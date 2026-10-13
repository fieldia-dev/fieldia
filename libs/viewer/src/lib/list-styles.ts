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
.fd-search-suggestions, .fd-search-panel { position: absolute; z-index: 30; inset-inline: 0; top: calc(100% + 4px); box-sizing: border-box; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14); }
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
.fd-pager { display: flex; align-items: center; gap: 4px; margin-inline-start: auto; }
.fd-pager-text { color: var(--fd-muted); font-size: 13.5px; font-variant-numeric: tabular-nums; margin-inline-end: 6px; white-space: nowrap; }
.fd-pager-button { min-width: 32px; padding-inline: 0; font-size: 18px; line-height: 1; }
.fd-list-scroll { overflow-x: auto; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); }
.fd-list-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.fd-list-table th { text-align: start; font-weight: 600; color: var(--fd-text); padding: 8px 10px; border-block-end: 1px solid var(--fd-border-strong); white-space: nowrap; background: var(--fd-surface); }
/* The header's words smaller than the rows', its cell the rows' size: a column's width in characters is the same in both. */
.fd-list-head { font-size: 13px; }
.fd-list-table td { padding: 7px 10px; border-block-end: 1px solid var(--fd-border); max-width: 28em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-list-table tbody tr:last-child td { border-block-end: none; }
.fd-list-table .fd-num { text-align: end; font-variant-numeric: tabular-nums; }
.fd-list-table th.fd-list-check, .fd-list-table td.fd-list-check { width: 36px; padding-inline: 10px 0; }
.fd-list-checkbox { width: 16px; height: 16px; margin: 0; vertical-align: middle; accent-color: var(--fd-accent); cursor: pointer; }
.fd-list-sort { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: flex; align-items: center; gap: 4px; font: inherit; color: inherit; }
.fd-list-sort::after { content: ''; width: 0; height: 0; border-inline: 4px solid transparent; opacity: 0; }
.fd-list-sort:hover::after { opacity: 0.35; border-block-start: 5px solid currentColor; }
.fd-list-table th[aria-sort="ascending"] .fd-list-sort::after { opacity: 1; border-block-start: none; border-block-end: 5px solid currentColor; }
.fd-list-table th[aria-sort="descending"] .fd-list-sort::after { opacity: 1; border-block-end: none; border-block-start: 5px solid currentColor; }
.fd-list-table th.fd-num .fd-list-sort { justify-content: flex-end; }
.fd-list-table th.fd-num .fd-list-sort::after { order: -1; }
.fd-list-sort:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-list-row:hover td { background: var(--fd-page); }
.fd-list-openable { cursor: pointer; }
.fd-list-row[aria-selected="true"] td { background: var(--fd-accent-soft); }
.fd-list-row:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-list-table[aria-busy="true"] tbody { opacity: 0.6; transition: opacity 0.2s 0.15s; }
.fd-list-group td { padding: 0; background: var(--fd-page); }
.fd-group-toggle { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; padding-inline-start: calc(12px + var(--fd-level, 0) * 22px); font-weight: 600; font-size: 13.5px; color: var(--fd-text); }
.fd-group-toggle::before { content: ''; flex: none; width: 6px; height: 6px; border-top: 1.5px solid currentColor; border-right: 1.5px solid currentColor; transform: rotate(45deg); transition: transform 0.12s; }
.fd-group-toggle:dir(rtl)::before { transform: rotate(-135deg); }
.fd-group-toggle[aria-expanded="true"]::before { transform: rotate(135deg); }
.fd-group-toggle:hover { background: var(--fd-accent-soft); }
.fd-group-toggle:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-group-count { color: var(--fd-muted); font-weight: 400; font-variant-numeric: tabular-nums; }
.fd-list-more td { padding: 4px 10px; padding-inline-start: calc(46px + var(--fd-level, 0) * 22px); }
.fd-list-empty, .fd-list-failed { margin: 0; padding: 28px 12px; text-align: center; color: var(--fd-muted); }
.fd-list-failed { color: var(--fd-error); }

/* A column of a given width (cells), in characters of the rows' words: what does not fit ends in "…". */
.fd-list-table [data-width] { box-sizing: content-box; width: calc(var(--fd-col-width) * 1ch); max-width: calc(var(--fd-col-width) * 1ch); overflow: hidden; text-overflow: ellipsis; }
.fd-list-table th[data-width] .fd-list-sort { min-width: 0; }
.fd-list-table th[data-width] .fd-list-head { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
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

/* The filter bar (search "fields"): a card with a keyword box at its start, each field's list of values at its end, then the gear and ×. */
.fd-filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; flex: 1 1 100%; min-width: 0; min-height: 45px; box-sizing: border-box; padding: 6px 8px 6px 16px; padding-inline: 16px 8px; background: var(--fd-surface); border-radius: var(--fd-radius); box-shadow: 0 3.2px 7.2px rgba(0, 0, 0, 0.132), 0 0.6px 1.8px rgba(0, 0, 0, 0.108); }
.fd-filter-search { flex: 1 1 200px; min-width: 0; display: flex; align-items: center; gap: 8px; color: var(--fd-muted); }
.fd-filter-icon { width: 16px; height: 16px; flex: none; }
.fd-filter-keyword { flex: 1; min-width: 0; border: 0; outline: none; background: none; font: inherit; font-size: 14px; color: var(--fd-text); padding: 6px 0; }
.fd-filter-keyword::placeholder { color: var(--fd-muted); opacity: 1; }
.fd-filter-keyword::-webkit-search-cancel-button { display: none; }
.fd-filter-search:focus-within { box-shadow: inset 0 -2px 0 var(--fd-focus); }
.fd-filter-fields { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-inline-start: auto; }
.fd-filter-field { position: relative; display: inline-flex; }
.fd-filter-pick { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; max-width: 220px; min-height: 32px; padding-inline: 8px; border-radius: 2px; font-size: 14px; color: var(--fd-muted); }
.fd-filter-pick[data-picked] { color: var(--fd-text); font-weight: 600; }
.fd-filter-words { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-filter-chevron { width: 16px; height: 16px; flex: none; color: var(--fd-muted); }
.fd-filter-tool { all: unset; box-sizing: border-box; cursor: pointer; display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 2px; color: var(--fd-muted); }
.fd-filter-clear { color: var(--fd-text); }
.fd-filter-tool svg { width: 16px; height: 16px; }
.fd-filter-pick:hover, .fd-filter-tool:hover, .fd-filter-pick[aria-expanded="true"], .fd-filter-tool[aria-expanded="true"] { background: var(--fd-page); }
.fd-filter-pick:focus-visible, .fd-filter-tool:focus-visible { outline: 1px solid var(--fd-focus); outline-offset: -1px; }
.fd-filter-menu { position: absolute; z-index: 30; inset-inline-end: 0; top: calc(100% + 4px); box-sizing: border-box; min-width: 200px; max-width: min(320px, 90vw); max-height: 320px; overflow: auto; padding-block: 4px; background: var(--fd-surface); border-radius: 4px; box-shadow: 0 3.2px 7.2px rgba(0, 0, 0, 0.132), 0 0.6px 1.8px rgba(0, 0, 0, 0.108); }
.fd-filter-option { display: flex; align-items: center; gap: 10px; min-height: 32px; padding-inline: 12px; cursor: pointer; font-size: 14px; color: var(--fd-text); outline: none; }
.fd-filter-option:hover { background: var(--fd-page); }
.fd-filter-option:focus-visible, .fd-filter-option:focus { background: var(--fd-page); box-shadow: inset 0 0 0 1px var(--fd-focus); }
.fd-filter-box { display: grid; place-items: center; width: 16px; height: 16px; flex: none; box-sizing: border-box; border: 1px solid var(--fd-border-strong); border-radius: 2px; color: transparent; }
.fd-filter-box svg { width: 12px; height: 12px; }
.fd-filter-option[aria-checked="true"] .fd-filter-box { background: var(--fd-accent); border-color: var(--fd-accent); color: var(--fd-accent-text, #fff); }
.fd-filter-option-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* A list with the filter bar: its card above the table's, the pager under the table. */
.fd-list[data-search="fields"] .fd-list-bar { gap: 16px; }
.fd-list[data-search="fields"] .fd-list-records > .fd-pager { justify-self: end; }
/* Fluent's lists, as a work tracker draws its backlog: the table a card with a light shadow and no frame; the header's words
   small, semibold and muted, the columns parted by short rules; rows 35px tall with no lines between them. */
.fd-form[data-fd-theme="fluent"] .fd-list-scroll { border: 0; border-radius: 4px; box-shadow: 0 1.6px 3.6px rgba(0, 0, 0, 0.132), 0 0.3px 0.9px rgba(0, 0, 0, 0.108); }
.fd-form[data-fd-theme="fluent"] .fd-list-table th { position: relative; height: 40px; padding-block: 0; color: var(--fd-muted); border-block-end: 1px solid var(--fd-border); }
.fd-form[data-fd-theme="fluent"] .fd-list-head { font-size: 12px; font-weight: 600; }
.fd-form[data-fd-theme="fluent"] .fd-list-table thead th:not(:first-child)::after { content: ''; position: absolute; inset-inline-end: 0; inset-block: 10px; width: 1px; background: var(--fd-border); }
.fd-form[data-fd-theme="fluent"] .fd-list-table thead th.fd-list-tree::after, .fd-form[data-fd-theme="fluent"] .fd-list-table thead th.fd-list-check::after { content: none; }
.fd-form[data-fd-theme="fluent"] .fd-list-table td { height: 35px; padding-block: 0; border-block-end: 0; }
.fd-form[data-fd-theme="fluent"] .fd-list-row:hover td { background: var(--fd-fill, var(--fd-page)); }
`;

/** Puts the list's look in the document once. */
export function installListStyles(doc: Document): void {
  if (doc.getElementById('fd-list-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fd-list-styles';
  style.textContent = LIST_STYLES;
  doc.head.append(style);
}
