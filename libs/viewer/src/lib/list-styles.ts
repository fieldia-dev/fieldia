import { fieldiaStyle } from '@fieldia/widgets';
import { LIST_ROW_STYLES } from './list-rows-styles';

/** The list's look, on the same tokens as the forms it opens. */
export const LIST_STYLES = `
.fd-list { display: grid; gap: 10px; min-width: 0; }
.fd-list [hidden] { display: none !important; }
.fd-list-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-height: 34px; }
/* A list that is also a map: List, Map, or both side by side; the map's part is drawn by @fieldia/map. */
.fd-list { container: fd-list / inline-size; }
.fd-list-views { display: inline-flex; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); overflow: hidden; }
.fd-list-views .fd-button { border: 0; border-radius: 0; min-height: 32px; padding-inline: 12px; }
.fd-list-views .fd-button + .fd-button { border-inline-start: 1px solid var(--fd-border); }
.fd-list-views .fd-button[aria-pressed="true"] { background: var(--fd-accent-soft); color: var(--fd-accent); font-weight: 600; }
.fd-list-body { display: grid; gap: 16px; min-width: 0; }
.fd-list-records { display: grid; gap: 10px; min-width: 0; align-content: start; }
.fd-list[data-view="list"] .fd-list-map { display: none; }
.fd-list[data-view="map"] .fd-list-records, .fd-list[data-view="map"] .fd-pager { display: none; }
.fd-list[data-view="both"] .fd-list-body { grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr); align-items: start; }
.fd-list[data-view="both"] .fd-list-map { position: sticky; top: 8px; }
/* Too narrow for two: the map over the table. */
@container fd-list (max-width: 860px) { .fd-list[data-view="both"] .fd-list-body { grid-template-columns: minmax(0, 1fr); } .fd-list[data-view="both"] .fd-list-map { position: static; order: -1; } }
.fd-list-row.fd-list-hot > td { background: var(--fd-accent-soft); }
/* Another view (a calendar, an app's own) shows in place of the table: only the one shown takes room. */
.fd-list-addon { min-width: 0; }
.fd-list-addon:not([data-on]) { display: none; }
.fd-list[data-alone] .fd-list-records, .fd-list[data-alone] .fd-list-bar > .fd-pager { display: none; }
.fd-search { position: relative; flex: 1 1 360px; max-width: 680px; min-width: 0; container: fd-search / inline-size; }
.fd-search-field { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-height: 34px; box-sizing: border-box; padding: 2px 2px 2px 8px; padding-inline: 8px 2px; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); background: var(--fd-surface); }
.fd-search-field:focus-within { border-color: var(--fd-focus); box-shadow: var(--fd-focus-ring); }
.fd-search-field > .fd-icon, .fd-search-field > svg { width: 16px; height: 16px; color: var(--fd-muted); flex: none; }
.fd-facets { display: contents; }
.fd-facet { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; min-width: 0; min-height: 24px; padding-block: 0; padding-inline: 6px 0; border-radius: 3px; background: var(--fd-accent-soft); color: var(--fd-accent); font-size: 13px; line-height: 18px; }
.fd-facet svg { width: 13px; height: 13px; flex: none; }
.fd-facet[data-kind="groupBy"] { background: var(--fd-success-soft); color: var(--fd-success); }
.fd-facet-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 24px each way: a target a finger can hit (WCAG 2.5.8). */
.fd-facet-remove { all: unset; cursor: pointer; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 2px; font-size: 15px; line-height: 1; opacity: 0.7; }
.fd-facet-remove:hover, .fd-facet-remove:focus-visible { opacity: 1; background: var(--fd-surface); }
.fd-search-input { flex: 1 1 140px; min-width: 100px; border: none; outline: none; background: none; font: inherit; font-size: 14px; color: var(--fd-text); padding: 5px 4px; }
.fd-form .fd-search-input:focus-visible { outline: none; }
.fd-search-toggle { all: unset; cursor: pointer; display: grid; place-items: center; width: 30px; height: 28px; border-radius: 3px; color: var(--fd-muted); }
/* Physical sides: a down chevron points down in either direction. */
.fd-search-toggle::before { content: ''; width: 7px; height: 7px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: translateY(-2px) rotate(45deg); }
.fd-search-toggle[aria-expanded="true"]::before { transform: translateY(2px) rotate(-135deg); }
.fd-search-toggle:hover, .fd-search-toggle[aria-expanded="true"] { background: var(--fd-page); color: var(--fd-text); }
.fd-search-toggle:focus-visible { outline: 2px solid var(--fd-focus); }
/* The ✦ beside the box (searchToFilter): its words read as filters by the assist part, which comes as it is pressed. */
.fd-assist-words { flex: none; display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 2px 8px; font-size: 13px; white-space: nowrap; }
.fd-assist-words[hidden] { display: none; }
.fd-assist-mark { color: var(--fd-accent); font-size: 15px; line-height: 1; }
.fd-search-suggestions, .fd-search-panel { position: absolute; z-index: 30; inset-inline: 0; top: calc(100% + 4px); box-sizing: border-box; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14); }
/* Opened over the box where there is not room under it and more over it (room.ts in @fieldia/widgets), scrolling within where it must. */
:is(.fd-search-suggestions, .fd-search-panel)[data-up] { top: auto; bottom: calc(100% + 4px); }
:is(.fd-search-suggestions, .fd-search-panel)[data-cut] { overflow-y: auto; }
.fd-search-suggestions { list-style: none; margin: 0; padding: 4px 0; }
.fd-search-suggestions [role="option"] { padding: 7px 12px; cursor: pointer; font-size: 14px; }
.fd-search-suggestions [role="option"][aria-selected="true"] { background: var(--fd-accent-soft); }
.fd-search-panel { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); padding-block: 6px; }
.fd-search-group { display: flex; flex-direction: column; align-items: stretch; gap: 1px; padding: 4px 10px 8px; min-width: 0; }
.fd-search-group + .fd-search-group { border-inline-start: 1px solid var(--fd-border); }
@container fd-search (max-width: 540px) {
  .fd-search-panel { grid-auto-flow: row; }
  .fd-search-group + .fd-search-group { border-inline-start: none; border-block-start: 1px solid var(--fd-border); padding-block-start: 8px; }
}
.fd-search-heading { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13.5px; padding: 4px 6px 6px; }
.fd-search-heading svg { width: 15px; height: 15px; }
.fd-search-group[data-group-kind="filters"] .fd-search-heading svg { color: var(--fd-accent); }
.fd-search-group[data-group-kind="groupBy"] .fd-search-heading svg { color: var(--fd-success); }
.fd-search-group[data-group-kind="favourites"] .fd-search-heading svg { color: var(--fd-warning); }
.fd-search-option { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 5px 6px; border-radius: 4px; font-size: 14px; color: var(--fd-text); }
.fd-search-option::before { content: ''; width: 14px; flex: none; text-align: center; color: var(--fd-accent); font-weight: 700; }
.fd-search-option[aria-pressed="true"]::before { content: '✓'; }
.fd-search-option:hover, .fd-search-option:focus-visible { background: var(--fd-page); }
/* Between two groups of named filters (ListFilter.group): a line, as Odoo's separator. */
.fd-search-separator { border-block-start: 1px solid var(--fd-border); margin: 4px 6px; }
/* How many records a filter finds (filterCounts) — a named filter, a favourite, a filter bar's value: at its end, quieter
   than its words, its digits lined up — "Late 5". */
.fd-search-count { display: contents; }
.fd-filter-count { margin-inline-start: auto; padding-inline-start: 12px; color: var(--fd-muted); font-size: 12.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
/* A range's From and To (filter-range.ts), a custom filter's "is between" and a filter bar's: side by side, what is wrong said under them. */
.fd-filter-range-boxes { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 4px 8px; }
.fd-filter-range-end { display: grid; gap: 4px; min-width: 0; }
.fd-filter-range-word { font-size: 12px; color: var(--fd-muted); }
.fd-filter-range-box { width: 100%; min-width: 0; box-sizing: border-box; }
.fd-filter-range-boxes > .fd-refusal-hint { grid-column: 1 / -1; }
.fd-search-add { color: var(--fd-muted); margin-block-start: 4px; }
.fd-search-add::before { content: '+'; color: var(--fd-muted); font-weight: 400; }
.fd-custom-filter, .fd-favourite-form { display: grid; gap: 6px; padding: 6px; }
.fd-custom-filter .fd-input, .fd-favourite-form .fd-input { width: 100%; box-sizing: border-box; min-height: 30px; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); padding: 3px 6px; font: inherit; font-size: 13.5px; background: var(--fd-surface); color: var(--fd-text); }
.fd-favourite-default { display: flex; align-items: center; gap: 6px; font-size: 13.5px; }
.fd-favourite-list { list-style: none; margin: 0; padding: 0; }
.fd-favourite { display: flex; align-items: center; }
.fd-favourite .fd-search-option { flex: 1; min-width: 0; }
.fd-favourite .fd-search-option[data-default="true"]::before { content: '★'; color: var(--fd-warning); }
.fd-favourite-remove { all: unset; cursor: pointer; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 4px; color: var(--fd-muted); }
.fd-favourite-remove:hover { background: var(--fd-page); color: var(--fd-error); }
.fd-favourites-none { margin: 0; padding: 4px 6px; color: var(--fd-muted); font-size: 13px; }
.fd-list-selection { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 3px 4px 3px 10px; border-radius: var(--fd-control-radius); background: var(--fd-accent-soft); }
.fd-list-count { font-weight: 600; font-size: 13.5px; color: var(--fd-accent); font-variant-numeric: tabular-nums; }
/* Every record that matches, a press away; then Edit, the app's buttons and Clear. */
.fd-list-every { font-weight: 600; }
/* Export and the list's views at the bar's end, before its pager; how far a long task has got, before them. */
.fd-list-export { margin-inline-start: auto; }
/* Import beside Export, at the bar's end, before the pager. */
.fd-list-import-button { margin-inline-start: auto; }
.fd-list-import-button:not([hidden]) + .fd-list-export, .fd-list-progress:not(:empty) + .fd-list-import-button { margin-inline-start: 0; }
.fd-list-import-button:not([hidden]) ~ .fd-pager { margin-inline-start: 0; }
.fd-list-import-button svg { width: 16px; height: 16px; flex: none; }
.fd-list-export:not([hidden]) ~ .fd-pager { margin-inline-start: 0; }
.fd-list-export svg { width: 16px; height: 16px; flex: none; }
.fd-list-export-what { text-transform: none; letter-spacing: 0; font-size: 12.5px; }
.fd-list-progress { color: var(--fd-muted); font-size: 13.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fd-list-progress:empty { display: none; }
.fd-list-progress:not(:empty) { margin-inline-start: auto; }
.fd-list-progress:not(:empty) + .fd-list-export { margin-inline-start: 0; }
/* Print beside Export, or at the bar's end in its place. */
.fd-list-print-button svg { width: 16px; height: 16px; flex: none; }
.fd-list-export[hidden] + .fd-list-print-button { margin-inline-start: auto; }
.fd-list-progress:not(:empty) + .fd-list-export[hidden] + .fd-list-print-button { margin-inline-start: 0; }
.fd-list-print-button:not([hidden]) ~ .fd-pager { margin-inline-start: 0; }
/* What an Edit could not change, and why: under the bar until it is dismissed. */
.fd-list-report { display: grid; gap: 4px; justify-items: start; padding: 8px 12px; border: 1px solid var(--fd-warning); border-radius: var(--fd-control-radius); background: var(--fd-warning-soft); color: var(--fd-text); font-size: 13.5px; }
.fd-list-report-words { margin: 0; font-weight: 600; }
.fd-list-report-list { margin: 0; padding-inline-start: 18px; max-height: 168px; overflow: auto; justify-self: stretch; }
/* An import's end: the file to fix its rows in, Undo, and Dismiss. */
.fd-list-report-tools { display: flex; flex-wrap: wrap; gap: 2px 14px; }
.fd-pager { display: flex; align-items: center; gap: 4px; margin-inline-start: auto; }
/* "1–24 of 60 customers" reads the way its words are written: left in English on a page right to left, never "of 60
   customers 24–1" (styles.ts: a page's words, one rule). */
.fd-pager-text { color: var(--fd-muted); font-size: 13.5px; font-variant-numeric: tabular-nums; margin-inline-end: 6px; white-space: nowrap; unicode-bidi: plaintext; }
.fd-pager-button { min-width: 32px; padding-inline: 0; font-size: 18px; line-height: 1; }
.fd-list-scroll { overflow-x: auto; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); }
.fd-list-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.fd-list-table th { text-align: start; font-weight: 600; color: var(--fd-text); padding: 8px 10px; border-block-end: 1px solid var(--fd-border-strong); white-space: nowrap; background: var(--fd-surface); }
/* The header's words smaller than the rows', its cell the rows' size: a column's width in characters is the same in both. */
.fd-list-head { font-size: 13px; }
.fd-list-table td { padding: 7px 10px; border-block-end: 1px solid var(--fd-border); max-width: 28em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-list-table tbody tr:last-child td { border-block-end: none; }
/* Where rows past the view are left out of the page (list-window.ts), a gap as tall as they are: no line, no padding. */
.fd-list-table .fd-list-gap > td { padding: 0; border: 0; background: none; }
/* Said under the search as Ctrl or ⌘ and F take the person there from a long list. */
.fd-list-find { margin: 4px 0 0; font-size: 13px; color: var(--fd-muted); }
.fd-list-table .fd-num { text-align: end; font-variant-numeric: tabular-nums; }
.fd-list-table th.fd-list-check, .fd-list-table td.fd-list-check { width: 36px; padding-inline: 10px 0; }
.fd-list-checkbox { vertical-align: middle; }
.fd-list-sort { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: flex; align-items: center; gap: 4px; font: inherit; color: inherit; }
.fd-list-sort::after { content: ''; width: 0; height: 0; border-inline: 4px solid transparent; opacity: 0; }
.fd-list-sort:hover::after { opacity: 0.35; border-block-start: 5px solid currentColor; }
.fd-list-table th:is([aria-sort="ascending"], [data-sort="ascending"]) .fd-list-sort::after { opacity: 1; border-block-start: none; border-block-end: 5px solid currentColor; }
.fd-list-table th:is([aria-sort="descending"], [data-sort="descending"]) .fd-list-sort::after { opacity: 1; border-block-end: none; border-block-start: 5px solid currentColor; }
.fd-list-table th.fd-num .fd-list-sort { justify-content: flex-end; }
.fd-list-table th.fd-num .fd-list-sort::after { order: -1; }
/* Ordered by several headers: each key's place beside its arrow, after it (before it on a number's, whose arrow leads). */
.fd-list-sort-rank { order: 1; flex: none; box-sizing: border-box; min-width: 16px; height: 16px; padding-inline: 4px; border-radius: 999px; background: var(--fd-accent-soft); color: var(--fd-accent); font-size: 11px; font-weight: 600; line-height: 16px; text-align: center; font-variant-numeric: tabular-nums; }
.fd-list-table th.fd-num .fd-list-sort-rank { order: -2; }
.fd-list-sort:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-list-row:hover td { background: var(--fd-page); }
.fd-list-openable { cursor: pointer; }
.fd-list-row[aria-selected="true"] td { background: var(--fd-accent-soft); }
.fd-list-row:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
/* Waiting (loading.ts): its rows' skeleton in its own columns, a bar each where its cells will be; Loading more… in the place of Show more. */
.fd-list-table .fd-sk-row > td { padding-block: 12px; }
.fd-list-table .fd-sk-row .fd-sk { margin: 0; max-inline-size: 220px; }
.fd-list-more-rows[data-fd-wait] > .fd-button, .fd-list-tree-more[data-fd-wait] .fd-button { display: none; }
.fd-list-group td { padding: 0; background: var(--fd-page); }
.fd-group-toggle { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; padding-inline-start: calc(12px + var(--fd-level, 0) * 22px); font-weight: 600; font-size: 13.5px; color: var(--fd-text); }
.fd-group-toggle::before { content: ''; flex: none; width: 6px; height: 6px; border-top: 1.5px solid currentColor; border-right: 1.5px solid currentColor; transform: rotate(45deg); transition: transform 0.12s; }
.fd-group-toggle:dir(rtl)::before { transform: rotate(-135deg); }
.fd-group-toggle[aria-expanded="true"]::before { transform: rotate(135deg); }
.fd-group-toggle:hover { background: var(--fd-accent-soft); }
.fd-group-toggle:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-group-count { color: var(--fd-muted); font-weight: 400; font-variant-numeric: tabular-nums; }
/* A heading's sums after its count: "Cairo (12) · EGP 4.3M". */
.fd-group-sums { color: var(--fd-text); font-weight: 400; font-variant-numeric: tabular-nums; }
/* The totals under the list: the ticked rows', then every record's, set apart by a firmer rule. */
.fd-list-totals td, .fd-list-totals th { padding: 7px 10px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; background: var(--fd-surface); border-block-end: 0; }
.fd-list-totals tr:first-child:not([hidden]) > *, .fd-list-totals tr[hidden] + tr > * { border-block-start: 1px solid var(--fd-border-strong); }
.fd-list-totals tr[data-total="ticked"] > * { background: var(--fd-accent-soft); color: var(--fd-accent); border-block-end: 1px solid var(--fd-border); }
.fd-list-totals th { text-align: start; }
.fd-list-total-kind { color: var(--fd-muted); font-weight: 400; font-size: 12.5px; }
/* No honest total over several currencies, said in the cell where the total would stand: quieter than a total. */
.fd-list-total-mixed { color: var(--fd-muted); font-weight: 400; font-size: 12.5px; }
/* A date grouped by a span: its name, then its Year, Quarter, Month, Week and Day under it, each its own toggle. */
.fd-search-spans { display: grid; gap: 1px; }
.fd-search-spans-name { padding: 5px 6px; padding-inline-start: 26px; font-size: 14px; color: var(--fd-text); }
.fd-search-spans-list { display: grid; gap: 1px; padding-inline-start: 14px; }
.fd-list-more td { padding: 4px 10px; padding-inline-start: calc(46px + var(--fd-level, 0) * 22px); }
/* Rows loaded as the list is scrolled (endless): Show more at their end, pressed by itself in sight. */
.fd-list-more-rows { display: flex; justify-content: center; padding: 10px 0 2px; }
.fd-list-more-rows[hidden] { display: none; }
.fd-list-empty, .fd-list-failed { margin: 0; padding: 28px 12px; text-align: center; color: var(--fd-muted); }
.fd-list-failed { color: var(--fd-error); }

/* A column of a given width (cells), in characters of the rows' words: what does not fit ends in "…". */
.fd-list-table [data-width] { box-sizing: content-box; width: calc(var(--fd-col-width) * 1ch); max-width: calc(var(--fd-col-width) * 1ch); overflow: hidden; text-overflow: ellipsis; }
.fd-list-table th[data-width] .fd-list-sort { min-width: 0; }
.fd-list-table th[data-width] .fd-list-head { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
/* A column in pixels: the whole column, its paddings in it, as a work tracker sizes its grid's. */
.fd-list-table [data-width-px] { box-sizing: border-box; width: var(--fd-col-px); min-width: var(--fd-col-px); max-width: var(--fd-col-px); overflow: hidden; text-overflow: ellipsis; }
.fd-list-table th[data-width-px] .fd-list-sort { min-width: 0; }
.fd-list-table th[data-width-px] .fd-list-head { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
/* Every column sized: the table as wide as they are, never stretched; wider than its card, the card scrolls sideways. */
.fd-list-table[data-fixed] { width: max-content; }
/* The row whose record is open (in a popup over the list): lit as a chosen one is, until it closes. */
.fd-list-row[aria-current="true"] td { background: var(--fd-accent-soft); }
/* What a cell draws before its words: a kind's icon in its colour, a state's dot. */
.fd-list-lead { width: 14px; height: 14px; margin-inline-end: 6px; vertical-align: -2px; flex: none; stroke-width: 2.2; }
.fd-list-dot { display: inline-block; width: 8px; height: 8px; margin-inline-end: 6px; border-radius: 50%; vertical-align: 1px; background: var(--fd-dot, var(--fd-border-strong)); }
.fd-list-dot[data-tone="muted"] { --fd-dot: var(--fd-border-strong); }
.fd-list-dot[data-tone="danger"] { --fd-dot: var(--fd-error); }
.fd-list-dot[data-tone="success"] { --fd-dot: var(--fd-success); }
.fd-list-dot[data-tone="warning"] { --fd-dot: #d97706; }
.fd-list-dot[data-tone="info"] { --fd-dot: var(--fd-info); }
@media (forced-colors: active) { .fd-list-dot { background: CanvasText; } }
/* Rows under their parent: Expand all and Collapse all in the header, a toggle before a parent's name, each depth further in. */
.fd-list-table .fd-list-tree { width: 1%; padding-inline: 10px 4px; white-space: nowrap; }
.fd-list-folds { display: inline-flex; gap: 6px; vertical-align: middle; }
.fd-list-fold { all: unset; box-sizing: border-box; cursor: pointer; display: grid; place-items: center; width: 24px; height: 24px; border: 1px solid var(--fd-text); border-radius: 2px; color: var(--fd-text); font-size: 18px; font-weight: 400; line-height: 1; }
.fd-list-fold:hover { background: var(--fd-page); }
.fd-list-fold:focus-visible, .fd-list-twisty:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-list-row[data-depth] > td[data-name] { padding-inline-start: calc(10px + var(--fd-depth, 0) * 20px); }
.fd-list-twisty, .fd-list-twisty-room { display: inline-block; width: 20px; height: 20px; margin-inline-end: 2px; vertical-align: middle; }
.fd-list-twisty { all: unset; display: inline-grid; place-items: center; width: 20px; height: 20px; margin-inline-end: 2px; vertical-align: middle; cursor: pointer; border-radius: 2px; color: var(--fd-muted); }
.fd-list-twisty::before { content: ''; width: 6px; height: 6px; border-top: 1.5px solid currentColor; border-right: 1.5px solid currentColor; transform: rotate(45deg); transition: transform 0.12s; }
.fd-list-twisty:dir(rtl)::before { transform: rotate(-135deg); }
.fd-list-twisty[aria-expanded="true"]::before { transform: rotate(135deg); }
.fd-list-twisty:hover { background: var(--fd-page); color: var(--fd-text); }

/* A related list inside a record: its title, count, View all and New over the table; what it says before a first save. */
.fd-related { display: grid; gap: 8px; min-width: 0; }
.fd-related [hidden] { display: none !important; }
.fd-related-head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; min-height: 32px; }
.fd-related-title { display: inline-flex; align-items: center; gap: 8px; min-width: 0; font-weight: 600; font-size: 15px; color: var(--fd-text); }
.fd-related-title svg { width: 16px; height: 16px; flex: none; color: var(--fd-muted); }
.fd-related-count { min-width: 20px; padding: 1px 7px; box-sizing: border-box; border-radius: 999px; background: var(--fd-page); border: 1px solid var(--fd-border); color: var(--fd-muted); font-size: 12.5px; font-weight: 600; line-height: 18px; text-align: center; font-variant-numeric: tabular-nums; }
.fd-related-tools { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-inline-start: auto; }
.fd-related-note { margin: 0; padding: 14px 12px; border: 1px dashed var(--fd-border); border-radius: var(--fd-radius); color: var(--fd-muted); text-align: center; font-size: 14px; }
.fd-related-list { min-width: 0; }
.fd-list[data-in-record] .fd-list-empty { padding-block: 16px; }
/* A list with the filter bar: its card above the table's, the pager under the table. */
.fd-list[data-search="fields"] .fd-list-bar { gap: 16px; }
.fd-list[data-search="fields"] .fd-list-records > .fd-pager { justify-self: end; }
/* How many records its filters leave, in the filter bar's row after the keyword, as the pager's words are where it stands. */
.fd-list-found { color: var(--fd-muted); font-size: 13.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fd-list-bar > .fd-list-found { margin-inline-start: auto; }
/* Fluent's lists, as a work tracker draws its backlog: the table a card with a light shadow and no frame; the header's words
   small, semibold and muted, the columns parted by short rules; rows 35px tall with no lines between them. */
/* Its header 38px and its rule, 39px in all whether a column's width is in pixels (its whole box) or characters. */
.fd-form[data-fd-theme="fluent"] .fd-list-table th { position: relative; box-sizing: border-box; height: 39px; padding-block: 0; color: var(--fd-muted); border-block-end: 1px solid var(--fd-border); }
.fd-form[data-fd-theme="fluent"] .fd-list-head { font-size: 12px; font-weight: 600; }
.fd-form[data-fd-theme="fluent"] .fd-list-table thead th:not(:first-child)::after { content: ''; position: absolute; inset-inline-end: var(--fd-rule-in, 0px); inset-block: 10px; width: 1px; background: var(--fd-border); }
.fd-form[data-fd-theme="fluent"] .fd-list-table thead th.fd-list-tree::after, .fd-form[data-fd-theme="fluent"] .fd-list-table thead th.fd-list-check::after { content: none; }
/* A column the page says has no rule (a tracker's Order, which the person cannot size). */
.fd-form[data-fd-theme="fluent"] .fd-list-table thead th[data-rule="none"]::after { content: none; }
/* Rows 36px apart (measured on the tracker's backlog: 17 rows from y 280 to 892); a cell's words 3px in from its column's
   start, its header's 7px, so a header stands a little in from the words under it. */
.fd-form[data-fd-theme="fluent"] .fd-list-table td { height: 36px; padding-block: 0; padding-inline: 3px 8px; border-block-end: 0; }
.fd-form[data-fd-theme="fluent"] .fd-list-table th { padding-inline: 7px 8px; }
.fd-form[data-fd-theme="fluent"] .fd-list-row:hover td { background: var(--fd-fill, var(--fd-page)); }
.fd-form[data-fd-theme="fluent"] .fd-list-row[aria-current="true"] td { background: var(--fd-accent-soft); }
/* Expand all and Collapse all 15px in, 25px by 22px and 4px apart, 7px before the next column; a parent's toggle, or room
   the size of one, 24px and 5px before the name, and the name's header over the name. */
.fd-form[data-fd-theme="fluent"] .fd-list-table .fd-list-tree { padding-inline: 15px 7px; }
.fd-form[data-fd-theme="fluent"] .fd-list-folds { gap: 4px; }
.fd-form[data-fd-theme="fluent"] .fd-list-fold { width: 25px; height: 22px; }
.fd-form[data-fd-theme="fluent"] .fd-list-row[data-depth] > td[data-name] { padding-inline-start: calc(3px + var(--fd-depth, 0) * 20px); }
/* The kind's icon 30px into the name's column, its words 4px after it, the header's word over the icon (08_18: the bug's
   ink at 495, its title's words at 512, "Title" at 494). */
.fd-form[data-fd-theme="fluent"] :is(.fd-list-twisty, .fd-list-twisty-room) { width: 24px; margin-inline-end: 3px; }
.fd-form[data-fd-theme="fluent"] .fd-list-table th[data-name] { padding-inline-start: 30px; }
.fd-form[data-fd-theme="fluent"] .fd-list-lead { margin-inline-end: 4px; }
/* The grid runs 9px on past its last column's rule, as the tracker's does (08_18: its white to 2011, the rule at 2002). */
.fd-form[data-fd-theme="fluent"] .fd-list-scroll:has(> .fd-list-table[data-fixed]) { padding-inline-end: 9px; }
/* Its card's scroll bar as the tracker's, on every system that lets a page draw one: 15px, a light track with a hairline
   at its inner edge, a rounded thumb in it, no arrows. Each selector written out: Chrome drops a part's :horizontal under
   an :is(), and a part paints no logical border. */
.fd-form[data-fd-theme="fluent"] .fd-list-scroll::-webkit-scrollbar { width: 15px; height: 15px; }
.fd-form[data-fd-theme="fluent"] .fd-list-scroll::-webkit-scrollbar-track,
.fd-form[data-fd-theme="fluent"] .fd-list-scroll::-webkit-scrollbar-corner { background: color-mix(in srgb, var(--fd-text) 2.2%, var(--fd-surface)); }
.fd-form[data-fd-theme="fluent"] .fd-list-scroll::-webkit-scrollbar-track:horizontal {
  border-top: 1px solid color-mix(in srgb, var(--fd-text) 10%, var(--fd-surface)); border-bottom: 1px solid color-mix(in srgb, var(--fd-text) 7.5%, var(--fd-surface));
}
.fd-form[data-fd-theme="fluent"] .fd-list-scroll::-webkit-scrollbar-track:vertical {
  border-left: 1px solid color-mix(in srgb, var(--fd-text) 10%, var(--fd-surface)); border-right: 1px solid color-mix(in srgb, var(--fd-text) 7.5%, var(--fd-surface));
}
.fd-form[data-fd-theme="fluent"] .fd-list-scroll::-webkit-scrollbar-thumb {
  border: solid transparent; border-width: 4px 3px 3px; border-radius: 8px; background: color-mix(in srgb, var(--fd-text) 24.5%, var(--fd-surface)) padding-box;
}
.fd-form[data-fd-theme="fluent"] .fd-list-scroll::-webkit-scrollbar-thumb:vertical { border-width: 3px 3px 3px 4px; }
.fd-form[data-fd-theme="fluent"] .fd-list-scroll::-webkit-scrollbar-thumb:hover { background-color: color-mix(in srgb, var(--fd-text) 40%, var(--fd-surface)); }
.fd-form[data-fd-theme="fluent"] .fd-list-scroll::-webkit-scrollbar-button { display: none; }
/* ---- on paper --------------------------------------------------------------------------------------------------
   Ctrl+P on a list: its rows as they stand, without its tools (a related list's saying how many of how many). Its
   Print: every record that matches in a sheet of its own (list-print.ts), in the list's place, the list left out. */
.fd-print-sheet, .fd-list-shown { display: none; }
@media print {
  /* A related list's head as its title alone: no room kept for its buttons, and none at all where it has no title (a
     list in a tab of its own, which the tab's name heads), never an empty band over its rows. */
  .fd-form .fd-related-head { min-height: 0; }
  .fd-form .fd-related-head:not(:has(> .fd-related-title)) { display: none !important; }
  /* A related list's rows as shown, and how many of how many where they run past a page. */
  .fd-form .fd-list-shown:not([hidden]) { display: block; margin: 4px 0 0; font-size: 12px; color: var(--fd-muted); }
  /* Its tools, and the column after the fields — each row's buttons and the Columns menu's cell — with them. */
  .fd-form .fd-list-bar, .fd-form .fd-list-selection, .fd-form .fd-list-report, .fd-form .fd-list-check, .fd-form .fd-list-tree, .fd-form .fd-list-twisty, .fd-form .fd-pager, .fd-form .fd-list-tail { display: none !important; }
  /* The view a list shows prints — its table, its gallery, its calendar, its map, its timeline, or its table and its map
     side by side — and the others stay off paper, as they are off the screen (a view not shown is display: none). */
  .fd-form .fd-list-scroll { overflow: visible !important; }
  .fd-form .fd-list-table { width: 100%; }
  .fd-form .fd-list-table :is(td, th) { white-space: normal; overflow-wrap: break-word; }
  /* A number, an amount, a day or a phone number on one line: never "+20 12 0528" over "2720". */
  .fd-form .fd-list-table td.fd-whole, .fd-print-sheet .fd-print-table td.fd-whole { white-space: nowrap; }
  .fd-form .fd-list > .fd-print-sheet { display: block; }
  .fd-print-about { display: grid; gap: 2px; margin-block-end: 12px; font-size: 12px; color: var(--fd-muted); }
  .fd-print-sheet .fd-print-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .fd-print-sheet .fd-print-table :is(th, td) { padding: 4px 6px; text-align: start; vertical-align: top; border-block-end: 1px solid var(--fd-border); overflow-wrap: break-word; }
  .fd-print-sheet .fd-print-table th { font-weight: 600; border-block-end-color: var(--fd-border-strong); }
  .fd-print-sheet .fd-print-table .fd-num { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .fd-print-sheet .fd-print-table tr > :first-child { padding-inline-start: calc(6px + var(--fd-level, 0) * 14px); }
  .fd-print-sheet .fd-print-group > td { padding-block-start: 10px; font-weight: 600; color: var(--fd-accent); border-block-end-color: var(--fd-border-strong); break-after: avoid; }
  /* Its footer at the foot of every sheet where an engine keeps room on each — the printout padded at each sheet's foot,
     its padding cloned there — as Chromium's and Firefox's do, a fixed footer repeated on every sheet over that room.
     Elsewhere, or where its room was never measured, once after the rows. (A record's is printed once, after it.) */
  @supports (box-decoration-break: clone) {
    .fd-print-sheet[data-print-room] { padding-block-end: var(--fd-print-room) !important; box-decoration-break: clone; }
    .fd-print-sheet[data-print-room] > .fd-print-foot { position: fixed; inset-block-end: 0; inset-inline: 0; margin: 0; background: #fff; }
  }
  /* The totals once, under the last row: not again at each sheet's foot, where they would read as that sheet's. */
  .fd-print-sheet .fd-print-table tfoot { display: table-row-group; }
  .fd-print-sheet .fd-print-table tfoot td { font-weight: 600; border-block: 2px solid var(--fd-border-strong) 0; }
}
`;

/** Puts the list's look in the document once: its table's, then its richer rows' (list-rows-styles.ts). */
export function installListStyles(doc: Document): void {
  if (doc.getElementById('fd-list-styles')) return;
  const style = fieldiaStyle(doc, LIST_STYLES + LIST_ROW_STYLES, 'fd-list-styles');
  doc.head.append(style);
}
