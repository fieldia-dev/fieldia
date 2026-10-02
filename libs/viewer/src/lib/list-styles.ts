/** The list's look, on the same tokens as the forms it opens. */
export const LIST_STYLES = `
.fd-list { display: grid; gap: 10px; min-width: 0; }
.fd-list [hidden] { display: none !important; }
.fd-list-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-height: 34px; }
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
