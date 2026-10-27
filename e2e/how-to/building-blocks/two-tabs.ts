import { expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import type { DemoReplay } from '../hand';
import { yourTab } from './support';

/** Save safety's other tab: Mona's, beside the person's own (support.ts, yourTab). */
const monasTab = (page: Page) => page.getByRole('region', { name: 'Mona’s tab' });

/** The two-tabs demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Change the phone in your tab, then press Someone else edits this',
      async run({ page, press, type, see }) {
        const phone = yourTab(page).getByRole('textbox', { name: 'Phone' });
        await type(phone, '+20 100 999 8887', { clear: true });
        await press(page.getByRole('button', { name: 'Someone else edits this' }));
        await see(page.locator('.ss-said')).toContainText('Mona saved in her tab: Visit, budget EGP 4,500,000.');
        // In her tab: the lead moved on a stage, its budget raised.
        await see(monasTab(page).getByRole('list', { name: 'Stage' }).locator('[aria-current="step"]')).toHaveText('Visit');
        await see(monasTab(page).getByRole('textbox', { name: 'Budget' })).toHaveValue('4,500,000');
        await see(phone).toHaveValue('+20 100 999 8887');
      },
    },
    {
      says: 'Press Save in your tab: Mona changed this record at the time she saved',
      async run({ page, press, see }) {
        const tab = yourTab(page);
        await press(tab.getByRole('button', { name: 'Save', exact: true }));
        const conflict = tab.locator('.fd-conflict');
        await see(conflict.getByRole('alert')).toContainText(/Mona changed this record at \d\d:\d\d\./);
        await see(conflict.getByRole('alert')).toContainText('They changed: Stage, Budget.');
        await see(conflict.getByRole('button', { name: 'Reload' })).toBeVisible();
        await see(conflict.getByRole('button', { name: 'Keep mine' })).toBeVisible();
        await see(tab.getByRole('textbox', { name: 'Phone' })).toHaveValue('+20 100 999 8887');
      },
    },
    {
      says: 'Press Keep mine: your phone is saved, and Mona’s stage and budget stay.',
      async run({ page, press, see, demo }) {
        const tab = yourTab(page);
        await press(tab.locator('.fd-conflict').getByRole('button', { name: 'Keep mine' }));
        await see(tab.locator('.fd-status').first()).toHaveText('Saved');
        await see(tab.locator('.fd-conflict')).toBeHidden();
        await see(tab.getByRole('textbox', { name: 'Phone' })).toHaveValue('+20 100 999 8887');
        await see(tab.getByRole('list', { name: 'Stage' }).locator('[aria-current="step"]')).toHaveText('Visit');
        await see(tab.getByRole('textbox', { name: 'Budget' })).toHaveValue('4,500,000');
        expect(await demo('dataSource.records.lead.1')).toMatchObject({ phone: '+20 100 999 8887', stage: 'visit', budget: 4500000 });
      },
    },
    {
      says: 'Or press Reload: Mona’s version shows, and your changes are listed',
      async run({ page, press, type, see }) {
        // The choice again: another change of Sara's, saved over another of Mona's.
        const tab = yourTab(page);
        const phone = tab.getByRole('textbox', { name: 'Phone' });
        await type(phone, '+20 122 555 0101', { clear: true });
        await press(page.getByRole('button', { name: 'Someone else edits this' }));
        // Mona, her tab brought up to date first, moves the lead on to Offer and raises its budget again.
        await see(page.locator('.ss-said')).toContainText('Mona saved in her tab: Offer, budget EGP 5,000,000.');
        await see(monasTab(page).getByRole('list', { name: 'Stage' }).locator('[aria-current="step"]')).toHaveText('Offer');
        const mona = await monasTab(page).getByRole('textbox', { name: 'Phone' }).inputValue();
        await press(tab.getByRole('button', { name: 'Save', exact: true }));
        const conflict = tab.locator('.fd-conflict');
        await see(conflict.getByRole('alert')).toContainText(/Mona changed this record at \d\d:\d\d\./);
        await press(conflict.getByRole('button', { name: 'Reload' }));
        await see(conflict).toBeHidden();
        // Mona's version in the form; Sara's change listed with its own Put back.
        await see(phone).toHaveValue(mona);
        await see(tab.getByRole('list', { name: 'Stage' }).locator('[aria-current="step"]')).toHaveText('Offer');
        const aside = tab.locator('.fd-set-aside');
        await see(aside).toBeVisible();
        await see(aside.getByRole('listitem').first()).toContainText('Phone');
        await see(aside.getByRole('listitem').first()).toContainText('+20 122 555 0101');
        await press(aside.getByRole('button', { name: 'Put back Phone' }));
        await see(phone).toHaveValue('+20 122 555 0101');
      },
    },
    {
      says: 'Point at the lock by Commission: only a manager sets it.',
      async run({ page, phone, press, hover, see }) {
        const tab = yourTab(page);
        const commission = tab.locator('.fd-field[data-field="commission"]').first();
        const lock = commission.getByRole('button', { name: 'Locked: Commission, %' });
        // The mouse rests on it; a finger, which has no resting, presses it.
        if (phone) await press(lock);
        else await hover(lock);
        await see(commission.locator('.fd-help-bubble')).toHaveText('Only a manager sets the commission or deletes a lead.');
        await see(commission.locator('.fd-help-bubble')).toBeVisible();
        await see(commission.getByRole('textbox')).toHaveAttribute('readonly', '');
        await press(tab.getByRole('button', { name: 'Actions' }));
        const menu = tab.getByRole('menu');
        await see(menu.getByRole('menuitem')).toHaveText(['Brochure', 'Archive', 'Duplicate']);
        await see(menu.locator('.fd-record-menu-note')).toHaveText('Only a manager sets the commission or deletes a lead.');
      },
    },
  ],
};
