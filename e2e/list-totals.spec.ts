import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * Lists that add up and filter by time, as a person uses them: the invoices
 * demo (shared/invoices.ts), its clock pinned to Wednesday 14 October 2026 so
 * its periods hold the same invoices every run. What each total should be is
 * worked out here from the demo's own records, never written down from the
 * screen: a sum that drifts from them fails.
 */

const NOW = 'now=2026-10-14T09:40';
const INVOICES = `page=invoices&skin=underline&${NOW}`;
const TODAY = '2026-10-14';

type Invoice = { name: string; partner_id: { label: string }; city: string; invoice_date: string; due_date: string; state: string; currency_id: { label: string }; amount: number };
const records = async (page: Page) => Object.values(await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records.invoice)) as Invoice[];

const rows = (page: Page) => page.locator('.fd-list-row');
const range = (page: Page) => page.locator('.fd-pager-text');
const totalRow = (page: Page) => page.locator('.fd-list-totals tr[data-total="all"]');
const tickedRow = (page: Page) => page.locator('.fd-list-totals tr[data-total="ticked"]');
const amountIn = (row: ReturnType<typeof totalRow>) => row.locator('td[data-field="amount"]');
const menu = (page: Page) => page.locator('.fd-search-panel');
const openMenu = async (page: Page) => {
  if (await menu(page).isHidden()) await page.getByRole('button', { name: 'Search options' }).click();
};
const chips = (page: Page) => page.locator('.fd-facet .fd-facet-text');
const headings = (page: Page) => page.locator('.fd-group-toggle');
/** An amount as written ("EGP 4,312,550.00", "EGP 812.5K") as a number, to the precision it is written in. */
const amountOf = (text: string) => {
  const found = /([\d,]+(?:\.\d+)?)\s*([KM])?/.exec(text.replace(/ /g, ' '));
  if (!found) return NaN;
  return Number(found[1].replace(/,/g, '')) * (found[2] === 'M' ? 1e6 : found[2] === 'K' ? 1e3 : 1);
};
const sum = (invoices: Invoice[]) => invoices.reduce((total, invoice) => total + invoice.amount, 0);
const money = (n: number) => `EGP ${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

test.describe('a list that adds up', () => {
  test('opens on this year’s invoices, their total under the Amount column', async ({ page }) => {
    const { problems } = await open(page, 'plain', INVOICES);
    const thisYear = (await records(page)).filter((invoice) => invoice.invoice_date.startsWith('2026'));
    await expect(chips(page)).toHaveText(['This year']);
    await expect(range(page)).toHaveText(`1–10 of ${thisYear.length} invoices`);
    await expect(totalRow(page).locator('th')).toHaveText('Total');
    // Every invoice of the year, not only the ten shown, in pounds alone.
    await expect(amountIn(totalRow(page))).toHaveText(money(sum(thisYear)));
    // Lined up under the amounts: the total's end on the column's end.
    const cell = (await rows(page).first().locator('td[data-col="amount"]').locator('bdi').boundingBox())!;
    const total = (await amountIn(totalRow(page)).locator('bdi').boundingBox())!;
    expect(Math.abs(cell.x + cell.width - (total.x + total.width)), 'the total is not lined up with the amounts').toBeLessThan(2);
    await expect(tickedRow(page)).toBeHidden();
    await expectNoSidewaysScroll(page);
    await screen(page, 'list-totals', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('adds up the rows ticked, over the total, while some are', async ({ page }) => {
    await open(page, 'plain', INVOICES);
    await expect(totalRow(page)).toBeVisible();
    const ticked: number[] = [];
    for (const n of [0, 2, 3]) {
      await rows(page).nth(n).getByRole('checkbox').check();
      ticked.push(amountOf((await rows(page).nth(n).locator('td[data-col="amount"]').textContent()) ?? ''));
    }
    await expect(tickedRow(page).locator('th')).toHaveText('3 selected');
    await expect(amountIn(tickedRow(page))).toHaveText(money(ticked.reduce((a, b) => a + b, 0)));
    await screen(page, 'list-totals-ticked', { viewport: true });
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(tickedRow(page)).toBeHidden();
  });

  test('gives no total over two currencies, and sums each city’s in its own', async ({ page }) => {
    await open(page, 'plain', INVOICES);
    const all = await records(page);
    await page.locator('.fd-facet', { hasText: 'This year' }).getByRole('button').click();
    await expect(range(page)).toHaveText(`1–10 of ${all.length} invoices`);
    // Pounds and dollars: no honest sum, and why in sight — a phone has no pointer to hover with — the sentence as its title.
    await expect(amountIn(totalRow(page))).toHaveText('Several currencies');
    await expect(amountIn(totalRow(page))).toHaveAttribute('title', 'In more than one currency: no total');
    await expect(amountIn(totalRow(page))).not.toContainText('EGP');
    await openMenu(page);
    await menu(page).getByRole('button', { name: 'City', exact: true }).click();
    await expect(chips(page)).toHaveText(['City']);
    const cities = ['Cairo', 'Alexandria', 'Giza', 'Mansoura', 'Dubai'].filter((city) => all.some((invoice) => invoice.city === city.toLowerCase()));
    await expect(headings(page)).toHaveCount(cities.length);
    for (const city of cities) {
      const theirs = all.filter((invoice) => invoice.city === city.toLowerCase());
      const heading = headings(page).filter({ hasText: new RegExp(`^${city} `) });
      const currency = city === 'Dubai' ? 'USD' : 'EGP';
      // In full, with its currency, as the totals row writes an amount: never rounded to "EGP 1.3M".
      await expect(heading).toContainText(`${city} (${theirs.length}) · ${money(sum(theirs)).replace('EGP', currency)}`);
      expect(amountOf((await heading.locator('.fd-group-sums').textContent()) ?? ''), `${city}'s sum`).toBe(sum(theirs));
    }
    await page.keyboard.press('Escape');
    await screen(page, 'list-totals-cities', { viewport: true });
  });
});

