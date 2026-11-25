import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';
import { choose, printDialog } from './support';

/** An invoice of the invoices demo (demos/shared/invoices.ts), as its records hold it. */
type Invoice = { name: string; partner_id: { label: string }; city: string; invoice_date: string; due_date: string; state: string; currency_id: { label: string }; amount: number };

/** The demo's invoices: made month by month up to the reader's own day, so what each period holds is worked out from them. */
const invoicesOf = async ({ demo }: Hand) => Object.values(await demo<Record<string, Invoice>>('dataSource.records.invoice'));
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The day the demo is opened on: its clock is the reader's (no `now` in its address). */
const today = () => dayKey(new Date());

/** What the list's filters find, each as the demo's page defines it (examples/pages/invoices.page.json). */
const thisYear = (invoice: Invoice) => invoice.invoice_date.startsWith(today().slice(0, 4));
const thisMonth = (invoice: Invoice) => invoice.invoice_date.startsWith(today().slice(0, 7));
const lastMonth = (invoice: Invoice) => {
  const now = new Date();
  return invoice.invoice_date.startsWith(dayKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7));
};
const overdue = (invoice: Invoice) => invoice.state === 'sent' && invoice.due_date < today();
/** A filter's name as the menu says it with its count (`filterCounts`): "Overdue, 3 invoices". */
const counted = (words: string, n: number) => `${words}, ${n.toLocaleString('en')} ${n === 1 ? 'invoice' : 'invoices'}`;

