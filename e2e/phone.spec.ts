import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * Phone numbers the world over, as a person uses them: the contact page (its page says `"phone": { "country": "EG",
 * "shown": "national" }`) shows its numbers from several countries as people read them, with a call and a WhatsApp
 * link; a number is typed at home's way or with its +, its country picked or following the keys, checked by that
 * country, kept as E.164 and refused, with why, when it does not read. The customers' list writes its phone column
 * the same way. In Firefox and WebKit too: it is a box of its own.
 */

const WIDE = { width: 1440, height: 900 };
const value = (page: Page, name: string) => page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);
const stored = (page: Page, id: number, name: string) => page.evaluate(([i, n]) => (window as any).fieldiaDemo.dataSource.records['res.partner'][i]?.[n], [id, name] as const);
const box = (page: Page, id: string) => node(page, id).locator('.fd-phone-input');
const country = (page: Page, id: string) => node(page, id).locator('.fd-phone-country');
const link = (page: Page, id: string, name: 'Call' | 'WhatsApp') => node(page, id).getByRole('link', { name: new RegExp(`^${name === 'Call' ? 'Call' : 'Message'} `) });

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

test.describe('a contact’s phone numbers', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=real-contact&record=7001&skin=underline'));
  });

  test('are shown as people read them, Egypt’s at home’s way, with a call and a WhatsApp link', async ({ page }) => {
    await expect(box(page, 'f-phone')).toHaveValue('02 2537 4100');
    await expect(box(page, 'f-mobile')).toHaveValue('010 0537 4100');
    await expect(country(page, 'f-mobile')).toContainText('+20');
    await expect(link(page, 'f-mobile', 'Call')).toHaveAttribute('href', 'tel:+201005374100');
    await expect(link(page, 'f-mobile', 'WhatsApp')).toHaveAttribute('href', 'https://wa.me/201005374100');
    await expect(link(page, 'f-mobile', 'WhatsApp')).toHaveText('WhatsApp');
    await screen(page, 'phone-contact');
    // Its people's numbers from other countries, abroad's way, on their cards.
    await page.locator('button[data-node="tab-contacts"]').click();
    const rania = node(page, 'f-children').locator('.fd-repeat-card[data-line="c7010"]');
    await expect(rania.locator('.fd-phone-input').last()).toHaveValue('+971 50 123 4567');
    await expect(rania.locator('.fd-phone-input').first()).toHaveValue('+971 4 331 6600');
    await expect(node(page, 'f-children').locator('.fd-repeat-card[data-line="c7002"] .fd-phone-input').last()).toHaveValue('+44 7700 900123');
    await screen(page, 'phone-contact-cards');
  });

  test('takes a number typed at home, keeps it as E.164 and saves it', async ({ page }) => {
    const mobile = box(page, 'f-mobile');
    await mobile.click();
    await mobile.press('Control+A');
    await mobile.pressSequentially('010 1234 5678');
    // Typed: no links until it is read.
    await expect(link(page, 'f-mobile', 'Call')).toBeHidden();
    await mobile.press('Tab');
    await expect(mobile).toHaveValue('010 1234 5678');
    await expect.poll(() => value(page, 'mobile')).toBe('+201012345678');
    await expect(link(page, 'f-mobile', 'WhatsApp')).toHaveAttribute('href', 'https://wa.me/201012345678');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => stored(page, 7001, 'mobile')).toBe('+201012345678');
  });

  test('takes a number typed with its + in its own country, the flag following the keys, shown abroad’s way', async ({ page }) => {
    const mobile = box(page, 'f-mobile');
    await mobile.click();
    await mobile.press('Control+A');
    await mobile.pressSequentially('+971 5');
    await expect(country(page, 'f-mobile')).toContainText('+971');
    await mobile.pressSequentially('0 123 4567');
    await mobile.press('Tab');
    await expect(mobile).toHaveValue('+971 50 123 4567');
    await expect.poll(() => value(page, 'mobile')).toBe('+971501234567');
    await expect(country(page, 'f-mobile')).toHaveAttribute('title', 'United Arab Emirates');
  });

  test('reads a number in the country picked from the list', async ({ page }) => {
    const select = country(page, 'f-phone').locator('select');
    await expect(select).toHaveAccessibleName('Country of Phone');
    await select.selectOption('SA');
    const phone = box(page, 'f-phone');
    // The number it held, its Egyptian code swapped for Saudi Arabia's, read there: no Saudi number starts so.
    await expect(node(page, 'f-phone').locator('.fd-error')).toBeHidden();
    await phone.click();
    await phone.press('Control+A');
    await phone.pressSequentially('011 464 7700');
    await phone.press('Tab');
    await expect(phone).toHaveValue('+966 11 464 7700');
    await expect.poll(() => value(page, 'phone')).toBe('+966114647700');
  });

  test('refuses a letter and says why; a number that does not read stays, with why, and Save refuses it', async ({ page }) => {
    const mobile = box(page, 'f-mobile');
    await mobile.click();
    await mobile.press('Control+A');
    await mobile.pressSequentially('010 1x');
    await expect(mobile).toHaveValue('010 1');
    await expect(node(page, 'f-mobile').locator('.fd-refusal-hint')).toHaveText('A phone number takes digits, spaces and + ( ) . - only');
    // Backspace takes the held key back, then the 1 before it.
    await mobile.press('Backspace');
    await mobile.press('Backspace');
    await expect(mobile).toHaveValue('010 ');
    await mobile.pressSequentially('234 567');
    await mobile.press('Tab');
    // Never lost: what was typed stays, marked, with why, and the field keeps its number.
    await expect(mobile).toHaveValue('010 234 567');
    const error = node(page, 'f-mobile').locator('.fd-error');
    await expect(error).toHaveText('Mobile: too short for a +20 number (Egypt)');
    await expect(mobile).toHaveAttribute('aria-invalid', 'true');
    await expect(link(page, 'f-mobile', 'Call')).toBeHidden();
    await expect(link(page, 'f-mobile', 'WhatsApp')).toBeHidden();
    await screen(page, 'phone-contact-too-short');
    // Saved from inside it (Ctrl+Enter): refused, its words still under it, the record as it was.
    await mobile.click();
    await mobile.press('Control+Enter');
    await expect(error).toHaveText('Mobile: too short for a +20 number (Egypt)');
    await expect(mobile).toHaveValue('010 234 567');
    expect(await stored(page, 7001, 'mobile')).toBe('+201005374100');
    // Put right, it reads and saves.
    await mobile.press('End');
    await mobile.pressSequentially('89');
    await mobile.press('Tab');
    await expect(error).toBeHidden();
    await expect(mobile).toHaveValue('010 2345 6789');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => stored(page, 7001, 'mobile')).toBe('+201023456789');
  });

  test('says when a number has no country to be read in, or a code no country has', async ({ page }) => {
    const phone = box(page, 'f-phone');
    await country(page, 'f-phone').locator('select').selectOption('');
    await phone.click();
    await phone.press('Control+A');
    await phone.pressSequentially('02 2537 4100');
    await phone.press('Tab');
    await expect(node(page, 'f-phone').locator('.fd-error')).toHaveText('Phone: choose its country, or write it with + and the country code');
    await phone.click();
    await phone.press('Control+A');
    await phone.pressSequentially('+999 1234 5678');
    await phone.press('Tab');
    await expect(node(page, 'f-phone').locator('.fd-error')).toHaveText('Phone: “+999” is no country’s code');
  });
});

