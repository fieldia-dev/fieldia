import { expect, test, type Page } from '@playwright/test';
import { doubleLines, tile, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * What an app adds to the designer, used as a person uses it: the app's own
 * kind of field (an IBAN) from the toolbox, its setting, and Try it checking
 * what is typed; a template to start a blank form from, undone and another
 * picked; and the app's assistant describing a form, at a desktop's and a
 * phone's width, in English and in Arabic right to left.
 */

/** The question picked in the survey editor, open to edit. */
const picked = (page: Page) => page.locator('.fd-q-selected');

test.describe('an app’s own kind of field', () => {
  let problems: string[] = [];
  test.beforeEach(({ page }) => {
    problems = watch(page);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('in the survey: added from the toolbox, set to a country, checked in Try it', async ({ page }) => {
    await page.goto('/designer/');
    const ibanTile = tile(page, 'kind:iban');
    await expect(page.locator('.fd-tool-group[data-group="Your kinds"] .fd-tool-heading-name')).toHaveText('Your kinds');
    await ibanTile.click();
    await expect(picked(page).locator('.fd-q-label')).toBeFocused();
    await page.keyboard.type('Account for refunds');
    await expect(picked(page).getByRole('button', { name: 'Kind of question: IBAN' })).toBeVisible();
    await picked(page).getByLabel('Country').selectOption('DE');
    expect(await page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage().layout.children[0].children[0].options)).toEqual({ country: 'DE' });
    // The card draws the app's own widget.
    await expect(picked(page).locator('.demo-iban')).toBeVisible();
    await screen(page, 'extend-iban-survey-card');
    expect(await doubleLines(page)).toEqual([]);

    await page.getByRole('button', { name: 'Try it' }).click();
    const box = page.locator('.fd-try-frame').getByLabel('Account for refunds');
    await box.click();
    await page.keyboard.type('gb82west12345698765432');
    const check = page.locator('.fd-try-frame .demo-iban-check');
    await expect(check).toHaveText('An IBAN from Germany starts with DE');
    await expect(box).toHaveAttribute('aria-invalid', 'true');
    await box.fill('');
    await box.pressSequentially('DE89370400440532013001');
    await expect(box).toHaveValue('DE89 3704 0044 0532 0130 01');
    await expect(check).toHaveText('The check digits do not match: a character is wrong');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('0');
    await expect(check).toHaveText('This IBAN checks out');
    await expect(box).toHaveAttribute('aria-invalid', 'false');
    await screen(page, 'extend-iban-survey-try');
  });

  test('on a screen: its setting on the panel’s Content tab, and Try it at a phone’s width in Arabic', async ({ page }) => {
    await page.goto('/screen/?start=blank');
    await tile(page, 'kind:iban').click();
    await page.keyboard.type('Supplier IBAN');
    const panel = page.locator('.fd-properties');
    const row = panel.locator('[data-setting="IBAN settings"]');
    await expect(row).toBeVisible();
    await row.getByLabel('Country').selectOption('EG');
    await expect(page.locator('.fd-canvas-field.fd-editing').getByLabel('Country')).toHaveValue('EG');
    await screen(page, 'extend-iban-screen-panel');
    expect(await doubleLines(page)).toEqual([]);

    await page.getByRole('button', { name: 'Try it' }).click();
    await page.getByRole('button', { name: 'Phone' }).click();
    await page.getByRole('button', { name: 'العربية' }).click();
    const box = page.locator('.fd-try-frame .demo-iban input');
    await box.click();
    await page.keyboard.type('EG38001900050000000026318000');
    const check = page.locator('.fd-try-frame .demo-iban-check');
    await expect(check).toHaveText('رقم IBAN من مصر من 29 خانة، والمكتوب 28');
    await page.keyboard.type('2');
    await expect(check).toHaveText('رقم IBAN صحيح');
    await expect(box).toHaveValue('EG38 0019 0005 0000 0000 2631 8000 2');
    // The whole of it in view at a phone's width, its country first.
    expect(await box.evaluate((input) => input.scrollWidth <= input.clientWidth)).toBe(true);
    await screen(page, 'extend-iban-screen-try-rtl', { viewport: true });
  });

  test('at a phone’s width: the tile, the card and its setting fit', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/designer/');
    await tile(page, 'kind:iban').click();
    await page.keyboard.type('Account');
    await picked(page).getByLabel('Country').selectOption('SA');
    await expectNoSidewaysScroll(page);
    expect(await doubleLines(page)).toEqual([]);
    await picked(page).scrollIntoViewIfNeeded();
    await screen(page, 'extend-iban-phone', { viewport: true });
  });
});