test.describe('a list that filters by time', () => {
  test('finds what is overdue, counted from today, and what is this month', async ({ page }) => {
    await open(page, 'plain', INVOICES);
    const all = await records(page);
    await page.locator('.fd-facet', { hasText: 'This year' }).getByRole('button').click();
    await openMenu(page);
    await menu(page).getByRole('button', { name: 'Overdue' }).click();
    const overdue = all.filter((invoice) => invoice.state === 'sent' && invoice.due_date < TODAY);
    expect(overdue.length, 'the demo has overdue invoices').toBeGreaterThan(1);
    await expect(range(page)).toHaveText(`1–${Math.min(10, overdue.length)} of ${overdue.length} invoices`);
    await expect(chips(page)).toHaveText(['Overdue']);
    // The owner's walk: overdue in pounds and dollars — why there is no total is said in the cell, not only on hover.
    await expect(amountIn(totalRow(page))).toHaveText('Several currencies');
    await expect(amountIn(totalRow(page))).toHaveAttribute('title', 'In more than one currency: no total');
    await page.keyboard.press('Escape');
    await screen(page, 'list-totals-overdue', { viewport: true });
    // Grouped by status, all of them Sent: that heading says it too.
    await openMenu(page);
    await menu(page).getByRole('button', { name: 'Status', exact: true }).click();
    await expect(headings(page)).toHaveText([`Sent (${overdue.length}) · Several currencies`]);
    await expect(headings(page).locator('.fd-group-sums')).toHaveAttribute('title', 'In more than one currency: no total');
    await page.keyboard.press('Escape');
    await screen(page, 'list-totals-overdue-by-status', { viewport: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await screen(page, 'list-totals-overdue-by-status-phone', { viewport: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    await openMenu(page);
    // Status, ticked: taken off again.
    await menu(page).getByRole('button', { name: /^✓ Status$/ }).click();
    await expect(chips(page)).toHaveText(['Overdue']);
    // Overdue off, This month on.
    await menu(page).getByRole('button', { name: 'Overdue' }).click();
    await menu(page).getByRole('button', { name: 'This month' }).click();
    const october = all.filter((invoice) => invoice.invoice_date >= '2026-10-01' && invoice.invoice_date <= TODAY);
    await expect(range(page)).toHaveText(`1–${Math.min(10, october.length)} of ${october.length} invoices`);
    await expect(amountIn(totalRow(page))).toHaveText(money(sum(october)));
  });

  test('takes a person’s own period of a date, and keeps it as a favourite', async ({ page }) => {
    await open(page, 'plain', INVOICES);
    const all = await records(page);
    await page.locator('.fd-facet', { hasText: 'This year' }).getByRole('button').click();
    await openMenu(page);
    await menu(page).getByRole('button', { name: 'Add a custom filter' }).click();
    await menu(page).getByRole('combobox', { name: 'Field' }).selectOption({ label: 'Invoice date' });
    await menu(page).getByRole('combobox', { name: 'Condition' }).selectOption({ label: 'in the period' });
    await menu(page).getByRole('combobox', { name: 'Value' }).selectOption({ label: 'Last 30 days' });
    await screen(page, 'list-totals-custom-period', { viewport: true });
    await menu(page).getByRole('button', { name: 'Apply' }).click();
    await expect(chips(page)).toHaveText(['Invoice date: Last 30 days']);
    const lately = all.filter((invoice) => invoice.invoice_date >= '2026-09-15' && invoice.invoice_date <= TODAY);
    await expect(range(page)).toHaveText(`1–${Math.min(10, lately.length)} of ${lately.length} invoices`);
    // Kept by name: the period, not the days it was today.
    await menu(page).getByRole('button', { name: 'Save current search' }).click();
    await menu(page).getByRole('textbox', { name: 'Name of the search' }).fill('Lately');
    await menu(page).getByRole('button', { name: 'Save', exact: true }).click();
    const kept = await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.includes('favourites:invoices'))?.[1] ?? '');
    expect(kept).toContain('"period":{"field":"invoice_date","is":"last30Days"}');
  });
});

test.describe('a Group By of a date, by its month, quarter or week', () => {
  test('heads each month in words, its count and its sum, and opens to its invoices', async ({ page }) => {
    await open(page, 'plain', INVOICES);
    const thisYear = (await records(page)).filter((invoice) => invoice.invoice_date.startsWith('2026'));
    await openMenu(page);
    const dates = menu(page).getByRole('group', { name: 'Invoice date' });
    await expect(dates.getByRole('button')).toHaveText(['Year', 'Quarter', 'Month', 'Week', 'Day']);
    await dates.getByRole('button', { name: 'Month' }).click();
    await expect(dates.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
    await expect(chips(page)).toHaveText(['This year', 'Invoice date: Month']);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October'];
    await expect(headings(page)).toHaveCount(months.length);
    for (const [i, month] of months.entries()) {
      const theirs = thisYear.filter((invoice) => Number(invoice.invoice_date.slice(5, 7)) === i + 1);
      await expect(headings(page).nth(i)).toContainText(`${month} 2026 (${theirs.length}) · ${money(sum(theirs))}`);
    }
    await page.keyboard.press('Escape');
    await screen(page, 'list-totals-months', { viewport: true });
    await headings(page).filter({ hasText: 'October 2026' }).click();
    const october = thisYear.filter((invoice) => invoice.invoice_date.startsWith('2026-10'));
    await expect(rows(page)).toHaveCount(october.length);
    await expect(rows(page).locator('td:nth-child(5)')).toHaveText(october.map(() => /Oct 2026$/));
    await screen(page, 'list-totals-october', { viewport: true });
  });

  test('heads a quarter and a week, the week from Saturday in Arabic', async ({ page }) => {
    await open(page, 'plain', INVOICES);
    await openMenu(page);
    const dates = menu(page).getByRole('group', { name: 'Invoice date' });
    await dates.getByRole('button', { name: 'Quarter' }).click();
    await expect(headings(page).first()).toContainText('Q1 2026 (');
    await expect(headings(page)).toHaveCount(4);
    await expect(headings(page).last()).toContainText('Q4 2026 (');

    await open(page, 'plain', `${INVOICES}&locale=ar&dir=rtl`);
    const thisYear = (await records(page)).filter((invoice) => invoice.invoice_date.startsWith('2026'));
    await page.locator('.fd-search-toggle').click();
    const arabic = page.locator('.fd-search-spans');
    await arabic.getByRole('button', { name: 'الأسبوع' }).click();
    // The last invoice's week runs from the Saturday on or before it, and is the ISO week holding most of its days.
    const last = thisYear.map((invoice) => invoice.invoice_date).sort().at(-1) as string;
    const saturday = new Date(`${last}T00:00:00Z`);
    saturday.setUTCDate(saturday.getUTCDate() - ((saturday.getUTCDay() + 1) % 7));
    const middle = new Date(saturday.getTime() + 3 * 86400000);
    middle.setUTCDate(middle.getUTCDate() + 4 - (middle.getUTCDay() || 7));
    const week = Math.ceil(((middle.getTime() - Date.UTC(middle.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
    const inIt = thisYear.filter((invoice) => invoice.invoice_date >= saturday.toISOString().slice(0, 10)).length;
    await expect(headings(page).last()).toContainText(`الأسبوع ${week}، 2026 (${inIt})`);
    await page.keyboard.press('Escape');
    await screen(page, 'list-totals-weeks-arabic', { viewport: true });
  });

  test('fits a phone: the totals under the table it scrolls in, nothing sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, 'plain', INVOICES);
    await expect(amountIn(totalRow(page))).toContainText('EGP');
    await expectNoSidewaysScroll(page);
    await screen(page, 'list-totals-phone', { viewport: true });
  });
});
