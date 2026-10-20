import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * One text in two languages, typed by people (`translate`), as a person meets it: a portal's listing whose title and
 * description are typed in Arabic and English under a switch — the reader's language first, Arabic written right to
 * left, a language still to type marked, a save refused in the language missing and the focus taken there — and a
 * clinic's services listed in the reader's language, a name typed in another alone marked with it, a search finding a
 * service by its name in either. Nothing is translated by a machine.
 */

const WIDE = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };
const tabs = (field: Locator) => field.getByRole('tab');
const tab = (field: Locator, name: string) => field.getByRole('tab', { name: new RegExp(`^${name}`) });
const shown = (field: Locator) => field.locator('[role="tabpanel"]:not([hidden])');
/** The box a language is typed in: named by the field's label and its language's tab. */
const box = (field: Locator) => shown(field).locator('[aria-labelledby*="-tab-"]');
const saved = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.calls.filter((call: { method: string }) => call.method === 'save').map((call: { request: { values: unknown } }) => call.request.values));

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

for (const variant of ['plain', 'react']) {
  test.describe(`${variant === 'plain' ? '' : `${variant}: `}a listing typed in Arabic and English`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(WIDE);
      ({ problems } = await open(page, variant, 'page=listing-languages&record=2&skin=underline'));
    });

    test('a switch over each text, the reader’s language first; the language still to type marked; Arabic right to left', async ({ page }) => {
      const title = node(page, 'f-title');
      await expect(tabs(title)).toHaveText([/^English/, /^العربية/]);
      await expect(tab(title, 'English')).toHaveAttribute('aria-selected', 'true');
      // English is still to type, and required: a screen reader is told so.
      await expect(tab(title, 'English')).toHaveAccessibleName('English required, not typed yet');
      await expect(box(title)).toHaveValue('');
      await expect(box(title)).toHaveAccessibleName(/^Title\W* English required, not typed yet$/);
      await tab(title, 'العربية').click();
      await expect(box(title)).toHaveValue('شقة بإطلالة على النيل في الزمالك');
      await expect(shown(title)).toHaveAttribute('dir', 'rtl');
      await expect(shown(title)).toHaveAttribute('lang', 'ar');
      if (variant === 'plain') await screen(page, 'two-languages-listing');
    });

    test('a save is refused in the language a required answer still needs, the focus taken there; typed, it is saved in both', async ({ page }) => {
      const title = node(page, 'f-title');
      await tab(title, 'العربية').click();
      await node(page, 'f-bedrooms').locator('input').fill('4');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(title.locator('.fd-error')).toHaveText('Title is required in English');
      await expect(tab(title, 'English')).toHaveAttribute('aria-selected', 'true');
      await expect(tab(title, 'English')).toHaveAttribute('data-fault', '');
      await expect(box(title)).toBeFocused();
      // The description is required in English alone, which it has: its Arabic may wait.
      await expect(node(page, 'f-description').locator('.fd-error')).toBeHidden();
      if (variant === 'plain') await screen(page, 'two-languages-refused');
      await box(title).fill('Nile-view flat in Zamalek');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect.poll(() => saved(page)).toHaveLength(1);
      expect((await saved(page))[0]).toMatchObject({ title: { ar: 'شقة بإطلالة على النيل في الزمالك', en: 'Nile-view flat in Zamalek' } });
      await expect(tab(title, 'English')).not.toHaveAttribute('data-empty', '');
    });

    test('the arrows move along a switch, Home and End to its ends; Tab goes on into the box', async ({ page }) => {
      const description = node(page, 'f-description');
      await tab(description, 'English').focus();
      await page.keyboard.press('ArrowRight');
      await expect(tab(description, 'العربية')).toBeFocused();
      await expect(tab(description, 'العربية')).toHaveAttribute('aria-selected', 'true');
      await expect(box(description)).toHaveValue('');
      await page.keyboard.press('Home');
      await expect(tab(description, 'English')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(box(description)).toBeFocused();
      await expect(box(description)).toHaveValue('Three bedrooms on the eighth floor, the Nile from every room, a doorman day and night.');
    });
  });
}

