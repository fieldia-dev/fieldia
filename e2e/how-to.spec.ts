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

for (const area of AREAS as { id: string; label: string }[]) {
  test.describe(`${area.label}: the how-to by hand`, () => {
    for (const demo of DEMOS.filter((one: { id: string }) => areaOf(one.id) === area.id)) {
      test(`${demo.id}: ${demo.name}`, { tag: ['@how-to', `@${area.id}`] }, async ({ page, isMobile }, testInfo) => {
        const replay = REPLAYS[area.id][demo.id];
        test.skip(!replay, 'no replay yet: the test above names it');
        test.skip(isMobile && !!replay.notOnPhone, replay.notOnPhone);
        test.setTimeout(replay.timeout ?? 60_000);
        const problems: string[] = [];
        const allowed = (text: string) => (replay.allow ?? []).some((words) => words.test(text));
        page.on('console', (message) => {
          if (message.type() === 'error' && !allowed(message.text())) problems.push(`console: ${message.text()}`);
        });
        page.on('pageerror', (error) => {
          if (!allowed(error.message)) problems.push(`page error: ${error.message}`);
        });
        // A person, not a test browser: the frame draws its menu, its how-to panel and its code drawer.
        await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
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
      });
    }
  });
}
