import type { Locator } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** One box's place on the page, once it is drawn. */
const box = async (part: Locator) => (await part.boundingBox())!;

/** “Around a record” (vendor-bill): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press › beside “3 / 4” at the top (or Alt+N)',
      async run({ page, phone, press, keys, see }) {
        const bar = page.locator('.fd-record-bar');
        const count = bar.locator('.fd-record-pager-text');
        const title = page.locator('.fd-title [data-field="name"] textarea');
        const pdf = page.locator('.fd-attachment-preview .fd-attachment-name');
        await see(count).toHaveText('3 / 4');
        await see(pdf).toHaveText('NT-8907.pdf');
        await press(bar.getByRole('button', { name: 'Next record' }));
        await see(count).toHaveText('4 / 4');
        await see(title).toHaveValue('BILL/2026/10/0004');
        await see(pdf).toHaveText('DOS-1187.pdf');
        // Round to the first: Alt+N on a desktop, › again on a phone, which has no Alt.
        if (phone) await press(bar.getByRole('button', { name: 'Next record' }));
        else await keys('Alt+KeyN');
        await see(count).toHaveText('1 / 4');
        await see(title).toHaveValue('BILL/2026/10/0001');
        await see(pdf).toHaveText('NT-8841.pdf');
      },
    },
    {
      says: 'Open the gear menu with the arrow keys: Print, then Debit Note',
      async run({ page, phone, press, keys, see }) {
        const gear = page.locator('.fd-record-bar .fd-record-gear');
        if (phone) {
          // A phone has no arrow keys: a tap opens the gear's menu.
          await press(gear);
        } else {
          // From › pressed in the step before, back to the gear with the keys.
          for (let i = 0; i < 6 && (await page.locator('.fd-record-gear:focus').count()) === 0; i++) await keys('Shift+Tab');
          await see(gear).toBeFocused();
          await keys('ArrowDown');
        }
        const menu = page.getByRole('menu');
        await see(menu).toBeVisible();
        await see(menu.getByRole('group', { name: 'Print' })).toBeVisible();
        if (!phone) await see(menu.getByRole('menuitem').first()).toBeFocused();
        // Print (its one item, the vendor bill), then Debit Note, Archive and Duplicate.
        await see(menu.getByRole('menuitem')).toHaveText(['Vendor bill', 'Debit Note', 'Archive', 'Duplicate']);
        await press(menu.getByRole('menuitem', { name: 'Debit Note' }));
        await see(menu).toBeHidden();
        await see(page.locator('.fd-say').filter({ hasText: 'Debit note DN/2026/10/0001 made' })).toBeVisible();
        await see(page.locator('.fd-slot[data-slot="chatter"] .fd-message-body').first()).toHaveText('Debit note DN/2026/10/0001 made for BILL/2026/10/0001');
      },
    },
    {
      says: 'Press Duplicate: the copy is a draft with no number yet',
      async run({ page, press, see }) {
        await press(page.locator('.fd-record-bar .fd-record-gear'));
        await press(page.getByRole('menuitem', { name: 'Duplicate' }));
        // No number and no dates, as Odoo's draft copy: its title says Draft.
        await see(page.locator('.fd-title [data-field="name"] textarea')).toHaveValue('');
        await see(page.locator('.fd-title [data-field="name"] textarea')).toHaveAttribute('placeholder', 'Draft');
        await see(page.locator('[data-node="f-date"] input')).toHaveValue('');
        await see(page.locator('[data-node="f-due"] input')).toHaveValue('');
        // A copy of the posted bill is a draft, to change and confirm on its own.
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Draft');
        await see(page.getByRole('button', { name: 'Confirm' })).toBeVisible();
        // Its bill and payment references start empty: a payment quoting the copy never names the posted bill.
        await see(page.locator('[data-node="f-ref"] input')).toHaveValue('');
        await see(page.locator('[data-node="f-payment-ref"] input')).toHaveValue('');
        await see(page.locator('.fd-record-bar .fd-record-pager-text')).toHaveText('2 / 5');
      },
    },
    {
      says: 'On BILL/2026/10/0002, press Archive and say yes',
      async run({ page, press, see }) {
        const bar = page.locator('.fd-record-bar');
        const gear = bar.locator('.fd-record-gear');
        await press(bar.getByRole('button', { name: 'Next record' }));
        await see(page.locator('.fd-title [data-field="name"] textarea')).toHaveValue('BILL/2026/10/0002');
        await see(page.locator('.fd-ribbon:visible')).toHaveCount(0);
        await press(gear);
        await press(page.getByRole('menuitem', { name: 'Archive' }));
        const question = page.getByRole('alertdialog');
        await see(question).toContainText('Are you sure that you want to archive this record?');
        await press(question.getByRole('button', { name: 'Archive' }));
        await see(question).toBeHidden();
        await see(page.locator('.fd-ribbon:visible')).toHaveText('Archived');
        await press(gear);
        await see(page.getByRole('menuitem', { name: 'Unarchive' })).toBeVisible();
        await see(page.getByRole('menuitem', { name: 'Archive', exact: true })).toBeHidden();
        await press(gear);
        await see(page.getByRole('menu')).toBeHidden();
      },
    },
    {
      says: 'Make the window narrow: BILL/2026/10/0002 has no PDF',
      async run({ page, phone, press, see }) {
        const sheet = page.locator('.fd-sheet-layout > .fd-card');
        const pdf = page.locator('.fd-sheet-layout > .fd-attachment-preview');
        const talk = page.locator('.fd-sheet-layout > .fd-side');
        const under = (part: Locator) => async () => (await box(part)).y >= (await box(sheet)).y + (await box(sheet)).height - 1;
        // BILL/2026/10/0002, its PDF not come: the conversation beside the sheet in a narrow window, under it at a phone's width.
        await see(page.locator('.fd-title [data-field="name"] textarea')).toHaveValue('BILL/2026/10/0002');
        await see(pdf).toBeHidden();
        await see(talk).toBeVisible();
        if (!phone) {
          await page.setViewportSize({ width: 900, height: 720 });
          await expect.poll(async () => (await box(talk)).x >= (await box(sheet)).x + (await box(sheet)).width - 1, { message: 'the conversation beside the sheet' }).toBe(true);
          await page.setViewportSize({ width: 390, height: 844 });
        }
        await expect.poll(under(talk), { message: 'the conversation under the sheet at a phone’s width' }).toBe(true);
        // A bill with its PDF, the window narrow: the PDF and the conversation both under the sheet.
        if (!phone) await page.setViewportSize({ width: 900, height: 720 });
        await press(page.locator('.fd-record-bar').getByRole('button', { name: 'Next record' }));
        await see(page.locator('.fd-title [data-field="name"] textarea')).toHaveValue('BILL/2026/10/0003');
        await see(pdf.locator('.fd-attachment-name')).toHaveText('NT-8907.pdf');
        await see(talk).toBeVisible();
        await expect.poll(under(pdf), { message: 'the PDF under the sheet' }).toBe(true);
        await expect.poll(under(talk), { message: 'the conversation under the sheet' }).toBe(true);
      },
    },
  ],
};
