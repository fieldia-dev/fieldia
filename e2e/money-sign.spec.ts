import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * The currency sign has one place for a language and a currency, the same in
 * every total, cell and box: on an English sales order "E£ 64,656.00",
 * "E£ 8,413.44", "E£ 73,069.44" — never "73,069.44 E£" in the last; on a
 * German one after each amount, everywhere.
 */

/** Whether a money box writes its currency after the amount: its unit follows its input. */
const signAfter = (page: Page, id: string) =>
  node(page, id).locator('.fd-number').evaluate((box) => {
    const parts = [...box.children];
    return parts.findIndex((part) => part.classList.contains('fd-currency')) > parts.findIndex((part) => part.tagName === 'INPUT');
  });

for (const [locale, query, after] of [
  ['en', '', false],
  ['de', '&locale=de', true],
] as const) {
  test(`${locale}: the order’s amounts, cells and totals put the sign in one place`, async ({ page }) => {
    const { problems } = await open(page, 'plain', `page=order&skin=underline${query}`);
    for (const id of ['f-untaxed', 'f-tax', 'f-total']) expect(await signAfter(page, id), id).toBe(after);
    const lines = node(page, 'f-lines');
    const total = lines.locator('.ag-grid-pinned-bottom-rows .ag-cell[col-id="subtotal"]');
    const subtotal = lines.locator('.ag-row[row-index="1"] .ag-cell[col-id="subtotal"]');
    for (const shown of [total, subtotal]) {
      const text = (await shown.textContent())?.trim() ?? '';
      expect(after ? /E£$/.test(text) : /^E£/.test(text), text).toBe(true);
    }
    await node(page, 'f-total').scrollIntoViewIfNeeded();
    await screen(page, `money-sign-totals-${locale}`, { viewport: true });
    expect(problems).toEqual([]);
  });
}
