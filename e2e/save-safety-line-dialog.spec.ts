import { expect, test } from './fixtures';
import { harness, zzHeld, zzHold, zzRelease, zzState } from './race-support';

/**
 * A line's own dialog, opened while the pager's save of the order is on its way: once the pager has moved on, what
 * the dialog hands back is for the order it was opened on. Laid on the order shown by then, it writes one order's
 * line over another's — here both orders' first lines have the key a memory source gives a form's first new line in
 * a session, as two orders made in two visits each have.
 */
test('a line’s dialog saved after the pager moved on never writes order 1’s line over order 2’s', async ({ page }) => {
  const problems = await harness(page);
  const phone = page.locator('#app .fd-field[data-field="phone"] input');
  await phone.fill('+1 changed');
  await zzHold(page, 'save');
  await page.locator('#app').getByRole('button', { name: 'Next record' }).click();
  await zzHeld(page, 'save');
  // Order 1's line, opened while its save is on its way, its quantity changed.
  await page.locator('#app .fd-line-open').first().click();
  const dialog = page.locator('.fd-form-dialog');
  await expect(dialog.locator('.fd-field[data-field="label"] input')).toHaveValue('Desk');
  await dialog.locator('.fd-field[data-field="qty"] input').fill('9');
  await zzRelease(page, 'save');
  await expect(page.locator('#app .fd-title input')).toHaveValue('Order two');
  await dialog.getByRole('button', { name: 'Save & Close' }).click();
  await expect(dialog).toHaveCount(0);
  // Order 2 keeps its own line, and nothing of order 1's is a change to save in it.
  const now = await zzState(page);
  expect(now.recordId).toBe(2);
  expect(now.values.lines).toMatchObject([{ id: 2, values: { label: 'Chair', qty: 4 } }]);
  expect(now.dirty).toEqual([]);
  expect(problems).toEqual([]);
});
