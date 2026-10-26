import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The customer demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Block, and Block again in its question',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Block', exact: true }));
        const question = page.getByRole('alertdialog');
        await see(question).toContainText('Block this customer? New orders will be refused.');
        await press(question.getByRole('button', { name: 'Block' }));
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Blocked');
        await see(page.locator('.fd-ribbon')).toHaveText('Blocked');
        await see(page.locator('.fd-status')).toHaveText('Saved');
        await press(page.getByRole('button', { name: 'Activate' }));
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Active');
        await see(page.locator('.fd-ribbon')).toBeHidden();
      },
    },
    {
      says: 'Press Ctrl+Enter (⌘+Enter on a Mac) to save',
      notOnPhone: 'a phone has no Ctrl key: its Save button saves there',
      async run({ page, type, keys, mod, see, demo }) {
        const website = page.getByRole('textbox', { name: 'Website' });
        await type(website, 'niletraders.example');
        await keys(`${mod}+Enter`);
        await see(page.locator('.fd-status')).toHaveText('Saved');
        await see(website).toBeFocused();
        expect((await demo<Record<string, unknown>>('dataSource.records.partner.1'))['website']).toBe('niletraders.example');
      },
    },
    {
      says: 'Open the Contacts tab and add a contact in the table',
      async run({ page, press, keys, see }) {
        await press(page.getByRole('tab', { name: 'Contacts' }));
        const contacts = page.getByRole('tabpanel', { name: 'Contacts' });
        await see(contacts).toBeVisible();
        await press(contacts.getByRole('button', { name: '+ Add a line' }));
        const rows = contacts.locator('tbody tr');
        await see(rows).toHaveCount(2);
        const name = rows.nth(1).getByRole('textbox', { name: 'Name' });
        await see(name).toBeFocused();
        await page.keyboard.type('Omar Said', { delay: 15 });
        await keys('Tab');
        await page.keyboard.type('Buyer', { delay: 15 });
        await see(name).toHaveValue('Omar Said');
        await see(rows.nth(1).getByRole('textbox', { name: 'Job position' })).toHaveValue('Buyer');
      },
    },
    {
      says: 'Type in Country and pick one from the list',
      async run({ page, press, type, see }) {
        const country = page.getByRole('combobox', { name: 'Country' });
        await type(country, 'Jor', { clear: true });
        const option = page.getByRole('option', { name: 'Jordan' });
        await see(option).toBeVisible();
        await press(option);
        await see(country).toHaveValue('Jordan');
      },
    },
    {
      says: 'Press the flag beside Phone and type a country',
      async run({ page, press, type, keys, see }) {
        await press(page.getByRole('button', { name: 'Country of Phone' }));
        const search = page.getByRole('combobox', { name: 'Search countries' });
        await see(search).toBeVisible();
        await page.keyboard.type('jordan', { delay: 15 });
        await keys('Enter');
        await see(page.getByRole('button', { name: 'Country of Phone' })).toContainText('+962');
        // A number of that country typed as people there write it: read in Jordan, its code put before it.
        const phone = page.locator('[data-node="f-phone"] input.fd-phone-input');
        await type(phone, '06 461 2200', { clear: true });
        await keys('Tab');
        await see(phone).toHaveValue('+962 6 461 2200');
        await see(phone).toHaveAttribute('aria-invalid', 'false');
      },
    },
    {
      says: 'In the conversation on the right, write a message',
      async run({ page, press, keys, see }) {
        const panel = page.getByRole('region', { name: 'Conversation' });
        await press(panel.getByRole('button', { name: 'Send message' }));
        const box = panel.locator('.fd-composer textarea');
        await see(box).toBeFocused();
        await page.keyboard.type('Over to you @mo', { delay: 15 });
        await see(panel.locator('.fd-mentions [role=option]')).toHaveText(['Mona Adel']);
        await keys('Enter');
        await see(box).toHaveValue('Over to you @Mona Adel ');
        await press(panel.getByRole('button', { name: 'Send', exact: true }));
        await see(panel.locator('.fd-message').first()).toContainText('Over to you @Mona Adel');
      },
    },
    {
      says: 'Read it in Turkish or Spanish, or right to left',
      async run({ page, follow, see }) {
        await follow('Turkish');
        // Fieldia's own words in Turkish: the conversation's, a table's; the app's own (Block, the tabs) as it wrote them.
        await see(page.getByRole('button', { name: 'Mesaj gönder' })).toBeVisible();
        await see(page.getByRole('button', { name: '+ Satır ekle' })).toBeVisible();
        await follow('Persian');
        await see(page.locator('.fd-form').first()).toHaveAttribute('dir', 'rtl');
        await see(page.getByRole('button', { name: 'Send message' })).toBeHidden();
        await follow('Back to English');
        await see(page.locator('.fd-form').first()).not.toHaveAttribute('dir', 'rtl');
        await see(page.getByRole('button', { name: 'Send message' })).toBeVisible();
      },
    },
  ],
};
