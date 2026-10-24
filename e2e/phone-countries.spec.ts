import { type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * A phone field's country, found by typing (the owner's walk of 23 Oct: the browser's own list of some 240 countries,
 * found only by scrolling). Pressed, its flag opens a box to type in over the list: each country with its flag and
 * its dialling code, the page's country and the reader's first; typed words find a country by its name in the page's
 * language or in English, its code ("ae") or its dialling code ("+971", "20"), the best first. The keys work it all —
 * typing on the flag opens it, the arrows move, Enter picks, Escape puts it away — and on a phone it opens as a sheet
 * from the foot of the screen. Right to left, in Arabic, it lists the countries by their Arabic names.
 */

const value = (page: Page, name: string) => page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);
const country = (page: Page, id: string) => node(page, id).locator('.fd-phone-country');
const finder = (page: Page) => page.getByRole('combobox', { name: 'Search countries' });
const rows = (page: Page) => page.getByRole('listbox', { name: 'Countries' }).getByRole('option');

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

test.describe('a phone’s country, found by typing', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    ({ problems } = await open(page, 'plain', 'page=real-contact&record=7001&skin=underline'));
  });

  test('pressed, it lists every country with its flag and code, the page’s and the reader’s first; typed, it finds one', async ({ page }) => {
    const button = country(page, 'f-phone');
    await expect(button).toHaveAccessibleName('Country of Phone');
    await expect(button).toHaveAccessibleDescription('Egypt');
    await button.click();
    await expect(finder(page)).toBeFocused();
    // Egypt, the page's; the United States, the reader's (the browser speaks en-US); then all, from Afghanistan.
    await expect(rows(page).nth(0)).toHaveText('🇪🇬Egypt+20');
    await expect(rows(page).nth(1)).toHaveText('🇺🇸United States+1');
    await expect(rows(page).nth(2)).toHaveText('🇦🇫Afghanistan+93');
    expect(await rows(page).count()).toBeGreaterThan(240);
    // The list hangs under the flag, over the page, inside the window.
    const [under, list] = [await button.boundingBox(), await page.locator('.fd-search-list:not([hidden])').boundingBox()];
    expect(list!.y).toBeGreaterThan(under!.y + under!.height - 1);
    expect(Math.abs(list!.x - under!.x)).toBeLessThan(2);
    await screen(page, 'phone-countries-open', { viewport: true });
    expect(await axeFindings(page, 'the phone’s countries open')).toEqual([]);

    for (const [typed, first] of [
      ['saudi', 'Saudi Arabia'],
      ['ae', 'United Arab Emirates'],
      ['+971', 'United Arab Emirates'],
      ['20', 'Egypt'],
      ['ger', 'Germany'],
    ] as const) {
      await finder(page).fill(typed);
      await expect(rows(page).first()).toContainText(first);
    }
    await finder(page).fill('Atlantis');
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'No country matches “Atlantis”' })).toBeVisible();
    await finder(page).fill('saudi');
    await screen(page, 'phone-countries-typed', { viewport: true });
    await rows(page).first().click();
    await expect(button).toContainText('+966');
    await expect(button).toHaveAccessibleDescription('Saudi Arabia');
    // Picked, the number is typed next: read in its country.
    const phone = node(page, 'f-phone').locator('.fd-phone-input');
    await expect(phone).toBeFocused();
    await phone.press('Control+A');
    await phone.pressSequentially('011 464 7700');
    await phone.press('Tab');
    await expect(phone).toHaveValue('+966 11 464 7700');
    await expect.poll(() => value(page, 'phone')).toBe('+966114647700');
  });

  test('the keys work it: typed on the flag it opens, the arrows move, Enter picks, Escape puts it away', async ({ page }) => {
    const button = country(page, 'f-mobile');
    await button.focus();
    await page.keyboard.type('jor');
    await expect(finder(page)).toBeFocused();
    await expect(finder(page)).toHaveValue('jor');
    await expect(rows(page).first()).toContainText('Jordan');
    await page.keyboard.press('Enter');
    await expect(button).toContainText('+962');
    await button.focus();
    await page.keyboard.press('ArrowDown');
    await expect(finder(page)).toBeFocused();
    // Opened on the one picked, in the whole list; the next row is a key away.
    await expect(page.locator('.fd-search-row[data-active]')).toContainText('Jordan');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.fd-search-row[data-active]')).toContainText('Kazakhstan');
    await page.keyboard.press('Escape');
    await expect(rows(page)).toHaveCount(0);
    await expect(button).toBeFocused();
    await expect(button).toContainText('+962');
    // Escape in the list closes the list alone: the record stays as it was.
    await expect(page.locator('.fd-form')).toBeVisible();
  });
});

