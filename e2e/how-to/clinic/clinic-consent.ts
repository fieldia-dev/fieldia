import type { Page } from '@playwright/test';
import type { DemoReplay, Hand } from '../hand';
import { choose } from './support';

/** Today as the page writes a day: "26 Oct 2026". */
/** Today on the clinic's clock (the page's `timeZone`, Africa/Cairo), as the browser's clock has it: what the evidence writes. */
const today = (page: Page) => page.evaluate(() => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date()));

/** The consent's signature, and what is said under it. */
const consentSign = (page: Page) => page.locator('[data-node="f-signature"]');
const consentEvidence = (page: Page) => consentSign(page).locator('.fd-signature-evidence');
/**
 * Signed as a person signs: a few strokes on the pad at a hand's speed; on the phone, whose finger Playwright's WebKit
 * cannot draw with (no touch drag), the name typed in the pad's "Or type your name", which signs the same.
 */
async function signConsent({ page, phone, type }: Hand, name = 'Laila Mostafa') {
  if (phone) {
    await type(consentSign(page).getByRole('textbox', { name: 'Or type your name' }), name, { clear: true });
    return;
  }
  const pad = consentSign(page).locator('canvas');
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height * 0.7);
  await page.mouse.down();
  for (const [x, y] of [[0.2, 0.35], [0.3, 0.75], [0.42, 0.3], [0.55, 0.7], [0.7, 0.4], [0.85, 0.6]]) await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 6 });
  await page.mouse.up();
}

/** The clinic-consent demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Type a patient’s name, a date of birth, a treatment',
      async run(hand) {
        const { page, press, type, keys, see } = hand;
        await type(page.getByRole('textbox', { name: /^Patient( Locked: Patient)?$/ }), 'Laila Mostafa');
        await type(page.getByRole('textbox', { name: /^Date of birth( Locked: Date of birth)?$/ }), '12/04/1991');
        await keys('Tab');
        const treatment = page.getByRole('combobox', { name: /^Treatment( Locked: Treatment)?$/ });
        await choose(hand, treatment, 'Anti-wrinkle injections');
        await see(treatment.locator('option:checked')).toHaveText('Anti-wrinkle injections');
        await press(page.getByRole('checkbox', { name: 'Forehead' }));
        await press(page.getByRole('checkbox', { name: 'I have read the risks above, and my questions were answered', exact: true }));
        await signConsent(hand);
        const day = await today(page);
        await see(consentEvidence(page).locator('.fd-signature-who')).toHaveText(new RegExp(`^Signed by Laila Mostafa, ${day}, \\d{2}:\\d{2}( \\S+)?$`));
        await see(consentEvidence(page).locator('.fd-signature-state')).toHaveText('✓The answers are as they were signed.');
      },
    },
    {
      says: 'Try to change the treatment: it is locked',
      async run({ page, phone, press, hover, see }) {
        const treatment = page.locator('[data-node="f-treatment"]');
        await see(treatment.getByRole('combobox')).toBeDisabled();
        await see(page.getByRole('checkbox', { name: 'Lips' })).toBeDisabled();
        // Pointed at with the mouse; on a phone, the lock pressed (it keeps its words open).
        const lock = treatment.locator('button.fd-lock');
        if (phone) await press(lock);
        else await hover(lock);
        await see(treatment.getByRole('tooltip')).toHaveText('Signed. To change it, press Change answers under the signature.');
      },
    },
    {
      says: 'Press Change answers, then Change answers again',
      async run(hand) {
        const { page, press, see } = hand;
        await press(consentSign(page).getByRole('button', { name: 'Change answers' }));
        const ask = consentSign(page).locator('.fd-signature-ask');
        await see(ask).toContainText('Change your answers? The signature is taken away, and you sign again once they are right.');
        await press(ask.getByRole('button', { name: 'Change answers' }));
        await see(consentSign(page).locator('.fd-signature-note')).toHaveText('Signature taken away: change your answers, then sign again.');
        await see(consentEvidence(page)).toBeHidden();
        const treatment = page.getByRole('combobox', { name: /^Treatment( Locked: Treatment)?$/ });
        await see(treatment).toBeEnabled();
        await choose(hand, treatment, 'Chemical peel');
        await see(treatment.locator('option:checked')).toHaveText('Chemical peel');
        await signConsent(hand);
        await see(consentEvidence(page).locator('.fd-signature-state')).toHaveText('✓The answers are as they were signed.');
        await see(treatment).toBeDisabled();
      },
    },
    {
      says: 'Sign before the answers are all given',
      async run(hand) {
        const { page, phone, press, see } = hand;
        // Opened again, and an answer taken back: the risks no longer ticked.
        await press(consentSign(page).getByRole('button', { name: 'Change answers' }));
        await press(consentSign(page).locator('.fd-signature-ask').getByRole('button', { name: 'Change answers' }));
        const risks = page.getByRole('checkbox', { name: 'I have read the risks above, and my questions were answered', exact: true });
        await press(risks);
        await see(risks).not.toBeChecked();
        await signConsent(hand);
        const note = consentSign(page).locator('.fd-signature-note');
        await see(note).toHaveText('Not signed yet: first put right I have read the risks above, and my questions were answered, then sign again.');
        await see(consentEvidence(page)).toBeHidden();
        // What was drawn (or typed) is kept: put right, it signs with no second drawing.
        if (phone) await see(consentSign(page).getByRole('textbox', { name: 'Or type your name' })).toHaveValue('Laila Mostafa');
        else await see(consentSign(page).getByRole('button', { name: 'Clear' })).toBeVisible();
        await press(risks);
        await see(note).toHaveText('Your answers are ready to sign.');
        await press(consentSign(page).getByRole('button', { name: 'Sign now' }));
        await see(consentEvidence(page).locator('.fd-signature-state')).toHaveText('✓The answers are as they were signed.');
      },
    },
    {
      says: 'Save, then open Mona Adel’s consent',
      async run({ page, press, follow, see }) {
        await press(page.getByRole('button', { name: 'Save', exact: true }));
        await see(page.locator('.fd-status')).toHaveText('Saved');
        await follow('open Mona Adel’s consent');
        await see(page.getByRole('textbox', { name: /^Patient( Locked: Patient)?$/ })).toHaveValue('Mona Adel');
        await see(consentEvidence(page).locator('.fd-signature-who')).toHaveText(/^Signed by Mona Adel, 14 Oct 2026, \d{2}:\d{2}( \S+)?$/);
        await see(consentEvidence(page).locator('.fd-signature-state')).toHaveText('✓The answers are as they were signed.');
        await see(page.getByRole('combobox', { name: /^Treatment( Locked: Treatment)?$/ })).toBeDisabled();
      },
    },
    {
      says: 'Open Hana Fouad’s: Cheeks was added in the clinic’s system',
      async run({ page, follow, see }) {
        await follow('Open Hana Fouad’s');
        await see(page.getByRole('textbox', { name: /^Patient( Locked: Patient)?$/ })).toHaveValue('Hana Fouad');
        await see(page.getByRole('checkbox', { name: 'Cheeks' })).toBeChecked();
        const said = consentEvidence(page).locator('.fd-signature-state');
        await see(said).toHaveText('⚠An answer has changed since it was signed.');
        await see(said).toHaveAttribute('data-changed', '');
      },
    },
  ],
};
