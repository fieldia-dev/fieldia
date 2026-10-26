import type { Locator } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { followLink, part } from './support';

/** A text in two languages: its switch's tabs, one by its language's name, the box shown under it. */
const langTab = (field: Locator, name: string) => field.getByRole('tab', { name: new RegExp(`^${name}`) });
const langShown = (field: Locator) => field.locator('[role="tabpanel"]:not([hidden])');
const langBox = (field: Locator) => langShown(field).locator('[aria-labelledby*="-tab-"]');

export const replay: DemoReplay = {
  steps: [
    {
      says: 'Title shows English first, empty and marked: this listing has its Arabic title only',
      async run({ page, press, see }) {
        const title = part(page, 'f-title');
        await see(title.getByRole('tab')).toHaveText([/^English/, /^العربية/]);
        await see(langTab(title, 'English')).toHaveAttribute('aria-selected', 'true');
        await see(langTab(title, 'English')).toHaveAccessibleName('English required, not typed yet');
        await see(langBox(title)).toHaveValue('');
        await press(langTab(title, 'العربية'));
        await see(langBox(title)).toHaveValue('شقة بإطلالة على النيل في الزمالك');
        await see(langShown(title)).toHaveAttribute('dir', 'rtl');
      },
    },
    {
      says: 'Change Bedrooms to 4 and press Save: “Title is required in English”',
      async run({ page, press, type, see, demo }) {
        const title = part(page, 'f-title');
        await type(page.getByRole('textbox', { name: 'Bedrooms' }), '4', { clear: true });
        await press(page.getByRole('button', { name: 'Save', exact: true }));
        await see(title.locator('.fd-error')).toHaveText('Title is required in English');
        await see(langTab(title, 'English')).toHaveAttribute('aria-selected', 'true');
        await see(langBox(title)).toBeFocused();
        await page.keyboard.type('Nile-view flat in Zamalek', { delay: 15 });
        await press(page.getByRole('button', { name: 'Save', exact: true }));
        await see(page.locator('.fd-status').first()).toHaveText('Saved');
        await see(title.locator('.fd-error')).toBeHidden();
        await see(langTab(title, 'English')).toHaveAccessibleName('English');
        const saves = (await demo<{ method: string; request: { values: Record<string, unknown> } }[]>('dataSource.calls')).filter((call) => call.method === 'save');
        expect(saves.at(-1)?.request.values).toMatchObject({ bedrooms: 4, title: { ar: 'شقة بإطلالة على النيل في الزمالك', en: 'Nile-view flat in Zamalek' } });
      },
    },
    {
      says: 'In Description, press العربية: its Arabic may wait',
      async run({ page, press, see }) {
        const description = part(page, 'f-description');
        await see(langTab(description, 'العربية')).toHaveAccessibleName('العربية not typed yet');
        await press(langTab(description, 'العربية'));
        await see(langBox(description)).toHaveValue('');
        await see(langShown(description)).toHaveAttribute('dir', 'rtl');
        // Never said to be missing: required in English alone, and saved without it.
        await see(description.locator('.fd-error')).toBeHidden();
        await see(description).toContainText('English is required; the Arabic may follow.');
      },
    },
    {
      says: 'Press the arrows on a switch with the keyboard',
      notOnPhone: 'a phone has no arrow keys, nor Home and End: a tap picks a language there',
      async run({ page, press, keys, see }) {
        const description = part(page, 'f-description');
        await press(langTab(description, 'English'));
        await see(langTab(description, 'English')).toBeFocused();
        await keys('ArrowRight');
        await see(langTab(description, 'العربية')).toBeFocused();
        await see(langTab(description, 'العربية')).toHaveAttribute('aria-selected', 'true');
        await keys('ArrowLeft');
        await see(langTab(description, 'English')).toBeFocused();
        await see(langTab(description, 'English')).toHaveAttribute('aria-selected', 'true');
        await keys('End');
        await see(langTab(description, 'العربية')).toBeFocused();
        await keys('Home');
        await see(langTab(description, 'English')).toBeFocused();
        await see(langBox(description)).toHaveValue('Three bedrooms on the eighth floor, the Nile from every room, a doorman day and night.');
      },
    },
    {
      says: 'Open it in Arabic: العربية comes first on each switch',
      async run(hand) {
        const { page, press, see } = hand;
        await followLink(hand, 'Open it in Arabic');
        const title = part(page, 'f-title');
        const description = part(page, 'f-description');
        await see(title.getByRole('tab')).toHaveText([/^العربية/, /^English/]);
        await see(description.getByRole('tab')).toHaveText([/^العربية/, /^English/]);
        await see(page.locator('.fd-form').first()).toHaveAttribute('dir', 'rtl');
        await see(langShown(title)).toHaveAttribute('dir', 'rtl');
        await press(langTab(description, 'English'));
        await see(langShown(description)).toHaveAttribute('dir', 'ltr');
        await see(langBox(description)).toHaveValue('Three bedrooms on the eighth floor, the Nile from every room, a doorman day and night.');
      },
    },
  ],
};
