import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { open } from './support';

/**
 * Found by the 0.23 input-rules check (colour code). The colour code box (colour.ts `hexWidget`) keeps "the colour held
 * as the box was entered" in `entered`, set on focus and null before. Text written into the box without the focus — a
 * browser's autofill, a password manager, an extension: the value, an `input` with no inputType, then `change` — that is
 * not a whole code ("#12345") makes the box put back `entered`, which is null: the field's colour is cleared, the redraw
 * that follows empties the box before its `change` can keep the text unread, and a save goes through with no colour.
 * The rule: text that does not read never changes the colour; it stays in the box, marked, with why.
 */

const stateOf = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState() as { values: Record<string, unknown>; unread: Record<string, { text: string } | undefined> });

test('a half colour code written into the code box without the focus keeps the colour, and is kept unread', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=business');
  const code = page.locator('[data-node="f-epic-color"] input.fd-colour-code');
  const before = (await stateOf(page)).values['epic_color'];
  expect(before).toBe('#2c8397');
  await code.evaluate((box: HTMLInputElement) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(box, '#12345');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const saved = await page.evaluate(() => (window as any).fieldiaDemo.handle.form.save());
  const after = await stateOf(page);
  expect({ colour: after.values['epic_color'], unread: after.unread?.['epic_color']?.text, box: await code.inputValue(), saved }).toEqual({ colour: '#2c8397', unread: '#12345', box: '#12345', saved: false });
  expect(problems).toEqual([]);
});
