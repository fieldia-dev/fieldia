import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { node, date } from './support';

/** Where a part is drawn on the screen. */
const box = async (page: Page, id: string) => (await node(page, id).boundingBox())!;

/** Where a field's label sits against its box: beside it, or above it. */
const labelAgainstBox = (page: Page, id: string) =>
  node(page, id).evaluate((field) => {
    const label = field.querySelector('.fd-label')!.getBoundingClientRect();
    const input = (field.querySelector('input, select, textarea') as HTMLElement).getBoundingClientRect();
    return label.bottom <= input.top + 1 ? 'above' : 'beside';
  });

/** “New employee” (layout): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Narrow the window: Personal details keeps its three columns on a tablet',
      async run({ page, phone, see }) {
        const left = async (id: string) => (await box(page, id)).x;
        if (!phone) {
          // A tablet: the photo, First name, Last name side by side; Work email under First name, on its column.
          await page.setViewportSize({ width: 768, height: 900 });
          await see(node(page, 'f-photo')).toBeVisible();
          await see(node(page, 'f-first-name')).toBeVisible();
          await expect.poll(async () => (await left('f-first-name')) - (await left('f-photo'))).toBeGreaterThan(10);
          expect(await left('f-last-name')).toBeGreaterThan((await left('f-first-name')) + 10);
          expect(Math.abs((await left('f-email')) - (await left('f-first-name')))).toBeLessThanOrEqual(1);
          await page.setViewportSize({ width: 390, height: 844 });
        }
        // A phone: one column — the photo, then First name under it, then Last name, each on the photo's column.
        await see(node(page, 'f-photo')).toBeVisible();
        await see(node(page, 'f-last-name')).toBeVisible();
        await expect.poll(async () => Math.abs((await left('f-first-name')) - (await left('f-photo')))).toBeLessThanOrEqual(1);
        expect(Math.abs((await left('f-last-name')) - (await left('f-photo')))).toBeLessThanOrEqual(1);
        expect((await box(page, 'f-first-name')).y).toBeGreaterThan((await box(page, 'f-photo')).y);
        expect((await box(page, 'f-last-name')).y).toBeGreaterThan((await box(page, 'f-first-name')).y);
        expect(Math.abs((await box(page, 'f-first-name')).width - (await box(page, 'f-photo')).width)).toBeLessThanOrEqual(1);
      },
    },
    {
      says: 'Open the Pay tab: the bank’s labels sit beside their boxes',
      async run({ page, phone, press, see }) {
        if (!phone) await page.setViewportSize({ width: 1280, height: 900 });
        await press(page.getByRole('tab', { name: 'Pay' }));
        const pay = page.getByRole('tabpanel', { name: 'Pay' });
        await see(pay.getByRole('textbox', { name: 'IBAN' })).toBeVisible();
        if (!phone) {
          // Wide: beside their boxes.
          for (const id of ['f-bank-name', 'f-pay-currency', 'f-iban']) await expect.poll(() => labelAgainstBox(page, id), id).toBe('beside');
          // Narrower, each box too narrow for its label beside it: above it.
          await page.setViewportSize({ width: 600, height: 900 });
        }
        await see(node(page, 'f-bank-name').locator('.fd-label')).toBeVisible();
        await expect.poll(() => labelAgainstBox(page, 'f-bank-name')).toBe('above');
        expect(await labelAgainstBox(page, 'f-pay-currency')).toBe('above');
        if (!phone) await page.setViewportSize({ width: 1280, height: 900 });
      },
    },
    {
      says: 'Choose a fixed-term contract on the Job tab: Contract ends takes its place on the columns',
      async run(hand) {
        const { page, press, see } = hand;
        await press(page.getByRole('tab', { name: 'Job' }));
        const ends = page.getByRole('textbox', { name: 'Contract ends' });
        await see(ends).toBeHidden();
        await press(page.getByRole('radio', { name: 'Fixed term' }));
        await see(ends).toBeVisible();
        // On the columns: where Start date's column is, as wide as it.
        const [start, end] = [await box(page, 'f-start-date'), await box(page, 'f-end-date')];
        expect(Math.abs(end.x - start.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(end.width - start.width)).toBeLessThanOrEqual(1);
        // A day before the start date: refused.
        await date(hand, page.getByRole('textbox', { name: 'Start date' }), '01/11/2026');
        await hand.keys('Tab');
        await date(hand, ends, '31/10/2026');
        await hand.keys('Tab');
        await see(node(page, 'f-end-date')).toContainText('Contract ends must not be before Start date');
        await see(ends).toHaveAttribute('aria-invalid', 'true');
      },
    },
    {
      says: 'See the page in Arabic, right to left, or in its dark scheme.',
      async run({ page, follow, see }) {
        await follow('in Arabic, right to left');
        await see(page.locator('.fd-form').first()).toHaveAttribute('dir', 'rtl');
        await see(page.getByRole('heading', { name: 'موظف جديد' })).toBeVisible();
        await see(page.getByRole('group', { name: 'البيانات الشخصية' })).toBeVisible();
        await follow('in its dark scheme');
        await see(page.locator('.fd-form').first()).toHaveAttribute('data-scheme', 'dark');
        await see(page.locator('.fd-form').first()).toHaveCSS('background-color', 'rgb(22, 25, 30)');
      },
    },
  ],
};