/**
 * Where the owner looked: the gallery's first demo, the Customer record, and its Every field. Each page says its
 * phones' country (`phone`), so its Phone is read the world over, its country found by typing — not a text box. Opened,
 * the stored number is shown as it is and the record is not changed by it.
 */
for (const [demo, query, id, stored, shown] of [
  ['the Customer record', 'page=customer&skin=underline', 'f-phone', '+20 2 2345 6789', '+20 2 2345 6789'],
  ['Every field', 'page=fields&skin=outlined', 'f-phone', '+20 2 2345 6700', '+20 2 2345 6700'],
] as const) {
  test(`${demo}: its phone's country pressed and a country typed, as the owner did`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    ({ problems } = await open(page, 'plain', query));
    const button = country(page, id);
    await expect(button).toHaveAccessibleDescription('Egypt');
    const phone = node(page, id).locator('.fd-phone-input');
    await expect(phone).toHaveValue(shown);
    expect(await value(page, 'phone')).toBe(stored);
    expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().dirty)).toEqual([]);
    await button.click();
    await expect(finder(page)).toBeFocused();
    await expect(rows(page).first()).toHaveText('🇪🇬Egypt+20');
    await finder(page).fill('jord');
    await expect(rows(page).first()).toContainText('Jordan');
    await page.keyboard.press('Enter');
    await expect(button).toContainText('+962');
    await expect(button).toHaveAccessibleDescription('Jordan');
    await expect(phone).toBeFocused();
    await phone.press('ControlOrMeta+A');
    await phone.pressSequentially('06 461 2200');
    await phone.press('Tab');
    await expect(phone).toHaveValue('+962 6 461 2200');
    await expect.poll(() => value(page, 'phone')).toBe('+96264612200');
  });
}

test('on a phone it opens as a sheet from the foot of the screen, and Close puts it away', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  ({ problems } = await open(page, 'plain', 'page=real-contact&record=7001&skin=quiet&scheme=dark'));
  const button = country(page, 'f-phone');
  await button.scrollIntoViewIfNeeded();
  await button.click();
  const sheet = page.getByRole('dialog', { name: 'Country of Phone' });
  await expect(sheet).toBeVisible();
  await expect(finder(page)).toBeFocused();
  const box = (await sheet.boundingBox())!;
  expect(Math.round(box.x)).toBe(0);
  expect(Math.round(box.width)).toBe(390);
  expect(Math.round(box.y + box.height)).toBe(844);
  // Each row a finger's height.
  expect((await rows(page).first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await finder(page).fill('fra');
  await expect(rows(page).first()).toContainText('France');
  await expectNoSidewaysScroll(page);
  await screen(page, 'phone-countries-sheet', { viewport: true });
  // Tab stays in the sheet.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(sheet.locator(':focus')).toHaveCount(1);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
  await expect(button).toBeFocused();
  // Picked in the sheet, it is the field's.
  await button.click();
  await finder(page).fill('+44');
  await page.keyboard.press('Enter');
  await expect(sheet).toBeHidden();
  await expect(button).toContainText('+44');
});

test('in Arabic, right to left: the countries by their Arabic names, found in English too, the codes left to right', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  ({ problems } = await open(page, 'plain', 'page=real-contact&record=7001&skin=outlined&locale=ar&dir=rtl'));
  const button = country(page, 'f-mobile');
  await button.click();
  const find = page.getByRole('combobox', { name: 'ابحث عن بلد' });
  await expect(find).toBeFocused();
  for (const typed of ['مصر', 'egypt', 'eg', '+20']) {
    await find.fill(typed);
    await expect(page.getByRole('listbox', { name: 'البلدان' }).getByRole('option').first()).toHaveText('🇪🇬مصر+20');
  }
  // Under the flag from the start of the line: its right edge at the flag's.
  const [under, list] = [await button.boundingBox(), await page.locator('.fd-search-list:not([hidden])').boundingBox()];
  expect(Math.abs(list!.x + list!.width - (under!.x + under!.width))).toBeLessThan(2);
  await expect(page.locator('.fd-search-row .fd-search-trail').first()).toHaveAttribute('dir', 'ltr');
  await screen(page, 'phone-countries-arabic', { viewport: true });
  await find.press('Enter');
  await expect(button).toContainText('+20');
});
