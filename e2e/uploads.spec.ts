import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * Photos stored as they are picked, as a person on a phone meets them: ten
 * 12-megapixel photos made smaller before they go, three at a time over a
 * slow connection, each with its bar; one failing and mended with Retry;
 * Save waiting for the rest and saying so, and refusing while one did not get
 * there; the record holding links alone. Then the same over the browser's
 * own network, slowed as a phone's is (Chromium's throttling), to a real
 * endpoint through uploadTo — one request failed by the test, and one file
 * the store refuses. And a phone's photo turned by its EXIF stands as taken.
 */

const photos = (page: Page) => node(page, 'f-photos');
const going = (page: Page) => photos(page).locator('.fd-file-going');
const status = (page: Page) => page.locator('.fd-status');
type Stored = { name: string; size: number; type: string; url: string; fileId?: number; data?: string };
const stored = (page: Page) => page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values.photos ?? []) as Stored[]);
/** What the page shows of a stored picture: its pixels' size, once it has loaded. */
const pictureSize = (page: Page, url: string) =>
  page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  }, url);

/** Watch the files on their way for a while: the most going at once, and the bar's shares seen. */
async function watch(page: Page, times = 12) {
  let most = 0;
  const shares = new Set<number>();
  for (let i = 0; i < times; i++) {
    most = Math.max(most, await photos(page).locator('.fd-file-going[data-status="uploading"]').count());
    for (const value of await photos(page).locator('progress[value]').evaluateAll((bars) => bars.map((bar) => (bar as HTMLProgressElement).value))) shares.add(value);
    await page.waitForTimeout(150);
  }
  return { most, moving: [...shares].some((share) => share > 0 && share < 100) };
}

