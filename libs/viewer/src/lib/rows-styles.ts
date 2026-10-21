/**
 * The rows part's sheet (rows-part.ts): what a list's row opens to under it — its toggle before the row's name (with
 * its words in a card on a phone), a table of what it holds, to read, its pager — Not ranked among the parts' sheets
 * (PART_RANK): it is the list's, cut from it, as its cards' and its columns' are, and goes right after the list's own
 * sheet, as its rules reshape the list's rows (a card's, from the cards' sheet, before it).
 */
export const ROWS_STYLES = `
/* ---- a row opened in place (detail) ---- */
/* Not a record's row: what it opens to, set in under the row's name, on the page's ground. */
.fd-list-table > tbody > tr.fd-list-detail > td { max-width: none; padding: 2px 10px 12px; padding-inline-start: 46px; white-space: normal; overflow: visible; background: var(--fd-page); }
.fd-list-detail-box { display: grid; gap: 6px; justify-items: start; min-width: 0; }
.fd-list-detail-scroll { max-width: 100%; overflow-x: auto; justify-self: stretch; }
.fd-list-detail-table { display: inline-grid; grid-template-columns: repeat(var(--fd-detail-columns, 1), auto); font-size: 13.5px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); }
.fd-list-detail-table[hidden] { display: none; }
.fd-list-detail-table > [role="rowgroup"], .fd-list-detail-row { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; }
.fd-list-detail-row > * { padding: 5px 12px; border-block-end: 1px solid var(--fd-border); white-space: nowrap; }
.fd-list-detail-head > * { color: var(--fd-muted); font-size: 12.5px; font-weight: 600; }
.fd-list-detail-table > [role="rowgroup"]:last-child > .fd-list-detail-row:last-child > * { border-block-end: 0; }
.fd-list-detail-table .fd-num { text-align: end; font-variant-numeric: tabular-nums; }
/* A section's heading or a note among the lines: its words across the row, a note's as it was written. */
.fd-list-detail-across { grid-column: 1 / -1; white-space: pre-line !important; }
.fd-list-detail-row[data-kind="section"] > * { font-weight: 600; background: var(--fd-page); }
.fd-list-detail-row[data-kind="note"] > * { color: var(--fd-muted); font-style: italic; }
.fd-list-detail-none, .fd-list-detail-failed { margin: 0; padding-block: 4px; color: var(--fd-muted); font-size: 13.5px; }
.fd-list-detail-failed { color: var(--fd-error); }
.fd-list-detail-pager { margin: 0; }
/* Its toggle before the row's name: an arrow that turns as it opens, mirrored right to left. */
.fd-list-detail-toggle { all: unset; box-sizing: border-box; cursor: pointer; display: inline-grid; place-items: center; width: 20px; height: 20px; margin-inline-end: 6px; vertical-align: middle; border-radius: 4px; color: var(--fd-muted); }
.fd-list-detail-toggle::before { content: ''; width: 6px; height: 6px; border-top: 1.5px solid currentColor; border-right: 1.5px solid currentColor; transform: rotate(45deg); transition: transform 0.12s; }
.fd-list-detail-toggle:dir(rtl)::before { transform: rotate(-135deg); }
.fd-list-detail-toggle[aria-expanded="true"]::before { transform: rotate(135deg); }
.fd-list-detail-toggle:hover { background: var(--fd-accent-soft); color: var(--fd-accent); }
.fd-list-detail-toggle:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
/* ---- rows re-ranked by hand (sequenceField) ---- */
/* A grip at the row's start, while the list is in their order; the row carried by it lifted over the rest. */
.fd-list-rank { display: none; flex: none; width: 10px; height: 16px; margin-inline-end: 8px; vertical-align: middle; cursor: grab; touch-action: none; background: radial-gradient(circle, var(--fd-border-strong) 1.3px, transparent 1.7px) 0 0 / 5px 5.33px; }
.fd-list-row[data-ranks] > td[data-col] > .fd-list-rank { display: inline-block; }
.fd-list-row[data-lifted] { position: relative; z-index: 2; cursor: grabbing; box-shadow: 0 6px 18px rgb(0 0 0 / 0.18); }
.fd-list-row[data-lifted] > td { background: var(--fd-accent-soft); }
tbody[data-ranking] { user-select: none; }
tbody[data-ranking] > .fd-list-row:not([data-lifted]) { transition: transform 0.12s; }
/* ---- a tree's children loaded as a parent opens (loadChildren) ---- */
/* Under a search, a match's parent after its name; a parent's "Show 40 more" set in under its children. */
.fd-list-tree-in { margin-inline-start: 8px; color: var(--fd-muted); font-size: 12.5px; }
/* A name set in by its depth wraps where the list is narrow (a phone), never pushing the other columns past its edge. */
.fd-list-row[data-tree] > td[data-name] { white-space: normal; overflow-wrap: break-word; padding-inline-start: calc(32px + var(--fd-depth, 0) * 20px); text-indent: -22px; }
/* On a phone: set in less at each depth, and no column for Collapse all — the arrows open and close each parent. */
@media (max-width: 520px) {
  .fd-list-row[data-tree] > td[data-name] { padding-inline-start: calc(28px + var(--fd-depth, 0) * 12px); }
  .fd-list-table:has(> tbody > .fd-list-row[data-tree]) :is(th, td).fd-list-tree { display: none; }
}
.fd-list-table > tbody > tr.fd-list-tree-more > td { padding: 4px 10px; padding-inline-start: calc(32px + var(--fd-depth, 0) * 20px); }
.fd-list-row[aria-busy="true"] > td[data-name] > .fd-list-twisty { opacity: 0.5; }
/* With its words, in a card on a phone alone. */
.fd-list-detail-words { display: none; }
@media not print {
.fd-list[data-as="cards"] .fd-list-detail-words { display: inline-flex; gap: 6px; width: auto; height: auto; min-height: 32px; margin: 4px 0 0; padding-inline: 2px 8px; color: var(--fd-accent); font-size: 13.5px; font-weight: 500; justify-self: start; }
.fd-list[data-as="cards"] .fd-list-detail-words::before { align-self: center; }
.fd-list[data-as="cards"] .fd-list-detail { display: block; }
/* A card's grip at its start, the card carried whole. */
.fd-list[data-as="cards"] .fd-list-row[data-ranks] > td.fd-list-card > .fd-list-rank { display: block; align-self: center; height: 24px; margin: 0; }
.fd-list[data-as="cards"] .fd-list-table > tbody > tr.fd-list-detail > td { display: block; padding: 0; background: none; }
/* A gallery's cards open their records: none opens in place. */
.fd-list[data-as="gallery"] :is(.fd-list-detail-toggle, .fd-list-detail, .fd-list-rank) { display: none !important; }
}
`;

/** The rows' sheet in a document, once, right after the list's own (and its cards', which it reshapes for a phone). */
export function installRowsStyles(doc: Document): void {
  if (doc.getElementById('fd-list-rows-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fd-list-rows-styles';
  style.textContent = ROWS_STYLES;
  const after = doc.getElementById('fd-list-cards-styles') ?? doc.getElementById('fd-list-styles');
  if (after) after.after(style);
  else (doc.head ?? doc.documentElement).append(style);
}
