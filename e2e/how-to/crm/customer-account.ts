import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';
import { chips, closePanel } from './support';

type Link = { id: number; label: string };
type Invoice = { id: number; name: string; partner_id: Link; invoice_date: string; due_date: string; state: string; amount: number };
type Quotation = { id: number; name: string; partner_id: Link; date: string; state: string };
/** A customer's invoices as the demo's source keeps them, the latest first (the higher number first on one day). */
async function invoicesOf(demo: Hand['demo'], partner: number): Promise<Invoice[]> {
  const all = await demo<Record<string, Omit<Invoice, 'id'>>>('dataSource.records.invoice');
  return Object.entries(all)
    .map(([id, values]) => ({ id: Number(id), ...values }))
    .filter((invoice) => invoice.partner_id?.id === partner)
    .sort((a, b) => b.invoice_date.localeCompare(a.invoice_date) || b.name.localeCompare(a.name));
}
/** A customer's quotations the tab counts, the latest first: the lost left out, as its list does. */
async function quotationsOf(demo: Hand['demo'], partner: number): Promise<Quotation[]> {
  const all = await demo<Record<string, Omit<Quotation, 'id'>>>('dataSource.records.quotation');
  return Object.entries(all)
    .map(([id, values]) => ({ id: Number(id), ...values }))
    .filter((quotation) => quotation.partner_id?.id === partner && quotation.state !== 'lost')
    .sort((a, b) => b.date.localeCompare(a.date));
}
const egp = (n: number) => `EGP ${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The customer-account demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Under the details, Invoices says how many this',
      async run({ page, see, demo }) {
        const mine = await invoicesOf(demo, 1);
        const invoices = page.locator('[data-node="invoices"]');
        await see(invoices.locator('.fd-related-count')).toHaveText(String(mine.length));
        await see(invoices).toHaveAccessibleName(`Invoices, ${mine.length}`);
        await see(invoices.locator('.fd-list-row td:first-child')).toHaveText(mine.slice(0, 5).map((invoice) => invoice.name));
        await see(invoices.locator('.fd-pager-text')).toHaveText(`1–5 of ${mine.length} invoices`);
        await see(invoices.locator('.fd-list-totals tr[data-total="all"] td[data-field="amount"]')).toHaveText(egp(mine.reduce((sum, invoice) => sum + invoice.amount, 0)));
      },
    },
    {
      says: 'An invoice sent and past its due date is in',
      async run({ page, press, see, demo }) {
        const mine = await invoicesOf(demo, 1);
        const invoices = page.locator('[data-node="invoices"]');
        const today = new Date().toISOString().slice(0, 10);
        const late = mine.slice(0, 5).find((invoice) => invoice.state === 'sent' && invoice.due_date < today);
        expect(late, 'a sent invoice past its due date among the five').toBeTruthy();
        const lateRow = invoices.locator(`.fd-list-row[data-id="${late!.id}"]`);
        await see(lateRow).toHaveAttribute('data-tone', 'danger');
        // A draft in bold: the customer's drafts among the rows shown.
        const drafts = invoices.locator('.fd-list-row').filter({ has: page.locator('td[data-col="state"]', { hasText: /^Draft$/ }) });
        await see(drafts.first(), 'a draft invoice, in bold, among this customer’s').toHaveAttribute('data-bold', '');
        // Send a reminder on the sent one: the app given it alone, said in a note.
        await press(lateRow.getByRole('button', { name: 'Send a reminder' }));
        await expect.poll(() => demo<{ action: string; recordIds?: number[] }[]>('requests').then((requests) => requests.at(-1))).toEqual(expect.objectContaining({ action: 'send_reminder', recordIds: [late!.id] }));
        await see(page.locator('.fd-say')).toContainText(late!.name);
      },
    },
    {
      says: 'Press › beside the pager for the next five, or',
      async run({ page, press, type, see, demo }) {
        const mine = await invoicesOf(demo, 1);
        const invoices = page.locator('[data-node="invoices"]');
        await press(invoices.getByRole('button', { name: 'Next page' }));
        await see(invoices.locator('.fd-list-row td:first-child')).toHaveText(mine.slice(5, 10).map((invoice) => invoice.name));
        await see(invoices.locator('.fd-pager-text')).toHaveText(`6–${Math.min(10, mine.length)} of ${mine.length} invoices`);
        // Or the search: "paid", and its line for Status.
        await type(invoices.getByRole('combobox', { name: 'Search' }), 'paid');
        await press(page.getByRole('option', { name: 'Status: Paid' }));
        const paid = mine.filter((invoice) => invoice.state === 'paid');
        await see(invoices.locator('.fd-list-row td[data-col="state"]')).toHaveText(Array(Math.min(5, paid.length)).fill('Paid'));
        await see(invoices.locator('.fd-related-count')).toHaveText(String(mine.length));
        // The search taken off again by its ×: the customer's invoices, all of them.
        await press(invoices.locator('.fd-facet').getByRole('button', { name: /^Remove / }));
        await see(invoices.locator('.fd-pager-text')).toHaveText(`1–5 of ${mine.length} invoices`);
      },
    },
    {
      says: 'Click Amount’s header: the invoices in their',
      async run({ page, press, see, demo }) {
        const mine = await invoicesOf(demo, 1);
        const invoices = page.locator('[data-node="invoices"]');
        await press(invoices.locator('th[data-field="amount"] button'));
        await see(invoices.locator('th[data-field="amount"]')).toHaveAttribute('aria-sort', 'ascending');
        const smallest = [...mine].sort((a, b) => a.amount - b.amount);
        await see(invoices.locator('.fd-list-row td:first-child')).toHaveText(smallest.slice(0, 5).map((invoice) => invoice.name));
      },
    },
    {
      says: 'Press New invoice: a new invoice opens in a',
      async run({ page, press, type, see, demo }) {
        const before = (await invoicesOf(demo, 1)).length;
        const invoices = page.locator('[data-node="invoices"]');
        await press(invoices.getByRole('button', { name: 'New invoice' }));
        const dialog = page.getByRole('dialog');
        await see(dialog.locator('.fd-form-dialog-title')).toHaveText('New invoice');
        await see(dialog.locator('[data-node="f-partner"] input')).toHaveValue('Nile Traders');
        await type(dialog.locator('[data-node="#title"] textarea'), 'INV/2026/9999');
        await type(dialog.locator('[data-node="f-amount"] input'), '1250');
        await press(dialog.getByRole('button', { name: 'Save & Close' }));
        await see(dialog).toBeHidden();
        await see(invoices.locator('.fd-related-count')).toHaveText(String(before + 1));
        // The smallest amount of them, by the order Amount's header gave: first.
        await see(invoices.locator('.fd-list-row').first().locator('td').first()).toHaveText('INV/2026/9999');
      },
    },
    {
      says: 'Press View all invoices: the invoices list',
      async run({ page, press, see, seePage, demo }) {
        const mine = await invoicesOf(demo, 1);
        await press(page.locator('[data-node="invoices"]').getByRole('button', { name: 'View all invoices' }));
        await seePage().toHaveURL(/page=invoices&/);
        await see(page.locator('.fd-list-row').first()).toBeVisible();
        await see(chips(page)).toHaveText(['Customer: Nile Traders']);
        await see(page.locator('.fd-pager-text')).toHaveText(`1–${Math.min(10, mine.length)} of ${mine.length} invoices`);
        // Back: the browser's.
        await page.goBack();
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('Nile Traders');
      },
    },
    {
      says: 'The Quotations tab says how many quotations',
      async run({ page, press, see, demo }) {
        const tab = page.locator('[data-node="tab-quotations"]');
        const mine = await quotationsOf(demo, 1);
        await see(tab.locator('.fd-tab-count')).toHaveText(String(mine.length));
        await see(page.getByRole('tab', { name: `Quotations, ${mine.length}`, exact: true })).toHaveAttribute('aria-selected', 'false');
        await press(page.getByRole('tab', { name: `Quotations, ${mine.length}`, exact: true }));
        const quotations = page.locator('[data-node="quotations"]');
        await see(quotations.locator('.fd-list-row td:first-child')).toHaveText(mine.slice(0, 5).map((quotation) => quotation.name));
        await press(page.getByRole('button', { name: 'Next customer' }));
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('Amira Clinics');
        const next = await quotationsOf(demo, 20);
        const theirInvoices = await invoicesOf(demo, 20);
        await see(page.locator('[data-node="invoices"] .fd-related-count')).toHaveText(String(theirInvoices.length));
        await see(tab.locator('.fd-tab-count')).toHaveText(String(next.length));
        await see(tab).toHaveAccessibleName(`Quotations, ${next.length}`);
        await see(quotations.locator('.fd-list-row td:first-child')).toHaveText(next.slice(0, 5).map((quotation) => quotation.name));
      },
    },
    {
      says: 'Press ‹ for Nile Traders again, and click a',
      async run({ page, press, see, seePage, demo }) {
        const quotations = page.locator('[data-node="quotations"]');
        const mine = await quotationsOf(demo, 1);
        await press(page.getByRole('button', { name: 'Previous customer' }));
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('Nile Traders');
        if (!(await quotations.isVisible())) await press(page.getByRole('tab', { name: /^Quotations/ }));
        await press(quotations.locator('.fd-list-row').first());
        await seePage().toHaveURL(new RegExp(`[?&]page=quotation&record=${mine[0].id}(&|$)`));
        await see(page.getByRole('dialog')).toHaveCount(0);
        await see(page.locator('.dh-title')).toHaveText('A quotation');
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue(mine[0].name);
        await see(page.locator('[data-node="f-partner"] input')).toHaveValue('Nile Traders');
        await page.goBack();
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('Nile Traders');
        if (!(await quotations.isVisible())) await press(page.getByRole('tab', { name: /^Quotations/ }));
        await press(quotations.getByRole('button', { name: 'New quotation' }));
        await seePage().toHaveURL(/[?&]page=quotation&record=new&values=/);
        await see(page.locator('[data-node="f-partner"] input')).toHaveValue('Nile Traders');
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('');
      },
    },
    {
      says: 'Back, then Start a new customer: the lists',
      async run(hand) {
        const { page, press, see } = hand;
        // Back to the customer — the browser's Back — where the how-to is, then its link.
        await page.goBack();
        await see(page.locator('.dh-title')).toHaveText('A customer with its invoices and quotations');
        await hand.follow('Start a new customer');
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('');
        await closePanel(hand);
        const invoices = page.locator('[data-node="invoices"]');
        await see(invoices.locator('.fd-list-row')).toHaveCount(0);
        await see(invoices.getByText('Nothing here until this customer is saved.')).toBeVisible();
        await see(page.locator('[data-node="tab-quotations"] .fd-tab-count')).toBeHidden();
        await press(page.getByRole('tab', { name: 'Quotations', exact: true }));
        await see(page.locator('[data-node="quotations"]').getByText('Nothing here until this customer is saved.')).toBeVisible();
      },
    },
  ],
};
