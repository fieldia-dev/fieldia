import type { DemoReplay } from '../hand';

/** The real-sale-invoice-wizard demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Choose Down payment (percentage): Down Payment Amount appears with % beside it, and is required',
      async run({ page, press, see }) {
        const amount = page.locator('[data-node="f-amount"]');
        await see(amount).toBeHidden();
        await press(page.getByRole('radio', { name: 'Down payment (percentage)' }));
        await see(amount).toBeVisible();
        await see(amount.locator('.fd-label')).toContainText('Down Payment Amount');
        await see(amount.locator('.fd-unit')).toHaveText('%');
        await see(amount).toHaveClass(/\bfd-required\b/);
        await see(amount.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
      },
    },
    {
      says: 'Type 95: a warning says the down payment is more than is left to invoice',
      async run({ page, phone, press, keys, see }) {
        const amount = page.locator('[data-node="f-amount"]');
        await press(amount.getByRole('textbox'));
        await keys('Control+a');
        await page.keyboard.type('95', { delay: 15 });
        // Left: by Tab, or a finger on the page's heading.
        if (phone) await press(page.getByRole('heading', { name: 'Create invoices' }));
        else await keys('Tab');
        await see(amount.locator('.fd-warning')).toHaveText('The Down Payment is greater than the amount remaining to be invoiced.');
        await see(amount.getByRole('textbox')).toHaveValue('95.00');
      },
    },
    {
      says: 'Choose Down payment (fixed amount): the amount in Egyptian pounds takes its place',
      async run({ page, press, see }) {
        await press(page.getByRole('radio', { name: 'Down payment (fixed amount)' }));
        const fixed = page.locator('[data-node="f-fixed-amount"]');
        await see(page.locator('[data-node="f-amount"]')).toBeHidden();
        await see(fixed).toBeVisible();
        await see(fixed.locator('.fd-label')).toContainText('Down Payment Amount');
        await see(fixed).toContainText('E£');
        await see(fixed).toHaveClass(/\bfd-required\b/);
      },
    },
    {
      says: 'Open it for three orders at once: Order Count and Consolidated Billing show instead of the choice',
      async run({ page, follow, see }) {
        await follow('Open it for three orders at once');
        await see(page.locator('[data-node="f-count"]')).toContainText('Order Count');
        await see(page.locator('[data-node="f-count"]').getByRole('textbox')).toHaveValue('3');
        await see(page.locator('[data-node="f-consolidated"]')).toContainText('Consolidated Billing');
        await see(page.locator('[data-node="f-method"]')).toBeHidden();
        await see(page.getByRole('radio', { name: 'Down payment (percentage)' })).toHaveCount(0);
      },
    },
  ],
};
