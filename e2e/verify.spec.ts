import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * Proof that the person owns the phone they give (the enquiry's mobile, `options.verify` by WhatsApp or SMS): Send a
 * code, the code typed — wrong, then right — Confirmed, and the answers sent with the app's proof; a send before it is
 * confirmed refused under the field; a number changed after it asks again. The demo's app sends the code to a stand-in
 * phone over the form, as WhatsApp would.
 */

const MONA = 'page=unit-enquiry&skin=outlined&utm_source=whatsapp&agent=mona&unit=B-12';
const sent = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses as { values: Record<string, unknown>; verified?: Record<string, { value: string; proof?: string }> }[]);
const lastCode = (page: Page) => page.evaluate(() => {
  const codes = (window as any).fieldiaDemo.dataSource.codes as { code: string }[];
  return codes[codes.length - 1]?.code as string;
});

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

for (const variant of ['plain', 'react']) {
  test.describe(`${variant === 'plain' ? '' : `${variant}: `}a phone proved by a code`, () => {
    test('asks for a code by WhatsApp, refuses a wrong one, and sends the proof once it is right', async ({ page }) => {
      ({ problems } = await open(page, variant, MONA));
      const phone = node(page, 'f-phone');
      await node(page, 'f-name').locator('input').fill('Hana Fouad');
      // Nothing to send a code to yet.
      await expect(phone.getByRole('button', { name: /Send a code/ })).toHaveCount(0);
      await phone.locator('input').first().fill('010 1234 5678');
      await phone.locator('input').first().press('Tab');
      await node(page, 'f-visit').getByRole('radio', { name: 'Book a viewing' }).check();
      // Sent before it is confirmed: refused under the field, nothing sent.
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(phone.locator('.fd-error')).toHaveText('Mobile is not confirmed: send a code and type it in');
      expect(await sent(page)).toEqual([]);
      await phone.getByRole('button', { name: 'Send a code by WhatsApp' }).click();
      await expect(phone.locator('.fd-verify-said')).toHaveText('We sent a code to +20 10 1234 5678 by WhatsApp. It works for 10 minutes.');
      const box = phone.getByRole('textbox', { name: 'Code sent to +20 10 1234 5678' });
      await expect(box).toBeFocused();
      await expect(box).toHaveAttribute('autocomplete', 'one-time-code');
      await expect(phone.locator('.fd-verify-wait')).toHaveText(/^Send again in 0:[0-3]\d$/);
      if (variant === 'plain') await screen(page, 'verify-code-sent');
      await box.fill('000000');
      await expect(phone.locator('.fd-verify-said')).toHaveText('That code is not right: 2 tries left.');
      await box.fill(await lastCode(page));
      await expect(phone.locator('.fd-verify-done')).toHaveText('Confirmed');
      await expect(phone.locator('.fd-error')).toBeHidden();
      if (variant === 'plain') await screen(page, 'verify-confirmed');
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(page.locator('.fd-done-title')).toHaveText('Thank you, Hana Fouad');
      const [response] = await sent(page);
      expect(response.verified).toEqual({ phone: { value: '+201012345678', proof: 'proved:code-1' } });
    });

    test('a number changed after it was confirmed asks for a code again; Enter in the code box never sends the form', async ({ page }) => {
      ({ problems } = await open(page, variant, MONA));
      const phone = node(page, 'f-phone');
      const number = phone.locator('input').first();
      await number.fill('010 1234 5678');
      await number.press('Tab');
      await phone.getByRole('button', { name: 'Send a code by SMS' }).click();
      const box = phone.getByRole('textbox', { name: /Code sent to/ });
      await box.fill('12');
      await box.press('Enter');
      await expect(phone.locator('.fd-verify-said')).toHaveText('That code is not right: 2 tries left.');
      await expect(page.locator('.fd-done')).toBeHidden();
      await box.fill(await lastCode(page));
      await expect(phone.locator('.fd-verify-done')).toBeVisible();
      await number.fill('011 2222 3333');
      await number.press('Tab');
      await expect(phone.locator('.fd-verify-done')).toBeHidden();
      await expect(phone.getByRole('button', { name: 'Send a code by WhatsApp' })).toBeVisible();
    });
  });
}

