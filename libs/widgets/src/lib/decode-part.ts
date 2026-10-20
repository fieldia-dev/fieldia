/**
 * The decode part (parts.ts): codes read in a camera's picture where the browser reads none itself — Safari, Firefox,
 * Chrome on a computer — with ZXing's readers (@zxing/library, Apache-2.0: see THIRD_PARTY_NOTICES.md): QR codes,
 * DataMatrix, EAN-13 and EAN-8, UPC-A and UPC-E, Code 128 and Code 39. Loaded only as Scan is pressed in such a browser,
 * through `decodePart` (widget-parts.ts): a browser with its own `BarcodeDetector` that reads the formats asked never
 * downloads it.
 */
import { BarcodeFormat, BinaryBitmap, DataMatrixReader, DecodeHintType, HybridBinarizer, MultiFormatOneDReader, QRCodeReader, RGBLuminanceSource } from '@zxing/library';
import type { CodeReader, FoundCode } from './scan-reader';

/** Each format by its BarcodeDetector name, as ZXing names it. */
const FORMATS: Record<string, BarcodeFormat> = {
  qr_code: BarcodeFormat.QR_CODE,
  data_matrix: BarcodeFormat.DATA_MATRIX,
  ean_13: BarcodeFormat.EAN_13,
  ean_8: BarcodeFormat.EAN_8,
  upc_a: BarcodeFormat.UPC_A,
  upc_e: BarcodeFormat.UPC_E,
  code_128: BarcodeFormat.CODE_128,
  code_39: BarcodeFormat.CODE_39,
};
const NAMES = new Map<BarcodeFormat, string>(Object.entries(FORMATS).map(([name, format]) => [format, name]));

/** The longest side a picture is read at: a phone's 1280 by 720 frame, made smaller, reads as well and four times faster. */
const MOST = 960;

/** A picture's pixels as a canvas gives them (`ImageData`), four bytes a pixel. */
type Pixels = { data: Uint8ClampedArray; width: number; height: number };
type Source = HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap | Pixels;
const isPixels = (source: Source): source is Pixels => 'data' in source && ArrayBuffer.isView(source.data);

/** A picture's size: a video's frame, an image's own, a canvas's. */
function sizeOf(source: Exclude<Source, Pixels>): [number, number] {
  if ('videoWidth' in source) return [source.videoWidth, source.videoHeight];
  if ('naturalWidth' in source) return [source.naturalWidth, source.naturalHeight];
  return [source.width, source.height];
}

/** A picture's light, one byte a pixel, as ZXing reads it. */
function lightOf(pixels: Uint8ClampedArray, count: number): Uint8ClampedArray {
  const light = new Uint8ClampedArray(count);
  for (let i = 0, p = 0; i < count; i++, p += 4) light[i] = (pixels[p] * 77 + pixels[p + 1] * 150 + pixels[p + 2] * 29) >> 8;
  return light;
}

/**
 * A reader of the `formats` asked, as a browser's BarcodeDetector reads: `detect` a picture — a video's frame, a canvas,
 * an image, its pixels (an `ImageData`, or its like) — and the codes found in it, none where there is none. Its frames are drawn on a canvas of
 * `doc`, made smaller where they are large.
 */
export function codeReader(formats: readonly string[], doc: Document): CodeReader {
  const wanted = formats.map((name) => FORMATS[name]).filter((format): format is BarcodeFormat => format !== undefined);
  const hints = new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, wanted],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const oneD = wanted.filter((format) => ![BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX].includes(format));
  const readers = [
    ...(wanted.includes(BarcodeFormat.QR_CODE) ? [new QRCodeReader()] : []),
    ...(wanted.includes(BarcodeFormat.DATA_MATRIX) ? [new DataMatrixReader()] : []),
    ...(oneD.length ? [new MultiFormatOneDReader(hints)] : []),
  ];
  // The canvas a frame is drawn on, made for the first frame that is not pixels already.
  let canvas: HTMLCanvasElement | null = null;
  let context: CanvasRenderingContext2D | null = null;
  /** The picture's pixels, drawn smaller where it is large. */
  function pixelsOf(source: Source): Pixels | null {
    if (isPixels(source)) return source;
    const [width, height] = sizeOf(source);
    if (!canvas) {
      canvas = doc.createElement('canvas');
      context = canvas.getContext('2d', { willReadFrequently: true });
    }
    if (!context || !width || !height) return null;
    const scale = Math.min(1, MOST / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }
  return {
    async detect(source) {
      const pixels = pixelsOf(source as Source);
      if (!pixels) return [];
      const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lightOf(pixels.data, pixels.width * pixels.height), pixels.width, pixels.height)));
      for (const reader of readers) {
        try {
          const result = reader.decode(bitmap, hints);
          const found: FoundCode = { rawValue: result.getText(), format: NAMES.get(result.getBarcodeFormat()) ?? 'unknown' };
          return [found];
        } catch {
          // None of its format in this picture: the next reader looks.
        } finally {
          reader.reset();
        }
      }
      return [];
    },
  };
}
