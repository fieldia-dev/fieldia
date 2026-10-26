import type { Page } from '@playwright/test';
import type { DemoReplay } from '../hand';
import { box, pickIn, toast } from './support';

/** The real sales order's lines grid, a cell of it, and its tax totals' row by its name. */
const orderLines = (page: Page) => page.locator('[data-node="f-order-line"]');
const orderCell = (page: Page, row: number, col: string) => orderLines(page).locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${col}"]`);
const taxTotal = (page: Page, name: string) => page.locator('[data-node="f-tax-totals"]').getByRole('row', { name: new RegExp(`^${name} `) }).getByRole('cell');

/** A header button of a record (a stat counter, an action) by its layout id. */
const recordButton = (page: Page, id: string) => page.locator(`button[data-node="${id}"]`);

/** The real-sale-order demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'In the grid, change the patient monitors’ Quantity from 4 to 5',
      async run({ page, phone, press, keys, see }) {
        await see(taxTotal(page, 'Untaxed amount')).toHaveText('E£ 289,450.00');
        if (phone) {
          await press(orderLines(page).getByRole('button', { name: '[PM-12] Patient monitor PM-12', exact: true }));
          const dialog = page.getByRole('dialog', { name: 'Order Lines' });
          await see(box(dialog, 'Quantity')).toHaveValue('4.00');
          await press(box(dialog, 'Quantity'));
          await keys('Control+a');
          await page.keyboard.type('5', { delay: 15 });
          await see(box(dialog, 'Tax excl.')).toHaveValue('213,750.00');
          await press(dialog.getByRole('button', { name: 'Save & Close' }));
          await see(dialog).toBeHidden();
          await see(orderLines(page)).toContainText('213,750.00');
        } else {
          await see(orderCell(page, 1, 'product_uom_qty')).toHaveText('4.00');
          await press(orderCell(page, 1, 'product_uom_qty'));
          await page.keyboard.type('5', { delay: 15 });
          await keys('Enter');
          await see(orderCell(page, 1, 'product_uom_qty')).toHaveText('5.00');
          await see(orderCell(page, 1, 'price_subtotal')).toHaveText('E£ 213,750.00');
        }
        await see(taxTotal(page, 'Untaxed amount')).toHaveText('E£ 332,200.00');
        await see(taxTotal(page, 'VAT 14%')).toHaveText('E£ 46,508.00');
        await see(taxTotal(page, 'Total')).toHaveText('E£ 378,708.00');
      },
    },
    {
      says: 'Add a product and pick the Defibrillator AED-3: its description, unit, VAT 14% and the hospital price',
      async run({ page, phone, press, see }) {
        await press(page.getByRole('button', { name: '+ Add a product' }));
        await page.keyboard.type('defib', { delay: 15 });
        await press(page.getByRole('option', { name: '[AED-3] Defibrillator AED-3' }));
        if (phone) {
          const dialog = page.getByRole('dialog', { name: 'Order Lines' });
          await see(box(dialog, 'Description')).toHaveValue(/Automated external defibrillator, adult and child pads\./);
          await see(dialog.getByRole('combobox', { name: 'UoM' })).toHaveValue('Units');
          await see(dialog.getByRole('group', { name: 'Taxes' })).toContainText('VAT 14%');
          await see(box(dialog, 'Unit Price')).toHaveValue('58,880.00');
          await press(dialog.getByRole('button', { name: 'Save & Close' }));
          await see(dialog).toBeHidden();
          await see(orderLines(page).getByRole('button', { name: '[AED-3] Defibrillator AED-3', exact: true })).toBeVisible();
        } else {
          const row = orderLines(page).locator('.ag-row').filter({ hasText: 'Defibrillator AED-3' }).first();
          await see(row.locator('.ag-cell[col-id="name"]')).toContainText('Automated external defibrillator, adult and child pads.');
          await see(row.locator('.ag-cell[col-id="product_uom"]')).toHaveText('Units');
          await see(row.locator('.ag-cell[col-id="tax_id"]')).toHaveText('VAT 14%');
          await see(row.locator('.ag-cell[col-id="price_unit"]')).toHaveText('58,880.00');
        }
      },
    },
    {
      says: 'Change the Customer to Delta Care Clinics: the addresses, pricelist and terms follow',
      async run(hand) {
        const { page, see } = hand;
        const warning = page.getByText('Delta Care Clinics has reached its credit limit of: E£ 150,000.00');
        await see(warning).toBeHidden();
        await see(page.getByRole('combobox', { name: 'Pricelist' })).toHaveValue('Hospitals 2026 (EGP)');
        await see(page.getByRole('combobox', { name: 'Payment Terms' })).toHaveValue('30 Days');
        await pickIn(hand, 'f-partner', 'delta', 'Delta Care Clinics');
        await see(page.getByRole('combobox', { name: 'Invoice Address' })).toHaveValue(/^Delta Care Clinics/);
        await see(page.getByRole('combobox', { name: 'Delivery Address' })).toHaveValue(/^Delta Care Clinics/);
        await see(page.getByRole('combobox', { name: 'Pricelist' })).toHaveValue('Public Pricelist (EGP)');
        await see(page.getByRole('combobox', { name: 'Payment Terms' })).toHaveValue('Immediate Payment');
        await see(warning).toBeVisible();
      },
    },
    {
      says: 'Press Send by Email: the quotation is emailed and moves to Quotation Sent',
      async run({ page, press, see }) {
        const step = page.getByRole('list', { name: 'Status' }).locator('[aria-current="step"]');
        await see(step).toHaveText('Quotation');
        await see(page.getByRole('textbox', { name: 'Expiration' })).toBeVisible();
        await press(page.getByRole('button', { name: 'Send by Email' }));
        await see(toast(page, 'Quotation S00071 emailed to Delta Care Clinics.')).toBeVisible();
        await see(step).toHaveText('Quotation Sent');
        await press(page.getByRole('button', { name: 'Confirm', exact: true }));
        await see(toast(page, /S00071 confirmed/)).toBeVisible();
        await see(step).toHaveText('Sales Order');
        await see(recordButton(page, 'action_view_delivery')).toBeVisible();
        await see(recordButton(page, 'action_view_delivery')).toContainText('Delivery');
        await see(page.getByRole('textbox', { name: 'Expiration' })).toBeHidden();
        await see(page.getByRole('textbox', { name: 'Order Date' })).toBeVisible();
        // The customer fixed, as a confirmed order's is.
        await see(page.getByRole('combobox', { name: 'Customer' })).toHaveValue('Delta Care Clinics');
        await see(page.getByRole('combobox', { name: 'Customer' })).not.toBeEditable();
      },
    },
    {
      says: 'Show Analytic Distribution from the grid’s column chooser (⋮): each line’s accounts with their shares',
      notOnPhone: 'a phone shows the lines as cards: no header row, no column chooser to show the column from',
      async run({ page, press, keys, follow, see, seePage }) {
        // Out of any cell being edited, first.
        await keys('Escape');
        const header = orderLines(page).locator('.ag-header-cell[col-id="analytic_distribution"]');
        await see(header).toHaveCount(0);
        await press(orderLines(page).getByRole('button', { name: 'Choose columns' }));
        await press(orderLines(page).locator('.fd-grid-chooser').getByRole('checkbox', { name: 'Analytic Distribution' }));
        await keys('Escape');
        await see(header).toBeVisible();
        await see(orderCell(page, 1, 'analytic_distribution')).toHaveText('Heliopolis rollout 70%, Sales department 30%');
        // A cell pressed: its accounts and shares to change.
        await press(orderCell(page, 1, 'analytic_distribution'));
        const editor = page.locator('.fd-grid-editor .fd-distribution');
        await see(editor).toBeVisible();
        await see(editor.locator('input.fd-share')).toHaveCount(2);
        await press(editor.locator('input.fd-share').first());
        await keys('Control+a');
        await page.keyboard.type('60', { delay: 15 });
        await see(editor).toContainText('90%');
        await keys('Enter');
        await see(orderCell(page, 1, 'analytic_distribution')).toHaveText('Heliopolis rollout 60%, Sales department 30%');
        // Opened as someone without the analytic accounting role: the column, and its place in the chooser, gone.
        await follow('Opened as someone without the analytic accounting role');
        await seePage().toHaveURL(/roles=base\.group_user/);
        await see(page.getByRole('textbox', { name: 'Order Reference' })).toHaveValue('S00071');
        await see(header).toHaveCount(0);
        await press(orderLines(page).getByRole('button', { name: 'Choose columns' }));
        await see(orderLines(page).locator('.fd-grid-chooser')).toBeVisible();
        await see(orderLines(page).locator('.fd-grid-chooser').getByRole('checkbox', { name: 'Analytic Distribution' })).toHaveCount(0);
        await keys('Escape');
      },
    },
    {
      says: 'Open S00068 and press Create Invoice: the Create invoices dialog opens over the order',
      async run({ page, follow, press, see }) {
        await follow('Open S00068');
        await see(page.getByRole('textbox', { name: 'Order Reference' })).toHaveValue('S00068');
        await press(page.getByRole('button', { name: 'Create Invoice', exact: true }));
        const dialog = page.getByRole('dialog', { name: 'Create invoices' });
        await see(dialog).toBeVisible();
        await see(dialog.getByRole('radio', { name: 'Regular invoice' })).toBeChecked();
        await see(page.getByRole('textbox', { name: 'Order Reference' })).toHaveValue('S00068');
      },
    },
  ],
};
