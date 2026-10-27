import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import { FILES } from '../../files-support';
import type { DemoReplay, Hand } from '../hand';
import { photosField } from './support-more';

/** The Code drawer opened from the frame's header: on a phone, from its Options. */
async function openCode({ page, phone, press }: Hand) {
  if (phone) await press(page.getByRole('button', { name: 'Framework, look and links' }));
  await press(page.getByRole('button', { name: '‹/› Code' }));
  await expect(page.locator('#demo-code')).toBeVisible();
}
const going = (page: Page) => photosField(page).locator('.fd-file-going');

/** The listing-photos demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 120_000,
  steps: [
    {
      says: 'Press Add 10 phone photos over the listing: ten photos',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Add 10 phone photos' }));
        // Ten, listed as picked; the first, a phone's 12 megapixels — some MBs — made smaller before it goes: a few
        // hundred KB.
        const items = photosField(page).locator('.fd-file-item');
        await see(items).toHaveCount(10, { timeout: 30_000 });
        await see(items.first()).toContainText('Living room.jpg');
        await see(items.last()).toContainText('Roof terrace.jpg');
        await see(items.first().locator('.fd-file-size')).toHaveText(/^\d{2,3}(\.\d)? KB$/, { timeout: 30_000 });
      },
    },
    {
      says: 'Watch three go at once over the slow connection, each with its bar',
      async run({ page, see }) {
        const uploading = photosField(page).locator('.fd-file-going[data-status="uploading"]');
        const waiting = going(page).filter({ hasText: 'Waiting…' });
        // Three at once, the rest waiting their turn; each going with its bar and how far it has got.
        await expect.poll(async () => [await uploading.count(), (await waiting.count()) > 0], { timeout: 30_000 }).toEqual([3, true]);
        await see(uploading.first().getByRole('progressbar')).toBeVisible();
        await see(uploading.first().locator('.fd-file-state')).toHaveText(/^\d{1,3}%$/);
        // Never more than three at a time while the rest wait.
        for (let i = 0; i < 6 && (await waiting.count()); i++) expect(await uploading.count()).toBeLessThanOrEqual(3);
        // Each made smaller before it went: every one a few hundred KB, the first, once stored, 1600 pixels across.
        const items = photosField(page).locator('.fd-file-item');
        await see(items.locator('.fd-file-size')).toHaveText(Array(10).fill(/^\d{2,3}(\.\d)? KB$/), { timeout: 30_000 });
        await see(photosField(page).getByRole('button', { name: /^Living room\.jpg, / })).toBeVisible({ timeout: 30_000 });
        const thumb = items.first().locator('img').first();
        await see(thumb).toBeVisible();
        await expect.poll(() => thumb.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth), { timeout: 15_000 }).toBe(1600);
      },
    },
    {
      says: 'Balcony view fails on its first try: press Retry on it',
      async run({ page, press, see }) {
        const balcony = going(page).filter({ hasText: 'Balcony view.jpg' });
        await see(balcony.locator('.fd-file-state')).toHaveText('Not uploaded', { timeout: 30_000 });
        await see(photosField(page).getByRole('status').filter({ hasText: 'Balcony view.jpg was not uploaded' })).toBeVisible();
        await press(balcony.getByRole('button', { name: 'Retry Balcony view.jpg' }));
        // On its way again: its Retry gone, a bar or its turn awaited in its place.
        await see(balcony.getByRole('button', { name: 'Retry Balcony view.jpg' })).toBeHidden();
        await see(balcony.getByRole('progressbar')).toBeVisible();
      },
    },
    {
      says: 'Press Save while photos are still going: it waits',
      async run({ page, press, see }) {
        const status = page.locator('.fd-status');
        await press(page.getByRole('button', { name: 'Save', exact: true }));
        // It waits, saying how many are left.
        await see(status).toHaveText(/^\d+ files? still uploading\. Saving when (it is|they are) done\.$/);
        // × on one still going — the last still waiting its turn, so that no upload ends it under the pointer: cancelled,
        // and taken away.
        const waiting = going(page).filter({ hasText: 'Waiting…' });
        const last = (await waiting.count()) ? waiting.last() : going(page).last();
        const name = (await last.locator('.fd-file-name').getAttribute('title'))!;
        await press(photosField(page).getByRole('button', { name: `Cancel uploading ${name}` }));
        await see(photosField(page).getByRole('button', { name: `Cancel uploading ${name}` })).toHaveCount(0);
        await see(photosField(page).getByRole('button', { name: new RegExp(`^${name.replace(/[.]/g, '\\.')}, `) })).toHaveCount(0);
        // Then saved, once the rest are there: nine photos.
        await see(status).toHaveText('Saved', { timeout: 60_000 });
        await see(photosField(page).locator('.fd-file-item')).toHaveCount(9);
      },
    },
    {
      says: 'Pick photos of your own with Add photos, or take one',
      async run({ page, pick, see }) {
        const add = photosField(page).locator('.fd-file-pick').getByText('Add photos', { exact: true });
        // A phone offers its camera for it: the box asks for the one on the back.
        await see(photosField(page).locator('input[type=file]')).toHaveAttribute('capture', 'environment');
        await pick(add, [FILES.photo('Garden at dusk.png', 1)]);
        const mine = photosField(page).locator('.fd-file-item').filter({ hasText: 'dusk.png' });
        await see(mine).toBeVisible();
        // Stored as it is picked: no bar left on it, its card a button to open it.
        await see(photosField(page).getByRole('button', { name: /^Garden at dusk\.png, / })).toBeVisible({ timeout: 30_000 });
        await see(photosField(page).locator('.fd-file-item')).toHaveCount(10);
      },
    },
    {
      says: 'Open the Code drawer: this store is the memory source slowed down',
      async run(hand) {
        const { page, press, see } = hand;
        await openCode(hand);
        const code = page.locator('#demo-code');
        await press(code.getByRole('tab', { name: 'JavaScript' }));
        await see(code.locator('code')).toContainText('createMemoryDataSource');
        await see(code.locator('code')).toContainText('bytesPerSecond: 50_000');
        await press(code.getByRole('tab', { name: 'Your store' }));
        await see(code.locator('code')).toContainText("upload: uploadTo({ url: '/api/files'");
        await see(code.locator('code')).toContainText('Azure Blob');
        await see(code.locator('code')).toContainText('uploadAddress(fileName)');
      },
    },
  ],
};
