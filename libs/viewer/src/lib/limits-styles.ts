import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * The limits part's look: a closed form's words in place of its questions, as the Thank you stands — its own words
 * under them — the banner of answers that can no longer be sent (the main sheet's banner), Continue later's button and
 * why it could not keep them, and what it kept: the link in a box with Copy, the app's words, Keep going. On the
 * form's tokens, so dark and the themes follow; logical sides, so right to left follows. Put in the page the first
 * time a page with `limits` or `continueLater` is drawn (installPartStyles, PART_RANK.limits).
 */
const LIMITS_CSS = /* css */ `
.fd-closed, .fd-later { display: grid; gap: 10px; justify-items: center; padding: 40px 16px; text-align: center; }
.fd-closed-title, .fd-later-title { margin: 0; font-size: 20px; font-weight: 650; line-height: 1.35; color: var(--fd-text); }
.fd-later-title:focus { outline: none; }
.fd-closed-message, .fd-later-words, .fd-later-message { margin: 0; max-width: 36em; color: var(--fd-muted); line-height: 1.5; }
.fd-closed[aria-busy="true"] .fd-closed-title { font-size: 15px; font-weight: 400; color: var(--fd-muted); }
.fd-later-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: min(100%, 34em); }
.fd-later-link { flex: 1 1 16em; min-width: 0; }
.fd-later-row[hidden], .fd-later-message[hidden], .fd-closed-message[hidden] { display: none; }
.fd-later-box { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
.fd-later-said { color: var(--fd-error); font-size: 13px; }
.fd-later-said:empty { display: none; }
.fd-later-button[aria-busy="true"] { opacity: 0.7; cursor: progress; }
`;

/** The limits part's sheet in a document, once, in its place among Fieldia's (PART_RANK.limits). */
export function installLimitsStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-limits-styles', LIMITS_CSS, PART_RANK.limits);
}
