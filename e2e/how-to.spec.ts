import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { AREAS, DEMOS, areaOf, demoHref, stepText } from '../demos/catalog.mjs';
import { handFor } from './how-to/hand';
import { REPLAYS } from './how-to';

/**
 * Every demo's how-to — the "Try this" steps the catalogue gives each demo (demos/catalog.mjs), shown under its name
 * and in its panel — replayed by a person's hand (the audit's R-M13): the mouse and the keys in Chromium, a finger on
 * the phone in WebKit (the `how-to-phone` project), each step's visible result checked. The tests are made from the
 * catalogue: a demo added, or a step added, reworded or moved, has a test that fails until its replay is written
 * (e2e/how-to/<area>.ts) — no demo's how-to goes unreplayed in silence.
 *
 * A demo that runs in each framework is replayed in the plain one: the frameworks draw the same DOM, and every other
 * spec runs each of them. The demo is opened as a person opens it, its frame and all (navigator.webdriver hidden).
 */

/** How many characters of a step's words a replay names: enough that a step reworded or moved no longer matches. */
const SAYS = 24;

test.describe('every step of every how-to has its replay', () => {
  test('each demo’s replays follow its steps, word for word at their start, and name no demo or step there is not', () => {
    const problems: string[] = [];
    for (const demo of DEMOS) {
      const area = areaOf(demo.id);
      const replay = area ? REPLAYS[area]?.[demo.id] : undefined;
      const steps: string[] = (demo.howTo ?? []).map(stepText);
      if (!replay) {
        problems.push(`${demo.id}: its ${steps.length} steps have no replay — write them in e2e/how-to/${area ?? '<its area>'}.ts`);
        continue;
      }
      steps.forEach((step, i) => {
        const says = replay.steps[i]?.says;
        if (says === undefined) problems.push(`${demo.id}, step ${i + 1} ("${step.slice(0, 60)}…") has no replay`);
        else if (says.length < Math.min(SAYS, step.length) || !step.startsWith(says)) problems.push(`${demo.id}, step ${i + 1}: its replay says "${says}", the step "${step.slice(0, 60)}…"`);
      });
      if (replay.steps.length > steps.length) problems.push(`${demo.id}: ${replay.steps.length} replays for ${steps.length} steps`);
    }
    for (const [area, replays] of Object.entries(REPLAYS)) {
      for (const id of Object.keys(replays)) if (areaOf(id) !== area) problems.push(`e2e/how-to/${area}.ts replays ${id}, which is ${areaOf(id) ? `in ${areaOf(id)}` : 'no demo'}`);
    }
    expect(Object.keys(REPLAYS).sort()).toEqual(AREAS.map((a: { id: string }) => a.id).sort());
    expect(problems).toEqual([]);
  });
});

/**
 * This worker's clock moved to `to`, ticking on from there as the page's does after `page.clock.setSystemTime`: a replay
 * that counts a day from today (`new Date()`) counts it from the page's day. Gives back the way to put it back.
 */
function shiftClock(to: number): () => void {
  const Real = Date;
  const offset = to - Real.now();
  class Shifted extends Real {
    constructor(...given: unknown[]) {
      super(...((given.length ? given : [Real.now() + offset]) as [number]));
    }
    static override now() {
      return Real.now() + offset;
    }
  }
  globalThis.Date = Shifted as DateConstructor;
  return () => void (globalThis.Date = Real);
}
let restoreClock: (() => void) | null = null;
test.afterEach(() => {
  restoreClock?.();
  restoreClock = null;
});

type Demo = { id: string; name: string; howTo: unknown[] };

/**
 * A demo's how-to replayed by hand, its steps one by one, each checking what a person sees; on `day` where one is given
 * (or a run names one, FIELDIA_HOWTO_DAY: every replay on that day), the page's clock and the replay's on it alike.
 */
