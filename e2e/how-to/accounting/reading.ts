import type { Page } from '@playwright/test';
import type { DemoReplay } from '../hand';
import { stage } from './support';

/** A part of the page by its node's id, as the page's file names it. */
const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);

/** “A dense record that reads at a glance” (reading): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Hold Alt: each header button shows its key.',
      notOnPhone: 'a phone has no Alt key to hold, nor Alt+Shift+G to press',
      async run({ page, keys, see }) {
        await page.keyboard.down('Alt');
        await see(node(page, 'b-send').locator('.fd-hotkey')).toHaveText('Y');
        await see(node(page, 'b-draft').locator('.fd-hotkey')).toHaveText('⇧G');
        await see(node(page, 'b-credit').locator('.fd-hotkey')).toHaveText('Q');
        await page.keyboard.up('Alt');
        await see(page.locator('.fd-hotkey:visible')).toHaveCount(0);
        // Alt+Shift+G: Reset to Draft pressed — its work the app's, which a note says it was asked to do.
        await keys('Alt+Shift+KeyG');
        await see(page.locator('.fd-say').filter({ hasText: 'The app was asked to reset INV/2026/00042 to draft.' })).toBeVisible();
      },
    },
    {
      says: 'Read the alerts: the lock date and the customer sit inside their words',
      async run({ page, see }) {
        const lock = node(page, 'a-lock');
        await see(lock).toHaveText('Entries dated before 30 Sept 2026 cannot be posted: that is the tax lock date.');
        await see(lock.locator('.fd-value')).toHaveText('30 Sept 2026');
        await see(node(page, 'a-credit')).toHaveText('Nile Traders owes 48,069.44 EGP past its due date, above its 40,000 EGP limit.');
        const duplicate = node(page, 'a-duplicate');
        await see(duplicate).toContainText('This invoice may be a duplicate of another one for Nile Traders.');
        await see(duplicate.locator('.fd-value')).toHaveText('Nile Traders');
        await see(duplicate.getByRole('button', { name: 'See the other invoice' })).toBeVisible();
      },
    },
    {
      says: 'Press Done: the parts for editing only',
      async run({ page, press, see }) {
        await see(page.getByRole('button', { name: 'Add Credit Note' })).toBeVisible();
        await press(page.getByRole('button', { name: 'Done' }));
        await see(page.getByRole('button', { name: 'Add Credit Note' })).toBeHidden();
        await see(page.getByText('Changing the customer sets its pricelist and payment terms again.')).toBeHidden();
        // Every field reads as words: no box, no list left on the sheet.
        const form = page.locator('main .fd-form').first();
        await see(form.getByRole('textbox')).toHaveCount(0);
        await see(form.getByRole('combobox')).toHaveCount(0);
        await see(node(page, 'f-partner').locator('.fd-read-text')).toContainText('Nile Traders');
        await see(node(page, 'f-date').locator('.fd-read-text')).toHaveText('2 Oct 2026');
        await see(page.getByRole('button', { name: 'Edit' })).toBeVisible();
      },
    },
    {
      says: 'Press Edit, then click Draft on the stages along the top',
      async run({ page, phone, press, keys, see }) {
        // Read as words since Done, the sheet's stages wait for Edit.
        await press(page.getByRole('button', { name: 'Edit' }));
        await see(page.getByRole('button', { name: 'Done' })).toBeVisible();
        const draft = page.locator('.fd-statusbar').getByRole('button', { name: /^Draft/ });
        await see(draft, 'Draft on the stages, to be clicked').toBeEnabled();
        await press(draft);
        await see(stage(page)).toHaveText(/^Draft/);
        await see(page.locator('.fd-statusbar .fd-step-time')).toHaveText(['3d', '5h']);
        const confirm = page.getByRole('button', { name: 'Confirm' });
        await see(confirm).toBeVisible();
        await see(page.getByRole('button', { name: 'Send & Print' })).toBeHidden();
        // Alt+V presses Confirm, a key a phone has none of: there, Confirm is pressed.
        if (phone) await press(confirm);
        else await keys('Alt+KeyV');
        await see(page.locator('.fd-say').filter({ hasText: 'The app was asked to confirm INV/2026/00042.' })).toBeVisible();
      },
    },
    {
      says: 'Open the Trust tab: an alert sits among its fields',
      async run({ page, press, see }) {
        await press(page.getByRole('tab', { name: 'Trust' }));
        const trust = page.getByRole('tabpanel', { name: 'Trust' });
        const alert = trust.getByRole('status').filter({ hasText: 'trust balance' });
        await see(alert).toHaveText('The trust balance is below its minimum: top up E£ 12,500.00 to reach it.');
        await see(alert.locator('.fd-value')).toHaveText('E£ 12,500.00');
        await see(trust.getByText('Top-up needed')).toBeVisible();
      },
    },
  ],
};