test('in Arabic, right to left: the countries by their Arabic names, the number left to right at the start of its box', async ({ page }) => {
  await page.setViewportSize(WIDE);
  ({ problems } = await open(page, 'plain', 'page=real-contact&record=7001&skin=underline&locale=ar&dir=rtl'));
  await expect(box(page, 'f-mobile')).toHaveValue('010 0537 4100');
  await expect(country(page, 'f-mobile').locator('select option[value="EG"]')).toHaveText(/مصر/);
  await expect(link(page, 'f-mobile', 'WhatsApp')).toHaveCount(0);
  await expect(node(page, 'f-mobile').getByRole('link', { name: /واتساب/ })).toHaveAttribute('href', 'https://wa.me/201005374100');
  await expectNoSidewaysScroll(page);
  await screen(page, 'phone-contact-arabic');
});

test('on a phone’s width, the number’s links go under it and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  ({ problems } = await open(page, 'plain', 'page=real-contact&record=7001&skin=underline'));
  await expect(box(page, 'f-mobile')).toHaveValue('010 0537 4100');
  await expect(link(page, 'f-mobile', 'Call')).toBeVisible();
  await expectNoSidewaysScroll(page);
  await node(page, 'f-mobile').scrollIntoViewIfNeeded();
  await screen(page, 'phone-contact-narrow', { viewport: true });
});

test('the customers’ list writes each phone as people read it, however it was kept', async ({ page }) => {
  await page.setViewportSize(WIDE);
  ({ problems } = await open(page, 'plain', 'page=customers&skin=underline'));
  const phoneOf = (name: string) => page.locator('.fd-list-row', { hasText: name }).locator('td').nth(3);
  // Kept as typed, "+20 2 2345 6789"; kept as E.164, "+96264612200" and "+20403334400": each in its country's groups.
  await expect(phoneOf('Nile Traders')).toHaveText('+20 2 2345 6789');
  await expect(phoneOf('Bayt Interiors')).toHaveText('+962 6 461 2200');
  await expect(phoneOf('Delta Foods')).toHaveText('+20 40 333 4400');
  await screen(page, 'phone-customers-list');
});
