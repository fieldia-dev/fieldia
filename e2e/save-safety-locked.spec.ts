import { expect, test } from './fixtures';
import { harness, zzHeld, zzHold, zzRelease, zzState } from './race-support';

/**
 * A save whose answer locks the record (a done order the source lets no one change) while the person typed in it:
 * what they typed cannot be saved, and Save and Discard are hidden on a record only to read. The pager, which saves
 * what changed before it moves, then only tries again and is refused ("Done orders are locked.") each time: the
 * person cannot page on, and nothing offers to let the change go. It should ask instead.
 */
test('locked by its save while a phone was typed: Next asks to let the phone go, and Discard moves on', async ({ page }) => {
  const problems = await harness(page, { source: "{ can: { order: (values) => (values.stage === 'done' ? { edit: false, reason: 'Done orders are locked.' } : {}) } }" });
  await page.locator('#app .fd-statusbar button', { hasText: 'Done' }).click();
  const phone = page.locator('#app .fd-field[data-field="phone"] input');
  await zzHold(page, 'save');
  await phone.press('ControlOrMeta+Enter');
  await zzHeld(page, 'save');
  await phone.fill('+1 typed while saving');
  await zzRelease(page, 'save');
  await expect(page.locator('#app .fd-status')).toHaveText('Saved, but not all your changes.');
  expect(await zzState(page)).toMatchObject({ can: { edit: false }, unsent: ['phone'] });
  await page.locator('#app').getByRole('button', { name: 'Next record' }).click();
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('Discard your changes?');
  await ask.getByRole('button', { name: 'Discard' }).click();
  await expect(page.locator('#app .fd-title textarea')).toHaveValue('Order two');
  expect(problems).toEqual([]);
});
