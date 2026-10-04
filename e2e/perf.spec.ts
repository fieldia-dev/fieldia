import { appendFileSync, mkdirSync } from 'node:fs';
import { loadavg } from 'node:os';
import { expect, test, type Page } from '@playwright/test';

/**
 * How quick Fieldia stays on a page of 500 fields (examples/pages/big.page.json,
 * written by tools/big-page.mjs): the viewer filling it in, and the survey
 * editor and the screen editor, Simple and Advanced, editing it.
 *
 * Each timing is taken in the browser: the main thread's work from the
 * action's event, through its handlers, to the end of the paint that shows
 * what it did — a message sent from the next frame's requestAnimationFrame
 * arrives once that frame is painted. The wait between the handlers ending
 * and the screen's next frame is left out: it is no work, and up to a frame
 * long, so with it a keystroke could never fit in one. Long tasks are
 * watched with a PerformanceObserver, up to 400 ms after the paint, so work
 * put off for a moment shows too.
 *
 * Each action is timed 7 times and the median held to its budget. Timings
 * are noisy where other work shares the machine: FIELDIA_PERF_SLACK
 * multiplies every budget — 3 on CI unless set, 1 on a person's machine —
 * and CI times each action 5 times (FIELDIA_PERF_RUNS), to keep its run
 * short. Each run's numbers and the load average go to
 * test-results/perf/results.jsonl, marked with FIELDIA_PERF_LABEL.
 */

/** How many times each action is timed: 7 at most, the fields the drags and picks are scripted for. */
const RUNS = Math.min(7, Number(process.env['FIELDIA_PERF_RUNS'] ?? (process.env['CI'] ? 5 : 7)));
const SLACK = Number(process.env['FIELDIA_PERF_SLACK'] ?? (process.env['CI'] ? 3 : 1));
const LABEL = process.env['FIELDIA_PERF_LABEL'] ?? 'this build';

/** Milliseconds, before the slack. */
const BUDGET = {
  /** Mount until first paint. */
  viewerMount: 400,
  /** One frame. */
  viewerKey: 16,
  /** A choice that shows or hides fields, and a send refused: a click answered at once. */
  viewerClick: 100,
  /** A designer opening the page: mount until first paint. */
  designerOpen: 1000,
  designerKey: 50,
  designerPick: 100,
  /** Add, undo, a drop, a move by keyboard: one edit. */
  designerEdit: 100,
  /** Try it, JSON, Translations, Rules, the outline. */
  viewSwitch: 300,
};

interface Timing {
  work: number;
  total: number;
  longest: number;
}

declare global {
  interface Window {
    fieldiaPerf: { arm(type: string): void; result(): Promise<Timing> | null };
    fieldiaTimings?: Record<string, { work: number; total: number }>;
  }
}

/** The timer, in the page before anything else runs. */
function harness() {
  const longTasks: { start: number; end: number }[] = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push({ start: entry.startTime, end: entry.startTime + entry.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    // A browser that does not report long tasks: the timings still stand.
  }
  const afterMessage = (then: () => void) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = then;
    channel.port2.postMessage(null);
  };
  let pending: Promise<Timing> | null = null;
  window.fieldiaPerf = {
    arm(type) {
      pending = new Promise((resolve) => {
        const start = (): void => {
          const began = performance.now();
          // The handlers have run once a message sent now arrives, or once the frame begins, whichever is first.
          let handled: number | null = null;
          afterMessage(() => (handled ??= performance.now()));
          requestAnimationFrame(() => {
            const frame = performance.now();
            const done = Math.min(handled ?? frame, frame);
            afterMessage(() => {
              const painted = performance.now();
              setTimeout(() => {
                const longest = Math.max(0, ...longTasks.filter((t) => t.end > began && t.start < painted + 400).map((t) => t.end - t.start));
                resolve({ work: done - began + (painted - frame), total: painted - began, longest });
              }, 450);
            });
          });
        };
        addEventListener(type, start, { capture: true, once: true });
      });
    },
    result: () => pending,
  };
}

const results: { build: string; scenario: string; action: string; budget: number; median: number; runs: number[]; longest: number; load: number; at: string }[] = [];
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const round = (n: number) => Math.round(n * 10) / 10;

