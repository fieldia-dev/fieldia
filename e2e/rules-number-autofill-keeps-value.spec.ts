import { type Browser, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * Found by the 0.23 input-rules check (number boxes). MINOR. A browser's autofill (or a password manager) writes a box
 * without keys and without focusing it: the value through the native setter, a plain `input` event (no inputType),
 * then `change`. Into a number box never entered, text that does not read ("abc") is held by the guard and read on the
 * change as the box's own (widgets.ts `numberWidget` read()), and "the field keeps what it held as the box was entered":
 * `entered` was never set, so the field's value becomes null: Budget's 1,850,000 is gone from the form while the box
 * shows "abc" (Save is refused meanwhile, for the text). The rule: left so, the box keeps what was typed, marked, and
 * the field keeps what it held.
 */

const formState = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).fieldiaDemo.handle.form.getState();
    return { budget: s.values.budget, unread: s.unread.budget?.text ?? null };
  });
const budget = (page: Page) => node(page, 'f-budget').locator('input.fd-number-input').first();

/** Autofill: the value written as a browser writes it, no key, no focus. */
const autofill = (page: Page, text: string) =>
  budget(page).evaluate((box: HTMLInputElement, t) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(box, t);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new Event('change', { bubbles: true }));
  }, text);

async function check(page: Page) {
  expect((await formState(page)).budget).toBe(1850000);
  for (const text of ['abc', '12.345']) {
    await autofill(page, text);
    // What was written stays, marked; the field keeps 1,850,000.
    expect(await formState(page)).toEqual({ budget: 1850000, unread: text });
  }
}

test.describe('a number box written by autofill', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('chromium: text that does not read, autofilled into a box never entered, leaves the field its value', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    await check(page);
  });

  for (const engine of ['firefox', 'webkit'] as const) {
    test(`${engine}: text that does not read, autofilled into a box never entered, leaves the field its value`, async ({ playwright, baseURL }) => {
      const browser: Browser = await playwright[engine].launch();
      try {
        const page = await browser.newPage({ baseURL });
        const found = await open(page, 'plain', 'page=fields&skin=outlined');
        await check(page);
        expect(found.problems).toEqual([]);
      } finally {
        await browser.close();
      }
    });
  }
});
