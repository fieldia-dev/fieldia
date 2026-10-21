import { expect, test } from './fixtures';
import { open, screen } from './support';

/** Undo on the toast after a one-tap press: Mark done says so with Undo for a few seconds, and Undo puts the course back. */
const stateOf = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.records['clinic.course']['1'].state as string);

test.describe('plain · undo after a press', () => {
  test('Mark done says it with Undo, and Undo puts the course back in progress', async ({ page }) => {
    await open(page, 'plain', 'page=treatment-course&record=1&skin=outlined');
    await page.locator('[data-node="b-done"]').click();
    const toast = page.locator('.fd-say').filter({ hasText: 'Course marked done' });
    await expect(toast).toBeVisible();
    await expect.poll(() => stateOf(page)).toBe('done');
    await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Done');
    await screen(page, 'press-undo-toast', { viewport: true });
    await toast.getByRole('button', { name: 'Undo' }).click();
    // The same toast, its words now what Undo did.
    await expect(page.locator('.fd-say > span')).toHaveText(['Undone.']);
    await expect.poll(() => stateOf(page)).toBe('running');
    await expect(page.locator('[data-node="b-done"]')).toBeVisible();
    await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('In progress');
  });
});
