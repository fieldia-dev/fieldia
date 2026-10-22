import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * A payment the answers wait for, as a buyer meets it on the enquiry (its page's `payment`: a reservation fee where the
 * visit reserves the unit): Submit's checks pass, the questions give way to the fee and Pay; the app's stand-in checkout
 * drawn in the step; a declined card says nothing was sent; paid, the reservation's reference — the payment among what
 * the app was told. Without reserving, no fee is asked.
 */

const MONA = 'page=unit-enquiry&skin=outlined&utm_source=whatsapp&agent=mona&unit=B-12';
const sent = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses as { values: Record<string, unknown>; payment?: Record<string, unknown> }[]);

/** The name and the mobile filled in, the mobile confirmed with the code the demo's app sent. */
async function aboutYou(page: Page) {
  await node(page, 'f-name').locator('input').fill('Hana Fouad');
  const phone = node(page, 'f-phone');
  await phone.locator('input').first().fill('010 1234 5678');
  await phone.locator('input').first().press('Tab');
  await phone.getByRole('button', { name: 'Send a code by WhatsApp' }).click();
  const code = await page.evaluate(() => {
    const codes = (window as any).fieldiaDemo.dataSource.codes as { code: string }[];
    return codes[codes.length - 1].code;
  });
  await phone.getByRole('textbox', { name: /Code sent to/ }).fill(code);
  await expect(phone.locator('.fd-verify-done')).toBeVisible();
}

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

for (const variant of ['plain', 'react']) {
  test.describe(`${variant === 'plain' ? '' : `${variant}: `}a unit reserved with a fee`, () => {
    test('takes the fee before anything is sent: declined, then paid, the reference said', async ({ page }) => {
      ({ problems } = await open(page, variant, MONA));
      await aboutYou(page);
      await node(page, 'f-visit').getByRole('radio', { name: 'Reserve the unit now' }).check();
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      const step = page.locator('.fd-pay');
      await expect(step).toBeVisible();
      await expect(step.getByRole('heading', { name: 'Reservation fee' })).toBeFocused();
      await expect(step.locator('.fd-pay-amount')).toHaveText(/^EGP\s10,000\.00$/);
      await expect(node(page, 'f-name')).toBeHidden();
      await step.getByRole('button', { name: /^Pay EGP\s10,000\.00$/ }).click();
      await expect(step.locator('.fd-pay-said')).toHaveText('Waiting for the payment…');
      // The app's own checkout, drawn in the step: a stand-in here.
      await expect(step.getByRole('textbox', { name: 'Card number' })).toBeVisible();
      if (variant === 'plain') await screen(page, 'payment-checkout');
      await step.getByRole('button', { name: 'Decline the card' }).click();
      await expect(step.locator('.fd-pay-said')).toHaveText('The payment did not go through: The card was declined. Nothing was sent.');
      expect(await sent(page)).toEqual([]);
      await step.getByRole('button', { name: 'Pay again' }).click();
      await step.getByRole('button', { name: 'Pay with this card' }).click();
      await expect(page.locator('.fd-done-title')).toHaveText('B-12 is held for you, Hana Fouad');
      await expect(page.locator('.fd-done-words')).toHaveText(['Your reservation is R-1201. An agent will call you within the hour to book the signing.']);
      const [response] = await sent(page);
      expect(response.payment).toMatchObject({ amount: 10000, currency: 'EGP', reference: expect.stringMatching(/^PAY-\d{4}$/) });
      if (variant === 'plain') {
        await expect(page.locator('.demo-sent-log dt', { hasText: 'Payment taken' }).locator('xpath=following-sibling::dd[1]')).toHaveText(/^EGP 10,000 · PAY-\d{4}$/);
        await screen(page, 'payment-paid');
      }
    });

    test('goes back to the answers with nothing sent, and asks no fee for a viewing', async ({ page }) => {
      ({ problems } = await open(page, variant, MONA));
      await aboutYou(page);
      await node(page, 'f-visit').getByRole('radio', { name: 'Reserve the unit now' }).check();
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await page.locator('.fd-pay').getByRole('button', { name: 'Back to the answers' }).click();
      await expect(page.locator('.fd-pay')).toBeHidden();
      await expect(node(page, 'f-visit')).toBeVisible();
      expect(await sent(page)).toEqual([]);
      await node(page, 'f-visit').getByRole('radio', { name: 'Book a viewing' }).check();
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(page.locator('.fd-done-title')).toHaveText('Thank you, Hana Fouad');
      const [response] = await sent(page);
      expect(response).not.toHaveProperty('payment');
    });
  });
}
