import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';
import { followLink, part, told } from './support';

/** The stand-in phone over the form, where the codes the app sends by WhatsApp or SMS arrive. */
const standInPhone = (page: Page) => page.locator('.demo-phone-message');
/** The code the stand-in phone shows, read off it as a person reads it. */
async function codeOnThePhone({ page, see }: Hand) {
  await see(standInPhone(page)).toHaveText(/your code is \d{6}/);
  return /your code is (\d{6})/.exec((await standInPhone(page).textContent())!)![1];
}
/** The mobile typed, and a code asked for by WhatsApp: its box ready, the code on the stand-in phone. */
async function askForACode(hand: Hand, number: string) {
  const { page, press, type, keys, see } = hand;
  const mobile = part(page, 'f-phone');
  await type(mobile.getByRole('textbox', { name: 'Mobile', exact: true }), number, { clear: true });
  await keys('Tab');
  await press(mobile.getByRole('button', { name: 'Send a code by WhatsApp' }));
  const box = mobile.getByRole('textbox', { name: /^Code sent to/ });
  await see(box).toBeFocused();
  return codeOnThePhone(hand);
}
/** The code typed as the stand-in phone shows it: Confirmed. */
async function confirmMobile(hand: Hand, number: string) {
  const code = await askForACode(hand, number);
  await hand.page.keyboard.type(code, { delay: 15 });
  await hand.see(part(hand.page, 'f-phone').locator('.fd-verify-done')).toHaveText('Confirmed');
}
/** The latest response's: the list's last. */
const toldLast = (page: Page) => told(page).last();

