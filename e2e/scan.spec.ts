import type { Page } from '@playwright/test';
import { codeSvg } from '../libs/widgets/src/lib/test-codes';
import { INJECTABLES, PATIENTS, SHELF } from '../demos/shared/scan';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * A code scanned with the camera (`options.scan`), as a person scans one: the Scan button, the camera's sheet, a code
 * held up to the camera and read — by the browser's own reader where it has one, else by the decode part, loaded as
 * Scan is pressed — and what it fills. The camera is a stand-in: a canvas the test holds a code up in, its stream the
 * page's camera (each engine's own captureStream), read frame by frame as a camera's is. A clinic's treatment: the
 * patient by her card's QR code, an injectable's product, lot and expiry from its box's GS1 DataMatrix; a shelf counted
 * by its barcodes; the camera refused, the field saying so and the box typed in.
 */

const GS = '\u001d';
const state = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values);
const box = (id: number) => INJECTABLES[id] as { gtin: string; box: { lot: string; expiry: string; serial: string } };
/** An injectable's box, as its maker prints its GS1 DataMatrix. */
const boxCode = (id: number) => codeSvg('data_matrix', `01${box(id).gtin}17${box(id).box.expiry}10${box(id).box.lot}${GS}21${box(id).box.serial}`, { gs1: true, size: 220 });

/**
 * The page's camera: a canvas over a desk's colour, with the code held up in it (`hold`), its stream what the page's
 * getUserMedia gives — or the error a browser gives when the camera is refused. What was asked of it is kept.
 */
async function camera(page: Page, refuse: string | null = null) {
  await page.addInitScript((refused) => {
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
    // A camera's frames keep coming, whether or not what it sees changes.
    setInterval(draw, 40);
    const host = window as unknown as { hold(svg: string | null): Promise<void>; asked: unknown[]; streams: MediaStream[] };
    host.asked = [];
    host.streams = [];
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
    const getUserMedia = async (constraints: MediaStreamConstraints) => {
      host.asked.push(constraints);
      if (refused) throw new DOMException('The camera was refused', refused);
      draw();
      const stream = (canvas as HTMLCanvasElement & { captureStream(rate?: number): MediaStream }).captureStream(25);
      host.streams.push(stream);
      return stream;
    };
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  }, refuse);
}
const hold = (page: Page, svg: string | null) => page.evaluate((code) => (window as unknown as { hold(svg: string | null): Promise<void> }).hold(code), svg);
/** Whether every stream the page was given has stopped: the camera off. */
const cameraOff = (page: Page) => page.evaluate(() => (window as unknown as { streams: MediaStream[] }).streams.every((stream) => stream.getTracks().every((track) => track.readyState === 'ended')));

