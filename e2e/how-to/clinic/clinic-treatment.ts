import type { Page } from '@playwright/test';
import type { DemoReplay } from '../hand';

/**
 * The device's camera, a stand-in: a canvas over a desk's colour, what is held up to it drawn in it, its stream what the
 * page's getUserMedia gives — or the error a browser gives once a person pressed Block (`refuse`). Playwright's
 * browsers have no camera to hold a code up to; this is that camera, not the app.
 */
async function cameraHere(page: Page) {
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    let picture: HTMLImageElement | null = null;
    const draw = () => {
      context.fillStyle = '#d9d4ca';
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (!picture) return;
      const [w, h] = [picture.naturalWidth || picture.width, picture.naturalHeight || picture.height];
      context.fillStyle = '#fff';
      context.fillRect((canvas.width - w) / 2 - 16, (canvas.height - h) / 2 - 16, w + 32, h + 32);
      context.drawImage(picture, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };
    setInterval(draw, 40);
    const host = window as unknown as { holdUp(svg: string | null): Promise<void>; refuse: string | null };
    host.refuse = null;
    host.holdUp = (svg) =>
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
      if (host.refuse) throw new DOMException('The camera was refused', host.refuse);
      draw();
      return (canvas as HTMLCanvasElement & { captureStream(rate?: number): MediaStream }).captureStream(25);
    };
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  });
}
/** A code held up to the camera — the codes page's own, as a person holds that page up — or nothing held. */
const holdUp = (page: Page, svg: string | null) => page.evaluate((code) => (window as unknown as { holdUp(svg: string | null): Promise<void> }).holdUp(code), svg);
/** A code on the codes page, as it is drawn there, by the words under it. */
const codeOn = (codes: Page, words: string) => codes.locator('figure', { hasText: words }).locator('svg').evaluate((svg) => svg.outerHTML);

