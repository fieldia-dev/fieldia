import { loadDecodePart } from './widget-parts';

/** A code found in a picture, as the browser's BarcodeDetector names it: its text and its format ("data_matrix"). */
export interface FoundCode {
  rawValue: string;
  format: string;
}

/**
 * What reads codes in a camera's picture: the browser's `BarcodeDetector`, the decode part's (ZXing's readers), or an
 * app's own (`useCodeReader`): the codes found in a picture — a video's frame — none where it holds none.
 */
export interface CodeReader {
  detect(source: CanvasImageSource | ImageBitmapSource): Promise<FoundCode[]>;
}

/** An app's reader of codes for the formats a field asks (`ScanSettings.formats`), in a document. */
export type CodeReaderMaker = (formats: readonly string[], doc: Document) => CodeReader | Promise<CodeReader>;

/** The browser's own reader, where it has one: Chrome and Edge on Android, ChromeOS and macOS, Safari behind a setting. */
interface DetectorClass {
  new (options: { formats: string[] }): CodeReader;
  getSupportedFormats(): Promise<string[]>;
}

let own: CodeReaderMaker | null = null;

/**
 * An app's own reader of codes, used before the browser's and the decode part's — a commercial scanning library, a
 * test's stand-in that reads a picture it was handed; null puts Fieldia's back.
 */
export function useCodeReader(reader: CodeReader | CodeReaderMaker | null): void {
  own = reader === null ? null : typeof reader === 'function' ? reader : () => reader;
}

/**
 * The reader of `formats` a scan reads with: the app's own (`useCodeReader`); else the browser's `BarcodeDetector`
 * where it reads every one of them; else the decode part's, asked for now — the first time Scan is pressed in a
 * browser that reads none itself. Rejects where that part cannot come.
 */
export async function codeReaderFor(formats: readonly string[], doc: Document): Promise<CodeReader> {
  if (own) return own(formats, doc);
  const Detector = (doc.defaultView as (Window & { BarcodeDetector?: DetectorClass }) | null)?.BarcodeDetector;
  if (Detector) {
    try {
      const supported = await Detector.getSupportedFormats();
      if (formats.every((format) => supported.includes(format))) return new Detector({ formats: [...formats] });
    } catch {
      // A detector that cannot say what it reads: the decode part reads instead.
    }
  }
  const part = await loadDecodePart();
  return part.codeReader(formats, doc);
}
