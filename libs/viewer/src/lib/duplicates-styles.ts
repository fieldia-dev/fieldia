import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * Possible duplicates' look (the duplicates part): a note of the records like the one typed under the field they
 * matched on, or over the page when no such field is in sight, and the merge's screen — the two records side by
 * side, a radio for each field's value. On the form's tokens, so dark and the themes follow; logical sides, so right
 * to left follows. Put in the page the first time a page asks for duplicates (installPartStyles,
 * PART_RANK.duplicates).
 */
const DUPLICATES_CSS = /* css */ `
.fd-duplicates {
  display: grid; gap: 6px; margin-block-start: 6px; padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--fd-warning) 45%, transparent); border-inline-start-width: 4px; border-radius: var(--fd-control-radius);
  background: var(--fd-warning-soft); color: var(--fd-text); font-size: 13px; line-height: 1.45;
}
.fd-duplicates-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.fd-duplicate { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 8px; align-items: start; }
.fd-duplicate-icon { display: flex; color: var(--fd-warning); padding-block-start: 2px; }
.fd-duplicate-icon svg { width: 16px; height: 16px; }
.fd-duplicate-words { min-width: 0; overflow-wrap: anywhere; }
.fd-duplicate-words strong { font-weight: 650; }
.fd-duplicate-ways { grid-column: 2; display: flex; flex-wrap: wrap; gap: 2px 6px; margin-inline-start: -4px; }
.fd-duplicate-ways .fd-button { min-height: 28px; padding-block: 2px; font-size: 13px; }
.fd-duplicates-more { margin: 0; padding-inline-start: 24px; color: var(--fd-muted); }
/* Over the page, when no field it matched on is in sight: in from a sheet's edges, as the conflict's note is. */
.fd-content > .fd-duplicates { margin-block: 0 16px; }
.fd-content > .fd-duplicates:has(~ .fd-sheet-page) { margin: 12px 16px; }
/* The merge's screen: the two records side by side, a field to a row. */
.fd-merge .fd-form-dialog-body { display: grid; gap: 12px; align-content: start; }
.fd-merge-intro, .fd-merge-same, .fd-merge-what, .fd-merge-error { margin: 0; }
.fd-merge-intro, .fd-merge-same { color: var(--fd-muted); }
.fd-merge-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 13.5px; }
.fd-merge-table :is(th, td) { padding: 8px; border-block-end: 1px solid var(--fd-border); text-align: start; vertical-align: top; }
.fd-merge-table thead th { font-weight: 600; border-block-end-color: var(--fd-border-strong); }
.fd-merge-table tbody th { width: 26%; font-weight: 500; color: var(--fd-muted); overflow-wrap: anywhere; }
.fd-merge-table td:has(input:checked), .fd-merge-table thead th:has(input:checked) { background: var(--fd-accent-soft); }
.fd-merge-pick { display: flex; gap: 8px; align-items: flex-start; min-width: 0; cursor: pointer; overflow-wrap: anywhere; }
.fd-merge-pick input { margin: 1px 0 0; }
.fd-merge-shown { display: block; font-weight: 400; font-size: 12px; color: var(--fd-muted); }
.fd-merge-empty { color: var(--fd-muted); font-style: italic; }
.fd-merge-what { padding: 8px 10px; border-radius: var(--fd-control-radius); background: var(--fd-info-soft); color: var(--fd-text); }
.fd-merge-error { padding: 8px 10px; border-radius: var(--fd-control-radius); background: var(--fd-error-soft); color: var(--fd-error); }
.fd-merge-error[hidden] { display: none; }
@media (max-width: 520px) { .fd-merge-table tbody th { width: 30%; } .fd-merge-table :is(th, td) { padding: 6px 4px; } }
`;

/** Possible duplicates' sheet in a document, once, in its place among Fieldia's (PART_RANK.duplicates). */
export function installDuplicateStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-duplicates-styles', DUPLICATES_CSS, PART_RANK.duplicates);
}
