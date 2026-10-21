import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * The pay part's look: the payment step in the questions' place — what it is for, the amount large, the page's words,
 * the app's checkout's slot, what is said (an error's in the error's colour), Pay, Cancel and Back in a row, and the
 * note that nothing is sent until it is paid. Its buttons are the main sheet's (`.fd-button`), so a theme reshapes
 * them; this lays them out alone, on the form's tokens, logical sides for right to left. Put in the page the first time
 * a page asking for a payment is drawn (installPartStyles, PART_RANK.pay).
 */
const PAY_CSS = /* css */ `
.fd-pay { display: grid; gap: 10px; justify-items: start; padding: 24px 0 8px; }
.fd-pay[hidden], .fd-pay-words[hidden] { display: none; }
.fd-pay-title { margin: 0; font-size: 20px; font-weight: 650; line-height: 1.35; color: var(--fd-text); }
.fd-pay-title:focus { outline: none; }
.fd-pay-amount { margin: 0; font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--fd-text); }
.fd-pay-words, .fd-pay-note { margin: 0; max-width: 40em; color: var(--fd-muted); line-height: 1.5; }
.fd-pay-note { font-size: 13px; }
.fd-pay-slot { inline-size: 100%; }
.fd-pay-slot:empty { display: none; }
.fd-pay-said { margin: 0; font-size: 14px; color: var(--fd-muted); }
.fd-pay-said:empty { display: none; }
.fd-pay-said.fd-pay-error { color: var(--fd-error); }
.fd-pay-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.fd-pay[aria-busy] .fd-pay-said { cursor: progress; }
`;

/** The pay part's sheet in a document, once, in its place among Fieldia's (PART_RANK.pay). */
export function installPayStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-pay-styles', PAY_CSS, PART_RANK.pay);
}
