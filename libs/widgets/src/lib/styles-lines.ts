import { installPartStyles, PART_RANK } from './styles';

/**
 * A table of lines (lines-table.ts) and a many2many's table of records
 * (links-table.ts): their own rules — the lines' grips, dragging and moving, a
 * column sized to its kind, a line's tone and bold, the ticks of lines chosen,
 * sections and notes, and lines as cards on a phone or always. The lines part's
 * sheet, put in its place among Fieldia's the first time a page draws one
 * (installPartStyles, PART_RANK.lines). What a table's lines share with a grid's
 * and a distribution's — the table, its heads and cells, ×, a line's buttons,
 * the totals, the add buttons, the bar of buttons for lines chosen — stays in
 * Fieldia's own sheet (styles.ts), as those draw it with no table of lines.
 */
export const LINES_CSS = /* css */ `
/* ---- a table of lines: its own rules --------------------------------------- */
.fd-lines { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; min-width: 0; }
/* A yes/no cell sits level with the inputs beside it. */
.fd-lines-table td > .fd-checkbox, .fd-lines-table td > .fd-switch { margin-block-start: 6px; }
.fd-lines-table .fd-lines-grip { width: 1px; min-width: 0; padding-inline: 6px 2px; }
/* A table wider than its box scrolls sideways under a line's grip and its delete button, which stay at its ends. */
.fd-lines:not([data-cards="always"]) .fd-lines-table :is(th, td):is(.fd-lines-grip, .fd-lines-tools) { position: sticky; z-index: 1; background-color: var(--fd-surface); }
.fd-lines:not([data-cards="always"]) .fd-lines-table :is(th, td).fd-lines-grip { inset-inline-start: 0; }
.fd-lines:not([data-cards="always"]) .fd-lines-table :is(th, td).fd-lines-tools { inset-inline-end: 0; }
/* A column of yes/no, numbers, money or dates as wide as its values, as Flectra's lists size them: words and links have the rest. */
.fd-lines-table td[data-fit] { min-width: 0; }
.fd-lines-table th[data-fit="boolean"] { width: 5em; min-width: 5em; }
.fd-lines-table th[data-fit="integer"] { width: max(7em, var(--fd-fit-need, 0px)); min-width: max(7em, var(--fd-fit-need, 0px)); }
.fd-lines-table th[data-fit="float"] { width: max(7.5em, var(--fd-fit-need, 0px)); min-width: max(7.5em, var(--fd-fit-need, 0px)); }
.fd-lines-table th[data-fit="monetary"] { width: max(11.5em, var(--fd-fit-need, 0px)); min-width: max(11.5em, var(--fd-fit-need, 0px)); }
.fd-lines-table th[data-fit="date"] { width: 9em; min-width: 9em; }
.fd-lines-table th[data-fit="datetime"] { width: 12.5em; min-width: 12.5em; }
/* Numbers and money read from the end, as Flectra's lists align them. */
.fd-lines-table th:is([data-fit="integer"], [data-fit="float"], [data-fit="monetary"]) { text-align: end; }
.fd-lines-table td:is([data-fit="integer"], [data-fit="float"], [data-fit="monetary"]) input { text-align: end; }
/* A table reads as a table, as a grid does: a line shows its boxes and buttons where the pointer or the cursor is.
   Only colours and visibility change, never a size: a line left for a click elsewhere must not move what is clicked.
   A touch screen has no pointer to hover with: there the boxes always show. */
@media (hover: hover) and (pointer: fine) {
  .fd-lines:not([data-cards="always"]) .fd-lines-table tbody tr:not(:hover, :focus-within) .fd-input:not([aria-invalid="true"]) { border-color: transparent; background-color: transparent; box-shadow: none; }
  .fd-lines:not([data-cards="always"]) .fd-lines-table tbody tr:not(:hover, :focus-within) :is(.fd-combo-open, .fd-combo-clear) { visibility: hidden; }
}
.fd-line-grip { display: block; margin-block-start: 7px; cursor: grab; }
/* A line dragged by its grip follows the pointer, lifted over the others, which slide out of its way. */
.fd-lines-dragging, .fd-lines-dragging * { cursor: grabbing; user-select: none; }
.fd-lines-dragging > tr:not(.fd-line-lifted) { transition: transform 0.15s ease; }
.fd-line-lifted { position: relative; z-index: 2; box-shadow: 0 6px 18px rgba(15, 20, 25, 0.16); }
.fd-line-lifted > td { background: var(--fd-surface); }
/* A table's own rules: a line's or a cell's tone and bold (Flectra's decoration-*), and buttons on a line. */
.fd-lines-table [data-tone="info"] { --fd-line-tone: var(--fd-info); --fd-tone: var(--fd-info); --fd-tone-soft: var(--fd-info-soft); }
.fd-lines-table [data-tone="success"] { --fd-line-tone: var(--fd-success); --fd-tone: var(--fd-success); --fd-tone-soft: var(--fd-success-soft); }
.fd-lines-table [data-tone="warning"] { --fd-line-tone: var(--fd-warning); --fd-tone: var(--fd-warning); --fd-tone-soft: var(--fd-warning-soft); }
.fd-lines-table [data-tone="danger"] { --fd-line-tone: var(--fd-error); --fd-tone: var(--fd-error); --fd-tone-soft: var(--fd-error-soft); }
.fd-lines-table [data-tone="muted"] { --fd-line-tone: var(--fd-muted); --fd-tone: var(--fd-muted); --fd-tone-soft: color-mix(in srgb, var(--fd-muted) 14%, transparent); }
.fd-lines-table [data-tone] :is(input, select, textarea, .fd-input, .fd-display) { color: var(--fd-line-tone); -webkit-text-fill-color: var(--fd-line-tone); }
.fd-lines-table :is(.fd-line-bold, .fd-cell-bold) :is(input, select, textarea, .fd-input, .fd-display) { font-weight: 600; }
/* With buttons on some lines, every line's × keeps to the end, so they line up. */
.fd-lines-table:has(.fd-line-button) td.fd-lines-tools { text-align: end; padding-inline-end: 4px; }
/* Lines chosen for the table's buttons: a tick before each line's grip. */
.fd-line-lead { display: inline-flex; align-items: center; gap: 4px; margin-block-start: 6px; }
.fd-line-lead .fd-line-grip { margin-block-start: 0; }
.fd-lines-table th.fd-lines-grip:has(.fd-line-pick-all) { padding-block: 4px; }
/* A line opened in a dialog: its own record's page, or its every field. */
.fd-lines-table .fd-line-open { border: none; background: none; cursor: pointer; color: var(--fd-accent); font-size: 14px; line-height: 1; padding: 4px 6px; border-radius: 4px; }
.fd-lines-table .fd-line-open:hover { background: var(--fd-accent-soft); }
.fd-links-table td { vertical-align: middle; }
.fd-links-table .fd-value-text { padding-block: 4px; }
/* Columns as wide as they hold (fit: content), the widest taking what is left. */
.fd-lines[data-fit="content"] .fd-lines-table { width: auto; max-width: 100%; }
.fd-lines[data-fit="content"] .fd-lines-table td { min-width: 0; }
/* Lines as cards (cards: narrow on a phone, or always): each a box, every cell its column's label above its value. */
.fd-lines[data-cards] { container: fd-lines / inline-size; }
@container fd-lines (max-width: 520px) {
  .fd-lines[data-cards="narrow"] .fd-lines-table, .fd-lines[data-cards="narrow"] .fd-lines-table :is(tbody, tfoot) { display: block; }
  .fd-lines[data-cards="narrow"] .fd-lines-table thead { display: none; }
  .fd-lines[data-cards="narrow"] .fd-lines-table tr { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; position: relative; padding: 10px 12px; margin-block-end: 8px; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); background: var(--fd-surface); }
  .fd-lines[data-cards="narrow"] .fd-lines-table td { display: block; border: none; padding: 0; min-width: 0; }
  .fd-lines[data-cards="narrow"] .fd-lines-table td[data-label]:not([colspan]:not([colspan="1"]))::before { content: attr(data-label); display: block; font-size: 12px; font-weight: 600; color: var(--fd-muted); }
  .fd-lines[data-cards="narrow"] .fd-lines-table td.fd-lines-grip { position: absolute; inset-block-start: 6px; inset-inline-start: 6px; padding: 0; }
  .fd-lines[data-cards="narrow"] .fd-lines-table td.fd-lines-grip .fd-line-grip { display: none; }
  .fd-lines[data-cards="narrow"] .fd-lines-table tr:has(.fd-line-pick) { padding-inline-start: 36px; }
  .fd-lines[data-cards="narrow"] .fd-lines-table td.fd-lines-tools { width: auto; text-align: end; }
  .fd-lines[data-cards="narrow"] .fd-lines-totals td:empty { display: none; }
}
.fd-lines[data-cards="always"] .fd-lines-table, .fd-lines[data-cards="always"] .fd-lines-table :is(tbody, tfoot) { display: block; }
.fd-lines[data-cards="always"] .fd-lines-table thead { display: none; }
.fd-lines[data-cards="always"] .fd-lines-table tr { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px 12px; position: relative; padding: 10px 12px; margin-block-end: 8px; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); background: var(--fd-surface); }
.fd-lines[data-cards="always"] .fd-lines-table td { display: block; border: none; padding: 0; min-width: 0; }
.fd-lines[data-cards="always"] .fd-lines-table td[data-label]:not([colspan]:not([colspan="1"]))::before { content: attr(data-label); display: block; font-size: 12px; font-weight: 600; color: var(--fd-muted); }
.fd-lines[data-cards="always"] .fd-lines-table td.fd-lines-grip, .fd-lines[data-cards="always"] .fd-lines-table td.fd-lines-tools { grid-column: 1 / -1; width: auto; }
.fd-lines[data-cards="always"] .fd-lines-table td.fd-lines-tools { text-align: end; }
/* A section heads the lines below it; a note reads as a remark between them. */
.fd-line-section td { background: var(--fd-page); }
.fd-line-section .fd-input { font-weight: 600; }
.fd-line-note .fd-input { font-style: italic; }
`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installLinesStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-lines-styles', LINES_CSS, PART_RANK.lines);
}