/** Time `act` 7 times, from its `trigger` event to the paint after it, and hold the median to the budget. */
async function timeIt(page: Page, scenario: string, action: string, budget: number, trigger: string, act: (run: number) => Promise<void>, between?: (run: number) => Promise<void>) {
  const runs: Timing[] = [];
  for (let run = 0; run < RUNS; run++) {
    await settle(page);
    await page.evaluate((type) => window.fieldiaPerf.arm(type), trigger);
    await act(run);
    runs.push(await page.evaluate(() => window.fieldiaPerf.result() as Promise<Timing>));
    await between?.(run);
  }
  record(scenario, action, budget, runs);
}

/** Note a timing, and hold its median to the budget, softly: the other timings are still taken. */
function record(scenario: string, action: string, budget: number, runs: Timing[]) {
  const work = runs.map((r) => round(r.work));
  const row = { build: LABEL, scenario, action, budget, median: median(work), runs: work, longest: round(Math.max(...runs.map((r) => r.longest))), load: round(loadavg()[0]), at: new Date().toISOString() };
  results.push(row);
  mkdirSync('test-results/perf', { recursive: true });
  appendFileSync('test-results/perf/results.jsonl', `${JSON.stringify(row)}\n`);
  expect.soft(row.median, `${scenario}: ${action} — runs ${work.join(', ')} ms`).toBeLessThanOrEqual(budget * SLACK);
}

/** Let what the last action put off finish, so it is not timed with the next. */
async function settle(page: Page) {
  await page.waitForTimeout(120);
  await page.evaluate(() => new Promise((resolve) => requestIdleCallback(resolve, { timeout: 1000 })));
}

/** Open a demo 7 times afresh and read how long it took to show the page. */
async function timeOpening(page: Page, scenario: string, url: string, name: string, budget: number) {
  const runs: Timing[] = [];
  for (let run = 0; run < RUNS; run++) {
    await page.goto(url);
    await page.waitForFunction((key) => window.fieldiaTimings?.[key] !== undefined, name);
    const timing = await page.evaluate((key) => window.fieldiaTimings?.[key] as { work: number; total: number }, name);
    runs.push({ ...timing, longest: 0 });
  }
  record(scenario, 'open the page', budget, runs);
}

