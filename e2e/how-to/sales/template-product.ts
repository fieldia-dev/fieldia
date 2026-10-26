import type { DemoReplay } from '../hand';

/** The template-product demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Type a sales price and a cost: the margin works itself out',
      async run({ page, type, see }) {
        await type(page.getByRole('textbox', { name: 'Sales price' }), '120');
        await type(page.getByRole('textbox', { name: 'Cost' }), '75');
        await see(page.getByRole('textbox', { name: 'Margin' })).toHaveValue('45.00');
        await see(page.getByRole('textbox', { name: 'Margin' })).not.toBeEditable();
      },
    },
    {
      says: 'Choose Service: the Inventory tab goes, as a service has no stock',
      async run({ page, press, see }) {
        await see(page.getByRole('tab', { name: 'Inventory' })).toBeVisible();
        await press(page.getByRole('radio', { name: 'Service' }));
        await see(page.getByRole('radio', { name: 'Service' })).toBeChecked();
        await see(page.getByRole('tab', { name: 'Inventory' })).toHaveCount(0);
        await see(page.getByRole('textbox', { name: 'In stock' })).toHaveCount(0);
        await see(page.getByRole('tab', { name: 'Description' })).toBeVisible();
      },
    },
  ],
};
