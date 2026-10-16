/**
 * The files part (parts.ts): a file field and a picture field — a list,
 * thumbnails or cards, the switch between them and the dialog one opens in
 * (files.ts) — files on their way to the app's store, each with its bar, × and
 * Retry (files-going.ts), photos made smaller before they go (shrink.ts), a
 * signature's pad (signature.ts), a PDF shown under its file box (pdf.ts), and
 * their sheet (styles-files.ts). Loaded the first time a page shows one,
 * through `filesPart`; the names of the files a value holds meanwhile, read
 * only, never written (`plainFilesWidget`), and picking a file waits for it.
 * The form's own side of files — uploads, a save that waits for them — is
 * @fieldia/core's, whatever draws them; so is a sheet's attachment preview,
 * which shows a file with the main script's `fileShown` (file-shown.ts).
 */
export { binaryWidget, imageWidget, readFile, INLINE_FILE_WARNING } from './files';
export { goingItem, goingList, goingWords } from './files-going';
export { shrinkPhoto, shrinkFor, shrinkable, SHRINK_DEFAULTS } from './shrink';
export { signatureWidget } from './signature';
export { pdfWidget } from './pdf';
export { installFilesStyles } from './styles-files';
