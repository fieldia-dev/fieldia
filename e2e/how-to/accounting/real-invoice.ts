import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { printDialog } from './support';

/** “Invoice, bill or journal entry” (real-invoice): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Add a line: pick a product and watch its price, taxes',
      async run({ page, press, phone, see }) {
        const lines = page.locator('[data-node="f-invoice-lines"]');
        const totals = page.locator('[data-node="f-tax-totals"]');
        await see(totals.getByRole('row', { name: /^Total / })).toContainText('58,117.20');
        await press(lines.getByRole('button', { name: '+ Add a line' }));
        if (phone) {
          // A phone's line: its own sheet, the product first.
          const sheet = page.getByRole('dialog', { name: 'Add a line', exact: true });
          const product = sheet.getByRole('combobox', { name: 'Product' });
          await see(product).toBeFocused();
          await page.keyboard.type('desk', { delay: 15 });
          await press(page.getByRole('option', { name: 'Office desk 140 × 70' }));
          await see(sheet.getByRole('textbox', { name: 'Price' })).toHaveValue('6,200.00');
          await see(sheet.locator('[data-field="tax_ids"]')).toContainText('VAT 14%');
          await press(sheet.getByRole('button', { name: 'Save & Close' }));
          await see(sheet).toBeHidden();
          await see(lines.getByRole('button', { name: 'Office desk 140 × 70', exact: true })).toBeVisible();
        } else {
          const editor = lines.locator('.ag-cell-inline-editing input, .ag-popup-editor input').first();
          await see(editor).toBeFocused();
          await page.keyboard.type('desk', { delay: 15 });
          await press(page.getByRole('option', { name: 'Office desk 140 × 70' }));
          // Out of the grid, as a person clicks away: on the tab it is in.
          await press(page.getByRole('tab', { name: 'Invoice Lines' }));
          const desk = lines.locator('.ag-row').filter({ hasText: 'Office desk 140 × 70' });
          await see(desk.locator('.ag-cell[col-id="price_unit"]')).toHaveText('6,200.00');
          await see(desk.locator('.ag-cell[col-id="tax_ids"]')).toHaveText('VAT 14%');
        }
        await see(totals.getByRole('row', { name: /^Untaxed amount / })).toContainText('57,180.00');
        await see(totals.getByRole('row', { name: /^VAT 14% / })).toContainText('8,005.20');
        await see(totals.getByRole('row', { name: /^Total / })).toContainText('65,185.20');
        // The journal items followed: the desk's income, the VAT, and the receivable for the whole.
        await press(page.getByRole('tab', { name: 'Journal Items' }));
        const items = page.getByRole('tabpanel', { name: 'Journal Items' });
        await see(items).toContainText('Office desk 140 × 70');
        await see(items).toContainText('8,005.20');
        await see(items).toContainText('65,185.20');
        await press(page.getByRole('tab', { name: 'Invoice Lines' }));
      },
    },
    {
      says: 'Press Confirm: the invoice gets its number, INV/2026/00042',
      async run({ page, press, see }) {
        await see(page.getByRole('button', { name: 'Register Payment', exact: true })).toHaveCount(0);
        await press(page.getByRole('button', { name: 'Confirm', exact: true }));
        await see(page.getByRole('textbox', { name: 'Number' })).toHaveValue('INV/2026/00042');
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Posted');
        await see(page.getByRole('button', { name: 'Register Payment', exact: true })).toBeVisible();
      },
    },
    {
      says: 'Register Payment opens its dialog: pay part of it',
      async run({ page, press, type, see }) {
        await press(page.getByRole('button', { name: 'Register Payment', exact: true }));
        const dialog = page.getByRole('dialog', { name: 'Register Payment' });
        await see(dialog).toBeVisible();
        const amount = dialog.locator('[data-node="f-amount"] input:not([role="combobox"])').first();
        await see(amount).toHaveValue('65,185.20');
        await type(amount, '50000', { clear: true });
        await press(dialog.getByRole('textbox', { name: 'Memo' }));
        // Part of it: what is left shows, kept open.
        await see(dialog.getByRole('textbox', { name: 'Payment Difference' })).toHaveValue('15,185.20');
        const keep = dialog.getByRole('radio', { name: 'Keep open' });
        await see(keep).toBeChecked();
        await press(dialog.getByRole('radio', { name: 'Mark as fully paid' }));
        await see(dialog.locator('[data-node="f-writeoff-account"]')).toBeVisible();
        await see(dialog.locator('[data-node="f-writeoff-label"] input')).toHaveValue('Write-Off');
        await press(keep);
        await see(dialog.locator('[data-node="f-writeoff-account"]')).toBeHidden();
        await press(dialog.getByRole('button', { name: 'Create Payment', exact: true }));
        await see(dialog).toBeHidden();
        await see(page.locator('.fd-say', { hasText: 'Payment of EGP 50,000.00 registered: EGP 15,185.20 left to pay' })).toBeVisible();
        await see(page.locator('.fd-ribbon', { hasText: 'Partial' })).toBeVisible();
      },
    },
    {
      says: 'Under the gear, Print › This invoice: the invoice on paper',
      async run({ page, press, keys, mod, phone, see }) {
        const print = await printDialog(page);
        await press(page.getByRole('button', { name: 'Actions' }));
        const thisInvoice = page.getByRole('menu').getByRole('group', { name: 'Print' }).getByRole('menuitem', { name: 'This invoice' });
        await see(thisInvoice).toBeVisible();
        await press(thisInvoice);
        await print.paper();
        const onPaper = async () => {
          // The firm over it: its logo, its name and address, the invoice's number.
          const head = page.locator('.fd-print-head');
          await see(head).toBeVisible();
          await see(head.locator('.fd-print-logo')).toBeVisible();
          await see(head.locator('.fd-print-words .fd-print-line')).toHaveText(['Zamalek Office Supplies S.A.E.', '26 July Street, Zamalek, Cairo · VAT EG 100-200-300']);
          await see(head.locator('.fd-print-title')).toHaveText('INV/2026/00042');
          // Every tab one after another, under its name; no tab bar.
          for (const tab of ['Invoice Lines', 'Other Info']) await see(page.locator(`.fd-tabpanel[data-fd-tab="${tab}"]`).first()).toBeVisible();
          await see(page.locator('.fd-tabbar')).toBeHidden();
          // The lines whole: a table as wide as the sheet, every line in it, the desk too.
          const table = page.locator('[data-field="invoice_line_ids"] .fd-print-table');
          await see(table).toBeVisible();
          await see(table).toContainText('Office desk 140 × 70');
          await see(page.locator('[data-field="invoice_line_ids"] .ag-root-wrapper')).toBeHidden();
          // No buttons: neither the record's bar nor the header's.
          await see(page.locator('.fd-record-bar')).toBeHidden();
          await see(page.locator('.fd-header .fd-actions')).toBeHidden();
        };
        await onPaper();
        // The gear's print prints the record alone: the demo's frame round it left out.
        await see(page.locator('#demo-head')).toBeHidden();
        await print.closed();
        await see(page.locator('.fd-print-table')).toHaveCount(0);
        if (!phone) {
          // Or Ctrl+P (⌘+P on a Mac): the same paper.
          await keys(`${mod}+p`);
          await print.paper();
          await onPaper();
          await print.closed();
        }
        await see(page.getByRole('button', { name: 'Actions' })).toBeVisible();
      },
    },
    {
      says: 'Print › Invoice: the app’s own PDF of it',
      async run({ page, press, phone, keys, see }) {
        await press(page.getByRole('button', { name: 'Actions' }));
        await press(page.getByRole('menu').getByRole('group', { name: 'Print' }).getByRole('menuitem', { name: 'Invoice', exact: true }));
        const viewer = page.getByRole('dialog', { name: 'INV_2026_00042.pdf' });
        await see(viewer).toBeVisible();
        await see(viewer.locator('iframe')).toHaveAttribute('src', /^blob:/);
        const download = viewer.getByRole('link', { name: 'Download' });
        await see(download).toBeVisible();
        const [file] = await Promise.all([page.waitForEvent('download'), press(download)]);
        expect(file.suggestedFilename()).toBe('INV_2026_00042.pdf');
        if (phone) await press(viewer.getByRole('button', { name: /Close/ }));
        else await keys('Escape');
        await see(viewer).toBeHidden();
      },
    },
    {
      says: 'Open another record: a USD invoice partly paid',
      async run(hand) {
        const { page, follow, see } = hand;
        await follow('a USD invoice partly paid');
        await see(page.locator('.fd-ribbon', { hasText: 'Partial' })).toBeVisible();
        await see(page.getByRole('combobox', { name: 'Currency', exact: true })).toHaveValue('USD');
        await see(page.getByRole('tab', { name: 'Currency Details' })).toBeVisible();
        await follow('a vendor bill');
        await see(page.locator('[data-node="f-vendor"]')).toBeVisible();
        await see(page.getByText('Warning: this bill might be a duplicate of one of those bills.')).toBeVisible();
        await follow('a journal entry');
        await see(page.getByRole('tab', { name: 'Invoice Lines' })).toHaveCount(0);
        await see(page.getByRole('button', { name: 'Post', exact: true })).toBeVisible();
        await follow('a paid credit note');
        await see(page.locator('.fd-ribbon', { hasText: 'Paid' })).toBeVisible();
        await see(page.getByRole('combobox', { name: 'Type' }).locator('option:checked')).toHaveText('Customer Credit Note');
      },
    },
  ],
};
