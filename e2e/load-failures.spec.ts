import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Two failures as the owner's walk of 0.33.0 met them (walk-0.33, findings 2 and 3), in "Loading, as you like it", every
 * answer held until the test lets it go — never raced against a slow one:
 * - the next rows that could not come are said, with Retry, and stay said: the end of the list in sight asks nothing
 *   by itself until the person presses Retry (0.33 said it for one frame, then "Loading more…" again);
 * - a customer that could not be opened is named in its place, with Retry, and no other customer's values stand
 *   under it to be typed into (0.33 left the previous customer there, editable, under a line that named none).
 */

const go = async (page: Page, query: string) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(`/loading/?${query}`);
  return problems;
};
const pane = (page: Page, name: string) => page.locator(`section.ld-pane[aria-label="${name}"]`);
const records = (page: Page) => pane(page, 'Customers').locator('.fd-list-records');
const rows = (page: Page) => records(page).locator('.fd-list-row');
const customer = (page: Page) => pane(page, 'Customer').locator('.fd-content').first();
const nameBox = (page: Page) => pane(page, 'Customer').locator('[data-node="f-name"] input');
const demo = <T>(page: Page, script: string) => page.evaluate(`(() => { const d = window.fieldiaDemo; return ${script}; })()`) as Promise<T>;
const inert = (page: Page) => nameBox(page).evaluate((box) => !!box.closest('[inert]'));
/** The page's first answers let go, never the list's next rows, until its first twelve are in and its customer shown. */
const opened = async (page: Page) => {
  await expect
    .poll(async () => {
      await demo(page, "d.release((ask) => !(ask.member === 'list' && ask.request.offset > 0))");
      return (await rows(page).count()) === 12 && (await nameBox(page).inputValue()) === 'Nile Traders';
    }, { timeout: 15000 })
    .toBe(true);
};
/** How many answers of the list's next rows are held: each one an ask. */
const nextAsks = (page: Page) => demo<number>(page, "(() => { let n = 0; d.release((ask) => (ask.member === 'list' && ask.request.offset > 0 && n++, false)); return n; })()");

test.describe('a failure stays said, with Retry, and names what failed', () => {
  test('the next rows that could not come: said with Retry, never asked again by themselves until Retry', async ({ page }) => {
    const problems = await go(page, 'slow=0&hold=1');
    await opened(page);
    const end = records(page).locator('.fd-list-more-rows');
    await end.scrollIntoViewIfNeeded();
    await expect(end.locator('.fd-loader[data-way="row"]')).toHaveText('Loading more…');
    expect(await nextAsks(page)).toBe(1);
    // Its answer fails — that one alone let go, so the failure is its own.
    await demo(page, "(d.net.failNext = true, d.release((ask) => ask.member === 'list' && ask.request.offset > 0), 0)");
    const failed = end.locator('.fd-loader[data-way="failed"]');
    await expect(failed).toHaveText('Couldn’t load. The server did not answer this once. Retry');
    // In sight, left alone: still said, and nothing asked again (0.33 asked again within a frame).
    for (let look = 0; look < 6; look++) {
      await page.waitForTimeout(250);
      await expect(failed).toBeVisible();
      await expect(end.locator('.fd-loader[data-way="row"]')).toHaveCount(0);
      expect(await nextAsks(page)).toBe(0);
    }
    await expect(rows(page)).toHaveCount(12);
    // Retry asks again, once: the next twelve come.
    await failed.getByRole('button', { name: 'Retry' }).click();
    await expect(end.locator('.fd-loader[data-way="row"]')).toHaveText('Loading more…');
    expect(await nextAsks(page)).toBe(1);
    await demo(page, '(d.hold(false), 0)');
    await expect.poll(() => rows(page).count()).toBeGreaterThanOrEqual(24);
    await expect(rows(page).nth(12)).toContainText('Isis Pharma');
    expect(problems).toEqual([]);
  });

  test('a customer that could not be opened: named in its place with Retry, no other customer’s values under it', async ({ page }) => {
    const problems = await go(page, 'slow=0&hold=1');
    await opened(page);
    expect(await inert(page)).toBe(false);
    // Horus Foods opened from the list, its answer held: Nile Traders is no longer there to type into.
    await rows(page).filter({ hasText: 'Horus Foods' }).first().click();
    await expect(nameBox(page)).toHaveValue('');
    expect(await inert(page)).toBe(true);
    // Its answer fails (the customer's own load, asked first).
    await demo(page, "(d.net.failNext = true, d.release((ask) => ask.member === 'load'), 0)");
    const failed = customer(page).locator('.fd-loader[data-way="failed"]');
    await expect(failed).toHaveText('Couldn’t open customer 32: The server did not answer this once. Retry');
    await expect(failed).toHaveAttribute('role', 'alert');
    await expect(customer(page).getByRole('button', { name: 'Retry' })).toHaveCount(1);
    // Nothing of another customer under it, nothing to type into.
    await expect(nameBox(page)).toHaveValue('');
    expect(await inert(page)).toBe(true);
    await expect(pane(page, 'Customer')).not.toContainText('Nile Traders');
    // Retry opens it.
    await failed.getByRole('button', { name: 'Retry' }).click();
    await demo(page, '(d.hold(false), 0)');
    await expect(nameBox(page)).toHaveValue('Horus Foods');
    expect(await inert(page)).toBe(false);
    await expect(customer(page).locator('.fd-loader[data-way="failed"]')).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});
