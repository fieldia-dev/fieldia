import { expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import type { DemoReplay } from '../hand';

/**
 * The page's camera, a stand-in as e2e/scan.spec.ts's is: a canvas over a desk's colour, the code held up in it
 * (`hold`), its stream what the page's getUserMedia gives; `frames` counts what it has shown. Put in place before Scan
 * is pressed, as a phone's camera is there before anyone presses it.
 */
async function camera(page: Page) {
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    let picture: HTMLImageElement | null = null;
    let frames = 0;
    const draw = () => {
      frames++;
      context.fillStyle = '#d9d4ca';
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (!picture) return;
      // A code held up close: as wide as the camera's middle.
      const k = Math.min(3, 520 / (picture.naturalWidth || picture.width));
      const [w, h] = [(picture.naturalWidth || picture.width) * k, (picture.naturalHeight || picture.height) * k];
      context.fillStyle = '#fff';
      context.fillRect((canvas.width - w) / 2 - 16, (canvas.height - h) / 2 - 16, w + 32, h + 32);
      context.drawImage(picture, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };
    setInterval(draw, 40);
    const host = window as unknown as { hold(svg: string | null): Promise<void>; frames(): number };
    host.frames = () => frames;
    host.hold = (svg) =>
      new Promise((done) => {
        if (!svg) {
          picture = null;
          draw();
          return done();
        }
        const image = new Image();
        image.onload = () => {
          picture = image;
          draw();
          done();
        };
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      });
    const getUserMedia = async () => {
      draw();
      return (canvas as HTMLCanvasElement & { captureStream(rate?: number): MediaStream }).captureStream(25);
    };
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  });
}

/** A code held up to the page's camera (the code as it is drawn on the other screen), or taken away (null). */
const hold = (page: Page, svg: string | null) => page.evaluate((code) => (window as unknown as { hold(svg: string | null): Promise<void> }).hold(code), svg);

/** How many frames the page's camera has shown. */
const frames = (page: Page) => page.evaluate(() => (window as unknown as { frames(): number }).frames());

/** The codes to scan, open on another screen (a second page): each code as it is drawn there, by the words under it. */
async function codeOn(codes: Page, words: string): Promise<string> {
  return codes.locator('figure').filter({ hasText: words }).locator('svg').first().evaluate((svg) => svg.outerHTML);
}

/** The stock-count demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Open the codes to scan on your phone or another screen, or print it',
      async run({ page, follow, see }) {
        // The link opens the codes in a tab of their own: the other screen.
        const opened = page.context().waitForEvent('page');
        await follow('the codes to scan');
        const codes = await opened;
        await see(codes.getByRole('heading', { name: 'Codes to scan' })).toBeVisible();
        for (const product of ['Hand cream 50 ml', 'Lip balm', 'Face wash 150 ml', 'A product the shop does not sell']) {
          await see(codes.getByRole('figure', { name: new RegExp(`^${product}`) })).toBeVisible();
        }
        // The demo's own page is still where it was.
        await see(page.getByRole('button', { name: 'Count Products by scanning' })).toBeVisible();
      },
    },
    {
      says: 'Press Scan under the table and hold up the hand cream’s barcode',
      async run({ page, press, see }) {
        const codes = page.context().pages().find((other) => other.url().includes('codes-to-scan'))!;
        await camera(page);
        await press(page.getByRole('button', { name: 'Count Products by scanning' }));
        const sheet = page.getByRole('dialog', { name: 'Count Products by scanning' });
        const said = sheet.getByRole('status');
        await see(said).toHaveText('Scan each item: every code read counts one.');
        await hold(page, await codeOn(codes, 'Hand cream 50 ml'));
        await see(said).toHaveText('Hand cream 50 ml: 1 counted');
        const lines = page.locator('[data-node="f-lines"] tbody tr[data-line]');
        await see(lines).toHaveCount(2);
        await see(lines.nth(1).getByRole('combobox', { name: 'Product' })).toHaveValue('Hand cream 50 ml');
        await see(lines.nth(1).getByRole('textbox', { name: 'Counted' })).toHaveValue('1');
      },
    },
    {
      says: 'Move the code away from the camera and back: 2. Held still',
      async run({ page, see }) {
        const codes = page.context().pages().find((other) => other.url().includes('codes-to-scan'))!;
        const said = page.getByRole('dialog', { name: 'Count Products by scanning' }).getByRole('status');
        const cream = page.locator('[data-node="f-lines"] tbody tr[data-line]').nth(1).getByRole('textbox', { name: 'Counted' });
        // Away from the camera for as long as a hand takes, thirty frames (over a second), then back.
        await hold(page, null);
        const away = await frames(page);
        await expect.poll(() => frames(page), { timeout: 10_000 }).toBeGreaterThan(away + 30);
        await see(said).toHaveText('Hand cream 50 ml: 1 counted');
        await hold(page, await codeOn(codes, 'Hand cream 50 ml'));
        await see(said).toHaveText('Hand cream 50 ml: 2 counted');
        // Held still while the camera shows forty more frames (over a second and a half): still 2.
        const seen = await frames(page);
        await expect.poll(() => frames(page), { timeout: 10_000 }).toBeGreaterThan(seen + 40);
        await see(said).toHaveText('Hand cream 50 ml: 2 counted');
        await see(cream).toHaveValue('2');
      },
    },
    {
      says: 'Hold up the lip balm’s: its line goes from 3 to 4. Then the product',
      async run({ page, press, type, see }) {
        const codes = page.context().pages().find((other) => other.url().includes('codes-to-scan'))!;
        const sheet = page.getByRole('dialog', { name: 'Count Products by scanning' });
        const said = sheet.getByRole('status');
        const lines = page.locator('[data-node="f-lines"] tbody tr[data-line]');
        await see(lines.nth(0).getByRole('textbox', { name: 'Counted' })).toHaveValue('3');
        await hold(page, await codeOn(codes, 'Lip balm'));
        await see(said).toHaveText('Lip balm: 4 counted');
        await see(lines.nth(0).getByRole('textbox', { name: 'Counted' })).toHaveValue('4');
        await hold(page, await codeOn(codes, 'A product the shop does not sell'));
        await see(said).toHaveText('Nothing has the code 4006381333931. Scan another, or type it.');
        await see(sheet).toBeVisible();
        await hold(page, null);
        // A label that will not scan: its code typed in the sheet, and Count.
        const typed = sheet.getByRole('textbox', { name: 'Or type the code' });
        await type(typed, '6224000123482');
        await press(sheet.getByRole('button', { name: 'Count', exact: true }));
        await see(said).toHaveText('Face wash 150 ml: 1 counted');
        await see(typed).toHaveValue('');
        await see(lines).toHaveCount(3);
      },
    },
    {
      says: 'Press Done: the total under the table counts every item',
      async run({ page, press, see }) {
        const sheet = page.getByRole('dialog', { name: 'Count Products by scanning' });
        await press(sheet.getByRole('button', { name: 'Done' }));
        await see(sheet).toBeHidden();
        await see(page.locator('[data-node="f-lines"]').getByRole('row', { name: /^Total/ })).toHaveText(/Total\s*7/);
      },
    },
  ],
};
