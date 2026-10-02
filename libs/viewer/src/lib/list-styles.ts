/** The list's look, on the same tokens as the forms it opens. */
export const LIST_STYLES = `
.fd-list { display: grid; gap: 10px; min-width: 0; }
.fd-list [hidden] { display: none !important; }
.fd-list-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-height: 34px; }
.fd-search { position: relative; flex: 1 1 360px; max-width: 680px; min-width: 0; container: fd-search / inline-size; }
.fd-search-field { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-height: 34px; box-sizing: border-box; padding: 2px 2px 2px 8px; padding-inline: 8px 2px; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); background: var(--fd-surface); }
.fd-search-field:focus-within { border-color: var(--fd-focus); box-shadow: var(--fd-focus-ring); }
.fd-search-field > .fd-icon, .fd-search-field > svg { width: 16px; height: 16px; color: var(--fd-muted); flex: none; }
.fd-facets { display: contents; }
.fd-facet { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; min-width: 0; padding-block: 2px; padding-inline: 6px 2px; border-radius: 3px; background: var(--fd-accent-soft); color: var(--fd-accent); font-size: 13px; line-height: 18px; }
.fd-facet svg { width: 13px; height: 13px; flex: none; }
.fd-facet[data-kind="groupBy"] { background: var(--fd-success-soft); color: var(--fd-success); }
.fd-facet-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-facet-remove { all: unset; cursor: pointer; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 2px; font-size: 15px; line-height: 1; opacity: 0.7; }
.fd-facet-remove:hover, .fd-facet-remove:focus-visible { opacity: 1; background: var(--fd-surface); }
.fd-search-input { flex: 1 1 140px; min-width: 100px; border: none; outline: none; background: none; font: inherit; font-size: 14px; color: var(--fd-text); padding: 5px 4px; }
.fd-form .fd-search-input:focus-visible { outline: none; }
.fd-search-toggle { all: unset; cursor: pointer; display: grid; place-items: center; width: 30px; height: 28px; border-radius: 3px; color: var(--fd-muted); }
.fd-search-toggle::before { content: ''; width: 7px; height: 7px; border-inline-end: 1.5px solid currentColor; border-block-end: 1.5px solid currentColor; transform: translateY(-2px) rotate(45deg); }
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
.fd-list-table th { text-align: start; font-weight: 600; font-size: 13px; color: var(--fd-text); padding: 8px 10px; border-block-end: 1px solid var(--fd-border-strong); white-space: nowrap; background: var(--fd-surface); }
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
.fd-list-empty, .fd-list-failed { margin: 0; padding: 28px 12px; text-align: center; color: var(--fd-muted); }
.fd-list-failed { color: var(--fd-error); }
`;

/** Puts the list's look in the document once. */
export function installListStyles(doc: Document): void {
  if (doc.getElementById('fd-list-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fd-list-styles';
  style.textContent = LIST_STYLES;
  doc.head.append(style);
}
