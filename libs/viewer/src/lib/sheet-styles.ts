import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * A record sheet's furniture (sheet-furniture.ts): the ribbons in its card's corner, its stat buttons, its badges' row,
 * its statusbar under the title, the attachment beside it — cut from Fieldia's stylesheet, and put first among the parts'
 * sheets (`PART_RANK.sheet`), right after Fieldia's own, where it stood: every part's sheet after it reshapes it as
 * before (on paper, the print part's). A part of the sheet part, installed as its furniture is first drawn — and by the
 * designer's canvas, which draws a sheet's head with the same looks (`installSheetStyles`, viewer-parts.ts).
 */
export const SHEET_CSS = /* css */ `
/* ---- a sheet's furniture: its ribbons, stat buttons, badges, statusbar and attachment (the sheet part) ---- */
.fd-ribbon-frame { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none; }
.fd-ribbon {
  position: absolute; inset-block-start: 18px; inset-inline-end: -42px; transform: rotate(45deg); width: 160px;
  text-align: center; font-size: 12px; font-weight: 700; padding: 4px 0; color: #fff; background: #5f6670;
  text-transform: uppercase; letter-spacing: 0.06em; pointer-events: none;
}
[dir="rtl"] .fd-ribbon { transform: rotate(-45deg); }
/* White words on a ribbon in either scheme: fixed, deep colours, each at least 5:1 against white. */
.fd-ribbon.fd-tone-danger { background: #c63c3d; }
.fd-ribbon.fd-tone-success { background: #2e7d32; }
.fd-ribbon.fd-tone-warning { background: #a14f00; }
.fd-ribbon.fd-tone-info { background: #1365d9; }
/* A ribbon with words to point at takes the pointer, though its frame lets clicks through. */
.fd-ribbon[title] { pointer-events: auto; cursor: help; }
.fd-stats { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0; margin: -24px -28px 0; border-block-end: 1px solid var(--fd-border); }
.fd-stats:empty { display: none; }
/* A visible ribbon owns the corner: stat buttons keep clear of it. */
.fd-card:has(> .fd-ribbon-frame > .fd-ribbon:not([hidden])) .fd-stats { padding-inline-end: 104px; }
.fd-stat {
  font: inherit; background: none; border: none; border-inline-start: 1px solid var(--fd-border); cursor: pointer;
  padding: 8px 18px; display: grid; justify-items: start; line-height: 1.2; color: var(--fd-text); min-width: 120px;
}
.fd-stat:hover { background: var(--fd-page); }
.fd-stat:has(> .fd-icon) { grid-template-columns: auto minmax(0, 1fr); align-items: center; column-gap: 10px; }
.fd-stat > .fd-icon { width: 22px; height: 22px; color: var(--fd-muted); }
.fd-stat-words { display: grid; justify-items: start; }
.fd-stat-value { font-weight: 700; font-size: 15px; color: var(--fd-accent); font-variant-numeric: tabular-nums; }
.fd-stat-label { font-size: 12.5px; color: var(--fd-muted); }
/* The statusbar under the title, and the badges' row over it. */
.fd-title-statusbar { display: flex; }
.fd-badges { display: flex; flex-wrap: wrap; gap: 6px; }
/* The first alert on a card clears the ribbon in its corner, when no stat buttons stand between them. */
.fd-card:has(> .fd-ribbon-frame > .fd-ribbon:not([hidden])) > :is(.fd-ribbon-frame + .fd-alert, .fd-ribbon-frame + .fd-stats[hidden] + .fd-alert) { margin-inline-end: 72px; }
/* A stat button with two values, each after its words, one over the other: "In: 3", "Out: 5". */
.fd-stat-pair { gap: 1px; }
.fd-stat-row { display: inline-flex; align-items: baseline; gap: 5px; }
.fd-stat-row > .fd-stat-label::after { content: ":"; }
.fd-stat-pair .fd-stat-value { font-size: 13.5px; }
/* On a phone, stat buttons two to a row, edged between them, clear of a ribbon in the corner. */
@container (max-width: 520px) {
  .fd-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fd-stat { min-width: 0; padding-inline: 12px; text-align: start; column-gap: 8px; }
  .fd-stat:has(> .fd-icon) { column-gap: 8px; }
  .fd-stat-value { font-size: 14px; }
  .fd-stat:nth-child(odd of :not([hidden])) { border-inline-start: none; }
  .fd-stat:nth-child(n + 3 of :not([hidden])) { border-block-start: 1px solid var(--fd-border); }
  .fd-card:has(> .fd-ribbon-frame > .fd-ribbon:not([hidden])) .fd-stats { padding-inline-end: 0; }
  .fd-card:has(> .fd-ribbon-frame > .fd-ribbon:not([hidden])) .fd-stat:nth-child(2 of :not([hidden])) { padding-inline-end: 64px; }
  .fd-card:has(> .fd-ribbon-frame > .fd-ribbon:not([hidden])) .fd-stat:nth-child(4 of :not([hidden])) { padding-inline-end: 36px; }
}
/* The attachment beside the sheet: the sheet and its side panel in the first column, the file in the second. */
.fd-attachment-preview { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); overflow: hidden; }
.fd-attachment-preview[hidden] { display: none; }
.fd-attachment-head { display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 12px; padding-inline: 12px 8px; border-block-end: 1px solid var(--fd-border); min-width: 0; }
.fd-attachment-count { color: var(--fd-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.fd-attachment-head [hidden] { display: none; }
.fd-attachment-body { display: grid; min-height: 0; background: var(--fd-page); }
.fd-attachment-body > iframe { width: 100%; height: 100%; min-height: 70vh; border: 0; background: #fff; }
.fd-attachment-body > img { display: block; max-width: 100%; max-height: 80vh; margin: auto; object-fit: contain; }
.fd-sheet-layout.fd-has-preview:has(> .fd-attachment-preview:not([hidden])) { max-width: none; grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr); grid-template-rows: auto 1fr; }
.fd-sheet-layout.fd-has-preview:has(> .fd-attachment-preview:not([hidden])) > :is(.fd-card, .fd-side) { grid-column: 1; }
.fd-sheet-layout.fd-has-preview > .fd-attachment-preview { grid-column: 2; grid-row: 1 / span 2; position: sticky; top: 8px; height: calc(100vh - 16px); max-height: 1200px; }
@container (max-width: 1000px) {
  .fd-sheet-layout.fd-has-preview:has(> .fd-attachment-preview:not([hidden])) { grid-template-columns: minmax(0, 1fr); }
  .fd-sheet-layout.fd-has-preview > .fd-attachment-preview { grid-column: 1; grid-row: auto; position: static; height: auto; }
  .fd-attachment-body > iframe { min-height: 60vh; }
}
`;

/** The sheet's furniture's look in a document, once, in its place among Fieldia's (PART_RANK.sheet). */
export function installSheetStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-sheet-styles', SHEET_CSS, PART_RANK.sheet);
}
