import { expect, test } from '@playwright/test';
import { node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * A host app's own parts inside a Fieldia form: the "shout" field and the
 * "note" slot are written once per framework, in that framework's own way.
 */
for (const variant of VARIANTS) {
  test.describe(`${variant}: the app's own parts`, () => {
    test('a custom field reads and writes the form, and its label works', async ({ page }) => {
      await open(page, variant, 'page=custom&skin=outlined');
      await page.getByLabel('Nickname').fill('hello');
      await expect(node(page, 'f-nickname').locator('output')).toHaveText('HELLO!');
      expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.nickname)).toBe('hello');
      await page.evaluate(() => (window as any).fieldiaDemo.handle.form.setValue('nickname', 'set from outside'));
      await expect(page.getByLabel('Nickname')).toHaveValue('set from outside');
    });

    test('a slot keeps its own state and follows the form', async ({ page }) => {
      await open(page, variant, 'page=custom&skin=outlined');
      const note = node(page, 'note');
      await note.getByRole('button', { name: 'Clicked 0 times' }).click();
      await expect(note.getByRole('button', { name: 'Clicked 1 time' })).toBeVisible();
      await page.getByLabel('Nickname').fill('Sam');
      await expect(note.locator('.demo-hello')).toHaveText('Hello, Sam');
      await screen(page, `${variant}-custom-parts`);
    });

    test('a required custom field is checked like any other', async ({ page }) => {
      await open(page, variant, 'page=custom');
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(node(page, 'f-nickname').locator('.fd-error')).toHaveText('Nickname is required');
    });
  });
}
