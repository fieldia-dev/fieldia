import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';
import { mapReady, stubMaps } from './map-support';
import { asAPhone, countsOf, domCounters, mountGenerated, type Counts } from './perf-counts';
import { everyRowLoaded, longList } from './support';

/**
 * Fieldia at scale, held by what the browser counts rather than by a clock (0.35, the audit's M6): the layouts an action
 * runs and the objects they lay out, the style recalculations, the DOM written, the DOM kept and the scripts asked for —
 * none of which a slow or a busy runner changes — and the form's own work (`workCounts`: conditions read, values worked
 * out, fields checked, parts brought up to date). A form of 500 fields, a table of 200 lines, lists of 3,000 and 5,000
 * rows, a list's map as its rows are pointed at, a Gantt of 500 tasks; on a desktop and on a mid-range phone
 * (`perf-phone`: 412 px, 4× slower). Each count against a budget measured on 0.35's merged build with a little room.
 * Run alone, one worker, in CI's own perf job (every `*-scale.spec.ts`).
 */

test.skip(({ browserName }) => browserName !== 'chromium', 'the counts are Chromium’s (its trace, its DOM counters)');
test.use({ trace: 'off' });

const PHONE = () => test.info().project.name === 'perf-phone';

/**
 * The budgets, by scenario and by profile: upper bounds, each what 0.35's merged build counts (25 Oct: perf-bytes' gates,
 * perf-form's quick way, perf-lists' window and lines) with about 5% room; a count that is 0 stays 0. 0.34.1 counted, on
 * the same scenarios: a key in a form of 500 fields brought every part up to date (533 updaters, the conditions, values
 * and checks of the whole form), now 16; a key in a record's header rewrote every line of its table (1,600 changes for
 * 200 lines), now none; a list of 5,000 rows kept 100,511 nodes and 30,141 listeners, and a row ticked laid out 110,121
 * objects, now some 1,600 and 470, and 1,311; a key in a line of the 200 wrote 1,600 changes, now 4; six rows pointed
 * at moved Leaflet's pins 96 times (every pin, at each), now 12; a Gantt of 500 tasks put 4,101 elements in the page for
 * a change of scale and 8,799 for a bar dropped, now 91 and 31. What stays as it was: a key still lays the whole form out (4,920 objects: no section is contained —
 * perf-form's proposal, sections as paint layers, is not in 0.35).
 */
/** A scenario's counts: the browser's (`Counts`) and those it counts of its own. */
type Held = Partial<Counts> & Record<string, number>;
const BUDGET: Record<string, Record<'desktop' | 'phone', Held>> = {
  'a key in a field nothing reads, 500 fields': { desktop: { layouts: 2, layoutObjects: 5200, mutations: 0, scripts: 0 }, phone: { layouts: 2, layoutObjects: 5100, mutations: 0, scripts: 0 } },
  'a key in a field a rule reads, 500 fields': { desktop: { layouts: 2, layoutObjects: 5200, mutations: 0, scripts: 0 }, phone: { layouts: 2, layoutObjects: 5100, mutations: 0, scripts: 0 } },
  'the work of a key in a field nothing reads, 500 fields': { desktop: { conditions: 0, computes: 0, checks: 0, updaters: 17 }, phone: { conditions: 0, computes: 0, checks: 0, updaters: 17 } },
  'the work of a key in a field a rule reads, 500 fields': { desktop: { conditions: 1, computes: 0, checks: 0, updaters: 17 }, phone: { conditions: 1, computes: 0, checks: 0, updaters: 17 } },
  'a key in the header of a 200-line table': { desktop: { layouts: 2, layoutObjects: 6400, mutations: 0, scripts: 0 }, phone: { layouts: 2, layoutObjects: 8700, mutations: 0, scripts: 0 } },
  'a key in a line of a 200-line table': { desktop: { layouts: 2, layoutObjects: 6400, mutations: 5, scripts: 0 }, phone: { layouts: 2, layoutObjects: 8700, mutations: 5, scripts: 0 } },
  'a list of 5,000 rows drawn': { desktop: { nodes: 1700, listeners: 500, rowsInPage: 60 }, phone: { nodes: 2000, listeners: 590, rowsInPage: 75 } },
  'a row of 5,000 ticked': { desktop: { layouts: 2, layoutObjects: 1400, mutations: 6, scripts: 0 }, phone: { layouts: 2, layoutObjects: 1700, mutations: 6, scripts: 0 } },
  'a list of 3,000 rows, wherever the view is': { desktop: { rows: 66, elements: 1020 }, phone: { rows: 84, elements: 1250 } },
  'rows pointed at, one after the other, and away': { desktop: { markerMoves: 13 }, phone: { markerMoves: 13 } },
  'a change of scale, 500 tasks': { desktop: { added: 96 }, phone: { added: 96 } },
  'a bar dropped, 500 tasks': { desktop: { added: 33 }, phone: { added: 33 } },
};

