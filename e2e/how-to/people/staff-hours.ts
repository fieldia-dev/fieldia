import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The staff hours' rows, by their record. */
const HANA = '.fd-list-row[data-id="5"]';

/** “A week of staff hours, typed in place” (staff-hours): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Hana Wael’s Wednesday, type 9:30 and press Tab',
      async run({ page, phone, press, type, keys, see }) {
        const row = page.locator(HANA);
        if (phone) {
          // A phone's cards: her card pressed, its fields in a sheet over the list.
          await press(row.locator('.fd-list-card'));
          const sheet = page.getByRole('dialog', { name: 'Change Hana Wael' });
          await see(sheet).toBeVisible();
          await type(sheet.getByRole('textbox', { name: 'Wed' }), '9:30', { clear: true });
          await see(sheet.getByRole('textbox', { name: 'Week' })).toHaveValue('54:30');
          await keys('Tab');
          await see(sheet.getByRole('textbox', { name: 'Wed' })).toHaveValue('09:30');
          return;
        }
        await press(row.locator('td[data-col="wed"]'));
        await page.keyboard.type('9:30', { delay: 15 });
        await see(row.locator('td[data-col="week"]')).toHaveText('54:30');
        await keys('Tab');
        await see(row.locator('td[data-col="wed"]')).toHaveText('09:30');
        await see(row.locator('td[data-col="week"]')).toHaveText('54:30');
      },
    },
    {
      says: 'Press the search box: the server refuses her week',
      async run({ page, phone, press, see }) {
        // On a phone the sheet is over the list: its Save & Close leaves her card, as the search box leaves her row.
        if (phone) await press(page.getByRole('dialog', { name: 'Change Hana Wael' }).getByRole('button', { name: 'Save & Close' }));
        else await press(page.locator('.fd-search-input'));
        const note = page.locator(`${HANA} + tr.fd-list-note`);
        await see(note.getByRole('alert')).toContainText('Not saved: Hana Wael would work 54:30 hours this week: the labour rules allow 48.');
      },
    },
    {
      says: 'Type 2:30 in her Thursday and leave the row: 48 hours, saved.',
      async run({ page, phone, press, type, see }) {
        const row = page.locator(HANA);
        const note = page.locator(`${HANA} + tr.fd-list-note`);
        if (phone) {
          await press(row.locator('.fd-list-card'));
          const sheet = page.getByRole('dialog', { name: 'Change Hana Wael' });
          await see(sheet.getByRole('textbox', { name: 'Wed' })).toHaveValue('09:30');
          await type(sheet.getByRole('textbox', { name: 'Thu' }), '2:30', { clear: true });
          await see(sheet.getByRole('textbox', { name: 'Week' })).toHaveValue('48:00');
          await press(sheet.getByRole('button', { name: 'Save & Close' }));
          await see(sheet).toBeHidden();
          await see(row.locator('.fd-list-card')).toContainText('48:00');
        } else {
          await press(row.locator('td[data-col="thu"]'));
          await page.keyboard.type('2:30', { delay: 15 });
          await see(row.locator('td[data-col="week"]')).toHaveText('48:00');
          await press(page.locator('.fd-search-input'));
          await see(row.locator('td[data-col="thu"]')).toHaveText('02:30');
        }
        await see(note.getByRole('alert')).toBeHidden();
        await expect.poll(async () => (await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records['staff.week']['5']))['week']).toBe(48);
      },
    },
    {
      says: 'Names and roles are not changed here: a press on one does nothing',
      async run({ page, phone, press, type, see }) {
        const row = page.locator(HANA);
        const rows = page.locator('.fd-list-row');
        await see(rows).toHaveCount(6);
        if (phone) {
          // Her card's sheet: her name and role shown, neither to be changed.
          await press(row.locator('.fd-list-card'));
          const sheet = page.getByRole('dialog', { name: 'Change Hana Wael' });
          const name = sheet.getByRole('textbox', { name: 'Name' });
          await type(name, 'Hana W.');
          await see(name).toHaveValue('Hana Wael');
          await see(sheet.getByRole('combobox', { name: 'Role' })).toBeDisabled();
          await press(sheet.getByRole('button', { name: 'Discard' }));
          await see(sheet).toBeHidden();
        } else {
          for (const column of ['name', 'role']) {
            await press(row.locator(`td[data-col="${column}"]`));
            await see(page.locator('td[data-editing]')).toHaveCount(0);
          }
          await see(page.getByRole('dialog')).toHaveCount(0);
        }
        await see(rows).toHaveCount(6);
        await see(page.locator('.fd-list-row[data-new]')).toHaveCount(0);
        await see(page.locator('.fd-list-add')).toHaveCount(0);
        await see(row).toContainText('Hana Wael');
      },
    },
  ],
};