test.describe('photos stored as they are picked', () => {
  test.describe.configure({ timeout: 180_000 });

  test('ten phone photos: made smaller, three at a time with their bars, one mended with Retry, Save waiting and saying why', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-photos&skin=outlined');
    await page.getByRole('button', { name: 'Add 10 phone photos' }).click();
    await expect(going(page).first()).toBeVisible({ timeout: 60_000 });
    // Three at a time over the slow store, each bar moving with its share.
    const { most, moving } = await watch(page);
    expect(most).toBeLessThanOrEqual(3);
    expect(most).toBeGreaterThanOrEqual(2);
    expect(moving).toBe(true);
    const first = going(page).first();
    await expect(first.locator('progress')).toHaveAttribute('aria-label', /^Uploading .+\.jpg$/);
    await screen(page, 'uploads-listing-going');

    // Save while photos are going: it waits, and says how many and why — Save itself out of the way meanwhile.
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(status(page)).toHaveText(/^\d+ files? still uploading\. Saving when (it is|they are) done\.$/);

    // The balcony's photo fails at the store: it says so, and offers Retry; the save stops under the field.
    const balcony = going(page).filter({ hasText: 'Balcony view.jpg' });
    await expect(balcony).toHaveAttribute('data-status', 'failed', { timeout: 60_000 });
    await expect(balcony.locator('.fd-file-state')).toHaveText('Not uploaded');
    await expect(status(page)).toHaveText('Not saved. Check: Photos', { timeout: 60_000 });
    await expect(photos(page).locator('.fd-error')).toHaveText('Balcony view.jpg was not uploaded: try again, or remove it');
    await screen(page, 'uploads-listing-failed');
    await balcony.getByRole('button', { name: 'Retry Balcony view.jpg' }).click();
    await expect(going(page)).toHaveCount(0, { timeout: 60_000 });
    await expect(photos(page).locator('.fd-file-news')).toHaveText(/^1 file uploaded$|files uploaded$/);

    // Ten links, in the order picked, each a photo made smaller: no bytes in the record.
    const kept = await stored(page);
    expect(kept.map((photo) => photo.name)).toEqual(['Living room.jpg', 'Kitchen.jpg', 'Master bedroom.jpg', 'Balcony view.jpg', 'Second bedroom.jpg', 'Bathroom.jpg', 'Entrance hall.jpg', 'Dining room.jpg', 'Study.jpg', 'Roof terrace.jpg']);
    for (const photo of kept) {
      expect(photo).toMatchObject({ type: 'image/jpeg', fileId: expect.any(Number) });
      expect(photo.data).toBeUndefined();
      expect(photo.size).toBeLessThan(600 * 1024);
    }
    expect(await pictureSize(page, kept[0].url)).toEqual([1600, 1200]);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(status(page)).toHaveText('Saved');
    const saved = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records.listing[1].photos as Stored[]);
    expect(saved).toHaveLength(10);
    expect(JSON.stringify(saved)).not.toContain('"data"');
    await screen(page, 'uploads-listing-done');
    expect(problems).toEqual([]);
  });

  test('right to left in Arabic, dark, on a phone: the bars fill from the right, the words are Arabic, nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { problems } = await open(page, 'plain', 'page=listing-photos&skin=outlined&locale=ar&dir=rtl&scheme=dark');
    await page.getByRole('button', { name: 'Add 10 phone photos' }).click();
    await expect(going(page).first()).toBeVisible({ timeout: 60_000 });
    await expect(going(page).locator('.fd-file-state').filter({ hasText: 'في الانتظار…' }).first()).toBeVisible();
    await expect(going(page).first().locator('progress')).toHaveAttribute('aria-label', /^رفع /);
    expect(await going(page).first().locator('progress').evaluate((bar) => getComputedStyle(bar).direction)).toBe('rtl');
    await expectNoSidewaysScroll(page);
    await screen(page, 'uploads-listing-rtl-dark-phone');
    expect(await axeFindings(page, 'photos on their way, right to left and dark')).toEqual([]);
    await page.getByRole('button', { name: 'حفظ' }).click();
    await expect(status(page)).toHaveText(/^ما زالت الملفات تُرفع: \d+\. سيُحفظ عند انتهائها\.$|^ملف واحد ما زال يُرفع\. سيُحفظ عند انتهائه\.$/);
    expect(problems).toEqual([]);
  });

  test('a phone’s photo turned by its EXIF stands as it was taken once smaller, and a small one is kept as it is', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-photos&skin=outlined');
    const sizes = await page.evaluate(async () => {
      /** A JPEG of 3000 × 2000 pixels, red along its top and green down its left: a phone held upright writes it so, with EXIF orientation 6. */
      const photo = async (width: number, height: number) => {
        const canvas = document.createElement('canvas');
        Object.assign(canvas, { width, height });
        const c = canvas.getContext('2d') as CanvasRenderingContext2D;
        c.fillStyle = '#2a6fdb';
        c.fillRect(0, 0, width, height);
        c.fillStyle = '#e02020';
        c.fillRect(0, 0, width, height / 5);
        c.fillStyle = '#20b040';
        c.fillRect(0, height / 5, width / 6, height);
        return new Uint8Array(await (await new Promise<Blob>((done) => canvas.toBlob((b) => done(b as Blob), 'image/jpeg', 0.9))).arrayBuffer());
      };
      // An APP1 segment with the one EXIF tag that matters here: Orientation (0x0112) = 6, turn a quarter clockwise.
      const exif = [0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
      const turned = await photo(3000, 2000);
      const withExif = new Uint8Array([...turned.subarray(0, 2), ...exif, ...turned.subarray(2)]);
      const small = await photo(800, 600);
      const picked = new DataTransfer();
      picked.items.add(new File([withExif], 'Upright.jpg', { type: 'image/jpeg' }));
      picked.items.add(new File([small], 'Small.jpg', { type: 'image/jpeg' }));
      const input = document.querySelector('[data-node="f-photos"] input[type=file]') as HTMLInputElement;
      input.files = picked.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { small: small.length };
    });
    await expect.poll(async () => (await stored(page)).length, { timeout: 60_000 }).toBe(2);
    const [upright, small] = await stored(page);
    // Standing, as taken: 1600 high; the red that was along the stored pixels' top now down its right side, the green that was down their left along the top.
    expect(await pictureSize(page, upright.url)).toEqual([1067, 1600]);
    const red = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement('canvas');
      Object.assign(canvas, { width: image.naturalWidth, height: image.naturalHeight });
      const c = canvas.getContext('2d') as CanvasRenderingContext2D;
      c.drawImage(image, 0, 0);
      const at = (x: number, y: number) => [...c.getImageData(x, y, 1, 1).data.slice(0, 3)];
      return { right: at(image.naturalWidth - 20, 800), left: at(20, 800), top: at(500, 20) };
    }, upright.url);
    expect(red.right[0]).toBeGreaterThan(180);
    expect(red.left[2]).toBeGreaterThan(150);
    expect(red.top[1]).toBeGreaterThan(130);
    expect(red.top[0]).toBeLessThan(100);
    // Small already: kept byte for byte.
    expect(small.size).toBe(sizes.small);
    expect(await pictureSize(page, small.url)).toEqual([800, 600]);
    expect(problems).toEqual([]);
  });

  test('to a real endpoint through uploadTo, over a network slowed as a phone’s: bars from the browser’s own progress, a request that fails mended with Retry, a file the store refuses', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-photos&skin=outlined&store=http');
    // A phone on mobile data: 200 KB a second up, with a fifth of a second's wait.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 200, downloadThroughput: 1024 * 1024, uploadThroughput: 200 * 1024 });
    // The balcony's first try is cut off on the way; a PDF is refused, as a store that keeps pictures only refuses it.
    const tries = new Map<string, number>();
    await page.route('**/api/listing-files', async (route) => {
      const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
      const name = /filename="([^"]+)"/.exec(body)?.[1] ?? '';
      tries.set(name, (tries.get(name) ?? 0) + 1);
      if (name.startsWith('Balcony') && tries.get(name) === 1) return route.abort('connectionreset');
      if (name.endsWith('.pdf')) return route.fulfill({ status: 413, contentType: 'application/json', body: JSON.stringify({ message: 'This store keeps pictures only' }) });
      return route.continue();
    });
    await page.getByRole('button', { name: 'Add 10 phone photos' }).click();
    await expect(going(page).first()).toBeVisible({ timeout: 60_000 });
    const { most, moving } = await watch(page, 16);
    expect(most).toBeLessThanOrEqual(3);
    expect(moving).toBe(true);
    const balcony = going(page).filter({ hasText: 'Balcony view.jpg' });
    await expect(balcony).toHaveAttribute('data-status', 'failed', { timeout: 90_000 });
    await balcony.getByRole('button', { name: 'Retry Balcony view.jpg' }).click();
    await expect(going(page)).toHaveCount(0, { timeout: 90_000 });
    const kept = await stored(page);
    expect(kept).toHaveLength(10);
    for (const photo of kept) expect(photo.url).toMatch(/^\/api\/listing-files\/\d+\/.+\.jpg$/);
    expect(tries.get('Balcony view.jpg')).toBe(2);
    // The stored photos come back from the store, each its own picture.
    await expect(photos(page).locator('.fd-file-item img.fd-file-thumb').first()).toHaveJSProperty('complete', true);
    expect(await pictureSize(page, kept[3].url)).toEqual([1600, 1200]);

    // The floor plan, refused by the store: its words, and no Retry.
    await node(page, 'f-plan').locator('input[type=file]').setInputFiles({ name: 'Plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') });
    const plan = node(page, 'f-plan').locator('.fd-file-going');
    await expect(plan).toHaveAttribute('data-status', 'refused', { timeout: 30_000 });
    await expect(plan.locator('.fd-file-state')).toHaveText('This store keeps pictures only');
    await expect(plan.getByRole('button', { name: /^Retry/ })).toBeHidden();
    await screen(page, 'uploads-http-refused');
    await plan.getByRole('button', { name: 'Remove Plan.pdf' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(status(page)).toHaveText('Saved', { timeout: 30_000 });
    expect(problems.filter((problem) => !/net::ERR_CONNECTION_RESET|status of 413/.test(problem))).toEqual([]);
  });
});
