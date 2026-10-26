import type { DemoReplay } from '../hand';

/** The template-contact-us demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Choose Help with something under What is it',
      async run({ page, see }) {
        const order = page.getByRole('textbox', { name: 'Order or account number' });
        await see(order).toBeHidden();
        // The page's own list (a <select>): its option picked as the browser's list picks it.
        await page.getByRole('combobox', { name: 'What is it about?' }).selectOption({ label: 'Help with something' });
        await see(order).toBeVisible();
        await see(page.locator('[data-node="f-order"]').getByText('On your receipt or in your account.')).toBeVisible();
      },
    },
    {
      says: 'Press Submit with nothing filled in: each',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Submit' }));
        // Each required field left empty says so — What is it about? was chosen in the step before.
        await see(page.locator('[data-node="f-name"] .fd-error')).toHaveText('Your name is required');
        await see(page.locator('[data-node="f-email"] .fd-error')).toHaveText('Email is required');
        await see(page.locator('[data-node="f-message"] .fd-error')).toHaveText('Your message is required');
        await see(page.getByRole('alert').filter({ hasText: 'Not sent.' })).toHaveText('Not sent. Check: Your name, Email, Your message');
        await see(page.getByRole('textbox', { name: 'Your name' })).toBeFocused();
      },
    },
  ],
};
