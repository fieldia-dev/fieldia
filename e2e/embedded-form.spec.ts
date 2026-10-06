import { expect, test, type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * A saved form placed in another: the Address form, made once, placed twice
 * in Delivery details. A person fills it as one form — the address's own
 * required fields refuse in their own words, inside the copy they belong to —
 * and the app gets the answers nested under each copy's name. In the screen
 * designer, the saved form is placed from the toolbox, drawn as the form will
 * draw it, kept to a version, and refused where it would hold the page itself.
 */

const part = (page: Page, id: string) => page.locator(`.fd-form-part[data-node="${id}"]`);
const box = (page: Page, partId: string, field: string) => part(page, partId).locator(`[data-node="${field}"] input`).first();

async function waitForAddress(page: Page, partId = 'delivery-address') {
  await expect(part(page, partId).locator('[data-node="street"]')).toBeVisible();
}

test.describe('a saved form placed twice', () => {
  test('shows a quiet placeholder while the Address form comes, then the form', async ({ page }) => {
    // The demo's app takes two seconds to fetch a saved form here.
    const { problems } = await open(page, 'plain', 'page=delivery&skin=outlined&pagesDelay=2000');
    const delivery = part(page, 'delivery-address');
    await expect(delivery.locator('.fd-form-part-note')).toHaveText('Loading…');
    await expect(delivery).toHaveAttribute('aria-busy', 'true');
    await screen(page, 'embedded-loading', { viewport: true });
    await waitForAddress(page);
    await expect(delivery).not.toHaveAttribute('aria-busy');
    await expect(delivery.locator(':scope > legend')).toHaveText('Delivery address');
    expect(problems).toEqual([]);
  });

  test('refuses an empty address in its own words, then sends the answers nested under each copy', async ({ page }) => {
    const { problems, demo } = await open(page, 'plain', 'page=delivery&skin=outlined');
    await waitForAddress(page);
    await page.locator('[data-node="full-name"] input').fill('Sara Adel');
    await page.getByRole('button', { name: 'Submit' }).click();
    // The address's own required fields, inside the copy they belong to, the focus on the first.
    const street = part(page, 'delivery-address').locator('[data-node="street"]');
    await expect(street.locator('.fd-error')).toHaveText('Street and number is required');
    await expect(part(page, 'delivery-address').locator('[data-node="city"] .fd-error')).toHaveText('City is required');
    await expect(street.locator('input')).toBeFocused();
    await expect(page.locator('.fd-announce')).toHaveText('Not sent. Check: Street and number (Delivery address), City (Delivery address)');
    expect(await axeFindings(page, 'delivery refused')).toEqual([]);
    await screen(page, 'embedded-refused');

    await street.locator('input').fill('12 Nile Street');
    await box(page, 'delivery-address', 'city').fill('Cairo');
    await expect(street.locator('.fd-error')).toBeHidden();
    // The same Address form again, for the invoice: answered apart.
    await page.getByText('Send the invoice to another address').click();
    await waitForAddress(page, 'billing-address');
    await box(page, 'billing-address', 'street').fill('3 Harbour Road');
    await box(page, 'billing-address', 'city').fill('Alexandria');
    // A rule of the Address form's own, inside the second copy.
    await box(page, 'billing-address', 'postcode').fill('21');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(part(page, 'billing-address').locator('[data-node="postcode"] .fd-error')).toHaveText('A postcode is five figures');
    await box(page, 'billing-address', 'postcode').fill('21500');
    await screen(page, 'embedded-filled');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('Thank you. Your answers were sent.')).toBeVisible();
    const responses = await demo<{ values: Record<string, unknown> }[]>('dataSource.responses');
    expect(responses[0].values).toEqual({
      full_name: 'Sara Adel',
      phone: null,
      bill_elsewhere: true,
      delivery_address: { street: '12 Nile Street', line2: null, city: 'Cairo', postcode: null, country: 'EG' },
      billing_address: { street: '3 Harbour Road', line2: null, city: 'Alexandria', postcode: '21500', country: 'EG' },
    });
    expect(problems).toEqual([]);
  });

  for (const variant of ['react', 'vue', 'angular']) {
    test(`works the same in ${variant}`, async ({ page }) => {
      const { problems, demo } = await open(page, variant, 'page=delivery&skin=outlined');
      await waitForAddress(page);
      await page.locator('[data-node="full-name"] input').fill('Sara Adel');
      await box(page, 'delivery-address', 'street').fill('12 Nile Street');
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(part(page, 'delivery-address').locator('[data-node="city"] .fd-error')).toHaveText('City is required');
      await box(page, 'delivery-address', 'city').fill('Cairo');
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(page.getByText('Thank you. Your answers were sent.')).toBeVisible();
      const responses = await demo<{ values: Record<string, unknown> }[]>('dataSource.responses');
      expect(responses[0].values['delivery_address']).toEqual({ street: '12 Nile Street', line2: null, city: 'Cairo', postcode: null, country: 'EG' });
      expect(responses[0].values).not.toHaveProperty('billing_address');
      expect(problems).toEqual([]);
    });
  }

  test('reads right to left in Arabic, the Address form in its own Arabic words', async ({ page }) => {
    await open(page, 'plain', 'page=delivery&skin=outlined&locale=ar&dir=rtl');
    await waitForAddress(page);
    const delivery = part(page, 'delivery-address');
    await expect(delivery.locator(':scope > legend')).toHaveText('عنوان التوصيل');
    await expect(delivery.locator('[data-node="street"] .fd-label')).toHaveText('الشارع والرقم');
    await page.getByRole('button', { name: 'إرسال' }).click();
    await expect(delivery.locator('[data-node="city"] .fd-error')).toHaveText('المدينة مطلوب');
    // The address's first box starts on the right, as the page does.
    const form = (await page.locator('.fd-form').boundingBox())!;
    const street = (await box(page, 'delivery-address', 'street').boundingBox())!;
    expect(form.x + form.width - (street.x + street.width)).toBeLessThan(form.width / 2);
    expect(await axeFindings(page, 'delivery, Arabic')).toEqual([]);
    await screen(page, 'embedded-arabic');
  });

  test('fits a phone, nothing scrolling sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, 'plain', 'page=delivery&skin=outlined');
    await waitForAddress(page);
    await page.getByText('Send the invoice to another address').click();
    await waitForAddress(page, 'billing-address');
    await expectNoSidewaysScroll(page);
    expect(await axeFindings(page, 'delivery, phone')).toEqual([]);
    await screen(page, 'embedded-phone');
  });
});

