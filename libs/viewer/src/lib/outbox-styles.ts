import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * The outbox part's look: a quiet bar over the form saying what waits on this device, Send now beside it, and a send
 * refused once it went in the error's colour with Try again and Discard — under a kept response's ending as well. Its buttons are the main sheet's, so a theme
 * reshapes them; this lays them out alone, on the form's tokens, logical sides for right to left. Put in the page the
 * first time a page with an outbox is drawn (installPartStyles, PART_RANK.outbox).
 */
const OUTBOX_CSS = /* css */ `
.fd-outbox { display: grid; gap: 4px; margin-block-end: 12px; padding: 8px 12px; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); background: var(--fd-info-soft); color: var(--fd-text); font-size: 14px; }
.fd-outbox[hidden], .fd-outbox-refused[hidden] { display: none; }
.fd-outbox-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
.fd-outbox-said:empty { display: none; }
.fd-outbox-refused { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; color: var(--fd-error); }
.fd-outbox-refused li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
.fd-outbox-problem { background: var(--fd-error-soft); }
.fd-done .fd-outbox { margin: 8px 0 0; text-align: start; }
`;

/** The outbox part's sheet in a document, once, in its place among Fieldia's (PART_RANK.outbox). */
export function installOutboxStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-outbox-styles', OUTBOX_CSS, PART_RANK.outbox);
}
