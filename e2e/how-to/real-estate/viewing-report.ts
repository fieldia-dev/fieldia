import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';
import { part } from './support';

/** A photo of the kitchen, as a phone's camera roll gives one. */
const PHOTO = { name: 'kitchen.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') };
/** What the outbox says, where the person is: under the ending once sent, over the form otherwise. */
const outboxSaid = (page: Page) => page.locator('.fd-outbox-said:visible');
/** A viewing report filled in as a broker fills it: the unit typed, the condition picked. */
async function viewingReport({ page, press, type }: Hand, unit: string, condition: string) {
  await type(page.getByRole('textbox', { name: '*Unit' }), unit, { clear: true });
  await press(page.getByRole('radio', { name: condition }));
}

export const replay: DemoReplay = {
  // Its stand-in finds the network by a request: with the connection off, the browser says that request failed —
  // Chromium in its words, WebKit in its own.
  allow: [/^Failed to load resource: (net::ERR_INTERNET_DISCONNECTED|WebKit encountered an internal error)$/],
  steps: [
    {
      says: 'Press Work offline over the form, fill in the unit and the condition, add a photo and Submit',
      async run(hand) {
        const { page, press, pick, see, demo } = hand;
        await press(page.getByRole('button', { name: 'Work offline' }));
        await viewingReport(hand, 'B-12', 'Needs finishing');
        await pick(part(page, 'f-photos').locator('.fd-file-pick').getByText('Add files', { exact: true }), PHOTO);
        await see(part(page, 'f-photos')).toContainText('kitchen.png');
        await press(page.getByRole('button', { name: 'Submit', exact: true }));
        await see(page.locator('.fd-done-title')).toHaveText('Kept on this device');
        await see(page.locator('.fd-done .fd-outbox-said')).toHaveText('No signal: 1 send waits on this device.');
        await see(page.locator('.demo-sent-log')).toContainText('Nothing sent yet.');
        expect(await demo<unknown[]>('dataSource.responses')).toEqual([]);
      },
    },
    {
      says: 'Reload the page, still offline: it still waits',
      async run({ page, press, see }) {
        await page.reload();
        await see(page.locator('.fd-form').first()).toBeVisible();
        await see(outboxSaid(page)).toHaveText('No signal: 1 send waits on this device.');
        await press(page.getByRole('button', { name: 'Back online' }));
        await see(outboxSaid(page)).toHaveText('Everything that waited was sent.');
        // What the app was told, under the form: the report, its photo stored first.
        const told = page.locator('.demo-sent-log ol > li');
        await see(told).toHaveCount(1);
        const toldOf = (words: string) => told.last().locator('dt', { hasText: words }).locator('xpath=following-sibling::dd[1]');
        await see(toldOf('Unit')).toHaveText('B-12');
        await see(toldOf('Photos')).toHaveText('kitchen.png (stored)');
        await see(told.last().locator('dt', { hasText: 'Kept on the device without signal' })).toBeVisible();
      },
    },
    {
      says: 'Turn your connection off instead (or put the phone in airplane mode)',
      async run(hand) {
        const { page, press, see } = hand;
        const told = page.locator('.demo-sent-log ol > li');
        // The form, empty again since the last report went.
        await page.context().setOffline(true);
        await viewingReport(hand, 'C-3', 'Ready to move in');
        await press(page.getByRole('button', { name: 'Submit', exact: true }));
        await see(page.locator('.fd-done-title')).toHaveText('Kept on this device');
        await see(page.locator('.fd-done .fd-outbox-said')).toHaveText('No signal: 1 send waits on this device.');
        await page.context().setOffline(false);
        // By itself, as the connection comes back.
        await see(page.locator('.fd-done .fd-outbox-said')).toHaveText('Everything that waited was sent.');
        await see(told).toHaveCount(2);
        await see(told.last().locator('dt', { hasText: 'Unit' }).locator('xpath=following-sibling::dd[1]')).toHaveText('C-3');
      },
    },
    {
      says: 'Send another with the connection off, then reload',
      notOnPhone: 'Playwright’s WebKit cannot reload a page with the connection off (microsoft/playwright#42775): a phone’s reload from its service worker is not replayable there',
      async run(hand) {
        const { page, press, see } = hand;
        // Its own service worker in place, as it is once the page has been opened.
        await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
        await press(page.getByRole('button', { name: 'Submit another response' }));
        await page.context().setOffline(true);
        await viewingReport(hand, 'D-7', 'Needs repairs');
        await press(page.getByRole('button', { name: 'Submit', exact: true }));
        await see(page.locator('.fd-done .fd-outbox-said')).toHaveText('No signal: 1 send waits on this device.');
        await page.reload();
        await see(page.locator('.dh-title')).toHaveText('A viewing report with no signal');
        await see(page.locator('.fd-form').first()).toBeVisible();
        await see(outboxSaid(page)).toHaveText('No signal: 1 send waits on this device.');
        await see(page.locator('.demo-meanwhile-said')).toHaveText('No signal: what you send is kept on this device.');
        await page.context().setOffline(false);
        await see(outboxSaid(page)).toHaveText('Everything that waited was sent.');
        await see(page.locator('.demo-sent-log ol > li').last().locator('dt', { hasText: 'Unit' }).locator('xpath=following-sibling::dd[1]')).toHaveText('D-7');
      },
    },
  ],
};
