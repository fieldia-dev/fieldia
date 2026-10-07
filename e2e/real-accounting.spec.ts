import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * The accounting lane's real pages — Sherkety ERP's invoice (account.move),
 * its Register Payment dialog and Sherkety's own expense — used by a person in
 * every framework's demo: a line added and the taxes, totals and journal
 * items following; the invoice confirmed and numbered; a payment registered
 * short, then in full; the payment dialog on its own, its difference and its
 * currency; the expense taken from draft to paid.
 */

const WIDE = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const value = (page: Page, name: string) => page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);
const toast = (page: Page, words: string | RegExp) => page.locator('.fd-say', { hasText: words });
const grid = (scope: Page | Locator, id: string) => scope.locator(`[data-node="${id}"]`);
const cell = (scope: Page | Locator, id: string, row: number, col: string) => grid(scope, id).locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${col}"]`);
const editor = (scope: Page | Locator, id: string) => grid(scope, id).locator('.ag-cell-inline-editing input, .ag-popup-editor input').first();
/** What a field shows a person: its words, and what its boxes hold. */
const shown = (scope: Page | Locator, id: string) =>
  scope.locator(`[data-node="${id}"]`).first().evaluate((el) => `${el.textContent} ${[...el.querySelectorAll('input')].map((input) => input.value).join(' ')}`);
/** The number box of a money field: the one that is not the currency's search. */
const amountBox = (scope: Locator, id: string) => scope.locator(`[data-node="${id}"] input:not([role="combobox"])`).first();

/**
 * Type into a cell and leave the grid by its tab's label: Enter on the last
 * line would start a new one, and Escape would take back a line just added.
 */
async function typeInCell(page: Page, gridId: string, row: number, col: string, text: string) {
  await cell(page, gridId, row, col).click();
  await expect(editor(page, gridId)).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press('Tab');
  await leaveGrid(page);
}
/** Click where nothing is edited — the notebook's selected tab — so the grid's editor closes and keeps what was typed. */
const leaveGrid = (page: Page) => page.locator('[role="tab"][aria-selected="true"]').first().click();

