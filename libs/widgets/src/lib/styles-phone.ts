import { installPartStyles, PART_RANK } from './styles';

/**
 * The phone part's sheet (phone-box.ts): a number's country in a small box of its own before the number — its flag
 * and its dialling code, a button opening the list of countries found by typing (search-list.ts), or the browser's
 * own list laid over them — and a call and a WhatsApp link after it, wrapping under it where the row is narrow. A number reads left to right on a right-to-left page too, kept to
 * the page's start. Read-only, the country goes and the number is words with its links. "Country", none picked yet, is
 * quieter than a code yet words to read on the box's own fill in every theme: Apple's dark muted grey is 4.4:1 on its
 * fill, so a quarter of the text's colour goes into it.
 */
export const PHONE_CSS = /* css */ `
.fd-phone { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; min-width: 0; }
.fd-phone-box { display: flex; align-items: center; gap: 6px; flex: 1 1 15em; min-width: 0; }
.fd-phone-country { position: relative; display: inline-flex; align-items: center; gap: 5px; flex: none; width: auto; cursor: pointer; white-space: nowrap; font-variant-numeric: tabular-nums; padding-inline-end: 22px; text-align: start; }
.fd-phone-country::after {
  content: ""; position: absolute; inset-inline-end: 9px; top: 50%; width: 6px; height: 6px; margin-top: -5px;
  border: solid currentColor; border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); opacity: 0.6; pointer-events: none;
}
.fd-phone-flag { font-size: 1.1em; line-height: 1; }
.fd-phone-dial { color: var(--fd-text); }
.fd-phone-country[data-empty] .fd-phone-dial { color: color-mix(in srgb, var(--fd-muted) 75%, var(--fd-text)); }
.fd-phone-select { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; opacity: 0; cursor: pointer; font: inherit; }
.fd-phone-country:focus-within { border-color: var(--fd-focus); box-shadow: var(--fd-focus-ring); }
.fd-phone-input { flex: 1 1 auto; min-width: 0; font-variant-numeric: tabular-nums; }
[dir="rtl"] .fd-phone-input { text-align: right; }
.fd-phone-links { display: inline-flex; align-items: center; gap: 12px; }
.fd-phone-links:not(:has(> :not([hidden]))) { display: none; }
.fd-phone-link { color: var(--fd-accent); font-size: 13px; font-weight: 500; text-decoration: none; white-space: nowrap; }
.fd-phone-link:hover { text-decoration: underline; }
.fd-phone-link:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; border-radius: 2px; }
.fd-phone-link[hidden] { display: none; }
.fd-phone[data-readonly] .fd-phone-country { display: none; }
/* The list of countries found by typing, under the flag: a box to type in over the rows, each a flag, a name and a
   dialling code; the page's and the reader's countries first, a line under them. On a phone, a sheet from the foot of
   the screen with its title and Close, its rows a finger's height, its box's words 16px (no zoom on an iPhone). */
.fd-search-list {
  z-index: 40; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 6px; box-sizing: border-box;
  width: min(340px, calc(100vw - 16px)); max-height: min(380px, 70vh); padding: 8px; border: 1px solid var(--fd-border);
  border-radius: max(var(--fd-radius), 6px); background: var(--fd-surface); color: var(--fd-text); font-size: 14px; line-height: 20px;
  box-shadow: 0 8px 24px rgb(15 20 25 / 0.18);
}
.fd-search-list[hidden] { display: none; }
.fd-search-head { display: none; align-items: center; gap: 8px; }
.fd-search-title { flex: 1; margin: 0; font-size: 16px; font-weight: 600; }
.fd-search-list > .fd-search-find { width: 100%; }
.fd-search-rows { min-height: 0; margin-inline: -8px; overflow-y: auto; overscroll-behavior: contain; }
.fd-search-row { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 36px; padding-inline: 12px; cursor: pointer; }
.fd-search-row[data-first="last"] { border-block-end: 1px solid var(--fd-border); }
.fd-search-row[aria-selected="true"] { font-weight: 600; }
@media (hover: hover) { .fd-search-row:hover { background: color-mix(in srgb, var(--fd-text) 5%, transparent); } }
.fd-search-row[data-active] { background: var(--fd-accent-soft); box-shadow: inset 0 0 0 1px var(--fd-accent); }
.fd-search-lead { font-size: 1.15em; line-height: 1; }
.fd-search-words { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-search-trail { color: var(--fd-muted); font-variant-numeric: tabular-nums; }
.fd-search-none { margin: 4px; color: var(--fd-muted); }
.fd-search-none[hidden] { display: none; }
.fd-search-back { place-items: end stretch; padding: 0; }
.fd-search-list.fd-search-sheet {
  width: 100%; height: min(85vh, 640px); max-height: none; padding: 12px 12px calc(12px + env(safe-area-inset-bottom, 0px));
  border: 0; border-radius: 14px 14px 0 0;
}
.fd-search-sheet > .fd-search-head { display: flex; }
.fd-search-sheet .fd-search-find { min-height: 44px; font-size: 16px; }
.fd-search-sheet .fd-search-rows { margin-inline: -12px; }
.fd-search-sheet .fd-search-row { min-height: 44px; padding-inline: 16px; }
/* Why a key was refused: under the number, across the row. */
.fd-phone > .fd-refusal-hint { flex-basis: 100%; order: 3; }
/* On paper: the number as it is written, not its Call and WhatsApp links. */
@media print { .fd-form .fd-phone-links { display: none !important; } }
`;

/** The phone part's sheet in a document, once, in its place among Fieldia's. */
export function installPhoneStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-phone-styles', PHONE_CSS, PART_RANK.phone);
}
