/**
 * The scan part (parts.ts): a code scanned with the camera into a field (`options.scan`) — its widget with the Scan
 * button beside it and what a code read comes to (scan.ts), the camera's sheet (scan-sheet.ts), the reader it reads with — an app's own, the
 * browser's BarcodeDetector, else the decode part's, asked for as Scan is pressed (scan-reader.ts) — a GS1 code's parts
 * (gs1.ts), and its sheet (styles-scan.ts). Loaded the first time a page shows a field scanned into, through `scanPart`;
 * until it comes, the field is its widget alone, typed in as ever, and its button comes with the part (`partWidget`).
 *
 * An app reads codes its own way — a commercial scanning library, a test's stand-in — with
 * `(await scanPart.load()).useCodeReader(reader)`.
 */
export { scanning } from './scan';
export { openScanSheet, type ScanAnswer, type ScanEnd, type ScanProblem, type ScanSheet, type ScanSheetOptions } from './scan-sheet';
export { codeReaderFor, useCodeReader, type CodeReader, type CodeReaderMaker, type FoundCode } from './scan-reader';
export { gs1Day, gs1Number, gs1Parts, isGs1Day, readGs1 } from './gs1';
export { installScanStyles } from './styles-scan';
