import type { DemoReplay } from '../hand';

/** The template-purchase-order demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Pick a vendor and add products: the totals follow the lines',
      async run({ page, press, type, keys, see }) {
        const vendor = page.getByRole('combobox', { name: 'Vendor' });
        await type(vendor, 'Delta');
        await press(page.getByRole('option', { name: 'Delta Foods' }));
        await see(vendor).toHaveValue('Delta Foods');
        const products = page.getByRole('group', { name: 'Products' });
        const total = (name: string) => page.getByRole('textbox', { name, exact: true });
        for (const [product, search, quantity, price, untaxed, tax, all] of [
          ['Office chair, ergonomic', 'chair', '4', '85', '340.00', '47.60', '387.60'],
          ['Desk lamp, LED', 'lamp', '2', '30', '400.00', '56.00', '456.00'],
        ]) {
          await press(products.getByRole('button', { name: '+ Add a line' }));
          const line = products.locator('tbody tr[data-line]').last();
          await type(line.getByRole('combobox', { name: 'Product' }), search);
          await press(page.getByRole('option', { name: product }));
          await see(line.getByRole('combobox', { name: 'Product' })).toHaveValue(product);
          await type(line.getByRole('textbox', { name: 'Quantity' }), quantity, { clear: true });
          await type(line.getByRole('textbox', { name: 'Unit price' }), price);
          await keys('Tab');
          await see(total('Untaxed amount')).toHaveValue(untaxed);
          await see(total('Tax 14%')).toHaveValue(tax);
          await see(total('Total')).toHaveValue(all);
        }
        await see(products.locator('tbody tr[data-line]').first().getByRole('textbox', { name: 'Subtotal' })).toHaveValue('340.00');
      },
    },
    {
      says: 'Press Confirm order on an empty order: it says what is missing',
      async run({ page, press, type, keys, see }) {
        const at = page.locator('.fd-statusbar [aria-current="step"]');
        // The order emptied of its products: an order with nothing on it.
        const products = page.getByRole('group', { name: 'Products' });
        const lines = products.locator('tbody tr[data-line]');
        while (await lines.count()) await press(lines.first().getByRole('button', { name: 'Delete line' }));
        await see(lines).toHaveCount(0);
        await press(page.getByRole('button', { name: 'Confirm order' }));
        await see(page.locator('.fd-say', { hasText: 'Add the products to order first: an order with nothing on it cannot go to the vendor.' })).toBeVisible();
        await see(at).toHaveText('Request for quotation');
        // Products added, then sent and confirmed.
        await press(products.getByRole('button', { name: '+ Add a line' }));
        const line = lines.last();
        await type(line.getByRole('combobox', { name: 'Product' }), 'chair');
        await press(page.getByRole('option', { name: 'Office chair, ergonomic' }));
        await type(line.getByRole('textbox', { name: 'Quantity' }), '4', { clear: true });
        await type(line.getByRole('textbox', { name: 'Unit price' }), '85');
        await keys('Tab');
        await see(page.getByRole('button', { name: 'Receive products' })).toBeHidden();
        await press(page.getByRole('button', { name: 'Send by email' }));
        await see(at).toHaveText('Sent');
        await see(page.getByRole('button', { name: 'Receive products' })).toBeHidden();
        await press(page.getByRole('button', { name: 'Confirm order' }));
        await see(at).toHaveText('Purchase order');
        await see(page.getByRole('textbox', { name: 'Purchase order' })).toHaveValue(/^P\d{5}$/);
        await see(page.getByRole('button', { name: 'Receive products' })).toBeVisible();
      },
    },
  ],
};
