import { expect, test } from '@playwright/test';
import { node, open, screen } from './support';
import { VARIANTS } from './variants';

/** Ctrl+Enter (Cmd+Enter on a Mac) saves; Enter moves to the next field when a page asks; arrows stay the text box's. */
for (const variant of VARIANTS) {
  test.describe(`${variant} · keys`, () => {
    test('Ctrl+Enter saves the record from the field being typed in, a tag not yet added included', async ({ page }) => {
      const { demo } = await open(page, variant, 'page=fields&skin=outlined');
      const tags = node(page, 'f-materials').getByRole('combobox');
      await tags.fill('concrete');
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect.poll(() => demo<string>('dataSource.records.project.1.materials')).toBe('oak, glass, concrete');
      await expect(node(page, 'f-materials').locator('.fd-chip-label')).toHaveText(['oak', 'glass', 'concrete']);
    });

    test('in a text box a plain Enter starts a line and Ctrl+Enter saves it', async ({ page }) => {
      const { demo } = await open(page, variant, 'page=fields&skin=outlined');
      const scope = node(page, 'f-scope').locator('textarea');
      await scope.click();
      await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Phase two: the roof terrace.');
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect.poll(() => demo<string>('dataSource.records.project.1.scope')).toMatch(/kitchen\.\nPhase two: the roof terrace\.$/);
    });

    test('Enter moves to the next field when the page asks, and the arrow keys stay the text box’s', async ({ page }) => {
      const { demo } = await open(page, variant, 'page=signup&skin=outlined&enterToNext=1');
      const name = node(page, 'f-name').locator('input');
      await name.click();
      await page.keyboard.type('Sara Hasan');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.type('s');
      await expect(name).toHaveValue('Sara Hassan');
      await page.keyboard.press('Enter');
      await expect(node(page, 'f-email').locator('input')).toBeFocused();
      await page.keyboard.type('sara@example.com');
      await page.keyboard.press('Enter');
      await expect(node(page, 'f-company').locator('input')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(node(page, 'f-role').locator('select')).toBeFocused();
      await screen(page, `${variant}-keys-enter-to-next`, { viewport: true });
      expect(await demo('dataSource.responses')).toEqual([]);
    });

    test('Enter sends a sign-up as before when the page does not ask otherwise', async ({ page }) => {
      await open(page, variant, 'page=signup&skin=outlined');
      await node(page, 'f-name').locator('input').fill('Sara Hassan');
      await node(page, 'f-name').locator('input').press('Enter');
      // Sent, and refused for the questions still empty: the focus goes to the first of them.
      await expect(node(page, 'f-email').locator('input')).toBeFocused();
      await expect(node(page, 'f-email').locator('.fd-error')).toBeVisible();
    });

    test('Ctrl+Enter in a dialog saves and closes it', async ({ page }) => {
      await open(page, variant, 'page=fields&skin=outlined');
      await node(page, 'f-client').getByRole('button', { name: 'Open Nile Traders' }).click();
      const dialog = page.getByRole('dialog', { name: 'Nile Traders' });
      await dialog.locator('[data-node="#title"] input').fill('Nile Traders Co');
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect(dialog).toBeHidden();
      await expect(node(page, 'f-client').getByRole('combobox')).toHaveValue('Nile Traders Co');
    });
  });
}
