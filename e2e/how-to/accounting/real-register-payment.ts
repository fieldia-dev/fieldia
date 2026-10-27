import type { DemoReplay } from '../hand';

/** “Register a payment” (real-register-payment): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'The amount is less than what is due: the payment difference shows',
      async run({ page, see }) {
        await see(page.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('3,000.00');
        await see(page.getByRole('textbox', { name: 'Payment Difference' })).toHaveValue('498.00');
        await see(page.getByRole('radio', { name: 'Keep open' })).toBeChecked();
        await see(page.getByRole('radio', { name: 'Mark as fully paid' })).toBeVisible();
      },
    },
    {
      says: 'Choose Mark as fully paid: the account to post the difference in',
      async run({ page, press, see }) {
        await see(page.getByRole('combobox', { name: 'Post Difference In*' })).toBeHidden();
        await press(page.getByRole('radio', { name: 'Mark as fully paid' }));
        await see(page.getByRole('radio', { name: 'Mark as fully paid' })).toBeChecked();
        await see(page.getByRole('combobox', { name: 'Post Difference In*' })).toBeVisible();
        await see(page.getByRole('textbox', { name: 'Label*' })).toHaveValue('Write-Off');
      },
    },
    {
      says: 'Change the currency beside the amount to EGP',
      async run({ page, press, type, see }) {
        await see(page.getByRole('textbox', { name: 'Manual Exchange Rate' })).toBeVisible();
        const currency = page.getByRole('combobox', { name: 'Currency' });
        await type(currency, 'EGP', { clear: true });
        await press(page.getByRole('option', { name: 'EGP', exact: true }));
        await see(currency).toHaveValue('EGP');
        // What is due, 3,498.00 dollars, at the day's rate.
        await see(page.getByRole('textbox', { name: 'Amount', exact: true })).toHaveValue('169,653.00');
        await see(page.getByRole('textbox', { name: 'Manual Exchange Rate' })).toBeHidden();
      },
    },
    {
      says: 'Pick the Bank — CIB journal and the Postdated Check method',
      async run({ page, press, type, see }) {
        const journal = page.getByRole('combobox', { name: 'Journal*' });
        await type(journal, 'CIB', { clear: true });
        await press(page.getByRole('option', { name: 'Bank — CIB', exact: true }));
        await see(journal).toHaveValue('Bank — CIB');
        await see(page.getByRole('textbox', { name: 'Check / Bill Number*' })).toBeHidden();
        const method = page.getByRole('combobox', { name: /^Payment Method/ });
        await type(method, 'Postdated', { clear: true });
        await press(page.getByRole('option', { name: 'Postdated Check', exact: true }));
        await see(method).toHaveValue('Postdated Check');
        // Asked for: shown, and required — Create Payment says so.
        await see(page.getByRole('textbox', { name: 'Check / Bill Number*' })).toBeVisible();
        await see(page.getByRole('textbox', { name: 'Check Due Date*' })).toBeVisible();
        await press(page.getByRole('button', { name: 'Create Payment', exact: true }));
        await see(page.locator('[data-node="f-bill-no"] .fd-error')).toHaveText('Check / Bill Number is required');
      },
    },
  ],
};