async function replayed(page: Page, isMobile: boolean, testInfo: TestInfo, area: string, demo: Demo, day = process.env['FIELDIA_HOWTO_DAY']) {
  const replay = REPLAYS[area][demo.id];
  test.skip(!replay, 'no replay yet: the test above names it');
  test.skip(isMobile && !!replay.notOnPhone, replay.notOnPhone);
  test.setTimeout(replay.timeout ?? 60_000);
  const problems: string[] = [];
  const allowed = (text: string) => (replay.allow ?? []).some((words) => words.test(text));
  page.on('console', (message) => {
    if (message.type() === 'error' && !allowed(message.text())) problems.push(`console: ${message.text()}`);
    // Every demo's page is one validatePage passes (0.36): its whole check, run after the draw, finds nothing.
    if (message.text().includes('(page.invalid;')) problems.push(`page.invalid: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    if (!allowed(error.message)) problems.push(`page error: ${error.message}`);
  });
  // A person, not a test browser: the frame draws its menu, its how-to panel and its code drawer.
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  // Another day than today: a demo that counts from today, and its replay, on that day — the page's clock and the
  // replay's alike (a replay that counts a day from today counts it from that one).
  if (day) {
    await page.clock.setSystemTime(new Date(day));
    restoreClock = shiftClock(Date.parse(day));
  }
  const address = `/${demoHref(demo)}`;
  await page.goto(replay.slower ? `${address}${address.includes('?') ? '&' : '?'}${replay.slower.query}` : address);
  await expect(page.locator('.dh-title')).toHaveText(demo.name);
  const { hand, seen } = handFor(page, isMobile);
  const steps: string[] = demo.howTo.map(stepText);
  for (const [i, step] of replay.steps.entries()) {
    await test.step(`${i + 1}. ${steps[i]}`, async () => {
      if (isMobile && step.notOnPhone) {
        testInfo.annotations.push({ type: 'not on the phone', description: `step ${i + 1}: ${step.notOnPhone}` });
        return;
      }
      const before = seen();
      await step.run(hand);
      expect(seen(), `step ${i + 1} checks nothing a person sees: check its result with hand.see`).toBeGreaterThan(before);
    });
  }
  expect(problems, 'the page’s console').toEqual([]);
}

for (const area of AREAS as { id: string; label: string }[]) {
  test.describe(`${area.label}: the how-to by hand`, () => {
    for (const demo of DEMOS.filter((one: { id: string }) => areaOf(one.id) === area.id)) {
      test(`${demo.id}: ${demo.name}`, { tag: ['@how-to', `@${area.id}`] }, async ({ page, isMobile }, testInfo) => replayed(page, isMobile, testInfo, area.id, demo));
    }
  });
}

/**
 * The demos that count from today — their records, their free times, a day's limits, an age — and whose replays read
 * them, replayed on other days too, in Chromium: a Saturday that ends a month, a year's last evening, February's last
 * day. A replay that wrote a day of its own ran out on the day after it (0.36: the time-off request on 28 Oct, the
 * lease's month on 1 Nov, the quote's "Needed by" on 16 Dec); one that did not page on at a month's end, or took
 * tomorrow in today's year, failed on those days. Every replay on any day: FIELDIA_HOWTO_DAY=2027-02-28T09:00:00.
 */
const DAYS = ['2026-10-31T10:00:00', '2026-12-31T21:00:00', '2027-02-28T09:00:00'];
const COUNTING_FROM_TODAY = ['real-time-off', 'template-leave-request', 'test-drive', 'test-drives', 'template-quote-request', 'template-appointment-booking', 'clinic-branch', 'visit-feedback', 'invoices', 'real-legal-case', 'listing', 'lease', 'kinds'];
test.describe('the how-to on other days', () => {
  for (const id of COUNTING_FROM_TODAY) {
    const demo = DEMOS.find((one: { id: string }) => one.id === id) as Demo;
    for (const day of DAYS) {
      test(`${id} on ${day.slice(0, 10)}`, { tag: ['@how-to', '@other-days'] }, async ({ page, isMobile }, testInfo) => {
        test.skip(testInfo.project.name !== 'chromium', 'on other days in Chromium alone: what counts from today is the same in each engine');
        await replayed(page, isMobile, testInfo, areaOf(id) as string, demo, day);
      });
    }
  }
  test('names demos the catalogue has', () => {
    expect(COUNTING_FROM_TODAY.filter((id) => !DEMOS.some((one: { id: string }) => one.id === id))).toEqual([]);
  });
});