// Tracing snapshots the page from inside it, at every step: on 500 fields, it would be most of what is timed.
test.use({ trace: 'off' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(harness);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test.afterAll(() => {
  if (!results.length) return;
  console.log(`\nTimings, median of ${RUNS} (ms, work to paint), slack ×${SLACK}`);
  for (const r of results) console.log(`${`${r.scenario}: ${r.action}`.padEnd(58)} ${String(r.median).padStart(7)}  budget ${String(r.budget).padStart(4)}  longest task ${r.longest}  load ${r.load}`);
});

test('the viewer fills in 500 fields without a frame dropped', async ({ page }) => {
  const scenario = 'viewer';
  const url = '/plain/?page=big&skin=outlined';
  test.setTimeout(180_000);
  await timeOpening(page, scenario, url, 'viewer', BUDGET.viewerMount);
  await expect(page.locator('.fd-field[data-field]')).toHaveCount(500);

  // Typing in a field a rule reads: the reference beside it shows once the company has a name.
  const name = page.locator('[data-node="f-s01-name"] input');
  await name.click();
  await page.keyboard.type('Nile');
  await expect(page.locator('[data-node="f-s01-reference"]')).toBeVisible();
  await timeIt(page, scenario, 'type in a field a rule reads', BUDGET.viewerKey, 'input', () => page.keyboard.type('x'));
  // Typing in a field a worked-out value reads.
  await page.locator('[data-node="f-s01-headcount"] input').fill('12');
  await page.locator('[data-node="f-s01-budget"] input').click();
  await timeIt(page, scenario, 'type in a number a total reads', BUDGET.viewerKey, 'input', () => page.keyboard.type('5'));
  // Typing in a field nothing reads.
  await page.locator('[data-node="f-s13-reference"] input').click();
  await timeIt(page, scenario, 'type in a field nothing reads', BUDGET.viewerKey, 'input', () => page.keyboard.type('x'));

  // One choice shows or hides ten addresses across the page.
  const type = page.locator('[data-node="f-supplier-type"]');
  await type.scrollIntoViewIfNeeded();
  await timeIt(page, scenario, 'choose: 10 fields show or hide', BUDGET.viewerClick, 'click', (run) => type.getByRole('radio', { name: run % 2 ? 'Local' : 'Foreign', exact: true }).click());
  await expect(page.locator('[data-node="f-s02-address"]')).toBeVisible();

  // Send with 24 required names empty: every field checked, the problems shown, the first one focused.
  const send = page.getByRole('button', { name: 'Submit', exact: true });
  await timeIt(page, scenario, 'send with errors', BUDGET.viewerClick, 'click', async () => {
    await send.scrollIntoViewIfNeeded();
    await send.click();
  });
  await expect(page.locator('.fd-error:not([hidden])')).toHaveCount(24);
  await page.screenshot({ path: 'test-results/screens/perf-viewer.png', fullPage: false });
});

/** The editors, and how each picks, types in, adds, drags and moves its fields. */
const EDITORS = [
  { scenario: 'survey editor', url: '/designer/?start=big', timing: 'designer', advanced: false },
  { scenario: 'screen editor, Simple', url: '/screen/?start=big', timing: 'screen', advanced: false },
  { scenario: 'screen editor, Advanced', url: '/screen/?start=big', timing: 'screen', advanced: true },
];

for (const editor of EDITORS) {
  test(`the ${editor.scenario} edits 500 fields at the speed of typing`, async ({ page }) => {
    test.setTimeout(240_000);
    const { scenario } = editor;
    const survey = editor.timing === 'designer';
    await page.addInitScript((advanced) => {
      try {
        localStorage.setItem('fieldia.designer.mode', advanced ? 'advanced' : 'simple');
      } catch {
        // No storage: Simple.
      }
    }, editor.advanced);
    await timeOpening(page, scenario, editor.url, editor.timing, BUDGET.designerOpen);
    const card = (id: string) => page.locator(survey ? `.fd-q[data-node="${id}"]` : `.fd-canvas-field[data-node="${id}"]`);
    const words = (id: string) => card(id).locator(survey ? '.fd-q-text' : '.fd-label');
    const label = () => page.locator(survey ? '.fd-q-selected .fd-q-label' : '.fd-canvas-field.fd-editing .fd-canvas-label-input');
    const selected = () => page.evaluate(() => (window as unknown as { fieldiaDesigner: { designer: { getState(): { selected: string | null } } } }).fieldiaDesigner.designer.getState().selected);
    await expect(card('f-s25-reference')).toHaveCount(1);
    await page.screenshot({ path: `test-results/screens/perf-${editor.timing}${editor.advanced ? '-advanced' : ''}.png`, fullPage: false });

    // Pick a field: a different one each time, the one before closing.
    const picks = ['f-s02-name', 'f-s02-code', 'f-s02-phone', 'f-s02-email', 'f-s03-name', 'f-s03-code', 'f-s03-phone'];
    await timeIt(page, scenario, 'pick a field', BUDGET.designerPick, 'click', async (run) => {
      await words(picks[run]).scrollIntoViewIfNeeded();
      await words(picks[run]).click();
    });
    expect(await selected()).toBe(picks[RUNS - 1]);

    // Type in its label.
    await label().click();
    await page.keyboard.press('End');
    await timeIt(page, scenario, 'type in a label', BUDGET.designerKey, 'input', () => page.keyboard.type('x'));
    await expect(label()).toHaveValue(new RegExp(`x{${RUNS}}`));

    // Add a field from the toolbox, after the one picked; then take each back.
    const tile = page.locator('.fd-toolbox [data-tool="kind:short-answer"]');
    await page.keyboard.press('Escape');
    await words('f-s03-name').click();
    await timeIt(page, scenario, 'add a field', BUDGET.designerEdit, 'click', async () => {
      await tile.scrollIntoViewIfNeeded();
      await tile.click();
    });
    await page.keyboard.press('Escape');
    const undo = page.locator('.fd-designer-bar').getByRole('button', { name: 'Undo', exact: true });
    await timeIt(page, scenario, 'undo', BUDGET.designerEdit, 'click', () => undo.click());

    // Drag the last field of one section to the top of the next, at hand speed; timed from the drop.
    const sectionOf = (id: string) =>
      page.evaluate((id) => {
        type Node = { id: string; children?: Node[] };
        const walk = (holder: Node): string | null => {
          for (const node of holder.children ?? []) {
            if (node.id === id) return holder.id;
            const deeper = walk(node);
            if (deeper) return deeper;
          }
          return null;
        };
        return walk((window as unknown as { fieldiaDesigner: { designer: { getPage(): { layout: Node } } } }).fieldiaDesigner.designer.getPage().layout);
      }, id);
    const from = survey ? 'page-02' : 'section-02';
    const to = survey ? 'page-03' : 'section-03';
    const firstOfNext = page.locator(survey ? '.fd-design-step[data-node="page-03"] .fd-q' : '.fd-canvas-section[data-node="section-03"] .fd-canvas-field').first();
    const moved = ['f-s02-reference', 'f-s02-address', 'f-s02-deadline', 'f-s02-rating', 'f-s02-categories', 'f-s02-contact', 'f-s02-notes'];
    await timeIt(page, scenario, 'drop a field in another section', BUDGET.designerEdit, 'pointerup', async (run) => {
      const grab = words(moved[run]);
      // The field carried in the middle of the window, clear of the bar; the next section's first field below it.
      await grab.evaluate((element) => element.scrollIntoView({ block: 'center' }));
      const start = (await grab.boundingBox())!;
      const at = { x: start.x + 10, y: start.y + start.height / 2 };
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      let now = at;
      // Head for the top of the next section's first field, looking again as the fields move aside.
      for (let look = 0; look < 4; look++) {
        const target = (await firstOfNext.boundingBox())!;
        const aim = { x: target.x + 12, y: target.y + 6 };
        const steps = Math.max(2, Math.ceil(Math.hypot(aim.x - now.x, aim.y - now.y) / 60));
        for (let i = 1; i <= steps; i++) await page.mouse.move(now.x + ((aim.x - now.x) * i) / steps, now.y + ((aim.y - now.y) * i) / steps);
        now = aim;
        await page.waitForTimeout(60);
      }
      await page.mouse.up();
    });
    for (const id of moved.slice(0, RUNS)) {
      // Advanced may put it beside a field, in a row of its own inside the section.
      if (editor.advanced) expect.soft(await sectionOf(id), `${id} is moved`).not.toBe(from);
      else expect.soft(await sectionOf(id), `${id} is moved`).toBe(to);
    }

    // The views over the page: each opened, and closed again by Design.
    const mode = (name: string) => page.locator(`.fd-designer-bar [data-mode="${name}"]`);
    const back = async () => {
      await mode('design').click();
      await expect(page.locator(survey ? '.fd-survey-body' : '.fd-screen-body')).toBeVisible();
    };
    for (const [name, words] of [['try', 'open Try it'], ['json', 'open JSON'], ['translations', 'open Translations'], ['rules', 'open the rules overview']] as const) {
      await timeIt(page, scenario, words, BUDGET.viewSwitch, 'click', () => mode(name).click(), back);
    }

    // Type in the JSON.
    await mode('json').click();
    const json = page.locator('.fd-json textarea');
    await json.evaluate((box: HTMLTextAreaElement) => {
      const at = box.value.indexOf('Supplier qualification file') + 'Supplier qualification file'.length;
      box.focus();
      box.setSelectionRange(at, at);
    });
    await timeIt(page, scenario, 'type in the JSON', BUDGET.designerKey, 'input', () => page.keyboard.type('x'));
    // Typed, not applied: going back asks first.
    await mode('design').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click();
    await expect(page.locator(survey ? '.fd-survey-body' : '.fd-screen-body')).toBeVisible();

    // Type a translation.
    await mode('translations').click();
    const cell = page.getByRole('textbox', { name: 'Arabic for “Company code”', exact: true });
    await cell.click();
    await page.keyboard.press('End');
    await timeIt(page, scenario, 'type a translation', BUDGET.designerKey, 'input', () => page.keyboard.type('x'));
    await expect(cell).toHaveValue(new RegExp(`x{${RUNS}}`));
    await back();

    // The outline: opened, and a row moved down by the keyboard.
    const outline = page.locator('.fd-rail [data-rail="outline"]');
    await timeIt(page, scenario, 'open the outline', BUDGET.viewSwitch, 'click', () => outline.click(), async () => {
      await page.locator('.fd-rail [data-rail="add"]').click();
    });
    await outline.click();
    const row = page.locator('.fd-outline [role="treeitem"][data-pick="f-s04-name"]');
    await row.scrollIntoViewIfNeeded();
    await row.focus();
    await timeIt(page, scenario, 'move a row down by the keyboard', BUDGET.designerEdit, 'keydown', () => page.keyboard.press('Alt+ArrowDown'));
    await expect(row).toBeFocused();
  });
}