/** Pick a product on a new line of a grid, by typing part of its name. */
async function addLine(page: Page, gridId: string, row: number, typed: string, option: string) {
  await grid(page, gridId).getByRole('button', { name: '+ Add a line' }).click();
  await expect(editor(page, gridId)).toBeFocused();
  await page.keyboard.type(typed);
  await expect(grid(page, gridId).getByRole('option', { name: option })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(editor(page, gridId)).toHaveValue(option);
  await page.keyboard.press('Tab');
  await leaveGrid(page);
  await expect(cell(page, gridId, row, 'product_id')).toHaveText(option);
}

/** Open Register Payment from the record's header and wait for its defaults: the journal and the amount due. */
async function openPayment(page: Page) {
  await page.getByRole('button', { name: 'Register Payment', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Register Payment' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-node="f-journal"] input')).not.toHaveValue('');
  return dialog;
}

for (const variant of VARIANTS) {
  test.describe(`${variant} · real accounting`, () => {
    test('an invoice: a line added, the totals and journal items follow; confirmed, numbered, and paid in two payments', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-invoice&record=4101&skin=underline');
      await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
      await expect.poll(() => shown(page, 'f-amount-total')).toContain('58,117.20');
      // A draft has no number yet, and no Register Payment.
      await expect(page.getByRole('button', { name: 'Register Payment' })).toHaveCount(0);
      // One stat button shown: Sale Orders.
      await expect(page.locator('.fd-stats')).toBeVisible();

      // A desk added: its price comes from the product, and the taxes and totals follow.
      await addLine(page, 'f-invoice-lines', 6, 'desk', 'Office desk 140 × 70');
      await expect(cell(page, 'f-invoice-lines', 6, 'price_unit')).toHaveText('6,200.00');
      await expect(cell(page, 'f-invoice-lines', 6, 'tax_ids')).toHaveText('VAT 14%');
      await expect.poll(() => value(page, 'amount_total')).toBe(65185.2);
      await typeInCell(page, 'f-invoice-lines', 6, 'quantity', '2');
      await expect.poll(() => value(page, 'amount_untaxed')).toBe(63380);
      await expect.poll(() => value(page, 'amount_tax')).toBe(8873.2);
      await expect.poll(() => shown(page, 'f-amount-total')).toContain('72,253.20');
      if (variant === 'plain') await screen(page, 'real-invoice-line-added');

      // The journal items followed: the desk's income, the VAT, and the receivable for the whole, balanced.
      await page.getByRole('tab', { name: 'Journal Items' }).click();
      const totals = grid(page, 'f-journal-items').locator('.fd-grid-totals');
      await expect(totals).toContainText('72,253.20');
      const items = (await value(page, 'line_ids')) as { values: Record<string, unknown> }[];
      expect(items.find((l) => l.values['display_type'] === 'payment_term')?.values['debit']).toBe(72253.2);
      expect(items.filter((l) => l.values['display_type'] === 'tax').map((l) => l.values['credit'])).toEqual([8873.2]);
      if (variant === 'plain') await screen(page, 'real-invoice-journal-items');
      await page.getByRole('tab', { name: 'Invoice Lines' }).click();

      // Confirm: the number, the posted state, Register Payment, and the customer's outstanding credit.
      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
      await expect.poll(() => value(page, 'name')).toBe('INV/2026/00042');
      await expect(page.getByRole('textbox', { name: 'Number' })).toHaveValue('INV/2026/00042');
      await expect.poll(() => value(page, 'state')).toBe('posted');
      await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Posted');
      await expect(page.getByText('You have outstanding credits for this customer.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
      await expect.poll(() => shown(page, 'f-amount-residual')).toContain('72,253.20');

      // Register Payment, short: the difference shows, kept open.
      let dialog = await openPayment(page);
      await expect(amountBox(dialog, 'f-amount')).toHaveValue('72,253.20');
      await expect(dialog.locator('[data-node="f-payment-difference"]')).toBeHidden();
      await amountBox(dialog, 'f-amount').fill('50000');
      await amountBox(dialog, 'f-amount').press('Tab');
      await expect.poll(() => shown(dialog, 'f-payment-difference')).toContain('22,253.20');
      await expect(dialog.getByRole('radio', { name: 'Keep open' })).toBeChecked();
      // Marked as fully paid, it asks where the difference goes.
      await dialog.getByRole('radio', { name: 'Mark as fully paid' }).check();
      await expect(dialog.locator('[data-node="f-writeoff-account"]')).toBeVisible();
      await expect(dialog.locator('[data-node="f-writeoff-label"] input')).toHaveValue('Write-Off');
      if (variant === 'plain') await screen(page, 'real-invoice-payment-difference', { viewport: true });
      await dialog.getByRole('radio', { name: 'Keep open' }).check();
      await expect(dialog.locator('[data-node="f-writeoff-account"]')).toBeHidden();
      // Words said show over the dialog: the toasts sit above its backdrop.
      const layer = (selector: string) => page.locator(selector).first().evaluate((el) => Number(getComputedStyle(el).zIndex));
      expect(await layer('.fd-says')).toBeGreaterThan(await layer('.fd-dialog-backdrop'));
      // Its own footer, as Flectra's: Create Payment and Discard, with their keys.
      await expect(dialog.getByRole('button', { name: 'Save & Close' })).toHaveCount(0);
      await expect(dialog.getByRole('button', { name: 'Create Payment', exact: true })).toHaveAttribute('title', /Alt\+Q/i);
      await dialog.getByRole('button', { name: 'Create Payment', exact: true }).click();
      await expect(dialog).toBeHidden();
      // The dialog's own words, said as it saved, outlive it: the page under it says them.
      await expect(toast(page, /^Payment P\S+ of EGP 50,000\.00 posted/)).toBeVisible();
      await expect(toast(page, 'Payment of EGP 50,000.00 registered: EGP 22,253.20 left to pay')).toBeVisible();
      await expect.poll(() => value(page, 'payment_state')).toBe('partial');
      await expect.poll(() => value(page, 'amount_residual')).toBe(22253.2);
      await expect(page.locator('.fd-badge', { hasText: 'Partial' })).toBeVisible();
      await expect.poll(() => shown(page, 'f-payments')).toContain('50,000.00');

      // The rest: the dialog offers what is left, and paid, the ribbon says so.
      dialog = await openPayment(page);
      await expect(amountBox(dialog, 'f-amount')).toHaveValue('22,253.20');
      await dialog.getByRole('button', { name: 'Create Payment', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(toast(page, 'Payment of EGP 22,253.20 registered: paid in full')).toBeVisible();
      await expect.poll(() => value(page, 'payment_state')).toBe('paid');
      await expect(page.locator('.fd-ribbon', { hasText: 'Paid' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Register Payment' })).toHaveCount(0);
      await expect.poll(() => value(page, 'amount_residual')).toBe(0);
      // Saved: the data source holds the paid invoice.
      await expect
        .poll(() => page.evaluate(() => (window as any).fieldiaDemo.dataSource.records['account.move'][4101].payment_state))
        .toBe('paid');
      await screen(page, `real-invoice-paid-${variant}`);
      expect(problems).toEqual([]);
    });

    test('the same page as a bill, a USD invoice and a journal entry: what each type shows, and an unbalanced entry refused', async ({ page }) => {
      await page.setViewportSize(WIDE);
      // A vendor bill: Vendor and Bill Date, the possible duplicate, Set as Checked, an editable tax.
      const bill = await open(page, variant, 'page=real-invoice&record=4103&skin=underline');
      await expect(node(page, 'f-vendor')).toBeVisible();
      await expect(node(page, 'f-customer')).toBeHidden();
      await expect(node(page, 'f-bill-date')).toBeVisible();
      // Every stat button hidden by its condition: no empty row of them, as in Flectra.
      await expect(page.locator('.fd-stats')).toBeHidden();
      await expect(page.getByText('Warning: this bill might be a duplicate of one of those bills.')).toBeVisible();
      await page.getByRole('button', { name: 'Set as Checked', exact: true }).click();
      await expect(toast(page, 'Marked as checked')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Set as Checked', exact: true })).toHaveCount(0);
      // The vendor's own rounding: the tax typed, the total follows.
      await amountBox(page.locator('body'), 'f-amount-tax').fill('5488.50');
      await amountBox(page.locator('body'), 'f-amount-tax').press('Tab');
      await expect.poll(() => value(page, 'amount_total')).toBe(44688.5);
      if (variant === 'plain') await screen(page, 'real-bill');
      expect(bill.problems).toEqual([]);

      // A USD invoice partly paid: its rate, its total in EGP, its Currency Details, and Partial.
      const usd = await open(page, variant, 'page=real-invoice&record=4102&skin=underline');
      await expect(page.locator('.fd-badge', { hasText: 'Partial' })).toBeVisible();
      await expect.poll(() => shown(page, 'f-amount-total-base')).toContain('315,153.00');
      await expect(page.getByRole('tab', { name: 'Currency Details' })).toBeVisible();
      await expect.poll(() => shown(page, 'f-amount-residual')).toContain('3,498.00');
      if (variant === 'plain') await screen(page, 'real-invoice-usd');
      expect(usd.problems).toEqual([]);

      // A journal entry: no invoice lines, its items editable, Post refused while it does not balance.
      const entry = await open(page, variant, 'page=real-invoice&record=4104&skin=underline');
      await expect(page.getByRole('tab', { name: 'Invoice Lines' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeVisible();
      await expect(node(page, 'f-payment-terms')).toBeHidden();
      await typeInCell(page, 'f-journal-items', 1, 'credit', '80000');
      await page.getByRole('button', { name: 'Post', exact: true }).click();
      await expect(toast(page, 'The entry is not balanced.')).toBeVisible();
      await expect.poll(() => value(page, 'state')).toBe('draft');
      await typeInCell(page, 'f-journal-items', 1, 'credit', '85000');
      await page.getByRole('button', { name: 'Post', exact: true }).click();
      await expect.poll(() => value(page, 'name')).toBe('MISC/2026/10/0004');
      await expect(page.getByRole('button', { name: 'Reverse Entry', exact: true })).toBeVisible();
      if (variant === 'plain') await screen(page, 'real-journal-entry');
      expect(entry.problems).toEqual([]);
    });

    test('Register Payment on its own: the difference and its handling, another currency, a postdated check', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-register-payment&record=4101&skin=underline');
      const form = page.locator('.fd-form');
      await expect.poll(() => shown(page, 'f-payment-difference')).toContain('498.00');
      await expect(node(page, 'f-manual-rate')).toBeVisible();
      await page.getByRole('radio', { name: 'Mark as fully paid' }).check();
      await expect(node(page, 'f-writeoff-account')).toBeVisible();
      await expect(node(page, 'f-writeoff-label')).toBeVisible();
      // Not required, yet no "Clear selection" under the radio, as Flectra has none (clear: false).
      await expect(node(page, 'f-difference-handling').locator('.fd-choice-clear')).toBeHidden();
      // Payments skipped for untrusted banks: the counts inside the alert's sentence.
      await page.evaluate(() => (window as any).fieldiaDemo.handle.setValues({ untrusted_payments_count: 2, total_payments_amount: 5 }));
      await expect(page.getByText('2 out of 5 payments will be skipped due to untrusted bank accounts.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create Payments', exact: true })).toBeVisible();
      await page.evaluate(() => (window as any).fieldiaDemo.handle.setValues({ untrusted_payments_count: 0, total_payments_amount: 1 }));
      // The method's help behind a (?), not under the field.
      await expect(node(page, 'f-payment-method').locator('.fd-help-tip')).toBeAttached();
      if (variant === 'plain') await screen(page, 'real-register-payment');

      // Paid in EGP: the amount due worked out at the day's rate, the difference gone, and no manual rate.
      const currency = form.locator('[data-node="f-amount"] [role="combobox"]');
      await currency.click();
      await currency.fill('EGP');
      await page.getByRole('option', { name: 'EGP', exact: true }).click();
      await expect.poll(() => value(page, 'amount')).toBe(169653);
      await expect(node(page, 'f-payment-difference')).toBeHidden();
      await expect(node(page, 'f-manual-rate')).toBeHidden();

      // The EGP bank and a postdated check: its number and due date are asked for. Only bank and cash journals are offered (id in available_journal_ids).
      const journal = node(page, 'f-journal').getByRole('combobox');
      await journal.click();
      await journal.fill('');
      await expect(page.getByRole('option', { name: 'Customer Invoices', exact: true })).toHaveCount(0);
      await journal.fill('CIB');
      await page.getByRole('option', { name: 'Bank — CIB', exact: true }).click();
      await expect(node(page, 'f-bill-no')).toBeHidden();
      const methodBox = node(page, 'f-payment-method').getByRole('combobox');
      await methodBox.click();
      await methodBox.fill('Postdated');
      await page.getByRole('option', { name: 'Postdated Check', exact: true }).click();
      await expect(node(page, 'f-bill-no')).toBeVisible();
      await expect(node(page, 'f-check-due-date')).toBeVisible();
      await page.getByRole('button', { name: 'Create Payment', exact: true }).click();
      await expect(node(page, 'f-bill-no').locator('.fd-error')).toHaveText('Check / Bill Number is required');
      await node(page, 'f-bill-no').locator('input').fill('CHK-004417');
      await node(page, 'f-check-due-date').locator('input').fill('2026-11-15');
      await page.getByRole('button', { name: 'Create Payment', exact: true }).click();
      await expect(toast(page, /posted, check CHK-004417 due 2026-11-15/)).toBeVisible();
      await expectNoSidewaysScroll(page);
      expect(problems).toEqual([]);
    });

    test('an expense: the header cascades to its lines, then submitted, approved, posted and paid', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-expense&record=4101&skin=underline');
      await expect.poll(() => shown(page, 'f-total')).toContain('34,930.00');
      // Description over the title; the shared analytic as accounts and shares; Company only for several companies.
      await expect(page.locator('.fd-form').getByText('Description', { exact: true }).first()).toBeVisible();
      await expect(node(page, 'f-header-analytic')).toContainText('100%');
      await expect(node(page, 'f-company')).toBeHidden();
      await expect(node(page, 'f-currency')).toBeVisible();
      // The shared vendor goes to every line.
      await node(page, 'f-header-vendor').locator('input').fill('Hilton Riyadh');
      await node(page, 'f-header-vendor').locator('input').press('Tab');
      await expect(cell(page, 'f-lines', 0, 'vendor')).toHaveText('Hilton Riyadh');
      await expect(cell(page, 'f-lines', 3, 'vendor')).toHaveText('Hilton Riyadh');
      // A new line takes the header's taxes; its price includes the VAT, taken out of it.
      await grid(page, 'f-lines').getByRole('button', { name: '+ Add a line' }).click();
      await expect(editor(page, 'f-lines')).toBeFocused();
      await page.keyboard.type('Parking at the venue');
      await page.keyboard.press('Tab');
      await expect.poll(() => ((value(page, 'line_ids') as Promise<{ values: Record<string, unknown> }[]>).then((l) => l[4]?.values['vendor']))).toBe('Hilton Riyadh');
      await typeInCell(page, 'f-lines', 4, 'price_unit', '570');
      await expect.poll(() => value(page, 'total_amount')).toBe(35500);
      await expect.poll(() => value(page, 'tax_amount')).toBe(4227.02);
      await expect(cell(page, 'f-lines', 4, 'tax_ids')).toHaveText('VAT 14% (Purchases)');
      if (variant === 'plain') await screen(page, 'real-expense-draft');

      // Submit, Approve, Post: the status bar moves, the bill is made, the Entries button shows.
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(toast(page, 'Submitted to Dina Mahmoud')).toBeVisible();
      await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Submitted');
      await page.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Approved');
      await page.getByRole('button', { name: 'Post', exact: true }).click();
      await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Posted');
      await expect(toast(page, /BILL\/2026\/10\/0014 posted: EGP 35,500.00 to reimburse to Omar Hassan/)).toBeVisible();
      await expect(page.getByRole('button', { name: /Entries/ })).toContainText('1');
      await expect.poll(() => shown(page, 'f-residual')).toContain('35,500.00');

      // Register Payment pays the employee: in full, the Paid ribbon and the last step.
      const dialog = await openPayment(page);
      await expect(amountBox(dialog, 'f-amount')).toHaveValue('35,500.00');
      await expect.poll(() => shown(dialog, 'f-partner-bank')).toContain('Banque Misr');
      await dialog.getByRole('button', { name: 'Create Payment', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(toast(page, 'Omar Hassan is reimbursed in full')).toBeVisible();
      await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Paid');
      await expect(page.locator('.fd-ribbon', { hasText: 'Paid' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Register Payment' })).toHaveCount(0);
      await screen(page, `real-expense-paid-${variant}`);
      expect(problems).toEqual([]);
    });
  });
}

test('the invoice at a phone’s width: nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { problems } = await open(page, 'plain', 'page=real-invoice&record=4101&skin=underline');
  await expect.poll(() => shown(page, 'f-amount-total')).toContain('58,117.20');
  await expectNoSidewaysScroll(page);
  await screen(page, 'real-invoice-phone');
  expect(problems).toEqual([]);
});
