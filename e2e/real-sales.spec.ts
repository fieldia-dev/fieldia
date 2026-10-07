import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * Sherkety ERP's sales screens, rebuilt from Flectra's views (demos/real/):
 * the sales order, the Create invoices dialog it opens, the product and the
 * B2B contract — each opened in every framework's demo and used as a person
 * would: a status button that moves the record, a line changed and the totals
 * following, a condition that shows or hides a field or a tab, a dialog opened
 * from its button and saved.
 */

const WIDE = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const ORDER = 'page=real-sale-order&record=7101&skin=underline';
const CONFIRMED = 'page=real-sale-order&record=7102&skin=underline';
const WIZARD = 'page=real-sale-invoice-wizard&record=7701&skin=outlined';
const PRODUCT = 'page=real-product&record=7301&skin=underline';
const CONTRACT = 'page=real-sale-contract&record=7601&skin=underline';

const value = (page: Page, name: string) => page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);
const toast = (page: Page, words: string | RegExp) => page.locator('.fd-say', { hasText: words });
const button = (page: Page, id: string) => page.locator(`button[data-node="${id}"]`);
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const cell = (page: Page, grid: string, row: number, col: string) => node(page, grid).locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${col}"]`);

/** Type into a link's box and pick the option named, with the keys. */
async function pick(page: Page, id: string, typed: string, option: string) {
  const box = node(page, id).getByRole('combobox');
  await box.click();
  await box.fill(typed);
  await expect(node(page, id).getByRole('option', { name: option, exact: true })).toBeVisible();
  while ((await box.getAttribute('aria-activedescendant')) === null || !(await page.locator(`#${await box.getAttribute('aria-activedescendant')}`).textContent())?.includes(option)) {
    await box.press('ArrowDown');
  }
  await box.press('Enter');
  await expect(box).toHaveValue(option);
}

