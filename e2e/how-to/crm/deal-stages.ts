import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';

/** A pipeline's stage's row by its name, by the record it is (deal-stages: Offer is the fourth, Won the sixth). */
const STAGE_IDS: Record<string, number> = { New: 1, Qualified: 2, Viewing: 3, Offer: 4, Contract: 5, Won: 6 };
const stageRow = (page: Page, name: string) => page.locator(`.fd-list-row[data-id="${STAGE_IDS[name]}"]`);
/** The stages as the demo's source keeps them, by id: what was saved. */
const stages = async (demo: Hand['demo']) => (await demo<Record<string, Record<string, Record<string, unknown>>>>('dataSource.records'))['deal.stage'];

/** The deal-stages demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Offer’s chance of winning, type 65 and',
      async run({ page, phone, press, type, see, demo }) {
        const offer = stageRow(page, 'Offer');
        if (phone) {
          // A phone shows each stage as a card: a tap opens it in a sheet, its chance of winning a box there.
          await press(offer.locator('.fd-list-card'));
          const sheet = page.getByRole('dialog', { name: 'Change Offer' });
          await see(sheet.getByRole('textbox', { name: 'Chance of winning' })).toHaveValue('70');
          await type(sheet.getByRole('textbox', { name: 'Chance of winning' }), '65', { clear: true });
          await press(sheet.getByRole('button', { name: 'Save & Close' }));
          await see(sheet).toHaveCount(0);
          await see(offer.locator('.fd-list-card')).toContainText('65%');
        } else {
          const chance = offer.locator('td[data-col="probability"]');
          await see(chance).toHaveText('70%');
          await press(chance);
          await see(page.locator('td[data-editing]')).toHaveAttribute('data-col', 'probability');
          // What the cell held is chosen whole: what is typed takes its place.
          await page.keyboard.type('65', { delay: 15 });
          await press(page.getByRole('combobox', { name: 'Search' }));
          await see(page.locator('td[data-editing]')).toHaveCount(0);
          await see(chance).toHaveText('65%');
        }
        await expect.poll(async () => (await stages(demo))['4']['probability']).toBe(0.65);
      },
    },
    {
      says: 'Press Enter on a stage’s row: its first cell',
      notOnPhone: 'Enter, Tab and Shift+Tab on a row and its cells: a phone’s keyboard has no keys to move between cells, and its cards open in a sheet',
      async run({ page, press, keys, see }) {
        // To the rows from the search box with Tab, as a person at the keyboard goes: past the menu's arrow, the first row.
        await press(page.getByRole('combobox', { name: 'Search' }));
        await keys('Tab', 'Tab');
        const first = stageRow(page, 'New');
        await see(first).toBeFocused();
        await keys('Enter');
        const editing = page.locator('td[data-editing]');
        await see(editing).toHaveAttribute('data-col', 'sequence');
        await see(first.locator('td[data-col="sequence"]')).toHaveAttribute('data-editing', /.*/);
        await keys('Tab');
        await see(first.locator('td[data-col="name"]')).toHaveAttribute('data-editing', /.*/);
        await keys('Tab');
        await see(first.locator('td[data-col="probability"]')).toHaveAttribute('data-editing', /.*/);
        await keys('Shift+Tab');
        await see(first.locator('td[data-col="name"]')).toHaveAttribute('data-editing', /.*/);
        // Enter takes the cell and goes down its column: the next stage's, at rest.
        await keys('Enter');
        await see(editing).toHaveCount(0);
        await see(stageRow(page, 'Qualified').locator('td[data-col="name"]')).toBeFocused();
        await see(first.locator('td[data-col="name"]')).toHaveText('New');
      },
    },
    {
      says: 'The Won stage shows a lock at its start: press',
      async run({ page, phone, press, see }) {
        const won = stageRow(page, 'Won');
        const lock = phone ? won.locator('.fd-list-card-title .fd-list-lock') : won.locator('td[data-col] > .fd-list-lock');
        await see(lock).toBeVisible();
        await press(lock);
        await see(page.getByRole('dialog')).toHaveCount(0);
        await see(page.locator('td[data-editing]')).toHaveCount(0);
        const why = won.locator('xpath=following-sibling::tr[1][contains(@class, "fd-list-note")]');
        await see(why).toBeVisible();
        await see(why).toHaveText('The won stage is kept by the sales manager.');
      },
    },
    {
      says: 'Press Add a stage and name it: leave it, and it',
      async run({ page, phone, press, type, keys, see, demo }) {
        await press(page.getByRole('button', { name: 'Add a stage' }));
        if (phone) {
          // On a phone the new stage opens in a sheet: Save & Close is leaving it.
          const sheet = page.getByRole('dialog', { name: 'Add a stage' });
          await see(sheet.getByRole('textbox', { name: 'Stage' })).toBeFocused();
          await page.keyboard.type('Contract signed', { delay: 15 });
          await press(sheet.getByRole('button', { name: 'Save & Close' }));
          await see(sheet).toContainText('Chance of winning is required');
          await see(sheet).toContainText('Days expected is required');
          await type(sheet.getByRole('textbox', { name: 'Chance of winning' }), '95');
          await type(sheet.getByRole('textbox', { name: 'Days expected' }), '25');
          await press(sheet.getByRole('button', { name: 'Save & Close' }));
          await see(sheet).toHaveCount(0);
        } else {
          const added = page.locator('.fd-list-row[data-new]');
          // One press adds it, though the won stage's why is still said under it from the step before.
          await see(added.locator('td[data-col="name"] input'), 'Add a stage, pressed once, adds a stage').toBeFocused();
          await page.keyboard.type('Contract signed', { delay: 15 });
          await press(page.getByRole('combobox', { name: 'Search' }));
          const asked = page.locator('.fd-list-note:not([hidden])');
          await see(asked).toContainText('Chance of winning');
          await see(asked).toContainText('Days expected');
          await press(added.locator('td[data-col="probability"]'));
          await page.keyboard.type('95', { delay: 15 });
          await keys('Tab');
          await page.keyboard.type('25', { delay: 15 });
          await press(page.getByRole('combobox', { name: 'Search' }));
          await see(page.locator('.fd-list-row[data-new]')).toHaveCount(0);
          await see(asked).toHaveCount(0);
        }
        await expect.poll(async () => Object.values(await stages(demo)).find((one) => one['name'] === 'Contract signed')?.['sequence']).toBe(60);
        const signed = page.locator('.fd-list-row', { hasText: 'Contract signed' });
        if (!phone) await see(signed.locator('td[data-col="sequence"]')).toHaveText('60');
        await see(stageRow(page, 'Won').locator('td[data-col="sequence"]')).toHaveText('100');
        await page.reload();
        await see(page.locator(phone ? '.fd-list-row .fd-list-card-title' : '.fd-list-row td[data-col="name"]')).toHaveText(['New', 'Qualified', 'Viewing', 'Offer', 'Contract', 'Contract signed', 'Won']);
      },
    },
  ],
};
