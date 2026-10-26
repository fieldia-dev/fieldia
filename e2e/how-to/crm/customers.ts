import type { Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';
import { header, rowWith, chips, searchMenu, openMenu } from './support';

/** The names in a list's rows: the second cell in a table, a card's title on a phone. */
const rowNames = ({ page, phone }: Hand) => page.locator(phone ? '.fd-list-row .fd-list-card-title' : '.fd-list-row td:nth-child(2)');
/** The menu closed again by the same arrow. */
async function closeMenu({ page, press }: Hand) {
  if (await searchMenu(page).isVisible()) await press(page.getByRole('button', { name: 'Search options' }));
  await expect(searchMenu(page)).toBeHidden();
}
/** A group's heading in a grouped list, by its name and count: "Egypt, 6 customers". */
const groupHead = (page: Page, words: string): Locator => page.getByRole('button', { name: words, exact: true });

/** The customers demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Type "egy" in the search box and pick',
      async run({ page, phone, type, press, keys, see }) {
        await type(page.getByRole('combobox', { name: 'Search' }), 'egy');
        const offered = page.getByRole('listbox', { name: 'Search' }).getByRole('option');
        await see(offered).toHaveText(['Search Name for: egy', 'Search Email for: egy', 'Search Phone for: egy', 'Search Country for: egy']);
        if (phone) {
          // A phone's keyboard has no arrow keys: the finger picks the same line.
          await press(offered.nth(3));
        } else {
          await keys('ArrowDown', 'ArrowDown', 'ArrowDown');
          await see(offered.nth(3)).toHaveAttribute('aria-selected', 'true');
          await keys('Enter');
        }
        await see(chips(page)).toHaveText(['Country: egy']);
        await see(page.locator('.fd-pager-text')).toHaveText('1–8 of 10 customers');
      },
    },
    {
      says: 'Open the menu at the end of the box: turn on',
      async run(hand) {
        const { page, press, see } = hand;
        await openMenu(hand);
        const menu = searchMenu(page);
        await press(menu.getByRole('button', { name: 'Active' }));
        await see(menu.getByRole('button', { name: '✓ Active' })).toHaveAttribute('aria-pressed', 'true');
        const grouping = menu.getByRole('group', { name: 'Group By' });
        await press(grouping.getByRole('button', { name: 'Country' }));
        await press(grouping.getByRole('button', { name: 'Status' }));
        await closeMenu(hand);
        await see(chips(page)).toHaveText(['Country: egy', 'Active', 'Country > Status']);
        await see(page.locator('.fd-list-group')).toHaveText(['Egypt (6)']);
        await press(groupHead(page, 'Egypt, 6 customers'));
        await press(groupHead(page, 'Active, 6 customers'));
        await see(groupHead(page, 'Active, 6 customers')).toHaveAttribute('aria-expanded', 'true');
        await see(rowNames(hand)).toHaveCount(6);
      },
    },
    {
      says: 'Click the Credit limit header, twice: the',
      async run(hand) {
        const { page, press, see } = hand;
        // The open groups' customers, by their credit limit: E£ 40,000 to E£ 420,000, then the other way.
        const upwards = ['Zamalek Studio', 'Amira Clinics', 'Heliopolis Dental Care', 'Nile Traders', 'Sahel Resorts', 'Delta Foods'];
        await press(header(page, 'Credit limit').getByRole('button'));
        await see(header(page, 'Credit limit')).toHaveAttribute('aria-sort', 'ascending');
        await see(rowNames(hand), 'the groups opened stay open, their customers in the new order').toHaveText(upwards);
        await press(header(page, 'Credit limit').getByRole('button'));
        await see(header(page, 'Credit limit')).toHaveAttribute('aria-sort', 'descending');
        await see(rowNames(hand)).toHaveText([...upwards].reverse());
      },
    },
    {
      says: 'Hold Shift and click the Country header: by',
      notOnPhone: 'Shift and a press: a phone has no Shift key to hold',
      async run({ page, press, see }) {
        await press(header(page, 'Country').getByRole('button'), { modifiers: ['Shift'] });
        await see(header(page, 'Credit limit').locator('.fd-list-sort-rank')).toHaveText('1');
        await see(header(page, 'Country').locator('.fd-list-sort-rank')).toHaveText('2');
        await see(header(page, 'Country').getByRole('button')).toHaveAccessibleName('Country sorted 2 of 2, ascending');
      },
    },
    {
      says: 'Tick two customers and press Archive: you are',
      async run({ page, press, see, demo }) {
        await press(page.getByRole('checkbox', { name: 'Select Delta Foods' }));
        await press(page.getByRole('checkbox', { name: 'Select Sahel Resorts' }));
        const bar = page.locator('.fd-list-selection');
        await see(bar.locator('.fd-list-count')).toHaveText('2 selected');
        await press(bar.getByRole('button', { name: 'Archive' }));
        const question = page.getByRole('alertdialog');
        await see(question).toContainText('Archive the chosen customers?');
        await press(question.getByRole('button', { name: 'Archive' }));
        await see(page.locator('.fd-say')).toContainText('The app was asked to archive 2 customers: Delta Foods and Sahel Resorts.');
        expect(await demo<{ action: string; recordIds?: number[] }[]>('requests')).toEqual([expect.objectContaining({ action: 'archive', recordIds: expect.arrayContaining([23]) })]);
      },
    },
    {
      says: 'Save the search as a favourite used by default',
      async run(hand) {
        const { page, press, type, see } = hand;
        await openMenu(hand);
        const menu = searchMenu(page);
        await press(menu.getByRole('button', { name: 'Save current search' }));
        await type(menu.getByRole('textbox', { name: 'Name of the search' }), 'Egypt, active');
        await press(menu.getByRole('checkbox', { name: 'Use by default' }));
        await press(menu.locator('.fd-favourite-form').getByRole('button', { name: 'Save' }));
        // Kept, its star saying it is used by default.
        await see(menu.getByRole('button', { name: '★ Egypt, active' })).toBeVisible();
        await page.reload();
        await see(page.locator('.dh-title')).toHaveText('Customer list');
        await see(chips(page)).toHaveText(['Country: egy', 'Active', 'Country > Status']);
        await see(page.locator('.fd-list-group')).toHaveText(['Egypt (6)']);
      },
    },
    {
      says: 'Click a row to open that customer on its own',
      async run({ page, press, see }) {
        await press(groupHead(page, 'Egypt, 6 customers'));
        await press(groupHead(page, 'Active, 6 customers'));
        await press(rowWith(page, 'Nile Traders'));
        await see(page.locator('.dh-title')).toHaveText('Customer record');
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('Nile Traders');
        await see(page.getByRole('button', { name: 'Block', exact: true })).toBeVisible();
      },
    },
  ],
};