/** The clinic-treatment demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Open the codes to scan on your phone or another screen',
      async run({ page, press, follow, see }) {
        // The codes open in a tab of their own, as on another screen; the demo stays where it was.
        const opening = page.waitForEvent('popup');
        await follow('the codes to scan');
        const codes = await opening;
        await see(codes.getByRole('heading', { name: 'Codes to scan' })).toBeVisible();
        await see(codes.locator('figure', { hasText: 'Hana Fouad' }).locator('svg')).toBeVisible();
        await see(codes.locator('figure', { hasText: 'Hyaluronic acid filler 1 ml' }).locator('svg')).toBeVisible();
        await see(codes.locator('figure', { hasText: 'Hand cream 50 ml' }).locator('svg')).toBeVisible();
        await codes.close();
        // The steps' panel, opened from its ? where the line under the name has no room (a phone), closed again.
        const panel = page.getByRole('complementary', { name: 'About this demo' });
        if (await panel.isVisible()) await press(panel.getByRole('button', { name: 'Close the panel' }));
        await see(page.getByRole('button', { name: 'Scan a code into Patient' })).toBeInViewport();
      },
    },
    {
      says: 'Press Add a line under Injectables used, then the scan button',
      async run({ page, press, see }) {
        await cameraHere(page);
        const codes = await page.context().newPage();
        await codes.goto('/samples/codes-to-scan.html');
        const filler = await codeOn(codes, 'Hyaluronic acid filler 1 ml');
        await codes.close();
        const lines = page.getByRole('group', { name: 'Injectables used' }).last();
        await press(lines.getByRole('button', { name: '+ Add a line' }));
        await see(lines.locator('tbody tr')).toHaveCount(2);
        await press(lines.getByRole('button', { name: 'Scan a code into Lot' }).last());
        const sheet = page.getByRole('dialog', { name: 'Scan Lot' });
        await see(sheet.getByRole('status')).toHaveText('Hold the code inside the frame.');
        await holdUp(page, filler);
        await see(sheet).toBeHidden();
        const line = lines.locator('tbody tr').last();
        await see(line.getByRole('combobox', { name: 'Product' })).toHaveValue('Hyaluronic acid filler 1 ml');
        await see(line.getByRole('textbox', { name: 'Lot' })).toHaveValue('HF-2207');
        await see(line.getByRole('textbox', { name: 'Expiry' })).toHaveValue('30 Jun 2027');
        await holdUp(page, null);
      },
    },
    {
      says: 'Press Scan beside Patient and show Hana Fouad’s card',
      async run({ page, press, see }) {
        const codes = await page.context().newPage();
        await codes.goto('/samples/codes-to-scan.html');
        const card = await codeOn(codes, 'Hana Fouad');
        await codes.close();
        const scan = page.getByRole('button', { name: 'Scan a code into Patient' });
        await press(scan);
        const sheet = page.getByRole('dialog', { name: 'Scan Patient' });
        await see(sheet.getByRole('status')).toHaveText('Hold the code inside the frame.');
        await holdUp(page, card);
        await see(sheet).toBeHidden();
        await see(page.getByRole('combobox', { name: '*Patient' })).toHaveValue('Hana Fouad');
        await holdUp(page, null);
      },
    },
    {
      says: 'Hold up a shelf’s barcode instead',
      async run({ page, phone, press, keys, see }) {
        const codes = await page.context().newPage();
        await codes.goto('/samples/codes-to-scan.html');
        const shelf = await codeOn(codes, 'Hand cream 50 ml');
        await codes.close();
        const lines = page.getByRole('group', { name: 'Injectables used' }).last();
        await press(lines.getByRole('button', { name: '+ Add a line' }));
        const line = lines.locator('tbody tr').last();
        await press(line.getByRole('button', { name: 'Scan a code into Lot' }));
        const sheet = page.getByRole('dialog', { name: 'Scan Lot' });
        await see(sheet.getByRole('status')).toHaveText('Hold the code inside the frame.');
        await holdUp(page, shelf);
        await see(sheet.getByRole('status')).toHaveText('This code has no Lot in it. Scan the code on the pack.');
        await see(sheet).toBeVisible();
        const scan = line.getByRole('button', { name: 'Scan a code into Lot' });
        if (!phone) {
          // Escape (a phone has none): the sheet closed, back on Scan, the camera off.
          await keys('Escape');
          await see(sheet).toBeHidden();
          await see(scan).toBeFocused();
          await press(scan);
          await see(sheet.getByRole('status')).toHaveText('Hold the code inside the frame.');
        }
        // Type it instead: the cursor in the lot's box, to type it.
        await press(sheet.getByRole('button', { name: 'Type it instead' }));
        await see(sheet).toBeHidden();
        const lot = line.getByRole('textbox', { name: 'Lot' });
        await see(lot).toBeFocused();
        await page.keyboard.type('LD5530', { delay: 15 });
        await see(lot).toHaveValue('LD5530');
        await holdUp(page, null);
      },
    },
    {
      says: 'Press Block when the browser asks for the camera',
      async run({ page, press, keys, see }) {
        // Block pressed: the browser refuses the camera from now on.
        await page.evaluate(() => ((window as unknown as { refuse: string }).refuse = 'NotAllowedError'));
        const patient = page.locator('[data-node="f-patient"]');
        await press(patient.getByRole('button', { name: 'Scan a code into Patient' }));
        await see(patient.locator('.fd-scan-note')).toHaveText('The camera is not allowed here. Allow it in the browser’s settings and press Scan again, or type the code.');
        await see(page.getByRole('dialog')).toHaveCount(0);
        const box = page.getByRole('combobox', { name: '*Patient' });
        await see(box).toBeFocused();
        // A barcode scanner plugged in: its keys, then its Enter — Hana's card.
        await page.keyboard.type('P-1043', { delay: 5 });
        await keys('Enter');
        // Hana is the patient already (step 3): the box's text chosen, what the scanner types finds her again.
        await see(box).toHaveValue('Hana Fouad');
        await see(patient.getByText(/nothing is called/)).toHaveCount(0);
        // A box's code typed by the scanner into a line's Lot: the line filled as the camera fills it.
        const lines = page.getByRole('group', { name: 'Injectables used' }).last();
        await press(lines.getByRole('button', { name: '+ Add a line' }));
        const line = lines.locator('tbody tr').last();
        await press(line.getByRole('textbox', { name: 'Lot' }));
        await page.keyboard.type('010622102500123817271100' + '10LD5521', { delay: 5 });
        await keys('Enter');
        await see(line.getByRole('combobox', { name: 'Product' })).toHaveValue('Lidocaine 2% 5 ml');
        await see(line.getByRole('textbox', { name: 'Lot' })).toHaveValue('LD5521');
        await see(line.getByRole('textbox', { name: 'Expiry' })).toHaveValue(/Nov 2027/);
      },
    },
  ],
};