test.describe('placing a saved form in the screen designer', () => {
  const bar = (page: Page) => page.locator('.fd-designer-issues');
  const frame = (page: Page) => page.locator('.fd-canvas-form');

  test('places Address from the toolbox, keeps it to a version, and refuses one that would hold the page', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/screen/');
    await expect(page.locator('.fd-designer-bar')).toBeVisible();
    await page.locator('.fd-canvas-field').first().click();

    // “A saved form”, under More: a menu of the app's saved forms.
    const tile = page.locator('.fd-toolbox [data-tool="form:saved"]');
    await expect(tile).toHaveText('A saved form');
    await expect(tile.locator('xpath=ancestor::section[@data-group="More"]')).toHaveCount(1);
    await tile.click();
    const menu = page.getByRole('menu', { name: 'A saved form' });
    await expect(menu.getByRole('menuitemradio')).toHaveText(['Address', 'Visit follow-up', 'Customer']);
    await menu.getByRole('menuitemradio', { name: 'Address' }).click();

    // Drawn as the form will draw it, in a frame naming the saved form and its version: its title, its fields.
    await expect(frame(page)).toHaveCount(1);
    await expect(frame(page).locator('.fd-canvas-form-tag')).toHaveText('Saved form “Address” · latest version');
    await expect(frame(page).locator('.fd-form-part > legend')).toHaveText('Address');
    await expect(frame(page).locator('[data-saved-node="line2"] .fd-label')).toHaveText('Building, floor or flat');
    await expect(frame(page).getByRole('button', { name: 'Open it' })).toBeVisible();
    // Nothing in it is typed in here: a click on its street picks the saved form itself.
    const street = (await frame(page).locator('[data-saved-node="street"] input').boundingBox())!;
    await page.mouse.click(street.x + 20, street.y + street.height / 2);
    await expect(frame(page).locator('[data-saved-node="street"] input')).not.toBeFocused();
    expect(await page.evaluate(() => (window as any).fieldiaDesigner.designer.getState().selected)).toBe('form-1');
    await frame(page).scrollIntoViewIfNeeded();
    await screen(page, 'designer-saved-form', { viewport: true });

    // Kept to the first version: drawn as that version was.
    const panel = page.locator('.fd-properties');
    await expect(panel.getByLabel('Saved form')).toHaveValue('address');
    await expect(panel.getByLabel('Answers go under')).toHaveValue('address');
    await panel.getByLabel('Version').selectOption('1');
    await expect(frame(page).locator('.fd-canvas-form-tag')).toHaveText('Saved form “Address” · version 1');
    await expect(frame(page).locator('[data-saved-node="line2"]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage().layout.children[0].children.find((n: { type: string }) => n.type === 'form'))).toMatchObject({
      type: 'form',
      page: 'address',
      version: 1,
      name: 'address',
    });
    expect(await axeFindings(page, 'designer, saved form picked')).toEqual([]);
    await screen(page, 'designer-saved-form-pinned', { viewport: true });

    // The Visit follow-up places this very page: placing it here is refused, saying why.
    await tile.click();
    await page.getByRole('menu', { name: 'A saved form' }).getByRole('menuitemradio', { name: 'Visit follow-up' }).click();
    await expect(bar(page)).toHaveText('“Visit follow-up” holds this page: it would be placed inside itself (Site visit → Visit follow-up → Site visit)');
    await expect(frame(page)).toHaveCount(1);
    await screen(page, 'designer-saved-form-cycle', { viewport: true });

    // Open it: the editor opens the Address form itself.
    await frame(page).getByRole('button', { name: 'Open it' }).click();
    await expect(page.locator('.fd-designer-bar input').first()).toHaveValue('Address');
    expect(problems).toEqual([]);
  });

  test('right to left, the frame mirrors with the canvas', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/screen/');
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    await page.locator('.fd-toolbox [data-tool="form:saved"]').click();
    await page.getByRole('menu', { name: 'A saved form' }).getByRole('menuitemradio', { name: 'Address' }).click();
    const shown = frame(page);
    await expect(shown.locator('[data-saved-node="street"]')).toBeVisible();
    const head = (await shown.locator('.fd-canvas-form-head').boundingBox())!;
    const icon = (await shown.locator('.fd-canvas-form-head > svg').boundingBox())!;
    // The icon leads on the right.
    expect(icon.x).toBeGreaterThan(head.x + head.width / 2);
    await shown.scrollIntoViewIfNeeded();
    await screen(page, 'designer-saved-form-rtl', { viewport: true });
  });
});
