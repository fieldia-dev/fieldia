import { expect, test } from './fixtures';
import { node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * A host app's own parts inside a Fieldia form: the badge field and the
 * printing desk's slot are written once per framework, in that framework's own way.
 */
for (const variant of VARIANTS) {
  test.describe(`${variant}: the app's own parts`, () => {
    test('a custom field reads and writes the form, and its label works', async ({ page }) => {
      await open(page, variant, 'page=custom&skin=outlined');
      // Nothing on the badge until a name is typed: no lone mark under an empty box.
      await expect(node(page, 'f-badge-name').locator('output')).toHaveText('');
      await expect(node(page, 'f-badge-name').locator('output')).toBeHidden();
      await page.getByLabel('Name on the badge').fill('Sara Hassan');
      await expect(node(page, 'f-badge-name').locator('output')).toHaveText('SARA HASSAN');
      expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.badge_name)).toBe('Sara Hassan');
      await page.evaluate(() => (window as any).fieldiaDemo.handle.form.setValue('badge_name', 'set from outside'));
      await expect(page.getByLabel('Name on the badge')).toHaveValue('set from outside');
    });

    test('a slot keeps its own state and follows the form', async ({ page }) => {
      await open(page, variant, 'page=custom&skin=outlined');
      const note = node(page, 'note');
      await expect(note.locator('.demo-hello')).toHaveText('Type a name to print its badge.');
      await note.getByRole('button', { name: 'Print the badge' }).click();
      await expect(note.getByRole('button', { name: 'Print again (1 printed)' })).toBeVisible();
      await page.getByLabel('Name on the badge').fill('Sam');
      await expect(note.locator('.demo-hello')).toHaveText('Ready to print the badge for Sam.');
      // Its own count, kept across the form's changes.
      await expect(note.getByRole('button', { name: 'Print again (1 printed)' })).toBeVisible();
      await screen(page, `${variant}-custom-parts`);
    });

    test('a required custom field is checked like any other', async ({ page }) => {
      await open(page, variant, 'page=custom');
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(node(page, 'f-badge-name').locator('.fd-error')).toHaveText('Name on the badge is required');
    });
  });
}
