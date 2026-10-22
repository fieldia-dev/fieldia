import { installPartStyles, PART_RANK } from './styles';

/**
 * A code scanned with the camera (scan.ts, scan-sheet.ts): a field's box with its Scan button at its end — a table's
 * under it — and the camera's sheet, its picture with a frame to hold the code in and what it says under it. The scan
 * part's sheet, put in its place among Fieldia's the first time a page draws a field scanned into
 * (installPartStyles, PART_RANK.scan).
 *
 * It lays out its own parts alone; the button, the dialog round the camera and the words are drawn by the main
 * sheet's rules (`.fd-button`, `.fd-form-dialog`), which the themes and the quiet look reshape. It names nothing they
 * name, so it goes last of the parts' sheets and moves no other's rank.
 */
export const SCAN_CSS = /* css */ `
/* A field scanned into: its box, and the Scan button at its end, wrapping under it where the row is narrow. */
.fd-scan { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 6px 8px; }
.fd-scan > :first-child { flex: 1 1 12rem; min-width: 0; }
.fd-scan-button { flex: none; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.fd-scan-button > svg { width: 18px; height: 18px; flex: none; }
/* In a line's cell, the button is its icon alone, beside the box. */
.fd-scan[data-in-line] { flex-wrap: nowrap; gap: 4px; }
.fd-scan[data-in-line] > :first-child { flex: 1 1 auto; }
.fd-scan[data-in-line] > .fd-scan-button { padding-inline: 6px; }
/* A table of lines counted by scanning: the button under the table. */
.fd-scan[data-scan="lines"] { display: grid; justify-items: start; }
.fd-scan[data-scan="lines"] > :first-child { width: 100%; }
/* Why the camera did not open: under the box, the whole row. */
.fd-scan-note { flex-basis: 100%; margin: 0; font-size: 13px; color: var(--fd-warning, #8a5300); }
/* The camera's sheet: its picture, the frame the code is held in, the words under it. */
.fd-form-dialog.fd-scan-sheet .fd-scan-body { padding: 0; background: var(--fd-surface); }
.fd-scan-view { position: relative; aspect-ratio: 4 / 3; max-height: 60vh; background: #111; overflow: hidden; }
.fd-scan-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.fd-scan-frame { position: absolute; inset: 20% 12%; border: 3px solid rgba(255, 255, 255, 0.92); border-radius: 12px; box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.32); }
.fd-scan-frame[data-read] { border-color: #2fbf71; }
.fd-scan-said { margin: 0; padding: 12px 16px; min-height: 3em; }
.fd-scan-said[data-problem] { color: var(--fd-error); font-weight: 600; }
.fd-scan-said[data-kept] { color: var(--fd-success); font-weight: 600; }
.fd-scan-foot { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
/* A table counted: a box under the words to type a code whose label will not scan, its button beside it. */
.fd-scan-typing { display: grid; gap: 4px; padding: 0 16px 14px; }
.fd-scan-typing-row { display: flex; gap: 8px; }
.fd-scan-typed { flex: 1 1 auto; min-width: 0; }
@media (prefers-reduced-motion: no-preference) { .fd-scan-frame { transition: border-color 0.15s; } }
@media print { .fd-form .fd-scan-button, .fd-form .fd-scan-note { display: none !important; } }
`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installScanStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-scan-styles', SCAN_CSS, PART_RANK.scan);
}
