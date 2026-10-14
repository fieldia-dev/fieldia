import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, node, screen } from './support';
import { VARIANTS } from './variants';

/**
 * "A part that fails" (demos/shared/contained.ts), in every framework: the app's delivery planner fails as it loads
 * and its price tag fails for a four-digit price, each written as that framework's own component. Each shows a small
 * box that names it, in its place; the console and the viewer's onError are told; and the rest of the form works and
 * saves. Nothing is left uncaught, and nothing else on the page moves.
 */

/** Open the demo, keeping what the console is told and anything thrown past Fieldia. */
async function openContained(page: Page, variant: string, query = '') {
  const told: string[] = [];
  const uncaught: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') told.push(message.text());
  });
  page.on('pageerror', (error) => uncaught.push(error.message));
  await page.goto(`/${variant}/?page=contained&skin=outlined${query}`);
  await expect(page.locator('.fd-form')).toBeVisible();
  await expect(node(page, 'f-customer').locator('input')).toHaveValue('Nile Traders');
  return { told, uncaught, demo: <T>(path: string) => page.evaluate((read) => read.split('.').reduce((value: any, key) => value?.[key], (window as any).fieldiaDemo), path) as Promise<T> };
}

for (const variant of VARIANTS) {
  test.describe(`${variant} · a part that fails`, () => {
    test('each failing part is a box that names it, onError hears where, and the rest of the form works and saves', async ({ page }) => {
      const { told, uncaught, demo } = await openContained(page, variant);
      // The planner failed as it loaded: its slot says so, as a status a screen reader says.
      const planner = node(page, 'n-planner').locator('.fd-broken');
      await expect(planner).toHaveText('This part could not be shown');
      await expect(planner).toHaveAttribute('role', 'status');
      // The price tag works for a three-digit price, and fails for a four-digit one.
      const price = node(page, 'f-price');
      await expect(price.locator('output')).toHaveText('EGP 450.00');
      await price.locator('input').fill('1200');
      await expect(price.locator('.fd-broken-words')).toHaveText('This field could not be shown: Price');
      // The change it could not show is not kept: the price is the one shown before, and the box says so.
      await expect(price.locator('.fd-broken-kept')).toHaveText('Your change was not kept: it is back to 450.00.');
      await expect(price.locator('input')).toHaveCount(0);
      // Its label and help stay: the person knows which field it was.
      await expect(price.locator('.fd-label')).toHaveText('Price');
      // The rest works: typed, saved, kept by the data source.
      await node(page, 'f-customer').locator('input').fill('Delta Foods');
      await node(page, 'f-notes').locator('textarea').fill('Call before noon.');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect.poll(() => demo<string>('dataSource.records.quote.1.customer')).toBe('Delta Foods');
      await expect.poll(() => demo<string>('dataSource.records.quote.1.notes')).toBe('Call before noon.');
      expect(await demo<number>('dataSource.records.quote.1.price')).toBe(450);
      // onError heard both, with where; the console was told; nothing was thrown past Fieldia.
      const log = page.locator('.demo-error-log li');
      await expect(log).toHaveCount(2);
      await expect(log.nth(0)).toContainText('"part":"slot"');
      await expect(log.nth(0)).toContainText('The delivery planner could not load its calendar');
      await expect(log.nth(1)).toContainText('"field":"price"');
      await expect(log.nth(1)).toContainText('four-digit prices are not supported yet');
      expect(told.some((said) => said.includes('[Fieldia] The slot "planner"'))).toBe(true);
      expect(told.some((said) => said.includes('[Fieldia] The field "price"'))).toBe(true);
      expect(uncaught).toEqual([]);
      await screen(page, `${variant}-contained`);
    });
  });
}

