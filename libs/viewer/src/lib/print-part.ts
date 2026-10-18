/**
 * The print part (parts.ts in @fieldia/widgets): a page on paper whole — each form's look laid out as printing begins
 * and back as it ends (print-look.ts), the browser's print of the page or of one part of it alone, and the sheet that
 * lays it out for paper (print-styles.ts). Loaded through `printPart` (print.ts) as a person shows they mean to print —
 * Ctrl+P, a Print pressed, the gear opened, a pointer resting on a Print button — or once a page meant for paper is
 * drawn; never for a page no one prints.
 */
export { printAlone, printLook, printPage } from './print-look';
export { installPrintStyles } from './print-styles';
