import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * Amounts typed in shorthand, as agents write them: a listing's price as 6m, a lease's yearly rent as 120k, and in
 * Arabic as ١٢٠ ألف — read on the digits by the number reader, the words for thousands and millions each engine's Intl
 * writes in the page's language; said under the box while typed, shown whole at rest, worked out from at once.
 */

const held = (page: import('@playwright/test').Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name] as number | null, field);

test.describe('amounts in shorthand', () => {
  test('a listing’s price typed as 6m, its price per m² worked out from it', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing&record=new&skin=underline');
    const area = node(page, 'f-area').locator('input');
    await area.click();
    await page.keyboard.type('123');
    const price = node(page, 'f-price').locator('input');
    await price.click();
    await page.keyboard.type('6m');
    await expect(node(page, 'f-price').locator('.fd-shorthand-said')).toHaveText('6m is 6,000,000');
    await screen(page, 'shorthand-typed');
    await page.keyboard.press('Tab');
    expect(await held(page, 'price')).toBe(6_000_000);
    await expect(price).toHaveValue('6,000,000');
    await expect.poll(() => held(page, 'price_per_meter')).toBe(48780.49);
    await expect(node(page, 'f-price-per-meter').locator('input')).toHaveValue('48,780.49');
    // A letter no shorthand begins with is refused, saying what the box takes.
    await price.click();
    await page.keyboard.press('End');
    await page.keyboard.type('q');
    await expect(node(page, 'f-price').locator('.fd-refusal-hint')).toHaveText(/^Price: numbers only, or short for thousands and millions, like 3\.5M$/);
    expect(problems).toEqual([]);
  });

  test('a lease’s yearly rent typed as 120k, and in Arabic as ١٢٠ ألف', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=lease&skin=underline&now=2026-10-21T09:00:00');
    const rent = node(page, 'f-rent').locator('input');
    await rent.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('1.2m');
    await page.keyboard.press('Tab');
    expect(await held(page, 'rent')).toBe(1_200_000);
    await expect(rent).toHaveValue('1,200,000');

    await open(page, 'plain', 'page=lease&skin=underline&locale=ar&now=2026-10-21T09:00:00');
    const arRent = node(page, 'f-rent').locator('input');
    await arRent.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText('١٢٠ ألف');
    await expect(node(page, 'f-rent').locator('.fd-shorthand-said')).toContainText('120,000');
    await screen(page, 'shorthand-arabic');
    await page.keyboard.press('Tab');
    expect(await held(page, 'rent')).toBe(120_000);
    expect(problems).toEqual([]);
  });
});
