import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/** Presence and live updates: Mona at the front desk opens the course, then changes its price, which arrives in it. */
test.describe('plain · live records', () => {
  test('Mona’s initials over the course; her price arrives and is said; after a change here, the conflict waits', async ({ page }) => {
    await open(page, 'plain', 'page=treatment-course&record=1&skin=outlined');
    await page.getByRole('button', { name: 'Mona opens this course' }).click();
    await expect(page.locator('.fd-presence')).toContainText('Also here: Mona Adel');
    await page.getByRole('button', { name: 'Mona changes the price' }).click();
    await expect(page.locator('.fd-say').filter({ hasText: 'Mona Adel changed Course price.' })).toBeVisible();
    await expect(node(page, 'f-price').locator('input')).toHaveValue(/10,000/);
    await screen(page, 'live-arrived', { viewport: true });
    await node(page, 'f-notes').locator('textarea').fill('Moved to Thursdays');
    await page.getByRole('button', { name: 'Mona changes the price' }).click();
    await expect(page.locator('.fd-conflict')).toContainText('Mona Adel changed this course');
    await expect(node(page, 'f-notes').locator('textarea')).toHaveValue('Moved to Thursdays');
    await screen(page, 'live-conflict', { viewport: true });
  });
});
