import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * Undo and Redo while filling, as a person presses them: Ctrl+Z (⌘Z) takes back the record's last change across
 * fields, Ctrl+Shift+Z makes it again; inside a box typed in, the browser's own undo goes through what was typed there
 * first — each engine's own — and the record's once it has taken it all back.
 */
test.describe('plain · undo while filling', () => {
  test('takes back a field changed, from the next field, the field taking the focus; and makes it again', async ({ page }) => {
    await open(page, 'plain', 'page=fields&skin=outlined');
    const name = node(page, 'f-name').locator('input');
    await name.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' B');
    await page.keyboard.press('Tab');
    await node(page, 'f-email').locator('input').focus();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(name).toHaveValue('Office fit-out');
    await expect(name).toBeFocused();
    await expect(page.locator('.fd-undo-heard')).toHaveText('Undone: Project');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(name).toHaveValue('Office fit-out B');
    await screen(page, 'undo-redone', { viewport: true });
  });

  test("in a box typed in, the browser's own undo first, then the record's: a tick taken back", async ({ page }) => {
    await open(page, 'plain', 'page=fields&skin=outlined');
    const signed = node(page, 'f-signed').locator('input');
    const ticked = await signed.isChecked();
    await signed.click();
    await expect(signed).toBeChecked({ checked: !ticked });
    const email = node(page, 'f-email').locator('input');
    const was = await email.inputValue();
    await email.click();
    await page.keyboard.press('End');
    await page.keyboard.type('x');
    await expect(email).toHaveValue(`${was}x`);
    // The browser's own: the letter typed goes, the tick stays.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(email).toHaveValue(was);
    await expect(signed).toBeChecked({ checked: !ticked });
    // Nothing left of it there: the record's, the tick taken back.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(signed).toBeChecked({ checked: ticked });
    await expect(email).toHaveValue(was);
  });
});
