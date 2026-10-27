import type { Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { chatter, followLink, message } from './support';

/** A message's ticks: how far it got, in words for a screen reader. */
const ticks = (page: Page, words: string) => message(page, words).locator('.fd-delivery');
/** The colour a part is drawn in, as [r, g, b]. */
const colourOf = async (target: Locator) => (await target.evaluate((element) => getComputedStyle(element).color)).match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);

export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Send message: the reply goes by WhatsApp, the channel Yasmin last wrote on',
      async run({ page, press, see }) {
        const panel = chatter(page);
        await press(panel.getByRole('button', { name: 'Send message' }));
        await see(panel.locator('.fd-send-by-option:has(input:checked)')).toHaveText('WhatsApp');
        await see(panel.locator('.fd-send-to')).toHaveText('To +20 10 0482 1937');
        const box = panel.locator('.fd-composer textarea');
        await see(box).toBeFocused();
        await see(box).toHaveAttribute('placeholder', 'Message by WhatsApp…');
        await page.keyboard.type('Parking is in front of the building.', { delay: 15 });
        await press(panel.getByRole('button', { name: 'Send by WhatsApp' }));
        const sent = 'Parking is in front of the building.';
        await see(panel.locator('.fd-message').first()).toContainText(sent);
        await see(panel.locator('.fd-message').first().locator('.fd-message-channel')).toHaveText('WhatsApp');
        // One tick, then two as her phone gets it.
        await see(ticks(page, sent)).toHaveAttribute('aria-label', 'Sent');
        await see(ticks(page, sent)).toHaveAttribute('aria-label', 'Delivered');
      },
    },
    {
      says: 'Press Yasmin reads your WhatsApp messages over the page',
      async run({ page, press, see }) {
        const sent = ['Parking is in front of the building.', 'I will meet you at the gate', 'The doorman will expect you'];
        for (const words of sent) await see(ticks(page, words)).toHaveAttribute('aria-label', 'Delivered');
        const grey = await colourOf(ticks(page, sent[1]));
        await press(page.getByRole('button', { name: 'Yasmin reads your WhatsApp messages' }));
        for (const words of sent) await see(ticks(page, words)).toHaveAttribute('aria-label', 'Read');
        // Grey before, blue now.
        const [r, g, b] = await colourOf(ticks(page, sent[1]));
        expect(Math.max(...grey) - Math.min(...grey), `grey: rgb(${grey})`).toBeLessThan(40);
        expect(b, `blue: rgb(${[r, g, b]})`).toBeGreaterThan(Math.max(r, g) + 40);
        // What she was never sent on WhatsApp keeps its own: the failed text message.
        await see(ticks(page, 'Your viewing link')).toHaveAttribute('aria-label', 'Not delivered');
      },
    },
    {
      says: 'Start a reply, then press Yasmin writes on WhatsApp',
      async run({ page, press, see }) {
        const panel = chatter(page);
        await press(panel.getByRole('button', { name: 'Send message' }));
        const box = panel.locator('.fd-composer textarea');
        await see(box).toBeFocused();
        await page.keyboard.type('The contract draft follows', { delay: 15 });
        await press(page.getByRole('button', { name: 'Yasmin writes on WhatsApp' }));
        const first = panel.locator('.fd-message').first();
        await see(first).toContainText('Is there parking for two cars?');
        await see(first).toHaveAttribute('data-direction', 'in');
        await see(first.locator('.fd-message-channel')).toHaveText('WhatsApp');
        await see(box).toHaveValue('The contract draft follows');
      },
    },
    {
      says: 'Look at the conversation: her first e-mail, your answer with the floor plan (read)',
      async run({ page, press, see }) {
        const first = message(page, 'Is the garden flat in Zamalek still available');
        await see(first.locator('.fd-message-channel')).toHaveText('E-mail');
        const plan = message(page, 'The floor plan is attached');
        await see(plan.locator('.fd-message-channel')).toHaveText('E-mail');
        await see(plan.getByRole('img', { name: 'zamalek-garden-flat.svg' })).toBeVisible();
        await see(ticks(page, 'The floor plan is attached')).toHaveAttribute('aria-label', 'Read');
        const sms = message(page, 'Your viewing link');
        await see(sms.locator('.fd-message-channel')).toHaveText('SMS');
        await see(sms.locator('.fd-message-failure')).toContainText('Not delivered: This number does not take text messages');
        const note = message(page, 'The owner would take 14.2M');
        await see(note).toContainText('Karim Fathy');
        await see(note.locator('.fd-message-channel')).toHaveText('Team note');
        // Sent again: on its way, then refused again by the gateway, and said again.
        await press(sms.getByRole('button', { name: 'Retry' }));
        await see(ticks(page, 'Your viewing link')).toHaveAttribute('aria-label', 'Sending');
        await see(ticks(page, 'Your viewing link')).toHaveAttribute('aria-label', 'Not delivered');
        await see(sms.locator('.fd-message-failure')).toContainText('Not delivered: This number does not take text messages');
      },
    },
    {
      says: 'Look at Activities: Call Yasmin to confirm Thursday is due at 15:30 today',
      async run({ page, phone, press, see }) {
        const panel = chatter(page);
        const call = panel.locator('.fd-activity', { hasText: 'Call Yasmin to confirm Thursday' });
        // On the office's clock, Cairo's, its zone named for a reader whose clock is another (here, UTC).
        await see(call.locator('.fd-activity-due')).toHaveText(/^Today at 15:30 (EEST|EET|GMT\+[23])$/);
        await press(panel.getByRole('button', { name: 'Schedule activity' }));
        const form = panel.locator('.fd-activity-form');
        await see(form.getByLabel('Due date')).toBeVisible();
        const time = form.getByLabel('Time', { exact: true });
        await see(time).toBeVisible();
        if (phone) return; // An iPhone's time box is its own wheel, which Playwright's WebKit cannot turn: its box seen beside the day.
        await press(form.getByLabel('Summary'));
        await page.keyboard.type('Tell Yasmin about the parking', { delay: 15 });
        await press(time);
        await page.keyboard.type('0545P', { delay: 15 });
        await see(time).toHaveValue('17:45');
        await press(form.getByRole('button', { name: 'Schedule' }));
        await see(panel.locator('.fd-activity', { hasText: 'Tell Yasmin about the parking' }).locator('.fd-activity-due')).toHaveText(/^Due \d{1,2} \w{3} \d{4}, 17:45 (EEST|EET|GMT\+[23])$/);
      },
    },
    {
      says: 'Open Omar Said’s enquiry: he has no e-mail',
      async run(hand) {
        const { page, press, see } = hand;
        await followLink(hand, 'Open Omar Said’s enquiry');
        const panel = chatter(page);
        await see(panel.locator('.fd-message').first()).toContainText('Is the studio furnished?');
        await press(panel.getByRole('button', { name: 'Send message' }));
        await see(panel.locator('.fd-send-by-option')).toHaveText(['WhatsApp', 'SMS', 'Team note']);
        await see(panel.locator('.fd-send-by-option:has(input:checked)')).toHaveText('WhatsApp');
        await see(panel.locator('.fd-send-to')).toHaveText('To +20 12 2765 4321');
      },
    },
  ],
};
