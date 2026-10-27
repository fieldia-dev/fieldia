import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';
import { narrow } from './support';

/** The price list's services, by their record's id: a row found by its record whatever its cells show. */
const SERVICE: Record<string, number> = { 'Botox, forehead': 1, 'Botox, crow’s feet': 2, 'Cheek filler, 2 ml': 4, Hydrafacial: 6, Microneedling: 7, 'Body contouring, one area': 9, 'Laser, face': 13 };
const service = (page: Page, name: string) => page.locator(`.fd-list-row[data-id="${SERVICE[name]}"]`);
const priceCell = (page: Page, name: string, column: string) => service(page, name).locator(`td[data-col="${column}"]`);
/** The note under a service's row (or card): why it was not saved, or who changed it meanwhile. */
const priceNote = (page: Page, name: string) => service(page, name).locator('xpath=following-sibling::tr[1][contains(@class, "fd-list-note")]');
type Call = { method: string; request: { id?: unknown; values?: Record<string, unknown> } };
const saves = async (hand: Hand) => ((await hand.demo<Call[]>('dataSource.calls')) ?? []).filter((call) => call.method === 'save').map((call) => call.request);
/** Rows copied as a spreadsheet puts them on the clipboard: from a box of their own, chosen whole, copied with the keys. */
async function copyRows(page: Page, text: string) {
  await page.evaluate((words) => {
    const sheet = document.createElement('textarea');
    sheet.id = 'how-to-copied';
    sheet.value = words;
    document.body.append(sheet);
    sheet.focus();
    sheet.select();
  }, text);
  await page.keyboard.press('ControlOrMeta+C');
  await page.evaluate(() => document.getElementById('how-to-copied')?.remove());
}