for (const variant of VARIANTS) {
  test.describe(`${variant} · a field that fails as it is typed in`, () => {
    test('typed at hand speed: no half-typed price is kept or saved, the box takes the focus and says so, and Tab goes on', async ({ page }) => {
      const { uncaught, demo } = await openContained(page, variant);
      const price = node(page, 'f-price');
      // As the demo's help says: click into the price, which holds 450, and type 1200. The first key makes 4501.
      await price.locator('input').click();
      await page.keyboard.press('End');
      await page.keyboard.type('1200', { delay: 120 });
      const box = price.locator('.fd-broken');
      await expect(box.locator('.fd-broken-words')).toHaveText('This field could not be shown: Price');
      await expect(box.locator('.fd-broken-kept')).toHaveText('Your change was not kept: it is back to 450.00.');
      // The keyboard kept its place: on the box, named by what failed; the keys after the first went nowhere else.
      await expect(box).toBeFocused();
      await expect(box).toHaveAccessibleName('This field could not be shown: Price');
      await expect(box).toHaveAccessibleDescription('Your change was not kept: it is back to 450.00.');
      await expect(node(page, 'f-customer').locator('input')).toHaveValue('Nile Traders');
      // Tab goes on to the next field, Shift+Tab comes back to the box.
      await page.keyboard.press('Tab');
      await expect(node(page, 'f-delivery').locator(':focus')).toHaveCount(1);
      await page.keyboard.press('Shift+Tab');
      await expect(box).toBeFocused();
      // The rest is changed and saved; the price stored is the one the person last saw.
      await node(page, 'f-customer').locator('input').fill('Delta Foods');
      await node(page, 'f-notes').locator('textarea').fill('Call before noon.');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect.poll(() => demo<string>('dataSource.records.quote.1.customer')).toBe('Delta Foods');
      expect(await demo<number>('dataSource.records.quote.1.price')).toBe(450);
      expect(uncaught).toEqual([]);
      await screen(page, `${variant}-contained-typed`);
    });
  });
}

test.describe('a part that fails, as a person sees it', () => {
  test('dark, right to left in Arabic, and on a phone: the boxes read, and nothing scrolls sideways', async ({ page }) => {
    await openContained(page, 'plain', '&scheme=dark');
    await node(page, 'f-price').locator('input').fill('1500');
    await expect(node(page, 'f-price').locator('.fd-broken')).toBeVisible();
    // The box's words on its own ground, in the dark scheme too: its colours come from the form's own.
    const colours = await node(page, 'f-price').locator('.fd-broken').evaluate((box) => {
      const style = getComputedStyle(box);
      return { text: style.color, ground: style.backgroundColor };
    });
    expect(colours.text).not.toBe(colours.ground);
    await screen(page, 'contained-dark');

    await openContained(page, 'plain', '&locale=ar&dir=rtl');
    await expect(node(page, 'n-planner').locator('.fd-broken')).toHaveText('تعذّر عرض هذا الجزء');
    await node(page, 'f-price').locator('input').fill('2000');
    await expect(node(page, 'f-price').locator('.fd-broken-words')).toHaveText('تعذّر عرض هذا الحقل: السعر');
    await expect(node(page, 'f-price').locator('.fd-broken-kept')).toHaveText('لم يُحتفَظ بتغييرك: عادت القيمة إلى 450.00.');
    // Its mark at the start of the line, which right to left is the right.
    const sides = await node(page, 'f-price').locator('.fd-broken').evaluate((box) => {
      const mark = box.querySelector('.fd-broken-mark') as HTMLElement;
      const words = box.querySelector('.fd-broken-words') as HTMLElement;
      return mark.getBoundingClientRect().left > words.getBoundingClientRect().left;
    });
    expect(sides).toBe(true);
    await screen(page, 'contained-rtl');

    await page.setViewportSize({ width: 390, height: 900 });
    await openContained(page, 'plain');
    await node(page, 'f-price').locator('input').fill('1001');
    await expect(node(page, 'f-price').locator('.fd-broken')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await screen(page, 'contained-phone');
  });
});
