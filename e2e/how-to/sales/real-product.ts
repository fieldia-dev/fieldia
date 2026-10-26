import type { DemoReplay } from '../hand';
import { chooseFrom } from './support';

/** The real-product demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Change Product Type to Service: the Inventory tab, the stock counters, Update Quantity and Replenish go',
      async run(hand) {
        const { page, see } = hand;
        const storable = page.getByText('Storable products are physical items for which you manage the inventory level.');
        await see(storable).toBeVisible();
        await see(page.getByRole('tab', { name: 'Inventory', exact: true })).toBeVisible();
        await see(page.getByRole('button', { name: '12 Units On Hand' })).toBeVisible();
        await chooseFrom(hand, page.getByRole('combobox', { name: /^Product Type/ }), 'Service');
        await see(page.getByRole('combobox', { name: /^Product Type/ }).locator('option:checked')).toHaveText('Service');
        await see(page.getByRole('tab', { name: 'Inventory', exact: true })).toBeHidden();
        // The stock counters: on hand, forecasted, in and out, min and max.
        await see(page.getByRole('button', { name: '12 Units On Hand' })).toBeHidden();
        await see(page.getByRole('button', { name: '8 Units Forecasted' })).toBeHidden();
        await see(page.getByRole('button', { name: 'In: 5 Out: 9' })).toBeHidden();
        await see(page.getByRole('button', { name: 'Update Quantity' })).toBeHidden();
        await see(page.getByRole('button', { name: 'Replenish' })).toBeHidden();
        // The storable product's tooltip under the type: no longer said.
        await see(storable).toBeHidden();
      },
    },
    {
      says: 'Untick Can be Purchased: the Purchase tab and the Purchased counter go',
      async run({ page, press, see }) {
        await see(page.getByRole('tab', { name: 'Purchase', exact: true })).toBeVisible();
        await see(page.getByRole('button', { name: '40 Units Purchased' })).toBeVisible();
        await press(page.getByRole('checkbox', { name: 'Can be Purchased' }));
        await see(page.getByRole('checkbox', { name: 'Can be Purchased' })).not.toBeChecked();
        await see(page.getByRole('tab', { name: 'Purchase', exact: true })).toBeHidden();
        await see(page.getByRole('button', { name: '40 Units Purchased' })).toBeHidden();
      },
    },
    {
      says: 'Change the Cost’s currency from USD to EGP with the box beside it',
      async run(hand) {
        const { page, see } = hand;
        const cost = page.getByRole('group', { name: 'Cost' });
        await see(cost.getByRole('combobox', { name: 'Cost Currency' })).toHaveValue('USD');
        const currency = cost.getByRole('combobox', { name: 'Cost Currency' });
        await hand.type(currency, 'EGP', { clear: true });
        await hand.press(page.getByRole('option', { name: 'EGP', exact: true }));
        await see(currency).toHaveValue('EGP');
        await see(cost.getByRole('textbox', { name: /^Cost/ })).toHaveValue('1,890.00');
      },
    },
    {
      says: 'In the Sales tab, set the warning to Blocking Message: Message becomes required',
      async run(hand) {
        const { page, press, see } = hand;
        await press(page.getByRole('tab', { name: 'Sales', exact: true }));
        const warn = page.locator('[data-node="f-sale-line-warn"]').getByRole('combobox');
        await chooseFrom(hand, warn, 'Blocking Message');
        await see(warn.locator('option:checked')).toHaveText('Blocking Message');
        const message = page.locator('[data-node="f-sale-line-warn-msg"]');
        await see(message).toHaveClass(/\bfd-required\b/);
        await see(message.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
        // Required: emptied, the record is not saved, and the box says why.
        await hand.type(message.getByRole('textbox'), '', { clear: true });
        await press(page.getByRole('button', { name: 'Save', exact: true }));
        await see(message.locator('.fd-error')).toBeVisible();
      },
    },
  ],
};
