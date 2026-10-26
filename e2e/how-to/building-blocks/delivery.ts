import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The delivery demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Submit with the address empty: Street and number and City refuse',
      async run({ page, press, type, see }) {
        const delivery = page.locator('.fd-form-part[data-node="delivery-address"]');
        await see(delivery.locator('[data-node="street"]')).toBeVisible();
        await type(page.locator('[data-node="full-name"] input'), 'Sara Adel');
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(delivery.locator('[data-node="street"] .fd-error')).toHaveText('Street and number is required');
        await see(delivery.locator('[data-node="city"] .fd-error')).toHaveText('City is required');
        await see(delivery.locator(':scope > legend')).toHaveText('Delivery address');
      },
    },
    {
      says: 'Tick “Send the invoice to another address”: the same Address form comes again',
      async run({ page, press, see }) {
        const tick = page.getByRole('checkbox', { name: 'Send the invoice to another address' });
        await press(tick);
        await see(tick).toBeChecked();
        const billing = page.locator('.fd-form-part[data-node="billing-address"]');
        await see(billing.locator('[data-node="street"]')).toBeVisible();
        await see(billing.locator('[data-node="city"]')).toBeVisible();
        await see(billing.locator(':scope > legend')).toHaveText('Billing address');
      },
    },
    {
      says: 'Fill both and send: the app gets the answers nested',
      async run({ page, press, type, see, demo }) {
        const box = (part: string, field: string) => page.locator(`.fd-form-part[data-node="${part}"] [data-node="${field}"] input`).first();
        await type(box('delivery-address', 'street'), '12 Nile Street');
        await type(box('delivery-address', 'city'), 'Cairo');
        await type(box('billing-address', 'street'), '3 Harbour Road');
        await type(box('billing-address', 'city'), 'Alexandria');
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(page.getByText('Thank you. Your answers were sent.')).toBeVisible();
        const responses = await demo<{ values: Record<string, unknown> }[]>('dataSource.responses');
        expect(responses[0].values).toMatchObject({
          delivery_address: { street: '12 Nile Street', city: 'Cairo' },
          billing_address: { street: '3 Harbour Road', city: 'Alexandria' },
        });
      },
    },
  ],
};
