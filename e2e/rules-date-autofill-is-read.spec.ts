import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { open } from './support';

/**
 * Found by the 0.23 input-rules check (dates). A browser's autofill (or a password manager, or an extension) writes a
 * box without keys and without the focus: the value set natively, then an `input` with no inputType, then `change`.
 * Fieldia's date box (date-box.ts) reads its text only once it was entered (`settle` returns while `entered` is null)
 * and its `change` only while it has the focus, and takes text on `input` only when it reads whole. So text written
 * so that does not read — 31/02/2026, a two-digit year, 10/15/2026 on a day-first page, a time of one-digit minutes —
 * is never read: it is not kept unread, the field keeps its old day, a save goes through with it, and the box's text
 * is put back over at the next redraw. Text boxes read the same `change` (text-box.ts) and do keep it.
 */

type State = { values: Record<string, unknown>; unread: Record<string, { text: string; message: string } | undefined> };
const stateOf = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState() as State);

/** What a browser's autofill does to a box it fills: the value, an input with no inputType, then change — no focus, no keys. */
const autofill = (page: Page, selector: string, text: string) =>
  page.locator(selector).evaluate((box: HTMLInputElement, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(box, value);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new Event('change', { bubbles: true }));
  }, text);

test.describe('a date box written by autofill', () => {
  for (const [query, node, field, text, nth] of [
    ['page=fields&skin=outlined', 'f-start', 'start_date', '31/02/2026', 0],
    ['page=fields&skin=outlined', 'f-start', 'start_date', '10/15/2026', 0],
    ['page=fields&skin=outlined', 'f-kickoff', 'kickoff', '15/10/2026 14:3', 0],
    ['page=business', 'f-dates', 'date_from', '15/10/26', 0],
    ['page=business', 'f-dates', 'date_to', '31/02/2026', 1],
  ] as const) {
    test(`${node} (${field}): "${text}" written by autofill is read — kept unread with why, and a save refuses it`, async ({ page }) => {
      const { problems } = await open(page, 'plain', query);
      const selector = `[data-node="${node}"] input.fd-input >> nth=${nth}`;
      const before = (await stateOf(page)).values[field];
      await autofill(page, selector, text);
      await expect(page.locator(selector)).toHaveValue(text);
      const saved = await page.evaluate(() => (window as any).fieldiaDemo.handle.form.save());
      const after = await stateOf(page);
      // What a person sees after the save: the autofilled text still in the box, marked, and the save refused.
      expect({ unread: after.unread?.[field]?.text, saved, value: after.values[field], box: await page.locator(selector).inputValue() }).toEqual({ unread: text, saved: false, value: before, box: text });
      expect(problems).toEqual([]);
    });
  }
});