/** Hold counts to the scenario's budget, saying all of them; and note them for the trend (test-results/perf). */
function hold(scenario: string, counts: Held) {
  const profile = PHONE() ? 'phone' : 'desktop';
  const budget = BUDGET[scenario][profile];
  test.info().annotations.push({ type: 'counts', description: `${scenario} (${profile}): ${JSON.stringify(counts)}` });
  console.log(`${scenario} (${profile}): ${JSON.stringify(counts)}`);
  for (const [name, most] of Object.entries(budget)) expect.soft(counts[name as keyof typeof counts], `${scenario}: ${name}`).toBeLessThanOrEqual(most as number);
}

test.beforeEach(async ({ page }) => {
  if (PHONE()) await asAPhone(page);
});

test('500 fields: a key writes and lays out what it changed, never the form', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await page.goto('/plain/?page=big&skin=outlined');
  await expect(page.locator('.fd-field[data-field]')).toHaveCount(500, { timeout: 60_000 });
  const quiet = page.locator('[data-node="f-s13-reference"] input');
  await quiet.click();
  await page.keyboard.type('ab');
  hold('a key in a field nothing reads, 500 fields', await countsOf(page, browser, () => page.keyboard.type('x'), '.fd-form'));
  const read = page.locator('[data-node="f-s01-name"] input');
  await read.click();
  await page.keyboard.type('Nile');
  await expect(page.locator('[data-node="f-s01-reference"]')).toBeVisible();
  hold('a key in a field a rule reads, 500 fields', await countsOf(page, browser, () => page.keyboard.type('x'), '.fd-form'));
});

/** A record with a header field and a table of `n` lines, three columns and a worked-out amount on each. */
function linesPage(n: number) {
  const values = { ref: 'PO-1', lines: Array.from({ length: n }, (_, i) => ({ key: `l${i + 1}`, id: i + 1, values: { item: `Item ${i + 1}`, qty: (i % 7) + 1, price: 10 + (i % 13) } })) };
  return {
    page: {
      fieldia: '0.13',
      id: 'order',
      title: 'Order',
      data: { kind: 'record', model: 'order' },
      fields: {
        ref: { type: 'char', label: 'Reference' },
        lines: { type: 'one2many', label: 'Lines', relation: 'order.line', fields: { item: { type: 'char', label: 'Item' }, qty: { type: 'integer', label: 'Qty' }, price: { type: 'float', label: 'Price' }, amount: { type: 'float', label: 'Amount', compute: 'qty * price' } } },
      },
      layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'f-ref', field: 'ref' }, { type: 'field', id: 'f-lines', field: 'lines' }] }] },
    },
    records: { order: { 1: values } },
    recordId: 1,
  };
}

test('200 lines: a key in the header writes no line', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await mountGenerated(page, linesPage(200));
  await expect(page.locator('#app .fd-lines-table tbody tr')).toHaveCount(200, { timeout: 60_000 });
  const ref = page.locator('#app [data-node="f-ref"] input');
  await ref.click();
  await page.keyboard.press('End');
  await page.keyboard.type('a');
  hold('a key in the header of a 200-line table', await countsOf(page, browser, () => page.keyboard.type('b'), '#app .fd-form'));
});

/** A list of `n` rows, five columns: past a page's 500, an endless list, every row loaded before it is counted. */
function listPage(n: number) {
  const people = Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { name: `Customer ${String(i + 1).padStart(4, '0')}`, email: `c${i + 1}@example.com`, city: ['Cairo', 'Giza', 'Luxor'][i % 3], credit: (i * 37) % 100000, visits: i % 50 }]));
  return {
    page: {
      fieldia: '0.13',
      id: 'people',
      title: 'Customers',
      data: { kind: 'record', model: 'person' },
      fields: { name: { type: 'char', label: 'Name' }, email: { type: 'char', label: 'Email' }, city: { type: 'char', label: 'City' }, credit: { type: 'monetary', label: 'Credit', currency: 'EGP' }, visits: { type: 'integer', label: 'Visits' } },
      layout: { type: 'list', id: 'people-list', columns: ['name', 'email', 'city', 'credit', 'visits'], ...longList(n) },
    },
    records: { person: people },
  };
}

