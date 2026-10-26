import type { DemoReplay } from '../hand';

/** “Invoice” (template-invoice): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Pick a customer and press Confirm: with no lines yet, it says why it cannot.',
      async run({ page, press, type, see }) {
        const customer = page.getByRole('combobox', { name: 'Customer' });
        await type(customer, 'Nile');
        await press(page.getByRole('option', { name: 'Nile Traders', exact: true }));
        await see(customer).toHaveValue('Nile Traders');
        await see(page.locator('[data-node="f-lines"] tbody tr[data-line]')).toHaveCount(0);
        await press(page.getByRole('button', { name: 'Confirm', exact: true }));
        // Why it cannot: there is nothing on it to bill.
        await see(page.locator('.fd-say').filter({ hasText: 'Add a line with an amount first: an invoice for nothing cannot be confirmed.' }).first()).toBeVisible();
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Draft');
        await see(page.getByRole('button', { name: 'Register payment' })).toBeHidden();
      },
    },
    {
      says: 'Add a line: pick a product, type a quantity and a price',
      async run({ page, press, type, see }) {
        const lines = page.locator('[data-node="f-lines"]');
        await press(lines.getByRole('button', { name: '+ Add a line' }));
        const line = lines.locator('tbody tr[data-line]').first();
        const product = line.getByRole('combobox', { name: 'Product' });
        await see(product).toBeFocused();
        await page.keyboard.type('chair', { delay: 15 });
        const option = page.getByRole('option', { name: 'Office chair, ergonomic' });
        await see(option).toBeVisible();
        await press(option);
        await see(product).toHaveValue('Office chair, ergonomic');
        await type(line.getByRole('textbox', { name: 'Quantity', exact: true }), '2', { clear: true });
        await type(line.getByRole('textbox', { name: 'Unit price', exact: true }), '150');
        await see(line.getByRole('textbox', { name: 'Subtotal', exact: true })).toHaveValue('300.00');
        await see(page.getByRole('textbox', { name: 'Untaxed amount' })).toHaveValue('300.00');
        await see(page.getByRole('textbox', { name: 'Tax 14%' })).toHaveValue('42.00');
        await see(page.getByRole('textbox', { name: 'Total', exact: true })).toHaveValue('342.00');
      },
    },
    {
      says: 'Type a discount on a line: its subtotal drops by that much',
      async run({ page, type, see }) {
        const line = page.locator('[data-node="f-lines"] tbody tr[data-line]').first();
        await type(line.getByRole('textbox', { name: 'Disc. %', exact: true }), '10', { clear: true });
        // 10 % off 300.00: 270.00, and the totals under it with it.
        await see(line.getByRole('textbox', { name: 'Subtotal', exact: true })).toHaveValue('270.00');
        await see(page.getByRole('textbox', { name: 'Untaxed amount' })).toHaveValue('270.00');
        await see(page.getByRole('textbox', { name: 'Total', exact: true })).toHaveValue('307.80');
      },
    },
    {
      says: 'Press Confirm: the invoice gets its number, moves to Posted',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Confirm', exact: true }));
        await see(page.getByRole('textbox', { name: 'Invoice Invoice number' })).toHaveValue(/^INV\/\d{4}$/);
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Posted');
        // Register payment where Confirm was.
        await see(page.getByRole('button', { name: 'Register payment' })).toBeVisible();
        await see(page.getByRole('button', { name: 'Confirm', exact: true })).toBeHidden();
      },
    },
  ],
};
