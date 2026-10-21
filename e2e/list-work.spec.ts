import { type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { expect, test } from './fixtures';
import { open, screen } from './support';

/**
 * Lists people work in all day, as they use them: the customers ordered by several headers (Shift and a press, or Shift
 * and Enter on a header). What each order should be is worked out here from the demo's own records, never written down
 * from the screen.
 */

type Values = Record<string, unknown>;
const CUSTOMERS = 'page=customers&skin=underline';
const NOW = 'now=2026-10-14T09:40';
const LEADS = `page=leads-queue&skin=underline&${NOW}`;

const names = (page: Page) => page.locator('.fd-list-row td:nth-child(2)');
const header = (page: Page, words: string) => page.locator('.fd-list-table thead th', { has: page.locator('.fd-list-head', { hasText: new RegExp(`^${words}$`) }) });
const records = async (page: Page, model: string) => Object.values(await page.evaluate((name) => (window as any).fieldiaDemo.dataSource.records[name], model)) as Values[];

/** Two values in a list's order, as a source sorts them: a link by its label, numbers by size, empty last whichever way. */
function compare(a: unknown, b: unknown, desc = false): number {
  const blank = (v: unknown) => v === null || v === undefined || v === '';
  if (blank(a) || blank(b)) return blank(a) === blank(b) ? 0 : blank(a) ? 1 : -1;
  const label = (v: unknown) => (typeof v === 'object' && v !== null && 'label' in v ? (v as { label: string }).label : v);
  const [x, y] = [label(a), label(b)];
  const result = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
  return desc ? -result : result;
}
const ordered = (rows: Values[], keys: { field: string; desc?: boolean }[]) =>
  [...rows].sort((a, b) => {
    for (const key of keys) {
      const by = compare(a[key.field], b[key.field], key.desc);
      if (by) return by;
    }
    return 0;
  });

test.describe('a list ordered by several headers', () => {
  test('adds a header with Shift and a press — or Shift and Enter — numbering each, and pages in that order', async ({ page }) => {
    const { problems } = await open(page, 'plain', CUSTOMERS);
    const customers = await records(page, 'partner');
    await header(page, 'Country').getByRole('button').click();
    await expect(header(page, 'Country')).toHaveAttribute('aria-sort', 'ascending');
    // Shift and a press adds Credit limit after Country; again, the other way.
    await header(page, 'Credit limit').getByRole('button').click({ modifiers: ['Shift'] });
    await header(page, 'Credit limit').getByRole('button').click({ modifiers: ['Shift'] });
    const keys = [{ field: 'country_id' }, { field: 'credit_limit', desc: true }, { field: 'name' }];
    const expected = ordered(customers, keys).map((one) => one['name'] as string);
    await expect(names(page)).toHaveText(expected.slice(0, 8));
    await expect(header(page, 'Country')).toHaveAttribute('aria-sort', 'ascending');
    await expect(header(page, 'Credit limit')).not.toHaveAttribute('aria-sort');
    await expect(header(page, 'Credit limit')).toHaveAttribute('data-sort', 'descending');
    await expect(header(page, 'Country').locator('.fd-list-sort-rank')).toHaveText('1');
    await expect(header(page, 'Credit limit').locator('.fd-list-sort-rank')).toHaveText('2');
    // A screen reader hears each key's place after its header's name.
    await expect(header(page, 'Credit limit').getByRole('button')).toHaveAccessibleName('Credit limit sorted 2 of 2, descending');
    await screen(page, 'list-work-sort', { viewport: true });
    expect(await axeFindings(page, 'a list ordered by two headers')).toEqual([]);
    // The next page in the same order.
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(names(page)).toHaveText(expected.slice(8));
    // Shift and Enter on a header, from the keyboard: Status joins as the third.
    await header(page, 'Status').getByRole('button').focus();
    await page.keyboard.press('Shift+Enter');
    await expect(header(page, 'Status').locator('.fd-list-sort-rank')).toHaveText('3');
    await expect(header(page, 'Status').getByRole('button')).toHaveAccessibleName('Status sorted 3 of 3, ascending');
    // A plain press: that header alone, the numbers gone.
    await header(page, 'Name').getByRole('button').click();
    await expect(page.locator('.fd-list-sort-rank')).toHaveCount(0);
    await expect(names(page).first()).toHaveText(ordered(customers, [{ field: 'name' }])[0]['name'] as string);
    expect(problems).toEqual([]);
  });

  test('numbers its keys on a phone’s chips too', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await open(page, 'plain', `${LEADS}`);
    await expect(page.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
    await header(page, 'Agent').getByRole('button').click();
    await header(page, 'Budget').getByRole('button').click({ modifiers: ['Shift'] });
    await expect(header(page, 'Budget').locator('.fd-list-sort-rank')).toHaveText('2');
    await expect(header(page, 'Budget').locator('.fd-list-sort-rank')).toBeVisible();
    await screen(page, 'list-work-sort-phone', { viewport: true });
  });
});