test('5,000 rows: the DOM a list keeps, and a row ticked', async ({ page, browser }) => {
  test.setTimeout(300_000);
  await mountGenerated(page, listPage(5000));
  // Its rows counted, only those near the view in the page (0.35, list-window.ts): waited for by its count, every row
  // loaded as a person scrolling to its end loads them.
  await everyRowLoaded(page, 5000);
  await frames(page);
  await frames(page);
  hold('a list of 5,000 rows drawn', { ...(await domCounters(page)), rowsInPage: await page.locator('#app .fd-list-row').count() });
  const tick = page.locator('#app .fd-list-row').nth(2).locator('input[type="checkbox"]');
  hold('a row of 5,000 ticked', await countsOf(page, browser, () => tick.check(), '#app'));
});

/** Two frames: a list's window draws round the view at the frame after a scroll, the browser lays it out at the next. */
const frames = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

test('3,000 rows: the rows and elements in the page, at its top, its middle and its end', async ({ page }) => {
  test.setTimeout(180_000);
  await mountGenerated(page, listPage(3000));
  await everyRowLoaded(page, 3000);
  const inPage = () => page.evaluate(() => ({ rows: document.querySelectorAll('#app tbody tr.fd-list-row').length, elements: document.querySelectorAll('#app *').length }));
  const most = { rows: 0, elements: 0 };
  for (const at of [0, 0.5, 1]) {
    await page.evaluate((at) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * at), at);
    await frames(page);
    await frames(page);
    const now = await inPage();
    most.rows = Math.max(most.rows, now.rows);
    most.elements = Math.max(most.elements, now.elements);
  }
  hold('a list of 3,000 rows, wherever the view is', most);
});

/**
 * The form's own work for a key, as `workCounts` counts it (0.35, perf-form): the conditions read, the values worked
 * out, the fields checked and the parts brought up to date — on the 500-field page, in the one-tag script.
 */
async function workOf(page: Page, act: () => Promise<void>): Promise<Record<string, number>> {
  const read = () => page.evaluate(() => ({ ...(window as unknown as { Fieldia: { workCounts: Record<string, number> } }).Fieldia.workCounts }));
  const before = await read();
  await act();
  await frames(page);
  const after = await read();
  return Object.fromEntries(Object.keys(after).map((name) => [name, after[name] - before[name]]));
}

test('500 fields: a key works out only what reads it — its conditions, values, checks and parts', async ({ page }) => {
  test.setTimeout(180_000);
  const big = JSON.parse(readFileSync(join(__dirname, '../examples/pages/big.page.json'), 'utf8')) as Record<string, unknown>;
  await mountGenerated(page, { page: big });
  await expect(page.locator('#app .fd-field[data-field]')).toHaveCount(500, { timeout: 60_000 });
  const quiet = page.locator('#app [data-node="f-s13-reference"] input');
  await quiet.click();
  await page.keyboard.type('ab');
  hold('the work of a key in a field nothing reads, 500 fields', await workOf(page, () => page.keyboard.type('x')));
  const read = page.locator('#app [data-node="f-s01-name"] input');
  await read.click();
  await page.keyboard.type('Nile');
  hold('the work of a key in a field a rule reads, 500 fields', await workOf(page, () => page.keyboard.type('x')));
});

test('200 lines: a key in a line writes its own cells, no other line’s', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await mountGenerated(page, linesPage(200));
  await expect(page.locator('#app .fd-lines-table tbody tr')).toHaveCount(200, { timeout: 60_000 });
  const qty = page.locator('#app .fd-lines-table tbody tr').nth(100).locator('input').nth(1);
  await qty.click();
  await page.keyboard.press('End');
  await page.keyboard.type('1');
  hold('a key in a line of a 200-line table', await countsOf(page, browser, () => page.keyboard.type('2'), '#app .fd-lines-table tbody'));
});

