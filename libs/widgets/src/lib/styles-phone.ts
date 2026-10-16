import { installPartStyles, PART_RANK } from './styles';

/**
 * The phone part's sheet (phone-box.ts): a number's country in a small box of its own before the number — its flag
 * and its dialling code, the browser's own list of countries laid over them — and a call and a WhatsApp link after
 * it, wrapping under it where the row is narrow. A number reads left to right on a right-to-left page too, kept to
 * the page's start. Read-only, the country goes and the number is words with its links.
 */
export const PHONE_CSS = /* css */ `
.fd-phone { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; min-width: 0; }
.fd-phone-box { display: flex; align-items: center; gap: 6px; flex: 1 1 15em; min-width: 0; }
.fd-phone-country { position: relative; display: inline-flex; align-items: center; gap: 5px; flex: none; width: auto; cursor: pointer; white-space: nowrap; font-variant-numeric: tabular-nums; padding-inline-end: 22px; }
.fd-phone-country::after {
  content: ""; position: absolute; inset-inline-end: 9px; top: 50%; width: 6px; height: 6px; margin-top: -5px;
  border: solid currentColor; border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); opacity: 0.6; pointer-events: none;
}
.fd-phone-flag { font-size: 1.1em; line-height: 1; }
.fd-phone-dial { color: var(--fd-text); }
.fd-phone-country[data-empty] .fd-phone-dial { color: var(--fd-muted); }
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
/* Why a key was refused: under the number, across the row. */
.fd-phone > .fd-refusal-hint { flex-basis: 100%; order: 3; }
`;

/** The phone part's sheet in a document, once, in its place among Fieldia's. */
export function installPhoneStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-phone-styles', PHONE_CSS, PART_RANK.phone);
}
