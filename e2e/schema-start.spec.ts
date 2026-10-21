import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { screen } from './support';

/**
 * The designer's "Start from a schema…" on a blank screen, as a person uses it: paste a JSON Schema, see the fields it
 * makes with their kinds and what was kept with a change or left out, start, and find the fields on the canvas — the
 * dialog readable by everyone (axe), Undo there after.
 */
test('a blank screen starts from a JSON Schema: what it makes shown first, then the fields on the canvas, with Undo', async ({ page }) => {
  await page.goto('/screen/?start=blank');
  await expect(page.locator('.fd-designer-bar')).toBeVisible();
  await page.getByRole('button', { name: 'Start from a schema…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Start from a schema' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Schema, as JSON' })).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Start', exact: true })).toBeHidden();
  await dialog.getByRole('textbox', { name: 'Schema, as JSON' }).fill(
    JSON.stringify(
      {
        title: 'Property enquiry',
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', title: 'Client', maxLength: 80 },
          email: { type: 'string', format: 'email', description: 'We answer here.' },
          kind: { type: 'string', enum: ['villa', 'apartment', 'office'] },
          bedrooms: { type: 'integer', minimum: 1, maximum: 9 },
          moveIn: { type: 'string', format: 'date' },
          address: { type: 'object', properties: { street: { type: 'string' }, city: { type: 'string' } } },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      null,
      2
    )
  );
  await expect(dialog.locator('.fd-schema-count')).toHaveText('8 fields:');
  await expect(dialog.locator('.fd-schema-field')).toHaveText(['Client', 'Email', 'Kind', 'Bedrooms', 'Move in', 'Tags', 'Street', 'City']);
  await expect(dialog.locator('.fd-schema-notes').first()).toContainText('address’s properties are fields of their own');
  await screen(page, 'designer-start-from-schema', { viewport: true });
  expect(await axeFindings(page, 'start from a schema')).toEqual([]);

  await dialog.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.fd-start-done-words')).toHaveText('Started from the schema: 8 fields.');
  await expect(page.locator('.fd-canvas-field')).toHaveCount(8);
  await expect(page.locator('.fd-canvas-section', { hasText: 'Address' })).toBeVisible();
  await screen(page, 'designer-started-from-schema');
  await page.locator('.fd-start-done').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.fd-canvas-field')).toHaveCount(0);
});
