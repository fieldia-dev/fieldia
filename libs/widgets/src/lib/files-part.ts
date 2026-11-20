/**
 * The files part (parts.ts): a file field and a picture field — a list,
 * thumbnails or cards, the switch between them and the dialog one opens in
 * (files.ts), which also shows a file the app hands back from an action (`viewFiles`: the viewer's host, its PDF of
 * a record over the record) — files on their way to the app's store, each with its bar, × and
 * Retry (files-going.ts), photos made smaller before they go (shrink.ts), a
 * signature's pad (signature.ts; the evidence of one that signs answers is a
 * part of its own, evidence-part.ts), a PDF shown under its file box (pdf.ts), and
 * their sheet (styles-files.ts). Loaded the first time a page shows one,
 * through `filesPart`; the names of the files a value holds meanwhile, read
 * only, never written (`plainFilesWidget`), and picking a file waits for it.
 * The form's own side of files — uploads, a save that waits for them — is
 * @fieldia/core's, whatever draws them. How every file is shown in place — its
 * bytes checked against the format it says (file-formats.ts) — is here too: a
 * sheet's attachment preview (the main script's `fileShown`) asks for it.
 */
export { binaryWidget, imageWidget, readFile, viewFiles, takeFiles, preview, INLINE_FILE_WARNING, type ViewFiles, type FilesTaking, type FileField } from './files';
export { showAppFile, type AppFileContext } from './files-app';
export { goingItem, goingList, goingWords } from './files-going';
export { shrinkPhoto, shrinkFor, shrinkable, readPicture, SHRINK_DEFAULTS, type Picture } from './shrink';
export { encodeSoon } from './encode-now';
export { signatureWidget } from './signature';
export { pdfWidget } from './pdf';
export { fileShown, formatOf, shownFile, whenShown, type FileFormat, type Shown, type ShownKind } from './file-formats';
export { installFilesStyles } from './styles-files';
