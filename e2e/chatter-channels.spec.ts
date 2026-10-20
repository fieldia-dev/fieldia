import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * A conversation that knows its channels, as an estate agency's request page has it: a buyer's enquiry beside
 * WhatsApp, e-mail, a text message and the team's notes — each saying its channel, ticks on what went out —, a reply
 * by the buyer's own channel, messages arriving while a reply is typed, and follow-ups at an hour on Cairo's clock.
 * The demos' clock is pinned at 11:00 in Cairo (08:00 UTC); the browser's own clock is Cairo's, so no zone is named.
 */
const ENQUIRY = 'page=enquiry&skin=underline&now=2026-10-20T08:00:00Z';
const chatter = (page: Page) => page.locator('.fd-slot[data-slot="chatter"] .fd-chatter');
const message = (page: Page, words: string) => chatter(page).locator('.fd-message', { hasText: words });
const ticks = (page: Page, words: string) => message(page, words).locator('.fd-delivery');
const offered = (page: Page) => chatter(page).locator('.fd-send-by-option');
const picked = (page: Page) => chatter(page).locator('.fd-send-by-option:has(input:checked)');

test.use({ timezoneId: 'Africa/Cairo' });

for (const variant of VARIANTS) {
  test.describe(`${variant} · chatter channels`, () => {
    test('says each message’s channel and how far it got, a failed one’s why, and each follow-up’s hour', async ({ page }) => {
      const { problems } = await open(page, variant, ENQUIRY);
      await expect(chatter(page).locator('.fd-message')).toHaveCount(7);
      await expect(chatter(page).locator('.fd-message .fd-message-channel')).toHaveText(['WhatsApp', 'WhatsApp', 'WhatsApp', 'Team note', 'SMS', 'E-mail', 'E-mail']);
      await expect(ticks(page, 'I will meet you at the gate')).toHaveAttribute('aria-label', 'Delivered');
      await expect(ticks(page, 'The floor plan is attached')).toHaveAttribute('aria-label', 'Read');
      await expect(message(page, 'Your viewing link')).toContainText('Not delivered: This number does not take text messages');
      // What came from the buyer has no ticks, and the time each was written is on the office's clock.
      await expect(ticks(page, 'Can we see the flat on Thursday')).toHaveCount(0);
      await expect(message(page, 'Can we see the flat on Thursday').locator('time')).toHaveText('20 Oct 2026, 08:50');
      await expect(chatter(page).locator('.fd-activity-due')).toHaveText(['Overdue since 19 Oct 2026, 17:00', 'Today at 15:30', 'Due 22 Oct 2026, 18:30']);
      await chatter(page).locator('.fd-activities').scrollIntoViewIfNeeded();
      await screen(page, `${variant}-chatter-channels`, { viewport: true });
      expect(problems).toEqual([]);
    });

    test('replies by the buyer’s last channel, its ticks turning as her phone tells; what arrives meanwhile leaves the reply typed', async ({ page }) => {
      await open(page, variant, ENQUIRY);
      const panel = chatter(page);
      await panel.getByRole('button', { name: 'Send message' }).click();
      // Yasmin wrote last on WhatsApp (her first word was an e-mail).
      await expect(offered(page)).toHaveText(['WhatsApp', 'E-mail', 'SMS', 'Team note']);
      await expect(picked(page)).toHaveText('WhatsApp');
      await expect(panel.locator('.fd-send-to')).toHaveText('To +20 10 0482 1937');
      const box = panel.locator('.fd-composer textarea');
      await expect(box).toBeFocused();
      await expect(box).toHaveAttribute('placeholder', 'Message by WhatsApp…');
      await box.pressSequentially('Parking is in front of the building.');
      await screen(page, `${variant}-chatter-channels-reply`, { viewport: true });
      await panel.getByRole('button', { name: 'Send by WhatsApp' }).click();
      const sent = 'Parking is in front of the building.';
      await expect(panel.locator('.fd-message').first()).toContainText(sent);
      await expect(ticks(page, sent)).toHaveAttribute('aria-label', 'Sent');
      // Her phone gets it a moment later.
      await expect(ticks(page, sent)).toHaveAttribute('aria-label', 'Delivered');

      // A second reply, half typed by e-mail, as she writes on WhatsApp: hers arrives on top, the reply stays as it is.
      await panel.getByRole('button', { name: 'Send message' }).click();
      await panel.locator('.fd-send-by-option', { hasText: 'E-mail' }).click();
      await box.pressSequentially('The contract draft follows');
      // Each message shown is kept as it is drawn: never the conversation drawn again whole.
      await panel.locator('.fd-message').evaluateAll((items) => items.forEach((item) => item.setAttribute('data-test-kept', '')));
      await page.getByRole('button', { name: 'Yasmin writes on WhatsApp' }).click();
      await expect(panel.locator('.fd-message').first()).toContainText('Is there parking for two cars?');
      await expect(panel.locator('.fd-message').first()).toHaveAttribute('data-direction', 'in');
      await expect(panel.getByRole('status').filter({ hasText: 'New WhatsApp message from Yasmin Farouk' })).toHaveCount(1);
      await expect(box).toHaveValue('The contract draft follows');
      await expect(picked(page)).toHaveText('E-mail');
      await expect(panel.locator('.fd-message[data-test-kept]')).toHaveCount(8);
      await expect(panel.locator('.fd-message:not([data-test-kept])')).toHaveCount(1);
      await panel.locator('.fd-message').first().scrollIntoViewIfNeeded();
      await screen(page, `${variant}-chatter-channels-arrived`, { viewport: true });

      // She reads what was sent to her: each WhatsApp message's ticks turn read, a failed text message stays failed.
      await page.getByRole('button', { name: 'Yasmin reads your WhatsApp messages' }).click();
      for (const words of [sent, 'I will meet you at the gate', 'The doorman will expect you']) await expect(ticks(page, words)).toHaveAttribute('aria-label', 'Read');
      await expect(ticks(page, 'Your viewing link')).toHaveAttribute('aria-label', 'Not delivered');
      await expect(box).toHaveValue('The contract draft follows');
      await panel.locator('.fd-message').nth(3).scrollIntoViewIfNeeded();
      await screen(page, `${variant}-chatter-channels-read`, { viewport: true });
    });

    test('schedules a follow-up at an hour on the office’s clock, and a note by the team’s own channel', async ({ page }) => {
      await open(page, variant, ENQUIRY);
      const panel = chatter(page);
      await panel.getByRole('button', { name: 'Schedule activity' }).click();
      const form = panel.locator('.fd-activity-form');
      await form.getByLabel('Activity', { exact: true }).selectOption({ label: 'Call' });
      await form.getByLabel('Summary').fill('Tell Yasmin about the parking');
      await form.getByLabel('Due date').fill('2026-10-20');
      await form.getByLabel('Time', { exact: true }).fill('17:45');
      await screen(page, `${variant}-chatter-channels-schedule`, { viewport: true });
      await form.getByRole('button', { name: 'Schedule' }).click();
      await expect(panel.locator('.fd-activity', { hasText: 'Tell Yasmin about the parking' }).locator('.fd-activity-due')).toHaveText('Today at 17:45');
      await panel.getByRole('button', { name: 'Log note' }).click();
      await expect(picked(page)).toHaveText('Team note');
      await panel.locator('.fd-composer textarea').fill('Her husband is coming to the viewing too.');
      await panel.locator('.fd-composer textarea').press('ControlOrMeta+Enter');
      const note = panel.locator('.fd-message').first();
      await expect(note).toHaveClass(/fd-message-note/);
      await expect(note.locator('.fd-message-channel')).toHaveText('Team note');
      await expect(note.locator('.fd-delivery')).toHaveCount(0);
    });

    test('offers no channel the buyer cannot be written to by: a walk-in with no e-mail', async ({ page }) => {
      await open(page, variant, `${ENQUIRY}&record=2`);
      const panel = chatter(page);
      await expect(panel.locator('.fd-message').first()).toContainText('Is the studio furnished?');
      await panel.getByRole('button', { name: 'Send message' }).click();
      await expect(offered(page)).toHaveText(['WhatsApp', 'SMS', 'Team note']);
      await expect(picked(page)).toHaveText('WhatsApp');
      await expect(panel.locator('.fd-send-to')).toHaveText('To +20 12 2765 4321');
    });
  });
}

test.describe('chatter channels on another clock', () => {
  test.use({ timezoneId: 'Europe/Berlin' });
  test('names the office’s zone beside an hour, where the reader’s clock is another', async ({ page }) => {
    await open(page, 'plain', ENQUIRY);
    await expect(chatter(page).locator('.fd-activity-due').nth(1)).toHaveText(/^Today at 15:30 \S+/);
    await expect(chatter(page).locator('.fd-activity-due').nth(1)).not.toHaveText('Today at 15:30 CEST');
  });
});
