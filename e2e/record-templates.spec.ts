import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/** Record templates: a new course started from one the clinic saved, and a course saved as one by its name. */
test.describe('plain · record templates', () => {
  test('a new course starts from Botox package; a course is saved as a template by its name', async ({ page }) => {
    await open(page, 'plain', 'page=treatment-course&record=new&skin=outlined');
    await page.getByRole('button', { name: 'Templates' }).click();
    await page.getByRole('menuitem', { name: 'Botox package' }).click();
    await expect(node(page, 'f-treatment').locator('select option:checked')).toHaveText('Botox');
    await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.treatment)).toBe('botox');
    await expect(node(page, 'f-sessions').locator('.fd-repeat-words')).toHaveText('Every 2 weeks, 3 times');
    await expect(page.locator('.fd-say').filter({ hasText: 'Started from “Botox package”.' })).toBeVisible();
    await screen(page, 'templates-started', { viewport: true });
    await page.locator('.fd-title textarea, .fd-title input').first().fill('Nadia Samir');
    await page.getByRole('button', { name: 'Templates' }).click();
    await page.getByRole('menuitem', { name: 'Save as template…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Save as template…' });
    await dialog.getByRole('textbox', { name: 'Template name' }).fill('Botox, short course');
    await screen(page, 'templates-save-dialog', { viewport: true });
    await dialog.getByRole('button', { name: 'Save template' }).click();
    await expect(page.locator('.fd-say').filter({ hasText: 'Template “Botox, short course” saved.' })).toBeVisible();
    await page.getByRole('button', { name: 'Templates' }).click();
    await expect(page.getByRole('menuitem', { name: 'Botox, short course' })).toBeVisible();
  });
});
