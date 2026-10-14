import { randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { FILES } from './files-support';
import { node, open, screen } from './support';

/**
 * Files a person picks are never lost or sent where they should not go, as a
 * person meets it: a photo picked while the listing saves over a slow network
 * stays a change, shown and saved next; Retry that stores a failed photo takes
 * "Not saved" with it; a "photo" the browser cannot draw shows its file icon,
 * never a broken picture; a saved form placed in a record (the owner's consent
 * in a listing's handover) stores its signature and its deed for the listing,
 * the listing's save waiting for them and stopped by one that failed; and an
 * app with no store keeps a drawn signature in its draft, as before 0.21.
 */

const status = (page: Page) => page.locator('.fd-status');
const photos = (page: Page) => node(page, 'f-photos');
const going = (page: Page) => photos(page).locator('.fd-file-going');
const state = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState());
const listing = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.records.listing[1]);
const saveButton = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });

test.describe('files picked are never lost', () => {
  test.describe.configure({ timeout: 120_000 });

  test('a photo picked while the listing saves over a slow network stays a change: shown, unsaved, and saved next', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-photos&skin=outlined');
    // The listing's save answers slowly: only once the photo picked meanwhile is stored.
    await page.evaluate(() => {
      const { dataSource, handle } = (window as any).fieldiaDemo;
      const save = dataSource.save.bind(dataSource);
      dataSource.save = async (request: unknown) => {
        for (let i = 0; i < 200 && !(handle.form.getState().values.photos ?? []).length; i++) await new Promise((done) => setTimeout(done, 50));
        return save(request);
      };
    });
    await node(page, 'f-bedrooms').locator('input').fill('4');
    await saveButton(page).click();
    await expect(status(page)).toHaveText('Saving…');
    // Picked while it saves.
    await photos(page).locator('input[type=file]').setInputFiles(FILES.photo('Kitchen.png'));
    await expect(status(page)).toHaveText('Saved', { timeout: 30_000 });
    // The photo shows, and is still to save: the save never carried it.
    await expect(photos(page).locator('.fd-file-item:not(.fd-file-going)')).toHaveCount(1);
    expect((await state(page)).dirty).toEqual(['photos']);
    expect((await listing(page)).photos).toEqual([]);
    await expect(saveButton(page)).toBeVisible();
    await saveButton(page).click();
    await expect(status(page)).toHaveText('Saved');
    expect((await state(page)).dirty).toEqual([]);
    const kept = (await listing(page)).photos;
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ name: 'Kitchen.png', fileId: expect.any(Number) });
    expect(problems).toEqual([]);
  });

  test('Retry that stores a failed photo takes “Not saved” with it', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-photos&skin=outlined&store=http');
    let tries = 0;
    await page.route('**/api/listing-files', (route) => (++tries === 1 ? route.fulfill({ status: 500, body: 'The store is down' }) : route.continue()));
    await node(page, 'f-bedrooms').locator('input').fill('4');
    await photos(page).locator('input[type=file]').setInputFiles(FILES.photo('phone-a.png'));
    await expect(going(page)).toHaveAttribute('data-status', 'failed', { timeout: 30_000 });
    await saveButton(page).click();
    await expect(status(page)).toHaveText('Not saved. Check: Photos');
    await going(page).getByRole('button', { name: 'Retry phone-a.png' }).click();
    await expect(going(page)).toHaveCount(0, { timeout: 30_000 });
    await expect(photos(page).locator('.fd-error')).toBeHidden();
    // Not said any more: the photo is stored, and the listing is still to save.
    await expect(status(page)).not.toHaveText(/Not saved/);
    expect(await state(page)).toMatchObject({ status: 'ready', error: null, saveProblem: null });
    await saveButton(page).click();
    await expect(status(page)).toHaveText('Saved');
    expect(problems.filter((problem) => !/status of 500/.test(problem))).toEqual([]);
  });

  test('a “photo” the browser cannot draw shows its file icon, on its way, refused and stored — never a broken picture', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-photos&skin=outlined');
    // Random bytes named .jpg: too large, so refused; and a small one, stored.
    await photos(page).locator('input[type=file]').setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: randomBytes(6 * 1024 * 1024) });
    const refused = going(page).filter({ hasText: 'broken.jpg' });
    await expect(refused).toHaveAttribute('data-status', 'refused', { timeout: 30_000 });
    await expect(refused.locator('.fd-file-state')).toHaveText('broken.jpg is larger than 5 MB');
    await expect(refused.locator('img')).toHaveCount(0);
    await expect(refused.locator('.fd-file-icon')).toHaveText('JPG');
    await photos(page).locator('input[type=file]').setInputFiles({ name: 'damp wall.jpg', mimeType: 'image/jpeg', buffer: randomBytes(20 * 1024) });
    const kept = photos(page).locator('.fd-file-item:not(.fd-file-going)').filter({ hasText: 'damp wall' });
    await expect(kept).toHaveCount(1, { timeout: 30_000 });
    await expect(kept.locator('img')).toHaveCount(0);
    await expect(kept.locator('.fd-file-icon')).toHaveText('JPG');
    await screen(page, 'uploads-undecodable-icons');
    expect(problems.filter((problem) => !/Failed to load resource|ERR_/.test(problem))).toEqual([]);
  });
});