/** An amount as the list writes one: its currency, then the number in full. */
const money = (amount: number, currency = 'EGP') => `${currency} ${amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A sum as a heading or a total writes it: in the one currency of them all, or none. */
const sumOf = (invoices: Invoice[]) => {
  const currencies = new Set(invoices.map((invoice) => invoice.currency_id.label));
  return currencies.size > 1 ? 'Several currencies' : money(invoices.reduce((total, invoice) => total + invoice.amount, 0), [...currencies][0] ?? 'EGP');
};

/** Words one after another, as cells side by side read: any space, or none, between them. */
const inRow = (...parts: string[]) => new RegExp(parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s')).join('\\s*'));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The invoices list's parts: its rows, its totals' rows, its groups' headings, the search's chips and its menu. */
const invoiceRows = (page: Page) => page.locator('.fd-list-row');
const totalRow = (page: Page) => page.locator('.fd-list-totals tr[data-total="all"]');
const tickedRow = (page: Page) => page.locator('.fd-list-totals tr[data-total="ticked"]');
const headings = (page: Page) => page.locator('.fd-group-toggle');
const chips = (page: Page) => page.locator('.fd-facet .fd-facet-text');
const menuOf = (page: Page) => page.locator('.fd-search-panel');

/** The menu at the end of the search box, opened (or closed) by its own button, as a person does on a desktop and on a phone. */
async function searchMenu({ page, press }: Hand, open: boolean) {
  if ((await menuOf(page).isVisible()) !== open) await press(page.getByRole('button', { name: 'Search options' }));
}

/** “Invoices that add up” (invoices): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'The list opens on This year: the total of this year’s invoices is under the Amount column.',
      async run(hand) {
        const { page, phone, see } = hand;
        await see(chips(page)).toHaveText(['This year']);
        const year = (await invoicesOf(hand)).filter(thisYear);
        await see(page.locator('.fd-pager-text')).toHaveText(`1–${Math.min(10, year.length)} of ${year.length} invoices`);
        // Every invoice of the year, not only the ten shown.
        await see(totalRow(page).locator('th')).toHaveText('Total');
        const amount = totalRow(page).locator('td[data-field="amount"]');
        await see(amount).toHaveText(sumOf(year));
        if (phone) {
          // No columns on a phone's cards: the total says what it adds up, and is in sight from the first screen.
          await see(amount).toHaveAttribute('data-label', 'Amount');
          await see(amount).toBeInViewport();
        } else {
          // Under the Amount column: its end on the column's end.
          const column = (await page.getByRole('columnheader', { name: 'Amount' }).boundingBox())!;
          const total = (await amount.boundingBox())!;
          expect(Math.abs(column.x + column.width - (total.x + total.width)), 'the total is not under the Amount column').toBeLessThan(2);
          await see(amount).toBeInViewport();
        }
      },
    },
    {
      says: 'Tick three invoices: a row over the total says “3 selected” and adds up those three.',
      async run({ page, press, see }) {
        await see(tickedRow(page)).toBeHidden();
        let sum = 0;
        for (const n of [0, 1, 2]) {
          const row = invoiceRows(page).nth(n);
          await press(row.getByRole('checkbox'));
          await see(row.getByRole('checkbox')).toBeChecked();
          sum += Number(/EGP\s([\d,]+\.\d\d)/.exec((await row.textContent()) ?? '')![1].replace(/,/g, ''));
        }
        await see(tickedRow(page).locator('th')).toHaveText('3 selected');
        await see(tickedRow(page).locator('td[data-field="amount"]')).toHaveText(money(sum));
        // Over the total.
        const ticked = (await tickedRow(page).boundingBox())!;
        const total = (await totalRow(page).boundingBox())!;
        expect(ticked.y + ticked.height, 'the row of the ticked is not over the total').toBeLessThanOrEqual(total.y + 1);
      },
    },
    {
      says: 'Open the menu at the end of the search box: each filter says how many invoices it finds, with This year on',
      async run(hand) {
        const { page, see } = hand;
        await searchMenu(hand, true);
        await see(menuOf(page)).toBeVisible();
        const filters = menuOf(page).getByRole('group', { name: 'Filters' });
        // Each counted as if it alone of its group were on, among the rest of the search: Overdue among this year's, each
        // period in This year's place.
        const all = await invoicesOf(hand);
        const year = all.filter(thisYear);
        await see(filters.getByRole('button', { name: counted('Overdue', year.filter(overdue).length), exact: true })).toBeVisible();
        await see(filters.getByRole('button', { name: counted('This month', all.filter(thisMonth).length), exact: true })).toBeVisible();
        await see(filters.getByRole('button', { name: counted('Last month', all.filter(lastMonth).length), exact: true })).toBeVisible();
        await see(filters.getByRole('button', { name: counted('This year', year.length), exact: true })).toHaveAttribute('aria-pressed', 'true');
        await searchMenu(hand, false);
      },
    },
    {
      says: 'Turn on Overdue: this year’s invoices sent and not paid',
      async run(hand) {
        const { page, press, see } = hand;
        await searchMenu(hand, true);
        await see(menuOf(page)).toBeVisible();
        const filters = menuOf(page).getByRole('group', { name: 'Filters' });
        // Overdue in a group of its own, the periods in another, a line between them.
        await see(filters.locator('.fd-search-option[data-filter], [role="separator"]')).toHaveText([/^Overdue/, '', /^This month/, /^Last month/, /^This year/]);
        await press(filters.getByRole('button', { name: /^Overdue,/ }));
        await see(filters.getByRole('button', { name: /^Overdue,/ })).toHaveAttribute('aria-pressed', 'true');
        await see(filters.getByRole('button', { name: /^This year,/ })).toHaveAttribute('aria-pressed', 'true');
        // The periods counted again, among this year's overdue invoices: This month's among them.
        const overdueAll = (await invoicesOf(hand)).filter(overdue);
        await see(filters.getByRole('button', { name: counted('This month', overdueAll.filter(thisMonth).length), exact: true })).toBeVisible();
        await searchMenu(hand, false);
        await see(chips(page)).toHaveText(['This year', 'Overdue']);
        // This year's invoices sent and not paid by their due date, counted from today: both hold, and no other. Early in
        // January none of this year's is a month old, and the list says it finds none.
        const late = (await invoicesOf(hand)).filter((invoice) => overdue(invoice) && thisYear(invoice));
        if (late.length) await see(page.locator('.fd-pager-text')).toHaveText(`1–${Math.min(10, late.length)} of ${late.length} invoices`);
        else await see(page.getByText('No invoices match.')).toBeVisible();
        await see(invoiceRows(page).filter({ hasNotText: 'Sent' })).toHaveCount(0);
      },
    },
    {
      says: 'Under Group By, press Month beside Invoice date: a heading for each month, its count and its sum',
      async run(hand) {
        const { page, press, see } = hand;
        await searchMenu(hand, true);
        const dates = menuOf(page).getByRole('group', { name: 'Invoice date' });
        await press(dates.getByRole('button', { name: 'Month' }));
        await see(dates.getByRole('button', { name: /Month$/ })).toHaveAttribute('aria-pressed', 'true');
        await searchMenu(hand, false);
        // A heading for each month of what the search finds — this year's overdue invoices — its count and its sum.
        const found = (await invoicesOf(hand)).filter((invoice) => overdue(invoice) && thisYear(invoice));
        const months = [...new Set(found.map((invoice) => invoice.invoice_date.slice(0, 7)))].sort();
        await see(headings(page)).toHaveText(
          months.map((month) => {
            const theirs = found.filter((invoice) => invoice.invoice_date.startsWith(month));
            return `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)} (${theirs.length}) · ${sumOf(theirs)}`;
          }),
        );
      },
    },
    {
      says: 'Turn Overdue, This year and Month off, and group by City: Dubai’s invoices are in dollars',
      async run(hand) {
        const { page, press, see } = hand;
        await searchMenu(hand, true);
        await press(menuOf(page).getByRole('group', { name: 'Filters' }).getByRole('button', { name: /^Overdue,/ }));
        await press(menuOf(page).getByRole('group', { name: 'Filters' }).getByRole('button', { name: /^This year,/ }));
        await see(menuOf(page).getByRole('group', { name: 'Filters' }).getByRole('button', { name: /^This year,/ })).toHaveAttribute('aria-pressed', 'false');
        const dates = menuOf(page).getByRole('group', { name: 'Invoice date' });
        await press(dates.getByRole('button', { name: /Month$/ }));
        await see(dates.getByRole('button', { name: /Month$/ })).toHaveAttribute('aria-pressed', 'false');
        await press(menuOf(page).getByRole('button', { name: 'City', exact: true }));
        await see(menuOf(page).getByRole('button', { name: /City$/ })).toHaveAttribute('aria-pressed', 'true');
        await searchMenu(hand, false);
        await see(chips(page)).toHaveText(['City']);
        // Every invoice, by city: Dubai's in dollars and summed in dollars; the list's total none.
        const all = await invoicesOf(hand);
        const dubai = all.filter((invoice) => invoice.city === 'dubai');
        expect(dubai.length, 'Dubai has invoices').toBeGreaterThan(0);
        await see(headings(page).filter({ hasText: /^Dubai \(/ })).toHaveText(`Dubai (${dubai.length}) · ${sumOf(dubai)}`);
        await see(headings(page).filter({ hasText: /^Dubai \(/ })).toContainText('USD');
        await see(totalRow(page).locator('td[data-field="amount"]')).toHaveText('Several currencies');
      },
    },
    {
      says: 'Type “cairo” in the search box and pick City: Cairo, group by Customer in place of City',
      async run(hand) {
        const { page, press, type, see } = hand;
        await type(page.getByRole('combobox', { name: 'Search' }), 'cairo');
        await press(page.getByRole('option', { name: 'City: Cairo' }));
        await see(chips(page).filter({ hasText: 'Cairo' })).toHaveCount(1);
        await searchMenu(hand, true);
        // City, grouped by since the step before, is pressed again to let it go ("✓ City" while it holds).
        await press(menuOf(page).getByRole('button', { name: /City$/ }));
        await press(menuOf(page).getByRole('button', { name: 'Customer', exact: true }));
        await see(menuOf(page).getByRole('button', { name: /City$/ })).toHaveAttribute('aria-pressed', 'false');
        await see(menuOf(page).getByRole('button', { name: /Customer$/ })).toHaveAttribute('aria-pressed', 'true');
        await searchMenu(hand, false);
        // What the search finds now: Cairo's invoices, of all fifteen months — more than a page.
        const found = (await invoicesOf(hand)).filter((invoice) => invoice.city === 'cairo');
        const print = await printDialog(page);
        await press(page.getByRole('button', { name: 'Print' }));
        const sheet = page.locator('.fd-print-sheet');
        await see(sheet).toHaveCount(1);
        await print.paper();
        await see(sheet).toBeVisible();
        // Over them, the filters in words and the day.
        // The day the browser prints on, read from its own clock.
        const printedOn = await page.evaluate(() => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }));
        await see(sheet.locator('.fd-print-when')).toHaveText(new RegExp(`^Printed ${printedOn}, \\d\\d:\\d\\d$`));
        await see(sheet.locator('.fd-print-about > div').first()).toHaveText(/^Filters: .*City.*Cairo/);
        await see(sheet.locator('.fd-print-about > div').nth(1)).toHaveText(/^Grouped by Customer$/);
        await see(sheet.locator('.fd-print-about > div').last()).toHaveText(`${found.length} invoices`);
        // Every one the search finds, not just the page's ten.
        expect(found.length, 'the search finds more than a page of invoices: “not just this page”').toBeGreaterThan(10);
        await see(sheet.locator('tbody tr:not(.fd-print-group)')).toHaveCount(found.length);
        // Under its customer, with its sum; the total under them.
        const customers = [...new Set(found.map((invoice) => invoice.partner_id.label))].sort();
        for (const customer of customers) {
          const theirs = found.filter((invoice) => invoice.partner_id.label === customer);
          await see(sheet.locator('tbody tr.fd-print-group').filter({ hasText: new RegExp(`^${customer} \\(`) })).toHaveText(inRow(`${customer} (${theirs.length})`, sumOf(theirs)));
        }
        await see(sheet.locator('tfoot tr')).toHaveText(inRow('Total', sumOf(found)));
        await print.closed();
        await see(sheet).toHaveCount(0);
      },
    },
    {
      says: 'Add a custom filter: Invoice date, in the period, Last 7 days. Save it as a favourite',
      async run(hand) {
        const { page, press, type, see } = hand;
        await searchMenu(hand, true);
        const panel = menuOf(page);
        await press(panel.getByRole('button', { name: 'Add a custom filter' }));
        await choose(hand, panel.getByRole('combobox', { name: 'Field' }), 'Invoice date');
        await see(panel.getByRole('combobox', { name: 'Field' }).locator('option:checked')).toHaveText('Invoice date');
        await choose(hand, panel.getByRole('combobox', { name: 'Condition' }), 'in the period');
        await see(panel.getByRole('combobox', { name: 'Condition' }).locator('option:checked')).toHaveText('in the period');
        await choose(hand, panel.getByRole('combobox', { name: 'Value' }), 'Last 7 days');
        await see(panel.getByRole('combobox', { name: 'Value' }).locator('option:checked')).toHaveText('Last 7 days');
        await press(panel.getByRole('button', { name: 'Apply' }));
        const period = chips(page).filter({ hasText: 'Invoice date: Last 7 days' });
        await see(period).toHaveCount(1);
        // Saved as a favourite, by its name.
        await searchMenu(hand, true);
        await press(panel.getByRole('button', { name: 'Save current search' }));
        await type(panel.getByRole('textbox', { name: 'Name of the search' }), 'Last seven days');
        await press(panel.getByRole('button', { name: 'Save', exact: true }));
        // Named with how many it finds, as the list counts its filters.
        const favourite = panel.getByRole('group', { name: 'Favourites' }).getByRole('button', { name: /^Last seven days(, \d[\d,]* invoices?)?$/ });
        await see(favourite).toBeVisible();
        // Kept as the period, not the days it is today: taken away and used again, it is the last seven days.
        const kept = await page.evaluate(() => Object.entries({ ...sessionStorage, ...localStorage }).find(([key]) => key.includes('favourites:invoices'))?.[1] ?? '');
        expect(kept, 'the favourite keeps its period, not today’s days').toContain('"period":{"field":"invoice_date","is":"last7Days"}');
        await searchMenu(hand, false);
        await press(page.getByRole('button', { name: 'Remove Invoice date: Last 7 days' }));
        await see(period).toHaveCount(0);
        await searchMenu(hand, true);
        await press(favourite);
        await see(period).toHaveCount(1);
        await searchMenu(hand, false);
      },
    },
  ],
};
