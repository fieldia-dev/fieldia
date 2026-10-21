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