test.describe('a saved form placed in a record: the owner’s consent in a listing’s handover', () => {
  test.describe.configure({ timeout: 120_000 });
  const part = (page: Page) => page.locator('.fd-form-part[data-node="p-consent"]');

  test('a signature drawn at hand speed goes to the store for the listing, and the listing keeps its link, never its bytes', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-handover&skin=outlined');
    const pad = part(page).locator('[data-node="c-signature"] canvas');
    await expect(pad).toBeVisible();
    await part(page).locator('[data-node="c-owner"] input').fill('Hoda Mansour');
    await pad.scrollIntoViewIfNeeded();
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + box.height * 0.7);
    await page.mouse.down();
    for (const [x, y] of [[0.2, 0.35], [0.3, 0.75], [0.42, 0.3], [0.55, 0.7], [0.7, 0.4], [0.85, 0.6]]) {
      await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 8 });
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    await saveButton(page).click();
    await expect(status(page)).toHaveText('Saved', { timeout: 30_000 });
    const uploads = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.calls.filter((c: any) => c.method === 'upload').map((c: any) => ({ model: c.request.model, field: c.request.field, recordId: c.request.recordId })));
    expect(uploads).toEqual([{ model: 'listing', field: 'consent.signature', recordId: 1 }]);
    const consent = (await listing(page)).consent;
    expect(consent).toMatchObject({ owner: 'Hoda Mansour', signature: { name: 'signature.png', type: 'image/png', fileId: expect.any(Number) } });
    expect(consent.signature.data).toBeUndefined();
    expect((await state(page)).dirty).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('the listing’s save waits for the deed still on its way over a slow network, and stops under it when it fails', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-handover&skin=outlined&store=http');
    await page.route('**/api/listing-files', async (route) => {
      const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
      if (/filename="Deed, refused\.pdf"/.test(body)) return route.fulfill({ status: 500, body: 'The store is down' });
      await new Promise((done) => setTimeout(done, 1500));
      return route.continue();
    });
    const deed = part(page).locator('[data-node="c-deed"]');
    await expect(deed.locator('input[type=file]')).toBeAttached();
    await deed.locator('input[type=file]').setInputFiles({ name: 'Deed.pdf', mimeType: 'application/pdf', buffer: FILES.quote().buffer });
    // Save shows as soon as it is picked, and waits for it, saying why.
    await saveButton(page).click();
    await expect(status(page)).toHaveText('1 file still uploading. Saving when it is done.');
    await expect(status(page)).toHaveText('Saved', { timeout: 30_000 });
    expect((await listing(page)).consent).toMatchObject({ deed: { name: 'Deed.pdf', url: expect.stringMatching(/^\/api\/listing-files\//) } });
    // One that fails stops the listing's save, under the deed.
    await deed.locator('input[type=file]').setInputFiles({ name: 'Deed, refused.pdf', mimeType: 'application/pdf', buffer: FILES.quote().buffer });
    await expect(deed.locator('.fd-file-going')).toHaveAttribute('data-status', 'failed', { timeout: 30_000 });
    await node(page, 'f-bedrooms').locator('input').fill('4');
    await saveButton(page).click();
    await expect(status(page)).toHaveText('Not saved. Check: Title deed (Owner’s consent)');
    await expect(deed.locator('.fd-error')).toHaveText('Deed, refused.pdf was not uploaded: try again, or remove it');
    expect((await listing(page)).bedrooms).toBe(3);
    expect(problems.filter((problem) => !/status of 500/.test(problem))).toEqual([]);
  });
});

test.describe('an app with no store keeps its drafts as before', () => {
  const pad = (page: Page) => node(page, 'q-signature').locator('canvas');
  async function draw(page: Page) {
    await pad(page).scrollIntoViewIfNeeded();
    const box = (await pad(page).boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + box.height * 0.7);
    await page.mouse.down();
    for (const [x, y] of [[0.3, 0.3], [0.5, 0.7], [0.7, 0.35]]) await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 8 });
    await page.mouse.up();
  }
  const signature = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.signature);

  test('with no upload, a drawn signature is kept in the draft and back on Restore', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=kinds&skin=outlined&drafts=1&store=none');
    await page.evaluate(() => localStorage.clear());
    await draw(page);
    expect((await signature(page)).data.length).toBeGreaterThan(200);
    await page.waitForTimeout(800);
    await page.reload();
    await page.getByRole('button', { name: 'Restore' }).click();
    expect((await signature(page))?.data?.length ?? 0).toBeGreaterThan(200);
    expect(problems).toEqual([]);
  });

  test('with a store, the draft keeps no bytes: restored, the signature is as the record holds it', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=kinds&skin=outlined&drafts=1');
    await page.evaluate(() => localStorage.clear());
    await draw(page);
    await page.waitForTimeout(800);
    const draft = await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith('fieldia:draft:'))?.[1] ?? '');
    expect(draft).not.toContain('"data"');
    await page.reload();
    await page.getByRole('button', { name: 'Restore' }).click();
    expect(await signature(page)).toBeNull();
    expect(problems).toEqual([]);
  });
});
