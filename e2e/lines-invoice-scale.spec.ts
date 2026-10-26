import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { asAPhone, countsOf } from './perf-counts';

/**
 * The draft invoice of 200 lines, the demos' own (`/plain/?page=real-invoice&record=4102&lines=200`, after Reset to
 * Draft), as the owner's walk of 0.35 typed in it: 140–210 ms a key on a desktop, 0.5–0.7 s with a CPU four times
 * slower, where the same invoice of 3 lines took 25–31 ms — in a line and in the header alike, as its app's server
 * works the invoice out again at every change, the payment reference's too. A key here costs what one of 3 lines does
 * (0.35.1), held by what is counted rather than timed: the DOM written (nodes, attributes and words; and the attributes
 * set, the same value or not), the record-sized JSON written out (each a copy or a comparison of the 200 lines), and
 * the form's own checks (`workCounts`). 0.35.0, the same keys, desktop: the header's 1,304 DOM writes (the 200 lines'
 * cards drawn again, out of sight) and 471 attributes set, 11 records written out (2 MB); a line's 1,342, 488 and 13.
 * Run with the counts at scale, in CI's perf job (every `*-scale.spec.ts`), on a desktop and a mid-range phone.
 */

test.skip(({ browserName }) => browserName !== 'chromium', 'the counts are Chromium’s (its trace)');
test.use({ trace: 'off' });

const PHONE = () => test.info().project.name === 'perf-phone';

/**
 * Upper bounds, measured on 0.35.1's build with a little room; a count that is 0 stays 0. The form's checks are those of
 * the same invoice of 3 lines, key for key (18 in the header, 98 in a line: its own cells, the journal items its change
 * moves, the totals); a phone runs the header's key, its lines drawn as cards (cards: narrow).
 */
const BUDGET: Record<string, Record<'desktop' | 'phone', Record<string, number>>> = {
  'a key in the header, 200 lines': { desktop: { mutations: 0, attributesSet: 0, recordsWritten: 2, checks: 20, scripts: 0 }, phone: { mutations: 0, attributesSet: 0, recordsWritten: 2, checks: 20, scripts: 0 } },
  // Its own cells and row — the grid's cells, its editor's box, its card — the totals under the lines, and the paging line's words.
  'a key in a line, 200 lines': { desktop: { mutations: 90, attributesSet: 40, recordsWritten: 2, checks: 100, scripts: 0 }, phone: { mutations: 90, attributesSet: 40, recordsWritten: 2, checks: 100, scripts: 0 } },
};

function hold(scenario: string, counts: Record<string, number>) {
  const profile = PHONE() ? 'phone' : 'desktop';
  const budget = BUDGET[scenario][profile];
  test.info().annotations.push({ type: 'counts', description: `${scenario} (${profile}): ${JSON.stringify(counts)}` });
  console.log(`${scenario} (${profile}): ${JSON.stringify(counts)}`);
  for (const [name, most] of Object.entries(budget)) expect.soft(counts[name], `${scenario}: ${name}`).toBeLessThanOrEqual(most);
}

/** Record-sized JSON written out (over 20 KB: the 200 lines, each a copy made or a comparison), and attributes set, as the page does them. */
const COUNTERS = () => {
  const counted = ((window as unknown as { __scale: Record<string, number> }).__scale = { recordsWritten: 0, attributesSet: 0 });
  const write = JSON.stringify;
  JSON.stringify = function (...args: Parameters<typeof JSON.stringify>) {
    const out = write.apply(this, args);
    if (typeof out === 'string' && out.length > 20_000) counted.recordsWritten++;
    return out;
  } as typeof JSON.stringify;
  const set = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (...args: Parameters<Element['setAttribute']>) {
    counted.attributesSet++;
    return set.apply(this, args);
  };
};

/** What `act` costs: the browser's counts under the form, the page's own counters and the form's work. */
async function costOf(page: Page, browser: import('@playwright/test').Browser, act: () => Promise<void>) {
  const read = () => page.evaluate(() => ({ ...(window as unknown as { __scale: Record<string, number> }).__scale, checks: (window as unknown as { fieldiaDemo: { workCounts: { checks: number } } }).fieldiaDemo.workCounts.checks }));
  const before = await read();
  // The answer of the invoice's server too, which works it out again (200 ms, as a server's).
  const counts = await countsOf(page, browser, async () => {
    await act();
    await page.waitForTimeout(600);
  }, '.fd-form');
  const after = await read();
  return { mutations: counts.mutations, scripts: counts.scripts, ...Object.fromEntries(Object.keys(after).map((name) => [name, after[name as keyof typeof after] - before[name as keyof typeof before]])) };
}

test('200 lines on the draft invoice: a key in the header writes nothing of the lines, a key in a line its own', async ({ page, browser }) => {
  test.setTimeout(180_000);
  if (PHONE()) await asAPhone(page);
  await page.addInitScript(COUNTERS);
  await page.goto('/plain/?page=real-invoice&record=4102&skin=underline&lines=200');
  await expect(page.locator('.fd-statusbar [aria-current="step"]').first()).toHaveText(/Posted/, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Reset to Draft' }).click();
  // Draft, as the server answered: its lines' boxes there to type in, the record's rules read again for every line once.
  await expect(page.locator('.fd-statusbar [aria-current="step"]').first()).toHaveText(/Draft/);
  const grid = page.locator('[data-node="f-invoice-lines"] .fd-grid-lines');
  const reference = page.locator('input[id$="f-payment-reference"]');
  await expect(reference).toBeEditable();
  await reference.click();
  await page.keyboard.press('End');
  // A few keys first, as a person types: what follows the reset done with.
  await page.keyboard.type(' pd', { delay: 150 });
  await page.waitForTimeout(800);
  hold('a key in the header, 200 lines', await costOf(page, browser, () => page.keyboard.type('a')));
  if (PHONE()) return;
  // The tenth line's Quantity, as the walk typed it.
  await grid.scrollIntoViewIfNeeded();
  await grid.locator('[role=row]').nth(10).locator('[role=gridcell][col-id="quantity"]').click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('41', { delay: 150 });
  await page.waitForTimeout(800);
  hold('a key in a line, 200 lines', await costOf(page, browser, () => page.keyboard.type('2')));
});
