import { codeReaderFor, useCodeReader } from './scan-reader';
import { codePixels } from './test-codes';
import { decodePart } from './widget-parts';

/**
 * The reader a scan reads with: the app's own where it gave one; the browser's BarcodeDetector where it reads every
 * format the field asks; else the decode part, asked for then — never before.
 */

type Host = Window & { BarcodeDetector?: unknown };
afterEach(() => {
  delete (window as Host).BarcodeDetector;
  useCodeReader(null);
});

class Detector {
  static formats = ['qr_code', 'ean_13'];
  static getSupportedFormats = async () => Detector.formats;
  constructor(readonly options: { formats: string[] }) {}
  detect = async () => [];
}

describe('the reader a scan reads with', () => {
  it("is the browser's BarcodeDetector where it reads every format asked, made for those formats", async () => {
    (window as Host).BarcodeDetector = Detector;
    const reader = await codeReaderFor(['qr_code'], document);
    expect(reader).toBeInstanceOf(Detector);
    expect((reader as unknown as Detector).options).toEqual({ formats: ['qr_code'] });
    expect(decodePart.loaded).toBeUndefined();
  });

  it("is the app's own before the browser's", async () => {
    (window as Host).BarcodeDetector = Detector;
    const own = { detect: async () => [{ rawValue: 'x', format: 'qr_code' }] };
    useCodeReader(own);
    expect(await codeReaderFor(['qr_code'], document)).toBe(own);
    const made: string[][] = [];
    useCodeReader((formats) => (made.push([...formats]), own));
    expect(await codeReaderFor(['ean_13'], document)).toBe(own);
    expect(made).toEqual([['ean_13']]);
  });

  it('is the decode part where the browser reads not every format asked, or none', async () => {
    (window as Host).BarcodeDetector = Detector;
    const reader = await codeReaderFor(['qr_code', 'data_matrix'], document);
    expect(reader).not.toBeInstanceOf(Detector);
    expect(decodePart.loaded).toBeDefined();
    expect(await reader.detect(codePixels('data_matrix', 'LOT-77') as unknown as ImageBitmapSource)).toEqual([{ rawValue: 'LOT-77', format: 'data_matrix' }]);
    delete (window as Host).BarcodeDetector;
    const none = await codeReaderFor(['qr_code'], document);
    expect(await none.detect(codePixels('qr_code', 'P-1042') as unknown as ImageBitmapSource)).toEqual([{ rawValue: 'P-1042', format: 'qr_code' }]);
  });
});
