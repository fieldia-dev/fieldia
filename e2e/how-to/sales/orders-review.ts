import type { DemoReplay } from '../hand';

/** The orders-review demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press the arrow before an order’s number: its lines open under it, five at a time',
      async run({ page, press, see }) {
        const toggle = page.getByRole('button', { name: 'Order lines of S00119' });
        await see(toggle).toHaveAttribute('aria-expanded', 'false');
        await press(toggle);
        await see(toggle).toHaveAttribute('aria-expanded', 'true');
        const lines = page.getByRole('table', { name: 'Order lines of S00119' });
        const shown = lines.locator('[role="rowgroup"]:last-child > [role="row"]');
        await see(shown).toHaveCount(5);
        // Its sections across the rows, its lines with their quantities and prices.
        await see(lines.locator('[data-kind="section"]').first()).toHaveText('Workstations');
        await see(lines.getByRole('columnheader', { name: 'Quantity' })).toBeVisible();
        const pager = page.getByRole('group', { name: 'Order lines of S00119' });
        await see(pager).toContainText('1–5 / 8');
        const firstShown = await shown.first().textContent();
        await press(pager.getByRole('button', { name: 'Next page' }));
        await see(pager).toContainText('6–8 / 8');
        await see(shown).toHaveCount(3);
        await see(shown.first()).not.toHaveText(firstShown ?? '');
      },
    },
    {
      says: 'Open another order too: both stay open. On a row, Right opens it and Left closes it',
      async run({ page, phone, press, keys, see }) {
        await press(page.getByRole('button', { name: 'Order lines of S00120' }));
        await see(page.getByRole('table', { name: 'Order lines of S00120' })).toBeVisible();
        await see(page.getByRole('table', { name: 'Order lines of S00119' })).toBeVisible();
        // The keys, on a desktop: a phone has no arrow keys, its finger opens and closes each order as above.
        if (phone) return;
        // From the toggle just pressed, back to its row, then down to the next order's, past the lines opened.
        await keys('Shift+Tab', 'Shift+Tab');
        await see(page.locator('.fd-list-row').filter({ hasText: 'S00120' })).toBeFocused();
        await keys('ArrowDown');
        const third = page.locator('.fd-list-row').filter({ hasText: 'S00121' });
        await see(third).toBeFocused();
        await keys('ArrowRight');
        await see(page.getByRole('table', { name: 'Order lines of S00121' })).toBeVisible();
        await see(third.getByRole('button', { name: 'Order lines of S00121' })).toHaveAttribute('aria-expanded', 'true');
        await keys('ArrowLeft');
        await see(page.getByRole('table', { name: 'Order lines of S00121' })).toHaveCount(0);
        await see(page.getByRole('table', { name: 'Order lines of S00119' })).toBeVisible();
      },
    },
    {
      says: 'Press an order’s row anywhere else: the order opens on its own page',
      async run({ page, press, see, seePage }) {
        await press(page.locator('.fd-list-row').filter({ hasText: 'S00120' }).getByText('Giza Plaza').filter({ visible: true }));
        await seePage().toHaveURL(/page=order&.*record=\d+/);
        await see(page.locator('[data-node="#title"] textarea, [data-node="#title"] input').first()).toHaveValue('S00120');
        await see(page.getByRole('combobox', { name: 'Customer' })).toHaveValue('Giza Plaza');
      },
    },
  ],
};
