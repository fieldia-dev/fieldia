import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * Found by the 0.23 input-rules check (number boxes). A money box takes its places from its currency (widgets.ts
 * `numberWidget`, `limits()`), but an amount is judged only as it is typed or the box is left: when the currency is
 * changed afterwards, nothing reads the amount again.
 *
 * - BLOCKING: 12.345 typed under the Jordanian dinar (three places), then the currency changed to the Egyptian pound
 *   (two), is saved as 12.345 EGP. The box shows "12.345" beside E£, nothing is said, and Save goes through: check
 *   (core check.ts) looks at a field's `digits` only, never at its currency's places. The rule: money is read "as
 *   numbers, in its currency's places"; a value the rules say can never be valid is never saved.
 * - MINOR: "12.345" left under the pound is kept unread ("takes at most 2 decimal places"); changed to the dinar, it
 *   would read, but the words stay and Save is refused for a reason that no longer holds until the box is entered again.
 */

const stored = (page: Page, field: string) => page.evaluate((f) => (window as any).fieldiaDemo.dataSource.records.project[1][f], field);
const formState = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).fieldiaDemo.handle.form.getState();
    return { budget: s.values.budget, currency: s.values.currency_id?.label, unread: s.unread, errors: s.errors, status: s.status };
  });
const amount = (page: Page) => node(page, 'f-budget').locator('input.fd-number-input').first();
const currency = (page: Page) => node(page, 'f-budget').locator('input[role="combobox"]').first();
const errorOf = (page: Page) => node(page, 'f-budget').locator('.fd-error').first();

/** The currency picked beside the amount, by its code, as a person picks it: typed, then Enter on the only match. */
async function pick(page: Page, code: string) {
  const box = currency(page);
  await box.click();
  await box.press('Control+A');
  await box.pressSequentially(code);
  await expect(page.getByRole('option', { name: code })).toBeVisible();
  await box.press('Enter');
  await expect.poll(async () => (await formState(page)).currency).toBe(code);
}

async function typeAmount(page: Page, text: string) {
  const box = amount(page);
  await box.click();
  await box.press('Control+A');
  await box.pressSequentially(text);
  await page.keyboard.press('Tab');
}

test.describe('money: an amount read again when its currency changes', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('12.345 typed in dinars, the currency then changed to pounds: Save never writes 12.345 EGP, and says why', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    const before = await stored(page, 'budget');
    await pick(page, 'JOD');
    await typeAmount(page, '12.345');
    expect((await formState(page)).budget).toBe(12.345);
    await pick(page, 'EGP');
    await page.locator('.fd-form button[type="submit"].fd-button-primary').first().click();
    await expect.poll(async () => (await formState(page)).status).not.toBe('saving');
    // Never saved with three places in a currency of two.
    expect({ stored: await stored(page, 'budget'), currency: (await stored(page, 'currency_id'))?.label }).not.toEqual({ stored: 12.345, currency: 'EGP' });
    expect(await stored(page, 'budget')).toBe(before);
    await expect(errorOf(page)).toContainText('2 decimal places');
  });

  test('"12.345" kept unread in pounds reads once the currency is changed to dinars: no words left for a reason gone', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    await typeAmount(page, '12.345');
    expect((await formState(page)).unread['budget']?.text).toBe('12.345');
    await pick(page, 'JOD');
    const now = await formState(page);
    expect({ budget: now.budget, unread: now.unread['budget'] ?? null, error: now.errors['budget'] ?? null }).toEqual({ budget: 12.345, unread: null, error: null });
  });
});
