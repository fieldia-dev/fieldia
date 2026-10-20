import { codeReader } from './decode-part';
import { readGs1 } from './gs1';
import { codePixels } from './test-codes';

/**
 * The decode part: a picture's codes read with ZXing's readers, where a browser has no reader of its own — each format
 * Fieldia reads, a GS1 DataMatrix with its parts apart, the formats a field asks and no other, none in a blank picture.
 */

const read = (formats: string[], pixels: ReturnType<typeof codePixels>) => codeReader(formats, document).detect(pixels as unknown as ImageBitmapSource);

describe('the decode part', () => {
  it('reads a QR code, a DataMatrix, an EAN-13 and a Code 39, each by its name', async () => {
    const all = ['qr_code', 'data_matrix', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];
    expect(await read(all, codePixels('qr_code', 'P-1042'))).toEqual([{ rawValue: 'P-1042', format: 'qr_code' }]);
    expect(await read(all, codePixels('data_matrix', 'LOT-77'))).toEqual([{ rawValue: 'LOT-77', format: 'data_matrix' }]);
    expect(await read(all, codePixels('ean_13', '6224000123451'))).toEqual([{ rawValue: '6224000123451', format: 'ean_13' }]);
    expect(await read(all, codePixels('code_39', 'A-1234'))).toEqual([{ rawValue: 'A-1234', format: 'code_39' }]);
  });

  it("reads a medicine's GS1 DataMatrix with its FNC1s, so its parts come apart", async () => {
    const gs1 = '0106285096000842172812311025A1234\u001d21SN998877';
    const [found] = await read(['data_matrix'], codePixels('data_matrix', gs1, { gs1: true }));
    expect(found.format).toBe('data_matrix');
    expect(readGs1(found.rawValue)).toEqual({ '01': '06285096000842', '17': '281231', '10': '25A1234', '21': 'SN998877' });
  });

  it('reads only the formats asked, and nothing in a picture with no code', async () => {
    expect(await read(['data_matrix'], codePixels('qr_code', 'P-1042'))).toEqual([]);
    expect(await read(['qr_code'], codePixels('ean_13', '6224000123451'))).toEqual([]);
    const blank = { data: new Uint8ClampedArray(200 * 120 * 4).fill(255), width: 200, height: 120 };
    expect(await read(['qr_code', 'ean_13'], blank)).toEqual([]);
  });

  it('reads a frame drawn on its canvas, made smaller where it is large', async () => {
    const pixels = codePixels('qr_code', 'ROOM-12', { scale: 40 });
    const drawn: { width: number; height: number }[] = [];
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      return {
        drawImage: () => drawn.push({ width: this.width, height: this.height }),
        // The frame as the canvas holds it: the code at its own size here, the reader told the canvas's.
        getImageData: () => pixels,
      } as unknown as CanvasRenderingContext2D;
    });
    const video = { videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement;
    const reader = codeReader(['qr_code'], document);
    expect(await reader.detect(video)).toEqual([{ rawValue: 'ROOM-12', format: 'qr_code' }]);
    expect(drawn).toEqual([{ width: 960, height: 540 }]);
    jest.restoreAllMocks();
  });
});
