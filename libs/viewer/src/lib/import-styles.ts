import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * A list's Import dialog: the place a file is dropped, its columns and the
 * field each goes into, the rows that cannot be imported, the first rows as
 * they will be saved, and how far the writing has got. Its box, its buttons
 * and its boxes are the main sheet's (a dialog's, a button's, a select's);
 * this lays out its own parts alone. In the import part, put in the page the
 * first time Import is pressed (installPartStyles, PART_RANK.import).
 */
const IMPORT_CSS = /* css */ `
.fd-import .fd-import-body { display: grid; gap: 14px; align-content: start; background: var(--fd-surface); padding: 16px 20px 20px; }
.fd-import-drop { display: grid; justify-items: center; gap: 10px; padding: 36px 20px; border: 2px dashed var(--fd-border-strong); border-radius: var(--fd-radius); text-align: center; color: var(--fd-text); }
.fd-import-drop[data-over] { border-color: var(--fd-accent); background: var(--fd-accent-soft); }
.fd-import-drop svg { width: 36px; height: 36px; color: var(--fd-muted); fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.fd-import-drop-words { margin: 0; font-size: 15px; font-weight: 600; }
.fd-import-drop .fd-help { margin: 0; }
.fd-import-problem { margin: 0; }
.fd-import-head { display: flex; flex-wrap: wrap; align-items: end; gap: 8px 16px; }
.fd-import-file { margin: 0; flex: 1 1 220px; min-width: 0; overflow-wrap: anywhere; }
.fd-import-how { display: grid; gap: 4px; font-size: 12.5px; color: var(--fd-muted); }
.fd-import-scroll { overflow: auto; max-height: min(52vh, 460px); border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); }
.fd-import-columns, .fd-import-preview { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.fd-import-columns :is(th, td), .fd-import-preview :is(th, td) { padding: 6px 10px; text-align: start; vertical-align: middle; border-block-end: 1px solid var(--fd-border); }
.fd-import-columns tbody tr:last-child > *, .fd-import-preview tbody tr:last-child > * { border-block-end: 0; }
.fd-import-columns thead th, .fd-import-preview thead th { position: sticky; top: 0; z-index: 1; background: var(--fd-page); color: var(--fd-muted); font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.fd-import-columns tbody th { font-weight: 600; overflow-wrap: anywhere; }
.fd-import-example { color: var(--fd-muted); max-width: 28ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-import-columns td:last-child { width: 40%; }
.fd-import-select { width: 100%; min-width: 12ch; box-sizing: border-box; }
.fd-import-how .fd-import-select { width: auto; }
.fd-import-preview td { white-space: nowrap; }
.fd-import-said { display: grid; gap: 4px; font-size: 13.5px; color: var(--fd-muted); }
.fd-import-said p, .fd-import-refused p { margin: 0; }
.fd-import-ready { margin: 0; font-weight: 600; }
.fd-import-ready[data-none] { color: var(--fd-error); }
.fd-import-refused { display: grid; gap: 6px; justify-items: start; padding: 10px 12px; border: 1px solid var(--fd-warning); border-radius: var(--fd-control-radius); background: var(--fd-warning-soft); font-size: 13.5px; }
.fd-import-refused ul { margin: 0; padding-inline-start: 18px; max-height: 180px; overflow: auto; justify-self: stretch; }
.fd-import-heading { margin: 4px 0 0; font-size: 14px; font-weight: 600; }
.fd-import-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.fd-import-status { margin-inline-end: auto; color: var(--fd-muted); font-size: 13px; }
.fd-import-writing { padding: 28px 0; }
.fd-import-progress { width: 100%; height: 10px; accent-color: var(--fd-accent); }
/* A phone: the first values give way to the picker, the most a column needs. */
@container (max-width: 520px) { .fd-import-example { display: none; } .fd-import-columns td:last-child { width: auto; } }
`;

/** The import's look in a document, once, in its place among Fieldia's sheets. */
export function installImportStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-import-styles', IMPORT_CSS, PART_RANK.import);
}
