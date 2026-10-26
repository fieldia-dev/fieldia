import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { box } from './support';

/** The rules demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Change a quantity or a price: the line’s subtotal, the total and the amount to pay follow',
      async run({ page, press, keys, see }) {
        const first = page.locator('[data-node="f-lines"] tbody tr[data-line]').first();
        await see(box(first, 'Subtotal')).toHaveValue('480.00');
        await press(box(first, 'Quantity'));
        await keys('Control+a');
        await page.keyboard.type('3', { delay: 15 });
        await see(box(first, 'Subtotal')).toHaveValue('720.00');
        await see(box(page, 'Total')).toHaveValue('720.00');
        await see(box(page, 'To pay')).toHaveValue('720.00');
        await press(box(first, 'Unit price'));
        await keys('Control+a');
        await page.keyboard.type('250', { delay: 15 });
        await see(box(first, 'Subtotal')).toHaveValue('750.00');
        await see(box(page, 'Total')).toHaveValue('750.00');
        await see(box(page, 'To pay')).toHaveValue('750.00');
      },
    },
    {
      says: 'Add a line that takes the total past EGP 1,000: the discount sets itself to 10%',
      async run({ page, press, type, keys, see }) {
        const rows = page.locator('[data-node="f-lines"] tbody tr[data-line]');
        await press(page.getByRole('button', { name: '+ Add a line' }));
        await see(rows).toHaveCount(2);
        const chair = rows.nth(1);
        await type(box(chair, 'Item'), 'Desk chair');
        await type(box(chair, 'Quantity'), '1');
        await see(box(page, 'Discount (%)')).toHaveValue('0');
        await type(box(chair, 'Unit price'), '1890');
        await see(box(chair, 'Subtotal')).toHaveValue('1,890.00');
        await see(box(page, 'Total')).toHaveValue('2,640.00');
        await see(box(page, 'Discount (%)')).toHaveValue('10');
        await see(box(page, 'To pay')).toHaveValue('2,376.00');
        // Changed by hand, it stays as set: what is left to pay follows it, and a quantity changed leaves it be.
        await press(box(page, 'Discount (%)'));
        await keys('Control+a');
        await page.keyboard.type('15', { delay: 15 });
        await see(box(page, 'To pay')).toHaveValue('2,244.00');
        await press(box(rows.first(), 'Quantity'));
        await keys('Control+a');
        await page.keyboard.type('4', { delay: 15 });
        await see(box(page, 'Total')).toHaveValue('2,890.00');
        await see(box(page, 'Discount (%)')).toHaveValue('15');
        await see(box(page, 'To pay')).toHaveValue('2,456.50');
      },
    },
    {
      says: 'Type an email outside @niletraders.example and leave the field: a warning shows under it',
      async run({ page, phone, type, press, keys, see }) {
        const email = page.locator('[data-node="f-email"]');
        const warning = email.locator('.fd-warning');
        await type(email.getByRole('textbox'), 'sara@gmail.com');
        await see(warning).toBeHidden();
        // Left: by Tab on a desktop, by a finger on the next box on a phone.
        if (phone) await press(page.getByRole('textbox', { name: 'Postcode' }));
        else await keys('Tab');
        await see(warning).toHaveText('Use your @niletraders.example address if you can: those orders are approved the same day.');
        // A warning, not an error: the box is not marked wrong (the form sending with it is seen in the next step).
        await see(email.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
        await see(email.locator('.fd-error')).toBeHidden();
      },
    },
    {
      says: 'Type a postcode of four digits, tick one delivery day, and send: the form stops',
      async run({ page, press, type, see, demo }) {
        const postcode = page.getByRole('textbox', { name: 'Postcode' });
        await type(postcode, '1151');
        await press(page.getByRole('checkbox', { name: 'Sunday' }));
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(page.locator('[data-node="f-postcode"] .fd-error')).toHaveText('A postcode has five digits, such as 11511.');
        await see(page.locator('[data-node="f-days"] .fd-error')).toHaveText('Choose at least 2 for Delivery days');
        await see(postcode).toHaveAttribute('aria-invalid', 'true');
        await see(page.locator('[data-node="f-email"] .fd-warning')).toBeVisible();
        expect(await demo<unknown[]>('dataSource.responses')).toHaveLength(0);
        // Put right, it sends — the email's warning notwithstanding (step 3's "the form still sends").
        await type(postcode, '2');
        await press(page.getByRole('checkbox', { name: 'Tuesday' }));
        await see(page.locator('[data-node="f-postcode"] .fd-error')).toBeHidden();
        await see(page.locator('[data-node="f-days"] .fd-error')).toBeHidden();
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(page.locator('.fd-done')).toBeVisible();
        expect(await demo<unknown[]>('dataSource.responses')).toHaveLength(1);
      },
    },
  ],
};
