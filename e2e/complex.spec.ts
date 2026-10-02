import { expect, test, type Page } from '@playwright/test';
import { node, open, screen } from './support';
import { VARIANTS } from './variants';

/** The complex fields on the customer sheet, in every framework. */
const record = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values);
const stored = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.records.partner[1]);

for (const variant of VARIANTS) {
  test.describe(`${variant}: complex fields`, () => {
    test('a many2one finds, chooses, and runs onchange', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=outlined');
      const country = node(page, 'f-country').getByRole('combobox');
      await country.fill('jor');
      await expect(node(page, 'f-country').getByRole('option', { name: 'Jordan' })).toBeVisible();
      await screen(page, `${variant}-customer-picker`);
      await node(page, 'f-country').getByRole('option', { name: 'Jordan' }).click();
      await expect(country).toHaveValue('Jordan');
      await expect.poll(async () => (await record(page)).currency_id).toEqual({ id: 2, label: 'JOD' });
      const region = node(page, 'f-region').getByRole('combobox');
      await region.click();
      await expect(node(page, 'f-region').getByRole('option')).toHaveText(['Amman']);
    });

    test('a many2one answers to the keyboard', async ({ page }) => {
      await open(page, variant, 'page=customer');
      const country = node(page, 'f-country').getByRole('combobox');
      await country.fill('a');
      await expect(node(page, 'f-country').getByRole('option')).toHaveCount(2);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(country).toHaveValue('Saudi Arabia');
      await country.fill('zz');
      await page.keyboard.press('Escape');
      await expect(country).toHaveValue('Saudi Arabia');
    });

    test('tags are added and removed', async ({ page }) => {
      await open(page, variant, 'page=customer');
      const tags = node(page, 'f-tags');
      await tags.getByRole('button', { name: 'Remove Wholesale' }).click();
      await tags.getByRole('combobox').fill('vi');
      await tags.getByRole('option', { name: 'VIP' }).click();
      await expect(tags.locator('.fd-chip-label')).toHaveText(['VIP']);
      expect((await record(page)).tag_ids).toEqual([{ id: 11, label: 'VIP' }]);
    });

    test('lines are added, edited, removed and saved', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=underline');
      const lines = node(page, 'f-contacts');
      await lines.getByRole('button', { name: '+ Add a line' }).click();
      const added = lines.locator('tbody tr').nth(1);
      await expect(added.getByLabel('Name')).toBeFocused();
      await page.keyboard.type('Omar Farouk');
      await added.getByLabel('Job position').fill('Accountant');
      await lines.locator('tbody tr').first().getByRole('button', { name: 'Delete line' }).click();
      await expect(lines.locator('tbody tr')).toHaveCount(1);
      await screen(page, `${variant}-customer-lines`);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('.fd-status')).toHaveText('Saved');
      const contacts = (await stored(page)).child_ids;
      expect(contacts.map((c: { values: { name: string } }) => c.values.name)).toEqual(['Omar Farouk']);
    });

    test('a required line field is checked before saving', async ({ page }) => {
      await open(page, variant, 'page=customer');
      const lines = node(page, 'f-contacts');
      await lines.getByRole('button', { name: '+ Add a line' }).click();
      await lines.locator('tbody tr').nth(1).getByLabel('Job position').fill('Driver');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(lines.locator('tbody tr').nth(1).locator('.fd-cell-error').first()).toHaveText('Name is required');
    });

    test('a photo is uploaded and previewed', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=outlined');
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      await page.locator('.fd-avatar input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
      await expect(page.locator('.fd-avatar img')).toBeVisible();
      expect((await record(page)).image).toMatchObject({ name: 'logo.png', type: 'image/png', size: png.length });
      await screen(page, `${variant}-customer-avatar`);
    });

    test('formatted notes are edited in place', async ({ page }) => {
      await open(page, variant, 'page=customer');
      await page.getByRole('tab', { name: 'Notes' }).click();
      const notes = node(page, 'f-notes').locator('[contenteditable]');
      await expect(notes).toContainText('Pays within 30 days');
      await notes.click();
      await page.keyboard.press('End');
      await page.keyboard.type(' Ask for Mona.');
      await expect.poll(async () => (await record(page)).notes).toContain('Ask for Mona.');
    });

    test('the whole sheet reads right to left in Arabic', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=outlined&locale=ar');
      await expect(page.locator('.fd-form')).toHaveAttribute('dir', 'rtl');
      await expect(node(page, 'f-contacts').getByRole('button', { name: '+ إضافة سطر' })).toBeVisible();
      await screen(page, `${variant}-customer-arabic`);
    });
  });
}