test.describe('a row a field adds as it is left moves nothing under the pointer', () => {
  /**
   * A person's click: the pointer down on where they aimed, then up — whatever lies there by then gets it. What they
   * aimed at has not moved while the pointer is down: the box left says what it adds once the press has ended.
   */
  async function pointAndPress(page: Page, target: ReturnType<Page['locator']>) {
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    expect((await target.boundingBox())!.y).toBe(box.y);
    await page.mouse.up();
  }

  test('the mobile typed, then Book a viewing pressed with the mouse: picked, the code’s buttons shown after', async ({ page }) => {
    // The owner's walk of 0.31: leaving the mobile added "Send a code" and pushed the form 42px under the pointer.
    await open(page, 'plain', MONA);
    const phone = node(page, 'f-phone');
    await phone.locator('input').first().click();
    await page.keyboard.type('010 1234 5678');
    const viewing = node(page, 'f-visit').getByRole('radio', { name: 'Book a viewing' });
    await pointAndPress(page, viewing);
    await expect(viewing).toBeChecked();
    await expect(phone.getByRole('button', { name: 'Send a code by WhatsApp' })).toBeVisible();
    await screen(page, 'verify-left-by-a-press', { viewport: true });
  });

  test('an amount in shorthand, left by a press below it: the press lands where it was aimed', async ({ page }) => {
    await open(page, 'plain', 'page=lease&skin=underline');
    const rent = page.locator('#fd1-f-rent');
    await rent.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('120k');
    await expect(page.locator('.fd-shorthand-said')).toBeVisible();
    // The first rent's month, under it in its column.
    const below = node(page, 'f-first-rent').locator('input').first();
    await pointAndPress(page, below);
    await expect(below).toBeFocused();
    await expect(page.locator('.fd-shorthand-said')).toBeHidden();
  });

  test('a field a condition shows as a box is left: a country typed, then Tags below pressed — the region shown after', async ({ page }) => {
    // The customer's how-to: “Type in Country”. A name typed and left is looked up as the box is left, and Region
    // (shown once there is a country) appears under it — which pushed Tags down under the pointer pressing it.
    await open(page, 'plain', 'page=customer&skin=outlined');
    const country = node(page, 'f-country').locator('input');
    const region = node(page, 'f-region');
    await country.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Tab');
    await expect(region).toBeHidden();
    await country.click();
    await page.keyboard.type('Egypt');
    const tags = node(page, 'f-tags').locator('input').first();
    await pointAndPress(page, tags);
    await expect(tags).toBeFocused();
    await expect(country).toHaveValue('Egypt');
    await expect(region).toBeVisible();
    await screen(page, 'condition-shown-after-a-press', { viewport: true });
  });
});

test.describe('on a phone, a row a field adds as it is left moves nothing under the finger', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the mobile typed, then Book a viewing tapped: picked; its links and the code’s buttons shown after', async ({ page }) => {
    await open(page, 'plain', MONA);
    const phone = node(page, 'f-phone');
    await phone.locator('input').first().click();
    await page.keyboard.type('010 1234 5678');
    const viewing = node(page, 'f-visit').getByRole('radio', { name: 'Book a viewing' });
    await viewing.scrollIntoViewIfNeeded();
    const box = (await viewing.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(viewing).toBeChecked();
    await expect(phone.getByRole('link', { name: /^Call / })).toBeVisible();
    await expect(phone.getByRole('button', { name: 'Send a code by WhatsApp' })).toBeVisible();
    await screen(page, 'verify-left-by-a-tap', { viewport: true });
  });

  test('a country typed, then Tags below tapped: Tags has the focus; the region a condition shows comes after', async ({ page }) => {
    await open(page, 'plain', 'page=customer&skin=outlined');
    const country = node(page, 'f-country').locator('input');
    const region = node(page, 'f-region');
    await country.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Tab');
    await expect(region).toBeHidden();
    await country.click();
    await page.keyboard.type('Egypt');
    const tags = node(page, 'f-tags').locator('input').first();
    await tags.scrollIntoViewIfNeeded();
    const box = (await tags.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(tags).toBeFocused();
    await expect(region).toBeVisible();
    await screen(page, 'condition-shown-after-a-tap', { viewport: true });
  });
});
