import type { DemoReplay } from '../hand';
import { stage } from './support';

/** “Expense report” (real-expense): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Type a vendor in Vendor Name: every line takes it',
      async run({ page, type, keys, phone, see }) {
        const lines = page.locator('[data-node="f-lines"]');
        const vendors = phone ? lines.locator('.fd-line-card dt:text-is("Vendor") + dd') : lines.locator('.ag-row .ag-cell[col-id="vendor"]');
        await see(vendors).toHaveText(['EgyptAir', 'Hilton Riyadh', 'Najd Village', 'Uber']);
        await type(page.getByRole('textbox', { name: 'Vendor Name' }), 'Riyadh Front Expo');
        await keys('Tab');
        await see(vendors).toHaveText(Array(4).fill('Riyadh Front Expo'));
      },
    },
    {
      says: 'Add a line with a price: its VAT is taken out of it',
      async run({ page, press, type, keys, phone, see }) {
        const lines = page.locator('[data-node="f-lines"]');
        const sum = (id: string) => page.locator(`[data-node="${id}"] .fd-read-text`);
        await see(sum('f-total')).toHaveText('E£ 34,930.00');
        await press(lines.getByRole('button', { name: '+ Add a line' }));
        if (phone) {
          const sheet = page.getByRole('dialog', { name: 'Lines' });
          const description = sheet.getByRole('textbox', { name: /^Description/ });
          await see(description).toBeFocused();
          await page.keyboard.type('Parking at the venue', { delay: 15 });
          await type(sheet.getByRole('textbox', { name: 'Unit Price' }), '570', { clear: true });
          await press(sheet.getByRole('button', { name: 'Save & Close' }));
          await see(sheet).toBeHidden();
          const card = lines.locator('.fd-line-card').filter({ hasText: 'Parking at the venue' });
          await see(card.locator('dt:text-is("Taxes") + dd')).toHaveText('VAT 14% (Purchases)');
          await see(card.locator('dt:text-is("Vendor") + dd')).toHaveText('Riyadh Front Expo');
        } else {
          const editor = lines.locator('.ag-cell-inline-editing input, .ag-popup-editor input').first();
          await see(editor).toBeFocused();
          await page.keyboard.type('Parking at the venue', { delay: 15 });
          await keys('Tab');
          const row = lines.locator('.ag-row[row-index="4"]');
          await press(row.locator('.ag-cell[col-id="price_unit"]'));
          await see(editor).toBeFocused();
          await page.keyboard.type('570', { delay: 15 });
          await keys('Tab');
          // Out of the grid, as a person clicks away: on the tab it is in.
          await press(page.getByRole('tab', { name: 'Lines' }));
          await see(row.locator('.ag-cell[col-id="tax_ids"]')).toHaveText('VAT 14% (Purchases)');
          await see(row.locator('.ag-cell[col-id="vendor"]')).toHaveText('Riyadh Front Expo');
        }
        // 570 with its VAT in it: 500 and 70 of tax, the totals with them.
        await see(sum('f-untaxed')).toHaveText('E£ 31,272.98');
        await see(sum('f-tax')).toHaveText('E£ 4,227.02');
        await see(sum('f-total')).toHaveText('E£ 35,500.00');
      },
    },
    {
      says: 'Press Submit, Approve, then Post: the stages along the top move on',
      async run({ page, press, see }) {
        await see(page.getByRole('button', { name: /Entries/ })).toHaveCount(0);
        await press(page.getByRole('button', { name: 'Submit', exact: true }));
        await see(stage(page)).toHaveText('Submitted');
        await press(page.getByRole('button', { name: 'Approve', exact: true }));
        await see(stage(page)).toHaveText('Approved');
        await press(page.getByRole('button', { name: 'Post', exact: true }));
        await see(stage(page)).toHaveText('Posted');
        await see(page.getByRole('button', { name: /Entries/ })).toBeVisible();
      },
    },
    {
      says: 'Register Payment pays the employee in a dialog',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Register Payment', exact: true }));
        const dialog = page.getByRole('dialog', { name: 'Register Payment' });
        await see(dialog).toBeVisible();
        await see(dialog.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('35,500.00');
        await press(dialog.getByRole('button', { name: 'Create Payment', exact: true }));
        await see(dialog).toBeHidden();
        await see(page.locator('.fd-say', { hasText: 'Omar Hassan is reimbursed in full' })).toBeVisible();
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Paid');
        await see(page.locator('.fd-ribbon', { hasText: 'Paid' })).toBeVisible();
      },
    },
  ],
};
