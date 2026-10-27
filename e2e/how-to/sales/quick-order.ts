import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { pickIn, toast } from './support';

/** The quick-order demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Type a name under “Who is calling” and press New customer: a side panel opens with the name in it',
      async run({ page, type, press, see }) {
        await type(page.getByRole('textbox', { name: 'Who is calling' }), 'Nadia Farouk');
        await press(page.getByRole('button', { name: 'New customer' }));
        const panel = page.getByRole('dialog', { name: 'New customer' });
        await see(panel).toBeVisible();
        await see(panel.locator('[data-node="c-name"]').getByRole('textbox')).toHaveValue('Nadia Farouk');
        await press(panel.getByRole('button', { name: 'Save & Close' }));
        await see(panel).toBeHidden();
        await see(page.locator('[data-node="f-customer"]').getByRole('combobox')).toHaveValue('Nadia Farouk');
        const said = toast(page, 'Customer added');
        await see(said).toBeVisible();
        // At the foot of the screen.
        const where = (await said.boundingBox())!;
        expect(where.y).toBeGreaterThan(page.viewportSize()!.height / 2);
      },
    },
    {
      says: 'Pick a product: the app checks the stock, says how many are left, and gives the price',
      async run(hand) {
        const { page, press, keys, see } = hand;
        await pickIn(hand, 'f-product', 'lamp', 'Desk lamp, LED');
        await see(toast(page, 'In stock: 40')).toBeVisible();
        await see(page.getByRole('textbox', { name: 'Price each' })).toHaveValue('380.00');
        await see(page.getByRole('textbox', { name: 'Total' })).toHaveValue('380.00');
        await press(page.getByRole('textbox', { name: 'Quantity' }));
        await keys('Control+a');
        await page.keyboard.type('3', { delay: 15 });
        await see(page.getByRole('textbox', { name: 'Total' })).toHaveValue('1,140.00');
      },
    },
    {
      says: 'Pick the standing desk: the app says it is out of stock, and the price stays empty',
      async run(hand) {
        const { page, see } = hand;
        await pickIn(hand, 'f-product', 'standing', 'Standing desk 160 × 80');
        await see(toast(page, 'Standing desk 160 × 80 is out of stock until November.')).toBeVisible();
        await see(page.getByRole('textbox', { name: 'Price each' })).toHaveValue('');
      },
    },
    {
      says: 'Press Customer’s page: the customer’s record takes the order’s place',
      async run({ page, press, see }) {
        const order = page.locator('form.fd-form').first();
        await press(page.getByRole('button', { name: 'Customer’s page' }));
        await see(order).toBeHidden();
        await see(page.locator('[data-node="#title"] textarea, [data-node="#title"] input').first()).toHaveValue('Nadia Farouk');
        await press(page.getByRole('button', { name: 'Back' }));
        await see(order).toBeVisible();
        await see(page.getByRole('textbox', { name: 'Who is calling' })).toHaveValue('Nadia Farouk');
        await see(page.locator('[data-node="f-customer"]').getByRole('combobox')).toHaveValue('Nadia Farouk');
        await see(page.locator('[data-node="f-product"]').getByRole('combobox')).toHaveValue('Standing desk 160 × 80');
        await see(page.getByRole('textbox', { name: 'Quantity' })).toHaveValue('3');
      },
    },
    {
      says: 'Press Submit with a field empty: the form shows what is missing',
      async run(hand) {
        const { page, press, see } = hand;
        // The product taken out, then Submit.
        await press(page.getByRole('button', { name: 'Clear Product' }));
        await see(page.locator('[data-node="f-product"]').getByRole('combobox')).toHaveValue('');
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(page.locator('[data-node="f-product"] .fd-error')).toHaveText('Product is required');
        await see(page.getByRole('alertdialog')).toHaveCount(0);
        // Filled in, sent again: the question, answered Submit.
        await pickIn(hand, 'f-product', 'chair', 'Office chair, ergonomic');
        await see(page.locator('[data-node="f-product"] .fd-error')).toBeHidden();
        await see(page.getByRole('textbox', { name: 'Price each' })).toHaveValue('1,890.00');
        await press(page.getByRole('button', { name: 'Submit' }));
        const question = page.getByRole('alertdialog', { name: 'Send the order?' });
        await see(question).toBeVisible();
        await press(question.getByRole('button', { name: 'Submit' }));
        await see(toast(page, 'Order sent')).toBeVisible();
        await see(page.locator('.fd-done-title')).toBeVisible();
      },
    },
  ],
};
