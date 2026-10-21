import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * The verify part's look: under a field that asks for a code, its Send a code buttons in a row, the code's box — as
 * wide as its digits, spaced apart to read — with Confirm and Send again beside it, what is said under them (an error's
 * in the error's colour), and Confirmed with its tick in the success colour. Its boxes and buttons are the main sheet's
 * (`.fd-input`, `.fd-button`), so a theme reshapes them; this lays them out alone. On the form's tokens, so dark and the
 * themes follow; logical sides, so right to left follows. Put in the page the first time a page with a field asking for
 * a code is drawn (installPartStyles, PART_RANK.verify).
 */
const VERIFY_CSS = /* css */ `
.fd-verify { display: grid; gap: 6px; margin-block-start: 6px; }
.fd-verify[hidden], .fd-verify-row[hidden], .fd-verify-done[hidden], .fd-verify-wait[hidden] { display: none; }
.fd-verify-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.fd-verify-code { inline-size: calc(8ch + 24px); max-inline-size: 100%; font-variant-numeric: tabular-nums; letter-spacing: 0.3em; text-align: center; }
.fd-verify-said { margin: 0; font-size: 13px; line-height: 1.45; color: var(--fd-muted); }
.fd-verify-said:empty { display: none; }
.fd-verify-said.fd-verify-error { color: var(--fd-error); }
.fd-verify-wait { font-size: 13px; color: var(--fd-muted); font-variant-numeric: tabular-nums; }
.fd-verify-done { display: inline-flex; align-items: center; gap: 4px; margin: 0; font-size: 13px; font-weight: 600; color: var(--fd-success); }
.fd-verify-done svg { inline-size: 16px; block-size: 16px; }
.fd-verify [aria-busy="true"] { cursor: progress; opacity: 0.75; }
`;

/** The verify part's sheet in a document, once, in its place among Fieldia's (PART_RANK.verify). */
export function installVerifyStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-verify-styles', VERIFY_CSS, PART_RANK.verify);
}