test.describe('a code scanned with the camera', () => {
  test("a patient found by her card, an injectable's product, lot and expiry from its box", async ({ page }) => {
    await camera(page);
    const { problems } = await open(page, 'plain', 'page=clinic-treatment&record=1&skin=outlined');
    const patient = node(page, 'f-patient');
    const scan = patient.getByRole('button', { name: 'Scan a code into Patient' });
    await expect(scan).toHaveText('Scan');
    await scan.click();
    const sheet = page.getByRole('dialog', { name: 'Scan Patient' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('status')).toHaveText('Hold the code inside the frame.');
    expect(await page.evaluate(() => (window as unknown as { asked: unknown[] }).asked)).toEqual([{ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }]);
    await screen(page, 'scan-sheet', { viewport: true });
    await hold(page, codeSvg('qr_code', String(PATIENTS[2]['card']), { size: 220 }));
    await expect(sheet).toBeHidden();
    await expect(patient.locator('input')).toHaveValue('Hana Fouad');
    await expect.poll(() => cameraOff(page)).toBe(true);
    await expect(scan).toBeFocused();
    await hold(page, null);

    // A line's lot, from its box: the one code fills the product, the lot and the expiry.
    const lines = node(page, 'f-lines');
    await lines.getByRole('button', { name: /Add a line/ }).click();
    const lot = lines.getByRole('button', { name: 'Scan a code into Lot' }).last();
    await lot.click();
    const lotSheet = page.getByRole('dialog', { name: 'Scan Lot' });
    await expect(lotSheet.getByRole('status')).toHaveText('Hold the code inside the frame.');
    // A shelf's barcode, of a kind the lot never reads: said, as a box's code with no lot in it is — the camera reads on.
    // (The owner's walk of 0.29: the sheet said only "Hold the code inside the frame.")
    await hold(page, codeSvg('ean_13', String(SHELF[1]['barcode']), { size: 420 }));
    await expect(lotSheet.getByRole('status')).toHaveText('This code has no Lot in it. Scan the code on the pack.');
    await screen(page, 'scan-shelf-code-as-lot', { viewport: true });
    await hold(page, null);
    await expect(lotSheet).toBeVisible();
    await hold(page, codeSvg('data_matrix', `01${box(3).gtin}17${box(3).box.expiry}`, { gs1: true, size: 220 }));
    await expect(lotSheet.getByRole('status')).toHaveText('This code has no Lot in it. Scan the code on the pack.');
    await hold(page, boxCode(2));
    await expect(lotSheet).toBeHidden();
    await expect.poll(async () => ((await state(page)).line_ids as { values: Record<string, unknown> }[]).at(-1)?.values).toMatchObject({
      product_id: { id: 2, label: 'Hyaluronic acid filler 1 ml' },
      lot: 'HF-2207',
      expiry: '2027-06-30',
    });
    await hold(page, null);
    await screen(page, 'scan-treatment-lines');
    expect(problems).toEqual([]);
  });

  test('a shelf counted by its barcodes, each read one more, the sheet reading on until Done', async ({ page }) => {
    await camera(page);
    const { problems } = await open(page, 'plain', 'page=stock-count&record=1&skin=outlined');
    const lines = node(page, 'f-lines');
    await lines.getByRole('button', { name: 'Count Products by scanning' }).click();
    const sheet = page.getByRole('dialog', { name: 'Count Products by scanning' });
    const said = sheet.getByRole('status');
    await expect(said).toHaveText('Scan each item: every code read counts one.');
    const counts = async () => Object.fromEntries(((await state(page)).line_ids as { values: { product_id: { label: string }; counted: number } }[]).map((line) => [line.values.product_id.label, line.values.counted]));
    const cream = codeSvg('ean_13', String(SHELF[1]['barcode']), { size: 420 });
    await hold(page, cream);
    await expect(said).toHaveText('Hand cream 50 ml: 1 counted');
    // Held still, one item: counted once. Out of sight a moment and back: the next.
    await page.waitForTimeout(1200);
    expect((await counts())['Hand cream 50 ml']).toBe(1);
    await hold(page, null);
    await page.waitForTimeout(1000);
    expect((await counts())['Hand cream 50 ml']).toBe(1);
    await hold(page, cream);
    await expect(said).toHaveText('Hand cream 50 ml: 2 counted');
    await hold(page, codeSvg('ean_13', String(SHELF[2]['barcode']), { size: 420 }));
    await expect(said).toHaveText('Lip balm: 4 counted');
    await hold(page, codeSvg('ean_13', '4006381333931', { size: 420 }));
    await expect(said).toHaveText('Nothing has the code 4006381333931. Scan another, or type it.');
    await screen(page, 'scan-counting', { viewport: true });
    await hold(page, null);
    // Typed, as its words say: a code whose label will not scan, read as the camera reads it.
    // (The owner's walk of 0.29: the sheet had nowhere to type one.)
    const typed = sheet.getByRole('textbox', { name: 'Or type the code' });
    await typed.fill(String(SHELF[4]['barcode']));
    await typed.press('Enter');
    await expect(said).toHaveText('Face wash 150 ml: 1 counted');
    await expect(typed).toHaveValue('');
    await expect(typed).toBeFocused();
    await typed.fill('4006381333931');
    await sheet.getByRole('button', { name: 'Count', exact: true }).click();
    await expect(said).toHaveText('Nothing has the code 4006381333931. Scan another, or type it.');
    await expect(typed).toHaveValue('4006381333931');
    await screen(page, 'scan-counting-typed', { viewport: true });
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => cameraOff(page)).toBe(true);
    expect(await counts()).toEqual({ 'Lip balm': 4, 'Hand cream 50 ml': 2, 'Face wash 150 ml': 1 });
    await expect(lines.locator('tfoot, .fd-lines-totals').first()).toContainText('7');
    expect(problems).toEqual([]);
  });

  test('the camera refused: said beside the button, the box focused to type, a scanner gun typing as ever', async ({ page }) => {
    await camera(page, 'NotAllowedError');
    const { problems } = await open(page, 'plain', 'page=clinic-treatment&record=new&skin=outlined');
    const patient = node(page, 'f-patient');
    await patient.getByRole('button', { name: 'Scan a code into Patient' }).click();
    const note = patient.locator('.fd-scan-note');
    await expect(note).toHaveText('The camera is not allowed here. Allow it in the browser’s settings and press Scan again, or type the code.');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(patient.locator('input')).toBeFocused();
    await screen(page, 'scan-refused');
    // A scanner gun: its keys, and its Enter.
    await page.keyboard.type('Salma');
    await page.keyboard.press('Enter');
    await expect(patient.locator('input')).toHaveValue('Salma Nabil');
    expect(problems).toEqual([]);
  });

  test('a scanner gun types a code: Enter, or leaving the box, reads it as the camera does — her card, a box’s code', async ({ page }) => {
    // The owner's walk of 0.29: "P-1043" and Enter said "nothing is called P-1043", and the box's code typed into Lot
    // stayed as typed, no product, no expiry.
    const { problems } = await open(page, 'plain', 'page=clinic-treatment&record=1&skin=outlined');
    const patient = node(page, 'f-patient');
    await patient.locator('input').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(String(PATIENTS[2]['card']));
    await page.keyboard.press('Enter');
    await expect(patient.locator('input')).toHaveValue('Hana Fouad');
    await expect(patient).not.toContainText('nothing is called');
    expect((await state(page)).patient_id).toEqual({ id: 2, label: 'Hana Fouad' });
    // A name typed still finds her by name.
    await patient.locator('input').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('Salma');
    await page.keyboard.press('Enter');
    await expect(patient.locator('input')).toHaveValue('Salma Nabil');
    // A line's lot: the box's whole code typed, then the box left — its product, lot and expiry, as the camera fills them.
    const lines = node(page, 'f-lines');
    await lines.getByRole('button', { name: /Add a line/ }).click();
    const lot = lines.locator('td[data-column="lot"] input').last();
    await lot.click();
    await page.keyboard.type(`01${box(2).gtin}17${box(2).box.expiry}10${box(2).box.lot}`);
    await page.keyboard.press('Tab');
    await expect.poll(async () => ((await state(page)).line_ids as { values: Record<string, unknown> }[]).at(-1)?.values).toMatchObject({
      product_id: { id: 2, label: 'Hyaluronic acid filler 1 ml' },
      lot: 'HF-2207',
      expiry: '2027-06-30',
    });
    await expect(lot).toHaveValue('HF-2207');
    await screen(page, 'scan-gun-typed');
    // A lot typed by hand stays as typed, though it starts as a GS1 part would.
    await lot.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('10A55');
    await page.keyboard.press('Enter');
    await expect.poll(async () => ((await state(page)).line_ids as { values: Record<string, unknown> }[]).at(-1)?.values['lot']).toBe('10A55');
    // Another box's code, Enter after it, the box kept: read as well.
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(`01${box(3).gtin}17${box(3).box.expiry}10${box(3).box.lot}`);
    await page.keyboard.press('Enter');
    await expect.poll(async () => ((await state(page)).line_ids as { values: Record<string, unknown> }[]).at(-1)?.values).toMatchObject({ lot: 'LD5521', expiry: '2027-11-30', product_id: { id: 3 } });
    await expect(lot).toHaveValue('LD5521');
    expect(problems).toEqual([]);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
    test("a line's card scans its lot, the camera's sheet the phone's width", async ({ page }) => {
      await camera(page);
      const { problems } = await open(page, 'plain', 'page=clinic-treatment&record=1&skin=outlined');
      const lines = node(page, 'f-lines');
      await lines.getByRole('button', { name: /Add a line/ }).click();
      const lot = lines.getByRole('button', { name: 'Scan a code into Lot' }).last();
      await expect(lot).toBeVisible();
      await lot.click();
      const sheet = page.getByRole('dialog', { name: 'Scan Lot' });
      await expect(sheet.getByRole('status')).toHaveText('Hold the code inside the frame.');
      const room = await sheet.boundingBox();
      expect(room && room.width).toBeLessThanOrEqual(390);
      await hold(page, boxCode(3));
      await expect(sheet).toBeHidden();
      await expect.poll(async () => ((await state(page)).line_ids as { values: Record<string, unknown> }[]).at(-1)?.values).toMatchObject({ lot: 'LD5521', expiry: '2027-11-30', product_id: { id: 3 } });
      await screen(page, 'scan-phone-card');
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(sideways).toBeLessThanOrEqual(0);
      expect(problems).toEqual([]);
    });
  });

  test('Escape closes the sheet and stops the camera; Type it instead puts the cursor in the box', async ({ page }) => {
    await camera(page);
    await open(page, 'plain', 'page=clinic-treatment&record=1&skin=outlined');
    const patient = node(page, 'f-patient');
    const scan = patient.getByRole('button', { name: 'Scan a code into Patient' });
    await scan.click();
    const sheet = page.getByRole('dialog', { name: 'Scan Patient' });
    await expect(sheet.getByRole('status')).toHaveText('Hold the code inside the frame.');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect.poll(() => cameraOff(page)).toBe(true);
    await expect(scan).toBeFocused();
    await scan.click();
    await page.getByRole('button', { name: 'Type it instead' }).click();
    await expect(sheet).toBeHidden();
    await expect(patient.locator('input')).toBeFocused();
    await expect(patient.locator('input')).toHaveValue('Mona Adel');
  });
});