test.describe('a listing in Arabic', () => {
  test('puts Arabic first on each switch, the page right to left, English still left to right', async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=listing-languages&record=1&skin=outlined&locale=ar&dir=rtl'));
    const title = node(page, 'f-title');
    await expect(tabs(title)).toHaveText([/^العربية/, /^English/]);
    await expect(box(title)).toHaveValue('فيلا بحديقة في التجمع الخامس');
    // The arrows run as the page does: Left moves on, right to left.
    await tab(title, 'العربية').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(tab(title, 'English')).toHaveAttribute('aria-selected', 'true');
    await expect(shown(title)).toHaveAttribute('dir', 'ltr');
    await expect(box(title)).toHaveValue('Garden villa in the Fifth Settlement');
    await screen(page, 'two-languages-arabic');
  });

  test('on a phone, the switch over the box, nothing wider than the screen', async ({ page }) => {
    await page.setViewportSize(PHONE);
    ({ problems } = await open(page, 'plain', 'page=listing-languages&record=2&skin=outlined'));
    const title = node(page, 'f-title');
    const [switchBox, boxBox] = [await title.getByRole('tablist').boundingBox(), await box(title).boundingBox()];
    expect((switchBox?.y ?? 0) + (switchBox?.height ?? 0)).toBeLessThanOrEqual(boxBox?.y ?? 0);
    await expectNoSidewaysScroll(page);
    await screen(page, 'two-languages-phone');
  });
});

test.describe('a clinic’s services named in English and Arabic', () => {
  const rows = (page: Page) => page.locator('.fd-list-table tbody tr.fd-list-row');
  const names = (page: Page) => rows(page).locator('td[data-col="name"]');
  const search = (page: Page) => page.getByRole('combobox', { name: 'Search' });

  test('lists each in the reader’s language, a name typed in another alone shown in it, marked', async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=services-languages&skin=underline'));
    await expect(rows(page)).toHaveCount(8);
    const arabicOnly = names(page).filter({ hasText: 'حشو تجميلي' });
    await expect(arabicOnly.locator('bdi[lang="ar"]')).toHaveText('حشو تجميلي');
    await expect(arabicOnly.locator('.fd-lang-mark')).toHaveText('AR (in Arabic)');
    await expect(names(page).filter({ hasText: 'Chemical peel' }).locator('.fd-lang-mark')).toHaveCount(0);
    await screen(page, 'two-languages-services');
  });

  test('finds a service by its name in either language', async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=services-languages&skin=underline'));
    await expect(rows(page)).toHaveCount(8);
    await search(page).fill('تنظيف');
    await search(page).press('Enter');
    await expect(names(page)).toHaveText(['Teeth cleaning']);
    await page.getByRole('button', { name: /^Remove/ }).first().click();
    await expect(rows(page)).toHaveCount(8);
    await search(page).fill('whitening');
    await search(page).press('Enter');
    await expect(names(page)).toHaveText(['Teeth whitening']);
  });

  test('in Arabic, each in Arabic, the English-only one marked; its page a switch over its name and its notes', async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=services-languages&skin=underline&locale=ar&dir=rtl'));
    await expect(rows(page)).toHaveCount(8);
    const englishOnly = names(page).filter({ hasText: 'Chemical peel' });
    await expect(englishOnly.locator('.fd-lang-mark')).toHaveText('EN (باللغة الإنجليزية)');
    await expect(names(page).filter({ hasText: 'تنظيف الأسنان' })).toHaveCount(1);
    await screen(page, 'two-languages-services-arabic');
    await names(page).filter({ hasText: 'تنظيف الأسنان' }).click();
    const notes = node(page, 'f-notes');
    await expect(tabs(notes)).toHaveText([/^العربية/, /^English/]);
    await expect(box(notes)).toHaveText('تناول طعامك كالمعتاد قبل الزيارة.');
  });

  test('on a phone, cards with each name in the reader’s language', async ({ page }) => {
    await page.setViewportSize(PHONE);
    ({ problems } = await open(page, 'plain', 'page=services-languages&skin=underline'));
    const card = page.locator('.fd-list-card').filter({ hasText: 'حشو تجميلي' });
    await expect(card.locator('.fd-list-card-title .fd-lang-mark')).toHaveText('AR (in Arabic)');
    await expectNoSidewaysScroll(page);
  });
});
