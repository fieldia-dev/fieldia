import { fieldiaStyle } from '@fieldia/widgets';

/**
 * The editable part's sheet (editable-part.ts): a list whose cells are changed in place — a cell that takes a change,
 * the box open in it, a row changed and not saved, the note under a row saying why it was not, a row added, Add a
 * line. Not ranked among the parts' sheets (PART_RANK): it is the list's, as its cards' and its columns' are, and goes
 * right after the list's own sheet (fd-list-styles, itself after them all), whose rows' rules it builds on. It names
 * nothing a theme reshapes: a cell's box is the form's own, drawn by the main sheet and the themes' — only its room in
 * the cell is said here.
 */
export const EDITABLE_STYLES = `
/* ---- a list's cells changed in place ---- */
.fd-list-table td[data-edit] { cursor: text; }
.fd-list-table td[data-edit]:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-list-table td[data-edit]:not([data-editing]):hover { box-shadow: inset 0 -1px 0 var(--fd-border-strong); }
/* The box open in a cell: as tall as the row and as wide as the cell was, so the columns stay where they stood (the
   cell's width held while it is open); a link's, a day's or a paragraph's box takes the room it needs, and its list
   floats over the page. */
.fd-list-table td[data-editing] { padding: 2px 4px; overflow: visible; white-space: normal; text-overflow: clip; }
.fd-list-editor { min-width: 0; }
.fd-list-editor :is(input, select, textarea) { min-width: 0; max-width: 100%; }
.fd-list-editor:is([data-type="many2one"], [data-type="many2many"], [data-type="date"], [data-type="datetime"]) { min-width: 12em; }
.fd-list-editor[data-type="text"] { min-width: 16em; }
.fd-list-editor > :not(label) { width: 100%; }
.fd-list-editor :is(input:not([type="checkbox"]):not([type="radio"]), select) { min-height: 30px; box-sizing: border-box; }
.fd-list-table td.fd-num[data-editing] input { text-align: end; }
/* A cell changed and not saved yet, tinted; one whose text does not read, or refused, in the error's tones. */
.fd-list-row[data-changed] > td[data-changed]:not([data-editing]) { background: var(--fd-accent-soft); }
.fd-list-table td[aria-invalid="true"]:not([data-editing]) { background: var(--fd-error-soft); color: var(--fd-error); box-shadow: inset 0 -2px 0 var(--fd-error); }
.fd-list-unread { text-decoration: underline wavy var(--fd-error); text-underline-offset: 3px; }
.fd-list-table td[data-waits] { color: var(--fd-muted); }
.fd-list-row[aria-busy="true"] > td { opacity: 0.65; transition: opacity 0.2s 0.15s; }
/* Under a row: why it was not saved, someone else's save first, the changes set aside — across the table. */
.fd-list-note > td { padding: 6px 10px 10px; white-space: normal; overflow: visible; max-width: none; background: var(--fd-surface); }
/* Its words under the row's first words, past the box to choose a row. */
.fd-list:not([data-choose="none"]) .fd-list-note > td { padding-inline-start: 46px; }
.fd-list-note .fd-conflict, .fd-list-note .fd-set-aside { margin: 0; }
.fd-list-refused { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; color: var(--fd-error); font-size: 13.5px; }
.fd-list-refused .fd-button-link { min-height: 24px; padding-block: 0; }
.fd-list-row:has(+ .fd-list-note:not([hidden])) > td { border-block-end-color: transparent; }
/* A row added, and one kept in sight though the search no longer finds it. */
.fd-list-row[data-new] > td.fd-list-check, .fd-list-row[data-kept] > td.fd-list-check { visibility: hidden; }
.fd-list-row[data-kept] > td { background: var(--fd-page); }
.fd-list-open { min-width: 28px; min-height: 28px; padding: 0 6px; font-size: 15px; }
.fd-list-adds { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; min-height: 0; }
.fd-list-adds:not(:has(> :not(.fd-sr-only):not([hidden]):not(textarea))) { display: none; }
.fd-list-add { min-height: 32px; }
.fd-list-add > span { font-size: 16px; }
.fd-list-paste-note { margin: 0; }
/* What a paste lands in before it is read: out of sight, still able to take the focus. */
.fd-list-paste-catcher { position: fixed; inset-inline-start: 0; top: 0; width: 1px; height: 1px; padding: 0; border: 0; opacity: 0; pointer-events: none; }
/* On a phone the rows are cards: the note under a card, as wide as it. */
.fd-list[data-as] .fd-list-note { display: block; margin-block-start: -6px; }
.fd-list[data-as] .fd-list-note > td { display: block; padding: 0 2px; background: none; }
.fd-list[data-as] .fd-list-row[data-changed] { border-inline-start: 3px solid var(--fd-accent); }
@media print { .fd-list-adds, .fd-list-open { display: none !important; } }
`;

/** The editable part's sheet in a document, once: right after the list's own, where it builds on its rules. */
export function installEditableStyles(doc: Document): void {
  if (doc.getElementById('fd-list-editable-styles')) return;
  const style = fieldiaStyle(doc, EDITABLE_STYLES, 'fd-list-editable-styles');
  const list = doc.getElementById('fd-list-styles');
  if (list) list.after(style);
  else (doc.head ?? doc.documentElement).append(style);
}