test('a row pointed at lights its pin on the map: the pins it moves', async ({ page }) => {
  test.setTimeout(120_000);
  await stubMaps(page);
  await page.goto('/plain/?page=map-couriers&skin=outlined');
  // Its map beside its rows: the couriers open on their map alone.
  await page.locator('.fd-list-views').getByRole('button', { name: 'List and map', exact: true }).click();
  await mapReady(page.locator('.fd-map-list .fd-map-box'));
  const rows = page.locator('.fd-list-row');
  await expect(rows.first()).toBeVisible();
  // Each pin raised over the others or lowered back, as Leaflet's own call counts it (the page's Leaflet, `L`).
  await page.evaluate(() => {
    const w = window as unknown as { __moves: number; L: { Marker: { prototype: { setZIndexOffset(this: unknown, offset: number): unknown } } } };
    w.__moves = 0;
    const own = w.L.Marker.prototype.setZIndexOffset;
    w.L.Marker.prototype.setZIndexOffset = function (offset: number) {
      w.__moves++;
      return own.call(this, offset);
    };
  });
  const hovers = 6;
  for (let i = 0; i < hovers; i++) {
    await rows.nth(i).hover();
    await frames(page);
  }
  await page.mouse.move(1, 1);
  await frames(page);
  const moves = await page.evaluate(() => (window as unknown as { __moves: number }).__moves);
  hold('rows pointed at, one after the other, and away', { markerMoves: moves, pins: await page.locator('.fd-map-list .leaflet-marker-icon').count() });
});

/** The fit-out's plan grown to `n` tasks, each after the demo's own, drawn again: a Gantt of a bar for each with a day. */
async function ganttOf(page: Page, n: number) {
  await page.goto('/plain/?page=fitout-plan&skin=outlined&now=2026-10-14T09:40');
  await expect(page.locator('.fd-gantt-body')).not.toHaveAttribute('aria-busy', 'true');
  const placed = await page.evaluate((n) => {
    const w = window as unknown as { fieldiaDemo: { dataSource: { records: Record<string, Record<number, Record<string, unknown>>> }; handle: { reload(): Promise<void> } } };
    const tasks = w.fieldiaDemo.dataSource.records['cafe.task'];
    const own = Object.values(tasks).filter((task) => task['start']);
    for (let i = Object.keys(tasks).length + 1; i <= n; i++) {
      const like = own[i % own.length];
      const start = new Date(`${like['start'] as string}T00:00:00`);
      start.setDate(start.getDate() + (i % 40));
      tasks[i] = { ...like, name: `Task ${i}`, after: [], start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}` };
    }
    void w.fieldiaDemo.handle.reload();
    return Object.values(tasks).filter((task) => task['start']).length;
  }, n);
  expect(placed).toBeGreaterThan(n - 5);
  await expect(page.locator('.fd-gantt-task')).toHaveCount(placed, { timeout: 60_000 });
  await expect(page.locator('.fd-gantt-body')).not.toHaveAttribute('aria-busy', 'true');
}

/** Elements put in the Gantt while `act` ran, each with what it holds, and attributes written. */
async function ganttWrites(page: Page, act: () => Promise<void>) {
  await page.evaluate(() => {
    const w = window as unknown as { __writes: { added: number; attributes: number }; __watch?: MutationObserver };
    w.__writes = { added: 0, attributes: 0 };
    w.__watch?.disconnect();
    w.__watch = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'childList') for (const node of record.addedNodes) w.__writes.added += 1 + (node instanceof Element ? node.getElementsByTagName('*').length : 0);
        else w.__writes.attributes++;
      }
    });
    w.__watch.observe(document.querySelector('.fd-gantt') as Element, { subtree: true, childList: true, attributes: true });
  });
  await act();
  await frames(page);
  await expect(page.locator('.fd-gantt-task[aria-busy="true"]')).toHaveCount(0);
  return page.evaluate(() => {
    const w = window as unknown as { __writes: { added: number; attributes: number }; __watch?: MutationObserver };
    w.__watch?.disconnect();
    return w.__writes;
  });
}

test('500 tasks: a bar dropped and a change of scale write what changed, never the chart', async ({ page }) => {
  test.setTimeout(180_000);
  await ganttOf(page, 500);
  const zoom = (name: string) => page.locator('.fd-gantt-zooms').getByRole('button', { name, exact: true });
  const zoomed = await ganttWrites(page, () => zoom('Weeks').click());
  hold('a change of scale, 500 tasks', { added: zoomed.added });
  await zoom('Days').click();
  await expect(page.locator('.fd-gantt-body')).not.toHaveAttribute('aria-busy', 'true');
  const bar = page.locator('.fd-gantt-task').nth(3);
  await bar.scrollIntoViewIfNeeded();
  const box = (await bar.boundingBox())!;
  const dropped = await ganttWrites(page, async () => {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width / 2 + i * 10, box.y + box.height / 2);
    await page.mouse.up();
  });
  hold('a bar dropped, 500 tasks', { added: dropped.added });
});