/** The service-prices demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Hydrafacial’s price, type 3000 and press Tab',
      async run({ page, phone, press, type, keys, see }) {
        if (phone) {
          // A phone's card, changed in a sheet over the list: the price per hour follows there as it is typed.
          await press(service(page, 'Hydrafacial').locator('.fd-list-card'));
          const sheet = page.getByRole('dialog', { name: 'Change Hydrafacial' });
          await see(sheet).toBeVisible();
          await type(sheet.getByRole('textbox', { name: 'Price', exact: true }), '3000', { clear: true });
          await see(sheet.getByRole('textbox', { name: 'Per hour' })).toHaveValue('3,000');
          return;
        }
        await press(priceCell(page, 'Hydrafacial', 'price'));
        await see(priceCell(page, 'Hydrafacial', 'price').locator('input')).toBeFocused();
        await page.keyboard.type('3000', { delay: 15 });
        await see(priceCell(page, 'Hydrafacial', 'per_hour')).toHaveText('E£ 3,000');
        await keys('Tab');
        await see(page.locator('td[data-editing]')).toHaveAttribute('data-col', 'active');
        await see(priceCell(page, 'Hydrafacial', 'active').locator('input[type="checkbox"]')).toBeFocused();
        await see(priceCell(page, 'Hydrafacial', 'price')).toHaveText('E£ 3,000');
      },
    },
    {
      says: 'Press another row: Hydrafacial is saved',
      async run(hand) {
        const { page, phone, press, see } = hand;
        if (phone) await press(page.getByRole('dialog').getByRole('button', { name: 'Save & Close' }));
        else await press(priceCell(page, 'Microneedling', 'name'));
        await expect.poll(async () => (await saves(hand)).length).toBe(1);
        expect((await saves(hand))[0].values).toEqual({ price: 3000, per_hour: 3000 });
        if (phone) {
          await see(page.getByRole('dialog')).toHaveCount(0);
          await see(service(page, 'Hydrafacial').locator('.fd-list-card')).toContainText('E£ 3,000');
        } else {
          await see(priceCell(page, 'Hydrafacial', 'price')).toHaveText('E£ 3,000');
          await see(priceCell(page, 'Hydrafacial', 'per_hour')).toHaveText('E£ 3,000');
          await see(service(page, 'Hydrafacial')).not.toHaveAttribute('data-changed');
          await see(service(page, 'Hydrafacial').locator('td[data-editing]')).toHaveCount(0);
        }
      },
    },
    {
      says: 'Type 2 in a service’s Minutes and leave the row',
      async run(hand) {
        const { page, phone, press, type, see } = hand;
        if (phone) {
          await press(service(page, 'Laser, face').locator('.fd-list-card'));
          const sheet = page.getByRole('dialog', { name: 'Change Laser, face' });
          await type(sheet.getByRole('textbox', { name: 'Minutes', exact: true }), '2', { clear: true });
          await see(sheet).toContainText('Fix Minutes to see Per hour');
          await press(sheet.getByRole('button', { name: 'Save & Close' }));
          await see(sheet).toContainText('Minutes must be at least 5');
          await see(sheet).toContainText('Fix Minutes to see Per hour');
          expect(await saves(hand)).toHaveLength(1);
          // A phone's Put back: the sheet's Discard.
          await press(sheet.getByRole('button', { name: 'Discard' }));
          await see(sheet).toBeHidden();
          await see(service(page, 'Laser, face').locator('.fd-list-card')).toContainText('20');
          return;
        }
        await press(priceCell(page, 'Laser, face', 'minutes'));
        await page.keyboard.type('2', { delay: 15 });
        await press(priceCell(page, 'Microneedling', 'name'));
        await see(priceNote(page, 'Laser, face')).toContainText('Not saved: Minutes must be at least 5');
        await see(priceCell(page, 'Laser, face', 'minutes')).toHaveText('2');
        await see(priceCell(page, 'Laser, face', 'per_hour')).toHaveText('—Fix Minutes to see Per hour');
        expect(await saves(hand)).toHaveLength(1);
        await press(priceNote(page, 'Laser, face').getByRole('button', { name: 'Put back' }));
        await see(priceNote(page, 'Laser, face')).toBeHidden();
        await see(priceCell(page, 'Laser, face', 'minutes')).toHaveText('20');
        await see(priceCell(page, 'Laser, face', 'per_hour')).toHaveText('E£ 3,300');
      },
    },
    {
      says: 'Press Add a service: type its name, Tab through its cells',
      async run(hand) {
        const { page, phone, press, type, keys, see } = hand;
        await see(page.locator('.fd-pager-text')).toHaveText('1–13 of 13 services');
        await press(page.getByRole('button', { name: 'Add a service' }));
        if (phone) {
          const sheet = page.getByRole('dialog');
          await see(sheet.getByRole('textbox', { name: 'Service', exact: true })).toBeFocused();
          await page.keyboard.type('Laser, back', { delay: 15 });
          await type(sheet.getByRole('textbox', { name: 'Minutes', exact: true }), '45', { clear: true });
          await type(sheet.getByRole('textbox', { name: 'Price', exact: true }), '2600', { clear: true });
          await press(sheet.getByRole('button', { name: 'Save & Close' }));
          await see(sheet).toHaveCount(0);
        } else {
          const added = page.locator('.fd-list-row[data-new]');
          await see(added.locator('td[data-col="name"] input')).toBeFocused();
          await page.keyboard.type('Laser, back', { delay: 15 });
          await keys('Tab');
          await see(page.locator('td[data-editing]')).toHaveAttribute('data-col', 'category');
          await keys('Tab', 'Tab');
          await see(page.locator('td[data-editing]')).toHaveAttribute('data-col', 'minutes');
          await page.keyboard.type('45', { delay: 15 });
          await keys('Tab');
          await page.keyboard.type('2600', { delay: 15 });
          await press(page.getByRole('combobox', { name: 'Search' }));
          await see(added).toHaveCount(0);
        }
        await expect.poll(async () => (await saves(hand)).length).toBe(2);
        expect((await saves(hand))[1]).toMatchObject({ id: null, values: { name: 'Laser, back', minutes: 45, price: 2600 } });
        await see(page.locator('.fd-list-row').filter({ hasText: 'Laser, back' })).toHaveCount(1);
        await see(page.locator('.fd-pager-text')).toHaveText('1–14 of 14 services');
      },
    },
    {
      says: 'Copy three rows of minutes and prices from a spreadsheet',
      notOnPhone: 'a phone has no Escape or Ctrl+V to paste rows on a cell, and its cards have no cells to paste across',
      async run(hand) {
        const { page, press, keys, mod, see } = hand;
        const before = { crow: ['20', 'E£ 3,500'], forehead: [await priceCell(page, 'Botox, forehead', 'minutes').innerText(), await priceCell(page, 'Botox, forehead', 'price').innerText()] };
        await copyRows(page, '25\t3800\n35\t4800\n50\t8200\n');
        await press(priceCell(page, 'Botox, crow’s feet', 'minutes'));
        await keys('Escape', `${mod}+V`);
        const asked = page.getByRole('alertdialog');
        await see(asked).toContainText('Change 3 rows with what you pasted?');
        await press(asked.getByRole('button', { name: 'Paste 3 rows' }));
        await see(page.locator('.fd-list-paste-words')).toHaveText('Pasted into 6 cells.');
        await see(priceCell(page, 'Botox, crow’s feet', 'minutes')).toHaveText('25');
        await see(priceCell(page, 'Botox, crow’s feet', 'price')).toHaveText('E£ 3,800');
        await see(priceCell(page, 'Botox, forehead', 'minutes')).toHaveText('35');
        await see(priceCell(page, 'Cheek filler, 2 ml', 'price')).toHaveText('E£ 8,200');
        await expect.poll(async () => (await saves(hand)).length).toBe(5);
        // Undo right after: each row as it was, saved again.
        await press(page.locator('.fd-list-undo'));
        await see(page.locator('.fd-list-paste-words')).toHaveText('Paste undone.');
        await see(priceCell(page, 'Botox, crow’s feet', 'minutes')).toHaveText(before.crow[0]);
        await see(priceCell(page, 'Botox, crow’s feet', 'price')).toHaveText(before.crow[1]);
        await see(priceCell(page, 'Botox, forehead', 'minutes')).toHaveText(before.forehead[0]);
        await see(priceCell(page, 'Botox, forehead', 'price')).toHaveText(before.forehead[1]);
        await expect.poll(async () => (await hand.demo<Record<string, Record<string, Record<string, unknown>>>>('dataSource.records'))['clinic.service']['2']['minutes']).toBe(20);
        // And Ctrl+Z right after a paste, the same.
        await press(priceCell(page, 'Botox, crow’s feet', 'minutes'));
        await keys('Escape', `${mod}+V`);
        await press(asked.getByRole('button', { name: 'Paste 3 rows' }));
        await see(priceCell(page, 'Botox, crow’s feet', 'price')).toHaveText('E£ 3,800');
        await keys(`${mod}+Z`);
        await see(page.locator('.fd-list-paste-words')).toHaveText('Paste undone.');
        await see(priceCell(page, 'Botox, crow’s feet', 'price')).toHaveText(before.crow[1]);
        await see(priceCell(page, 'Botox, forehead', 'minutes')).toHaveText(before.forehead[0]);
      },
    },
    {
      says: 'Press “Someone else changes a price”, then change the first',
      async run({ page, phone, press, type, see }) {
        const first = 'Body contouring, one area';
        await press(page.getByRole('button', { name: 'Someone else changes a price' }));
        if (phone) {
          await press(service(page, first).locator('.fd-list-card'));
          const sheet = page.getByRole('dialog');
          await type(sheet.getByRole('textbox', { name: 'Minutes', exact: true }), '100', { clear: true });
          await press(sheet.getByRole('button', { name: 'Save & Close' }));
        } else {
          await press(priceCell(page, first, 'minutes'));
          await page.keyboard.type('100', { delay: 15 });
          await press(page.getByRole('combobox', { name: 'Search' }));
        }
        const conflict = priceNote(page, first).locator('.fd-conflict');
        await see(conflict).toBeVisible();
        await see(conflict).toContainText(/Mona Adel changed this service at \d{1,2}:\d{2}/);
        await see(conflict.getByRole('button', { name: 'Reload' })).toBeVisible();
        await see(conflict.getByRole('button', { name: 'Keep mine' })).toBeVisible();
      },
    },
    {
      says: 'Press Escape in a cell you typed in: it holds what it held',
      notOnPhone: 'a phone has no Escape key, and its cards have no Columns menu: each card shows its own few fields',
      async run({ page, press, keys, see }) {
        await press(priceCell(page, 'Microneedling', 'minutes'));
        const held = await priceCell(page, 'Microneedling', 'minutes').locator('input').inputValue();
        await page.keyboard.type('90', { delay: 15 });
        await see(priceCell(page, 'Microneedling', 'minutes').locator('input')).toHaveValue('90');
        await keys('Escape');
        await see(page.locator('td[data-editing]')).toHaveCount(0);
        await see(priceCell(page, 'Microneedling', 'minutes')).toHaveText(held);
        // Done by hidden from Columns: Tab from Category goes on to Minutes.
        await press(page.getByRole('button', { name: 'Columns' }));
        await press(page.locator('.fd-list-columns-item', { hasText: 'Done by' }).locator('input[type="checkbox"]'));
        await keys('Escape');
        await see(page.getByRole('columnheader', { name: /Done by/ })).toHaveCount(0);
        await press(priceCell(page, 'Microneedling', 'category'));
        await keys('Tab');
        await see(page.locator('td[data-editing]')).toHaveAttribute('data-col', 'minutes');
      },
    },
    {
      says: 'Narrow the window, or open the page on a phone',
      async run(hand) {
        const { page, press, see } = hand;
        await narrow(hand);
        await see(page.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
        await see(service(page, 'Hydrafacial').locator('.fd-list-card')).toBeVisible();
        await press(service(page, 'Hydrafacial').locator('.fd-list-card'));
        const sheet = page.getByRole('dialog', { name: 'Change Hydrafacial' });
        await see(sheet).toBeVisible();
        await see(sheet.getByRole('textbox', { name: 'Price', exact: true })).toHaveValue('3,000');
      },
    },
  ],
};
