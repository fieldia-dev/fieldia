import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { download, closePanel } from './support';

/** The e-mail signature the customer-from-email how-to pastes, word for word. */
const SIGNATURE = 'Lina Haddad · Head of Procurement, Amman Fresh Markets · T: +962 6 461 2200 · M: +962 79 555 0142 · lina.haddad@ammanfresh.example · www.ammanfresh.example · 21 Mecca St, Shmeisani, Amman, Jordan · VAT: 4001-2210';
/**
 * Words put on the clipboard as a person copies them, as e2e/lists-import.spec.ts does: from a box of their own,
 * chosen whole and copied with the keys — then the box goes, and the focus is the page's again.
 */
async function copy(page: Page, text: string) {
  await page.evaluate((words) => {
    const sheet = document.createElement('textarea');
    sheet.id = 'e2e-copied';
    sheet.value = words;
    document.body.append(sheet);
    sheet.focus();
    sheet.select();
  }, text);
  await page.keyboard.press('ControlOrMeta+C');
  await page.evaluate(() => document.getElementById('e2e-copied')?.remove());
}

/** The customer-from-email demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Fill from an e-mail and paste: Lina',
      async run({ page, press, keys, see }) {
        await copy(page, SIGNATURE);
        await press(page.getByRole('button', { name: 'Fill from an e-mail' }));
        const dialog = page.getByRole('dialog', { name: 'Fill from an e-mail' });
        const box = dialog.getByRole('textbox', { name: 'Text to fill the form from' });
        await see(box).toBeFocused();
        await keys('ControlOrMeta+V');
        await see(box).toHaveValue(SIGNATURE);
      },
    },
    {
      says: 'Press Propose values: each value shows under',
      async run({ page, press, see }) {
        const dialog = page.getByRole('dialog', { name: 'Fill from an e-mail' });
        await press(dialog.getByRole('button', { name: 'Propose values' }));
        await see(dialog).toBeHidden();
        const review = page.locator('.fd-assist-review');
        await see(review).toContainText('9 values proposed. Review each on its field, or accept them all. Nothing is kept until you accept it.');
        const proposal = (id: string) => page.locator(`[data-node="${id}"] .fd-proposal`);
        await see(proposal('f-website').locator('ins')).toHaveText('https://www.ammanfresh.example');
        await see(proposal('f-website').getByRole('button', { name: 'Accept' })).toBeVisible();
        await see(proposal('f-website').getByRole('button', { name: 'Reject' })).toBeVisible();
        await see(proposal('f-country').locator('ins')).toHaveText('Jordan');
        await see(page.locator('[data-node="#title"] .fd-proposal ins')).toHaveText('Amman Fresh Markets');
        await see(proposal('f-contacts')).toContainText('1 line to add');
        await see(proposal('f-contacts')).toContainText('Lina Haddad · Head of Procurement');
        // Nothing written yet: the boxes as they were.
        await see(page.locator('[data-node="f-website"] input')).toHaveValue('');
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('');
      },
    },
    {
      says: 'Type in Phone while a proposal waits on it:',
      async run({ page, type, see }) {
        const proposal = (id: string) => page.locator(`[data-node="${id}"] .fd-proposal`);
        await see(proposal('f-phone')).toBeVisible();
        const phone = page.locator('[data-node="f-phone"] input').first();
        await type(phone, '+962 6 000');
        await see(proposal('f-phone')).toHaveCount(0);
        await see(proposal('f-email')).toHaveCount(1);
        await see(phone).toHaveValue('+962 6 000');
      },
    },
    {
      says: 'Accept the website, reject the tax ID, then',
      async run({ page, press, see }) {
        const proposal = (id: string) => page.locator(`[data-node="${id}"] .fd-proposal`);
        await press(proposal('f-website').getByRole('button', { name: 'Accept' }));
        await see(page.locator('[data-node="f-website"] input')).toHaveValue('https://www.ammanfresh.example');
        await see(proposal('f-website')).toContainText('Proposal kept');
        await press(proposal('f-vat').getByRole('button', { name: 'Reject' }));
        await see(proposal('f-vat')).toHaveCount(0);
        const review = page.locator('.fd-assist-review');
        await press(review.getByRole('button', { name: 'Accept all' }));
        // The rest: all but the website (kept already), the tax ID (rejected) and the phone (typed over).
        await see(review).toContainText('Kept 6 values');
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('Amman Fresh Markets');
        await see(page.locator('[data-node="f-vat"] input')).toHaveValue('');
        await see(page.locator('[data-node="f-phone"] input').first()).toHaveValue('+962 6 000');
        await see(page.locator('[data-node="f-contacts"]').getByRole('textbox').first()).toHaveValue('Lina Haddad');
        await press(review.getByRole('button', { name: 'Undo' }));
        // Back as it was before Accept all; the website, kept on its own, keeps its own Undo.
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('');
        await see(page.locator('[data-node="f-city"] input')).toHaveValue('');
        await see(page.locator('[data-node="f-contacts"] tbody tr')).toHaveCount(0);
        await see(page.locator('[data-node="f-phone"] input').first()).toHaveValue('+962 6 000');
        await see(proposal('f-website').getByRole('button', { name: 'Undo' })).toBeVisible();
      },
    },
    {
      says: 'Or download a sample e-mail and add it as a',
      async run(hand) {
        const { page, press, pick, see } = hand;
        const sample = await download(page, () => hand.follow('download a sample e-mail'));
        expect(sample.name).toBe('signature.txt');
        await closePanel(hand);
        await press(page.getByRole('button', { name: 'Fill from an e-mail' }));
        const dialog = page.getByRole('dialog', { name: 'Fill from an e-mail' });
        await pick(dialog.getByRole('button', { name: 'Add files' }), sample.path);
        await see(dialog).toContainText('signature.txt');
        await press(dialog.getByRole('button', { name: 'Propose values' }));
        await see(dialog).toBeHidden();
        await see(page.locator('.fd-assist-review')).toContainText(/\d+ values? proposed/);
        await see(page.locator('.fd-proposal').first()).toBeVisible();
      },
    },
  ],
};