export const replay: DemoReplay = {
  steps: [
    {
      says: 'Open it as Mona’s WhatsApp link: the unit says B-12',
      async run(hand) {
        const { page, see } = hand;
        await followLink(hand, 'Open it as Mona’s WhatsApp link');
        await see(page.getByRole('textbox', { name: 'Unit' })).toHaveValue('B-12');
        // Who sent them is in fields no one sees.
        await see(page.locator('[data-field="utm_source"], [data-field="agent_code"]')).toHaveCount(0);
      },
    },
    {
      says: 'Type a mobile, 010 1234 5678, and press Send a code by WhatsApp',
      async run(hand) {
        const { page, type, see } = hand;
        const mobile = part(page, 'f-phone');
        const code = await askForACode(hand, '010 1234 5678');
        await see(standInPhone(page)).toContainText('WhatsApp');
        await see(mobile.locator('.fd-verify-said')).toHaveText('We sent a code to +20 10 1234 5678 by WhatsApp. It works for 10 minutes.');
        const box = mobile.getByRole('textbox', { name: 'Code sent to +20 10 1234 5678' });
        const wrong = code === '000000' ? '111111' : '000000';
        await page.keyboard.type(wrong, { delay: 15 });
        await see(mobile.locator('.fd-verify-said')).toHaveText('That code is not right: 2 tries left.');
        await type(box, code, { clear: true });
        await see(mobile.locator('.fd-verify-done')).toHaveText('Confirmed');
      },
    },
    {
      says: 'Fill in your name, pick a viewing and Submit',
      async run({ page, press, type, see }) {
        await type(page.getByRole('textbox', { name: 'Full name', exact: true }), 'Hana Fouad');
        await press(page.getByRole('radio', { name: 'Book a viewing' }));
        await press(page.getByRole('button', { name: 'Submit', exact: true }));
        await see(page.locator('.fd-done-title')).toHaveText('Thank you, Hana Fouad');
        await see(page.locator('.fd-done-words')).toHaveText(['Your agent will call you within the hour about B-12.']);
        await see(told(page)).toHaveCount(1);
        const toldOf = (words: string) => toldLast(page).locator('dt', { hasText: words }).locator('xpath=following-sibling::dd[1]');
        await see(toldOf('Unit')).toHaveText('B-12');
        await see(toldOf('Source (hidden)')).toHaveText('whatsapp');
        await see(toldOf('Campaign (hidden)')).toHaveText('autumn-launch');
        await see(toldOf('Agent (hidden)')).toHaveText('mona');
      },
    },
    {
      says: 'Submit before the mobile is confirmed: it says so under the mobile',
      async run(hand) {
        const { page, press, type, keys, see } = hand;
        await press(page.getByRole('button', { name: 'Submit another response' }));
        const mobile = part(page, 'f-phone');
        await type(page.getByRole('textbox', { name: 'Full name', exact: true }), 'Hana Fouad', { clear: true });
        await type(mobile.getByRole('textbox', { name: 'Mobile', exact: true }), '010 1234 5678', { clear: true });
        await keys('Tab');
        await press(page.getByRole('radio', { name: 'Book a viewing' }));
        await press(page.getByRole('button', { name: 'Submit', exact: true }));
        await see(mobile.locator('.fd-error')).toHaveText('Mobile is not confirmed: send a code and type it in');
        await see(page.locator('.fd-done-title')).toBeHidden();
        await see(told(page)).toHaveCount(1);
        // Confirmed, then changed: a code asked for again. (Another number than the first: a number's code is asked
        // again only after 30 seconds, and says so.)
        await confirmMobile(hand, '011 2222 3333');
        await type(mobile.getByRole('textbox', { name: 'Mobile', exact: true }), '012 3456 7890', { clear: true });
        await keys('Tab');
        await see(mobile.locator('.fd-verify-done')).toBeHidden();
        await see(mobile.getByRole('button', { name: 'Send a code by WhatsApp' })).toBeVisible();
      },
    },
    {
      says: 'Pick Reserve the unit now and Submit: the payment step shows the EGP 10,000 fee',
      async run(hand) {
        const { page, press, see, demo } = hand;
        await confirmMobile(hand, '012 3456 7890');
        await press(page.getByRole('radio', { name: 'Reserve the unit now' }));
        await press(page.getByRole('button', { name: 'Submit', exact: true }));
        const step = page.locator('.fd-pay');
        await see(step).toBeVisible();
        await see(step.locator('.fd-pay-amount')).toHaveText(/^EGP\s10,000\.00$/);
        const responses = (await demo<unknown[]>('dataSource.responses')).length;
        await press(step.getByRole('button', { name: /^Pay EGP\s10,000\.00$/ }));
        await see(step.getByRole('textbox', { name: 'Card number' })).toBeVisible();
        await press(step.getByRole('button', { name: 'Decline the card' }));
        await see(step.locator('.fd-pay-said')).toHaveText('The payment did not go through: The card was declined. Nothing was sent.');
        expect(await demo<unknown[]>('dataSource.responses')).toHaveLength(responses);
        await press(step.getByRole('button', { name: 'Pay again' }));
        await press(step.getByRole('button', { name: 'Pay with this card' }));
        await see(page.locator('.fd-done-title')).toHaveText('B-12 is held for you, Hana Fouad');
        await see(page.locator('.fd-done-words')).toHaveText([/^Your reservation is R-\d+\. An agent will call you within the hour to book the signing\.$/]);
        await see(toldLast(page).locator('dt', { hasText: 'Payment taken' }).locator('xpath=following-sibling::dd[1]')).toHaveText(/^EGP 10,000 · PAY-\d{4}$/);
      },
    },
    {
      says: 'Open Karim’s Instagram link for C-3, change the unit to C-4 and Submit',
      async run(hand) {
        const { page, press, type, see } = hand;
        await followLink(hand, 'Open Karim’s Instagram link for C-3');
        const unit = page.getByRole('textbox', { name: 'Unit' });
        await see(unit).toHaveValue('C-3');
        await type(unit, 'C-4', { clear: true });
        await type(page.getByRole('textbox', { name: 'Full name', exact: true }), 'Omar Said', { clear: true });
        await confirmMobile(hand, '015 5555 6666');
        await press(page.getByRole('radio', { name: 'A call about prices and plans' }));
        await press(page.getByRole('button', { name: 'Submit', exact: true }));
        await see(page.locator('.fd-done-title')).toHaveText('Thank you, Omar Said');
        const toldOf = (words: string) => toldLast(page).locator('dt', { hasText: words }).locator('xpath=following-sibling::dd[1]');
        await see(toldOf('Unit')).toHaveText('C-4');
        await see(toldOf('Agent (hidden)')).toHaveText('karim');
        await see(toldOf('Source (hidden)')).toHaveText('instagram');
        await see(toldOf('Campaign (hidden)')).toHaveText('open-day');
      },
    },
  ],
};
