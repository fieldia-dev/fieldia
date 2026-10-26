import type { Locator } from '@playwright/test';
import { expect } from '../../fixtures';
import { node, follow } from './support-more';
import type { DemoReplay } from '../hand';

/** A box's height on the screen, as a person sees it grow or shrink. */
const height = async (target: Locator) => (await target.boundingBox())?.height ?? 0;

/** The embed demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Fill in the form — its code is always 246810 — and send it',
      async run({ page, press, type, keys, see }) {
        const told = page.locator('#told li');
        const form = page.locator('fieldia-form');
        await see(told.first()).toHaveText('fieldia-ready {"page":"unit-enquiry"}');
        await type(form.getByRole('textbox', { name: 'Full name' }), 'Hana Fouad');
        const phone = node(page, 'f-phone');
        await type(phone.getByRole('textbox', { name: 'Mobile' }), '010 1234 5678');
        await keys('Tab');
        await press(phone.getByRole('button', { name: 'Send a code by WhatsApp' }));
        const code = phone.getByRole('textbox', { name: /^Code sent to/ });
        await see(code).toBeFocused();
        await page.keyboard.type('246810', { delay: 15 });
        await see(phone.locator('.fd-verify-done')).toHaveText('Confirmed');
        await press(form.getByRole('radio', { name: 'Book a viewing' }));
        await press(form.getByRole('button', { name: 'Submit', exact: true }));
        await see(form.locator('.fd-done-title')).toHaveText('Thank you, Hana Fouad');
        // Told: ready, then the send with its reference — never the answers.
        await see(told).toHaveText(['fieldia-ready {"page":"unit-enquiry"}', 'fieldia-send {"id":"R-1201"}']);
        await see(page.locator('#told')).not.toContainText('Hana');
      },
    },
    {
      says: 'See it in a frame, as a partner’s one script tag places it',
      async run(hand) {
        const { page, press, type, keys, see } = hand;
        await follow(hand, 'See it in a frame');
        const frame = page.locator('iframe[data-fieldia-frame]');
        const inside = page.frameLocator('iframe[data-fieldia-frame]');
        await see(inside.locator('.fd-form')).toBeVisible();
        // The unit, from the link.
        await see(inside.getByRole('textbox', { name: 'Unit' })).toHaveValue('B-12');
        const fits = async () => Math.abs((await height(frame)) - (await inside.locator('html').evaluate((html) => html.getBoundingClientRect().height))) <= 2;
        await expect.poll(fits).toBe(true);
        const start = await height(frame);
        await type(inside.getByRole('textbox', { name: 'Full name' }), 'Omar Said');
        const phone = inside.locator('[data-node="f-phone"]');
        await type(phone.getByRole('textbox', { name: 'Mobile' }), '012 2222 3333');
        await keys('Tab');
        await press(phone.getByRole('button', { name: 'Send a code by WhatsApp' }));
        await see(phone.getByRole('textbox', { name: /^Code sent to/ })).toBeFocused();
        // Grown as it goes: the code's box and its words under the mobile.
        await expect.poll(() => height(frame)).toBeGreaterThan(start);
        await expect.poll(fits).toBe(true);
        const tall = await height(frame);
        await page.keyboard.type('246810', { delay: 15 });
        await see(phone.locator('.fd-verify-done')).toHaveText('Confirmed');
        await press(inside.getByRole('radio', { name: 'Book a viewing' }));
        await press(inside.getByRole('button', { name: 'Submit', exact: true }));
        await see(inside.locator('.fd-done-title')).toHaveText('Thank you, Omar Said');
        await see(page.locator('#told li').last()).toHaveText('fieldia-send {"id":"R-1201"}');
        // Sent, the thanks is shorter: the frame shrinks with it.
        await expect.poll(() => height(frame)).toBeLessThan(tall);
        await expect.poll(fits).toBe(true);
      },
    },
    {
      says: 'See it in Arabic: the element’s locale attribute',
      async run(hand) {
        const { page, see } = hand;
        await follow(hand, 'See it in Arabic');
        // The element on the page itself, as the step names it, its locale attribute Arabic.
        await see(page.locator('iframe[data-fieldia-frame]')).toHaveCount(0);
        const form = page.locator('fieldia-form');
        await see(form).toHaveAttribute('locale', 'ar');
        await see(form.locator('.fd-form')).toHaveAttribute('dir', 'rtl');
        // In Arabic: Fieldia's own words — its Submit, its phone's country — the page's own as the app wrote them.
        await see(form.getByRole('button', { name: 'إرسال' })).toBeVisible();
        await see(form.getByRole('button', { name: 'بلد Mobile' })).toBeVisible();
      },
    },
  ],
};
