import type { Locator } from '@playwright/test';
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from '@zxing/library';
import { PNG } from 'playwright-core/lib/utilsBundle';
import { expect } from '../../fixtures';
import { pressPrint } from '../../print-support';
import type { DemoReplay, Hand } from '../hand';
import { node } from './support';

/** Text put on the clipboard, then pasted with Ctrl+V where the focus is (e2e/long-paste.spec.ts's way). */
async function paste({ page, phone }: Hand, text: string) {
  if (!phone) await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate((words) => navigator.clipboard.writeText(words), text);
  await page.keyboard.press('Control+V');
}

/** A QR code read as a phone's camera reads it: its picture on the screen, decoded. */
async function readQr(code: Locator): Promise<string> {
  const png = PNG.sync.read(await code.screenshot());
  const light = new Uint8ClampedArray(png.width * png.height);
  for (let i = 0; i < light.length; i++) light[i] = (png.data[i * 4] * 299 + png.data[i * 4 + 1] * 587 + png.data[i * 4 + 2] * 114) / 1000;
  return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(light, png.width, png.height)))).getText();
}

/** The event-ticket demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Point a phone’s camera at the QR code: the ticket’s link opens.',
      async run({ page, see }) {
        const link = node(page, 'f-link');
        const code = link.getByRole('img', { name: /^QR code:/ });
        await see(code).toBeVisible();
        // What the camera reads is the link the ticket shows.
        const read = await readQr(link.locator('.fd-code-figure'));
        await see(link.getByRole('textbox', { name: 'Ticket on your phone' })).toHaveValue(read);
        expect(read).toBe('https://tickets.example/t/TKT-2026-0042');
      },
    },
    {
      says: 'Change the link under Ticket on your phone: the QR code follows it as you type.',
      async run({ page, type, see }) {
        const link = node(page, 'f-link');
        const box = link.getByRole('textbox', { name: 'Ticket on your phone' });
        await type(box, 'https://tickets.example/t/TKT-2026-0043', { clear: true });
        // Still typing in the box: the code already says what is in it.
        await see(box).toBeFocused();
        await see(link.getByRole('img', { name: /^QR code:/ })).toHaveAccessibleName('QR code: https://tickets.example/t/TKT-2026-0043');
        expect(await readQr(link.locator('.fd-code-figure'))).toBe('https://tickets.example/t/TKT-2026-0043');
      },
    },
    {
      says: 'Paste two thousand characters into Ticket on your phone',
      async run(hand) {
        const { page, press, type, see } = hand;
        const link = node(page, 'f-link');
        const box = link.getByRole('textbox', { name: 'Ticket on your phone' });
        await type(box, '', { clear: true });
        await paste(hand, 'x'.repeat(2000));
        await see(box).toHaveValue('x'.repeat(2000));
        await press(page.getByRole('textbox', { name: 'Name' }));
        await see(link.getByRole('status')).toHaveText('Too long for a QR code: shorten it, or show a link to it instead.');
        await see(link.getByRole('img')).toHaveCount(0);
      },
    },
    {
      says: 'Print the ticket: the codes print black on white, as sharp as on the screen.',
      async run({ page, phone, see }) {
        // Ctrl+P on a desktop; a phone prints from its share sheet, the browser's own: the page on paper either way.
        if (!phone) await pressPrint(page);
        await page.emulateMedia({ media: 'print' });
        for (const id of ['f-reference', 'f-card', 'f-badge']) {
          const figure = node(page, id).locator('.fd-code-figure');
          await see(figure).toBeVisible();
          await see(figure).toHaveCSS('background-color', 'rgb(255, 255, 255)');
          await see(figure.locator('path').first()).toHaveCSS('fill', 'rgb(0, 0, 0)');
          // Drawn as shapes (SVG), never a picture of dots: as sharp on paper as on the screen.
          await see(figure.locator('svg[role="img"]')).toHaveCount(1);
        }
      },
    },
  ],
};