for (const variant of VARIANTS) {
  test.describe(`${variant} · real sales pages`, () => {
    test('sales order: a line changed and the totals follow, a new customer’s credit warning, then sent and confirmed', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, ORDER);
      await expect(node(page, 'f-partner').getByRole('combobox')).toHaveValue('Dar El Shifa Hospital');
      await expect(cell(page, 'f-order-line', 1, 'price_subtotal')).toContainText('171,000.00');
      expect(await value(page, 'amount_total')).toBe(329973);
      // A quotation: Send by Email and Confirm, no Create Invoice, no stat buttons, Expiration and not Order Date.
      await expect(button(page, 'send_by_email_primary')).toBeVisible();
      await expect(button(page, 'action_confirm_draft')).toBeVisible();
      await expect(button(page, 'create_invoice')).toBeHidden();
      await expect(node(page, 'f-validity')).toBeVisible();
      await expect(node(page, 'f-date-order')).toBeHidden();
      // The grid's add buttons in the page's words, as Flectra's.
      await expect(node(page, 'f-order-line').locator('.fd-lines-add')).toHaveText(['+ Add a product', '+ Add a section', '+ Add a note']);
      if (variant === 'plain') await screen(page, 'real-sale-order');

      // Four monitors become five: the line's Tax excl. and the order's totals follow, worked out by the server's rules.
      await cell(page, 'f-order-line', 1, 'product_uom_qty').click();
      await page.keyboard.type('5');
      await page.keyboard.press('Enter');
      await expect(cell(page, 'f-order-line', 1, 'price_subtotal')).toContainText('213,750.00');
      await expect.poll(() => value(page, 'amount_untaxed')).toBe(332200);
      await expect.poll(() => value(page, 'amount_total')).toBe(378708);

      // Another customer: the addresses and terms follow, and Delta Care Clinics is over its credit limit.
      const warning = page.getByText('This customer is over the credit limit');
      await expect(warning).toBeHidden();
      await pick(page, 'f-partner', 'delta', 'Delta Care Clinics');
      await expect(warning).toBeVisible();
      await expect.poll(() => value(page, 'payment_term_id')).toEqual({ id: 7141, label: 'Immediate Payment' });
      await expect(node(page, 'f-partner-invoice').getByRole('combobox')).toHaveValue('Delta Care Clinics');

      // Sent by email: Quotation Sent. Confirmed: a sales order, the Delivery stat button, the order date in Expiration's place.
      await button(page, 'send_by_email_primary').click();
      await expect(toast(page, 'Quotation S00071 emailed to Delta Care Clinics.')).toBeVisible();
      await expect.poll(() => value(page, 'state')).toBe('sent');
      await expect(button(page, 'action_confirm')).toBeVisible();
      await expect(button(page, 'action_confirm_draft')).toBeHidden();
      await button(page, 'action_confirm').click();
      await expect(toast(page, /S00071 confirmed/)).toBeVisible();
      await expect.poll(() => value(page, 'state')).toBe('sale');
      await expect(warning).toBeHidden();
      await expect(node(page, 'f-validity')).toBeHidden();
      await expect(node(page, 'f-date-order')).toBeVisible();
      await expect(button(page, 'action_view_delivery')).toBeVisible();
      await expect(button(page, 'action_lock')).toBeVisible();
      await expect(tab(page, 'Optional Products')).toBeHidden();
      expect(await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records['sale.order'][7101].state)).toBe('sale');

      // Other Info: the delivery status shows once the order is confirmed.
      await tab(page, 'Other Info').click();
      await expect(node(page, 'f-delivery-status')).toBeVisible();
      await expect(node(page, 'f-picking-policy')).toBeVisible();
      if (variant === 'plain') await screen(page, 'real-sale-order-confirmed-other-info');
      expect(problems).toEqual([]);
    });

    test('sales order: Create Invoice opens the Create invoices dialog, and a down payment is invoiced', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, CONFIRMED);
      await expect(button(page, 'create_invoice')).toBeVisible();
      await expect(button(page, 'action_view_invoice')).toBeVisible();
      await button(page, 'create_invoice').click();
      const dialog = page.getByRole('dialog', { name: 'Create invoices' });
      await expect(dialog).toBeVisible();
      // One order: the choice shows, the count does not; the down payment already invoiced shows under it.
      await expect(dialog.getByRole('radio', { name: 'Regular invoice' })).toBeChecked();
      await expect(dialog.locator('[data-node="f-count"]')).toBeHidden();
      await expect(dialog.locator('[data-node="f-amount-to-invoice"] input')).toHaveValue(/337,650\.00/);
      await dialog.getByRole('radio', { name: 'Down payment (percentage)' }).check();
      const amount = dialog.locator('[data-node="f-amount"] input');
      await expect(amount).toBeVisible();
      // The company's down payment product is known, so its income account is not asked.
      await expect(dialog.locator('[data-node="f-deposit-account"]')).toBeHidden();
      await amount.fill('10');
      if (variant === 'plain') await screen(page, 'real-sale-invoice-wizard-in-order', { viewport: true });
      await dialog.getByRole('button', { name: 'Save & Close' }).click();
      await expect(dialog).toBeHidden();
      await expect(toast(page, 'Draft down payment invoice INV/2026/00118 created for E£36,765.00.')).toBeVisible();
      await expect.poll(() => value(page, 'invoice_count')).toBe(2);
      await expect.poll(() => value(page, 'amount_invoiced')).toBe(66765);
      expect(problems).toEqual([]);
    });

    test('Create invoices on its own: the down payment’s fields follow the choice, a warning over what is left, three orders at once', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, WIZARD);
      await expect(page.getByText('There are existing Draft Invoices for this Sale Order.')).toBeVisible();
      await expect(node(page, 'f-amount')).toBeHidden();
      await page.getByRole('radio', { name: 'Down payment (percentage)' }).check();
      await expect(node(page, 'f-amount')).toBeVisible();
      await expect(page.getByText('The new invoice will deduct draft invoices linked to this sale order.')).toBeHidden();
      // 95% of the order is more than is left to invoice: a warning, not an error.
      await node(page, 'f-amount').locator('input').fill('95');
      await node(page, 'f-amount').locator('input').blur();
      await expect(node(page, 'f-amount').locator('.fd-warning')).toContainText('The Down Payment is greater than the amount remaining to be invoiced.');
      await expect.poll(() => value(page, 'display_invoice_amount_warning')).toBe(true);
      if (variant === 'plain') await screen(page, 'real-sale-invoice-wizard');
      // The fixed amount takes its place, and is required.
      await page.getByRole('radio', { name: 'Down payment (fixed amount)' }).check();
      await expect(node(page, 'f-amount')).toBeHidden();
      await expect(node(page, 'f-fixed-amount')).toBeVisible();
      await expect(node(page, 'f-fixed-amount').locator('.fd-required, [aria-required="true"]').first()).toBeAttached();
      // Opened for three orders: the count and Consolidated Billing, and no choice of a down payment.
      await page.goto(`/${variant}/?page=real-sale-invoice-wizard&record=7702&skin=outlined`);
      await expect(node(page, 'f-count').locator('input')).toHaveValue('3');
      await expect(node(page, 'f-consolidated')).toBeVisible();
      await expect(node(page, 'f-method')).toBeHidden();
      expect(problems).toEqual([]);
    });

    test('product: a service loses its stock tabs and buttons, not purchased loses Purchase, a blocking warning needs its message', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, PRODUCT);
      await expect(button(page, 'action_update_quantity_on_hand_stat')).toBeVisible();
      await expect(button(page, 'action_update_quantity_on_hand')).toBeVisible();
      await expect(tab(page, 'Inventory')).toBeVisible();
      await expect(node(page, 'f-tooltip').locator('textarea')).toHaveValue('Storable products are physical items for which you manage the inventory level.');
      if (variant === 'plain') await screen(page, 'real-product');

      // A service: no Inventory tab, no stock stat buttons, no Update Quantity or Replenish, and no tooltip.
      await node(page, 'f-detailed-type').locator('select').selectOption({ label: 'Service' });
      await expect(tab(page, 'Inventory')).toBeHidden();
      await expect(button(page, 'action_update_quantity_on_hand_stat')).toBeHidden();
      await expect(button(page, 'action_view_stock_move_lines')).toBeHidden();
      await expect(button(page, 'action_update_quantity_on_hand')).toBeHidden();
      await expect(button(page, 'action_product_replenish')).toBeHidden();
      await expect(node(page, 'f-tooltip')).toBeHidden();
      await expect.poll(() => value(page, 'tracking')).toBe('none');

      // Not purchased: the Purchase tab and the Purchased stat button go.
      await expect(tab(page, 'Purchase')).toBeVisible();
      await node(page, 'f-purchase-ok').getByRole('checkbox').uncheck();
      await expect(tab(page, 'Purchase')).toBeHidden();
      await expect(button(page, 'action_view_po')).toBeHidden();

      // Sales: a warning's message is shown and required; no message, and it goes.
      await tab(page, 'Sales').click();
      await expect(node(page, 'f-sale-line-warn-msg')).toBeVisible();
      await node(page, 'f-sale-line-warn').locator('select').selectOption({ label: 'No Message' });
      await expect(node(page, 'f-sale-line-warn-msg')).toBeHidden();
      await node(page, 'f-sale-line-warn').locator('select').selectOption({ label: 'Blocking Message' });
      await expect(node(page, 'f-sale-line-warn-msg')).toBeVisible();
      await node(page, 'f-sale-line-warn-msg').locator('textarea').fill('');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(node(page, 'f-sale-line-warn-msg').locator('.fd-error')).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('sales contract: the type picks its tab, a milestone done moves the bar, activated then terminated through its dialog', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, CONTRACT);
      await expect(tab(page, 'Price Escalation')).toBeVisible();
      await expect(tab(page, 'SLA Performance')).toBeHidden();
      await expect.poll(() => value(page, 'milestone_completion_percentage')).toBe(0);
      if (variant === 'plain') await screen(page, 'real-sale-contract');

      // A service level agreement: SLA Performance instead of Price Escalation.
      await node(page, 'f-contract-type').locator('select').selectOption({ label: 'Service Level Agreement' });
      await expect(tab(page, 'Price Escalation')).toBeHidden();
      await expect(tab(page, 'SLA Performance')).toBeVisible();
      await node(page, 'f-contract-type').locator('select').selectOption({ label: 'Framework Agreement' });

      // The first milestone completed: one of four, a quarter of the bar.
      await node(page, 'f-milestones').locator('tbody tr').first().locator('select').selectOption({ label: 'Completed' });
      await expect.poll(() => value(page, 'milestone_completion_percentage')).toBe(25);

      // Activated: Terminate and Renew appear.
      await expect(button(page, 'action_terminate')).toBeHidden();
      await button(page, 'action_activate').click();
      await expect(toast(page, /Contract active/)).toBeVisible();
      await expect.poll(() => value(page, 'state')).toBe('active');
      await expect(button(page, 'action_terminate')).toBeVisible();
      await expect(button(page, 'action_renew')).toBeVisible();
      await expect(node(page, 'f-days-until-expiry')).toBeVisible();

      // Terminated through its dialog: the reason comes back, and the termination details show under the terms.
      await button(page, 'action_terminate').click();
      const dialog = page.getByRole('dialog', { name: 'Terminate Contract' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Save & Close' }).click();
      await expect(dialog.locator('[data-node="f-termination-reason"] .fd-error')).toBeVisible();
      await dialog.locator('[data-node="f-termination-reason"] textarea').fill('The hospital moved its ICU to a new building with its own supplier.');
      if (variant === 'plain') await screen(page, 'real-contract-termination', { viewport: true });
      await dialog.getByRole('button', { name: 'Save & Close' }).click();
      await expect(dialog).toBeHidden();
      await expect(toast(page, 'Contract terminated')).toBeVisible();
      await expect.poll(() => value(page, 'state')).toBe('terminated');
      await expect(tab(page, 'Terms & Conditions')).toHaveAttribute('aria-selected', 'true');
      await expect(node(page, 'f-termination-reason').locator('textarea')).toHaveValue('The hospital moved its ICU to a new building with its own supplier.');
      await expect(button(page, 'action_terminate')).toBeHidden();
      expect(problems).toEqual([]);
    });
  });
}

test('the sales order at a phone’s width: nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { problems } = await open(page, 'plain', ORDER);
  await expect(node(page, 'f-partner').getByRole('combobox')).toHaveValue('Dar El Shifa Hospital');
  await expectNoSidewaysScroll(page);
  await screen(page, 'real-sale-order-phone');
  expect(problems).toEqual([]);
});
