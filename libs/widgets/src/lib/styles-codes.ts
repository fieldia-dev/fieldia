import { installPartStyles, PART_RANK } from './styles';

/**
 * A value shown as a code (codes.ts): the code on a white ground with its margin whatever the page's scheme — a scanner
 * reads dark on light — its words under it, and why one cannot be drawn. The codes part's sheet, put in its place among
 * Fieldia's the first time a page shows a code (installPartStyles, PART_RANK.codes): before the themes', which reshape
 * the box over it; the code itself keeps its own colours under every theme.
 */
export const CODES_CSS = /* css */ `
.fd-code { display: grid; gap: 8px; justify-items: start; min-width: 0; }
.fd-code-figure { display: inline-grid; justify-items: center; gap: 4px; margin: 0; padding: 8px; max-width: 100%; border-radius: var(--fd-control-radius); background: #fff; color: #000; box-shadow: 0 0 0 1px var(--fd-border); }
.fd-code-picture { display: grid; max-width: 100%; }
.fd-code-picture svg { display: block; max-width: 100%; height: auto; fill: #000; }
/* The words under it read as the value is written, digits and letters in their own order. */
.fd-code-words { font: 13px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.04em; overflow-wrap: anywhere; text-align: center; unicode-bidi: plaintext; }
.fd-code-why:empty { display: none; }
.fd-code-why { margin: 0; color: var(--fd-warning); }
@media print { .fd-code-figure { box-shadow: none; } }
`;

/** The codes' sheet in a document, once, in its place among Fieldia's (PART_RANK.codes). */
export function installCodesStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-codes-styles', CODES_CSS, PART_RANK.codes);
}
