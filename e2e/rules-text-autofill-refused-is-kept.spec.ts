import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { open } from './support';

/**
 * Found by the 0.23 input-rules check (text boxes), MINOR. Email, phone and web-address boxes ask the browser to fill
 * them (`autocomplete="email"`, "tel", "url"). Autofill writes without keys: the value, an `input` with no inputType,
 * then `change`. Where the guard refuses what it writes (a ":" before the @, a letter in a phone number, past the most
 * characters), it treats it as an edit that could not be stopped: put back, words said — and, in a box that already held
 * a value, nothing of it held, so what the browser filled is gone and the old value saved. Into an empty box the same text
 * is held and kept whole, and the field's check says why (a paste over the most is "kept whole, for the person to
 * shorten"). Either way the person should find what was filled in the box, marked, and Save refused.
 */

const stateOf = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState() as { values: Record<string, unknown>; errors: Record<string, string | undefined> });

for (const [node, field, filled] of [
  ['f-email', 'email', 'ali:x@example.com'],
  ['f-phone', 'phone', '+20 1oo 123 4567'],
] as const) {
  test(`${node}: "${filled}" filled by the browser into a box that held a value stays in the box, and Save is refused`, async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const box = page.locator(`[data-node="${node}"] input.fd-input`);
    await box.evaluate((input: HTMLInputElement, text) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, filled);
    const saved = await page.evaluate(() => (window as any).fieldiaDemo.handle.form.save());
    const after = await stateOf(page);
    expect({ box: await box.inputValue(), value: after.values[field], saved }).toEqual({ box: filled, value: filled, saved: false });
    expect(problems).toEqual([]);
  });
}
