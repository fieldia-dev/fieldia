/** The grid's own touches on top of AG Grid's theme, scoped to Fieldia grids. */
export const GRID_CSS = /* css */ `
.fd-grid-lines { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; min-width: 0; }
.fd-grid-host { min-width: 0; }
/* AG Grid keeps 150px of rows for its "no rows" message; ours has none, so one row's height is enough. */
.fd-grid-lines .ag-grid-scrolling-rows.ag-layout-auto-height { min-height: 40px; }
/* AG Grid keeps room for a sideways scroll bar it has marked invisible; give the room back until it is needed. */
.fd-grid-lines .ag-body-horizontal-scroll.ag-invisible { display: none; }
/* Lists that open from a cell leave the table: the body keeps the rounded corners instead of the frame. */
.fd-grid-lines .ag-root-wrapper { overflow: visible; }
.fd-grid-lines .ag-root-wrapper-body { overflow: hidden; border-radius: inherit; }
.fd-grid-lines .fd-grid-tools { padding: 0; display: flex; align-items: center; justify-content: center; }
/* A cell the form found wrong: an inset red edge, so the row keeps its height. */
.fd-grid-lines .ag-cell-inline-editing.fd-grid-invalid, .ag-popup-editor .fd-grid-editor.fd-grid-editor-invalid { border-color: var(--fd-error) !important; }
.fd-grid-lines .fd-tone-info { --fd-line-tone: var(--fd-info); --fd-line-tone-soft: var(--fd-info-soft); }
.fd-grid-lines .fd-tone-success { --fd-line-tone: var(--fd-success); --fd-line-tone-soft: var(--fd-success-soft); }
.fd-grid-lines .fd-tone-warning { --fd-line-tone: var(--fd-warning); --fd-line-tone-soft: var(--fd-warning-soft); }
.fd-grid-lines .fd-tone-danger { --fd-line-tone: var(--fd-error); --fd-line-tone-soft: var(--fd-error-soft); }
.fd-grid-lines .fd-tone-muted { --fd-line-tone: var(--fd-muted); --fd-line-tone-soft: color-mix(in srgb, var(--fd-muted) 16%, transparent); }
.fd-grid-lines :is(.ag-row[class*="fd-tone-"] .ag-cell, .ag-cell[class*="fd-tone-"]) { color: var(--fd-line-tone); }
.fd-grid-lines :is(.fd-line-bold .ag-cell, .ag-cell.fd-cell-bold) { font-weight: 600; }
.fd-grid-badge { display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 12px; line-height: 20px; font-weight: 500; color: var(--fd-muted); background: color-mix(in srgb, var(--fd-muted) 14%, transparent); }
.fd-grid-badge[data-tone] { color: var(--fd-line-tone); background: var(--fd-line-tone-soft); }
.fd-grid-badge[data-tone="info"] { --fd-line-tone: var(--fd-info); --fd-line-tone-soft: var(--fd-info-soft); }
.fd-grid-badge[data-tone="success"] { --fd-line-tone: var(--fd-success); --fd-line-tone-soft: var(--fd-success-soft); }
.fd-grid-badge[data-tone="warning"] { --fd-line-tone: var(--fd-warning); --fd-line-tone-soft: var(--fd-warning-soft); }
.fd-grid-badge[data-tone="danger"] { --fd-line-tone: var(--fd-error); --fd-line-tone-soft: var(--fd-error-soft); }
.fd-grid-row-buttons { display: inline-flex; gap: 2px; }
.fd-grid-row-buttons .fd-line-button { padding: 2px 6px; font-size: 12.5px; }
.fd-grid-row-buttons .fd-line-button-icon { padding: 4px; color: var(--fd-muted); }
.fd-grid-row-buttons .fd-line-button-icon:hover { color: var(--fd-accent); }
.fd-grid-row-buttons svg { width: 15px; height: 15px; display: block; }
.fd-grid-lines .ag-cell.fd-grid-invalid { box-shadow: inset 0 0 0 1px var(--fd-error); background: var(--fd-error-soft); }
.fd-grid-lines .fd-line-open { border: none; background: none; cursor: pointer; color: var(--fd-accent); font-size: 14px; padding: 4px 6px; border-radius: 4px; }
.fd-grid-lines .fd-line-open:hover { background: var(--fd-page); }
.fd-grid-lines .fd-grid-totals { font-weight: 600; background: var(--fd-surface); }
.fd-grid-lines { position: relative; }
.fd-grid-chooser-button {
  border: none; background: none; cursor: pointer; color: var(--fd-muted); font-size: 16px; line-height: 1;
  padding: 4px 8px; border-radius: 4px;
}
.fd-grid-chooser-button:hover, .fd-grid-chooser-button[aria-expanded="true"] { color: var(--fd-text); background: var(--fd-page); }
.fd-grid-chooser {
  position: absolute; z-index: 30; display: grid; gap: 2px; padding: 6px; min-width: 180px;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 4px);
  box-shadow: 0 8px 24px rgba(15, 20, 25, 0.12);
}
.fd-grid-chooser label { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 4px; cursor: pointer; white-space: nowrap; }
.fd-grid-chooser label:hover { background: var(--fd-accent-soft); }
.fd-grid-lines .fd-grid-handle { color: var(--fd-muted); cursor: grab; }
.fd-grid-lines .fd-grid-handle .ag-drag-handle { margin: 0; }
.fd-grid-lines .ag-cell .fd-checkbox { margin: 0; vertical-align: middle; }
/* Typed text stays where the shown value was: the cell padding, less the 1px border AG Grid draws round an editor. */
.fd-grid-editor { height: 100%; display: flex; align-items: center; padding-inline: calc(var(--ag-cell-horizontal-padding) - 1px); box-sizing: border-box; }
/* A row that measures its height wraps the editor in a flex box of its own: fill it. */
.ag-cell-wrapper > .fd-grid-editor { flex: 1 1 auto; min-width: 0; align-self: stretch; }
.fd-grid-editor > * { flex: 1; min-width: 0; }
.fd-grid-editor .fd-input { border: 0; box-shadow: none; background: transparent; padding-inline: 0; min-height: 0; }
.fd-grid-editor .fd-combo-input { padding-inline-end: 24px; }
/* The cell's frame already marks the edit; outrank the underline skin's focus line. */
.fd-form .fd-grid-lines .fd-grid-editor .fd-input:focus { box-shadow: none; }
/* A popup editor (links) covers its cell exactly and looks like one being edited in place. */
.ag-popup-editor .fd-grid-editor {
  background: var(--ag-background-color); border: var(--ag-cell-editing-border); border-radius: var(--ag-border-radius);
  box-shadow: var(--ag-cell-editing-shadow);
}
/* Its list is as wide as its choices need, never narrower than the cell. */
.fd-grid-lines > .fd-grid-floating-list { position: absolute; inset-inline-end: auto; width: max-content; max-width: min(420px, 90vw); z-index: 30; }
.fd-grid-editor .fd-listbox { inset-inline-end: auto; width: max-content; min-width: 100%; max-width: min(420px, 90vw); }
/* A section heads the lines below it; a note is a remark between them, every line of it shown. */
.fd-grid-lines .fd-grid-section { background: var(--fd-page); }
.fd-grid-lines .fd-grid-section .fd-grid-kind-text { font-weight: 600; }
.fd-grid-lines .fd-grid-note .fd-grid-kind-text { font-style: italic; white-space: pre-wrap; line-height: 20px; }
.fd-grid-lines .fd-grid-note .fd-grid-kind-text:not(.ag-cell-inline-editing) { padding-block: 10px; }
.fd-grid-editor[data-kind="section"] .fd-input { font-weight: 600; }
.fd-grid-editor[data-kind="note"] { align-items: start; }
.fd-grid-editor[data-kind="note"] textarea { resize: none; min-height: 0; overflow: hidden; font-style: italic; line-height: 20px; padding-block: 9px; }
.fd-grid-editor[data-type="integer"] input, .fd-grid-editor[data-type="float"] input, .fd-grid-editor[data-type="monetary"] input { text-align: end; }
`;

const STYLE_ID = 'fieldia-grid-styles';

export function installGridStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = GRID_CSS;
  (document.head ?? document.documentElement).append(style);
}
