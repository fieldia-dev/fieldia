/**
 * What sits around a record, on the same tokens as the form: the bar over it
 * (breadcrumbs, the gear menu, the pager), the attachment preview beside its
 * sheet, and where the side panel goes. Put in the document after Fieldia's
 * own stylesheet, so its rules on the sheet's layout come after those.
 */
export const RECORD_STYLES = /* css */ `
.fd-record-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; min-height: 46px; box-sizing: border-box; padding: 6px 16px; background: var(--fd-surface); border-block-end: 1px solid var(--fd-border); }
.fd-form > .fd-content > .fd-record-bar { margin: -4px 0 12px; border-radius: var(--fd-radius); border: 1px solid var(--fd-border); }
.fd-breadcrumbs { min-width: 0; }
.fd-breadcrumbs ol { display: flex; flex-wrap: wrap; align-items: center; list-style: none; margin: 0; padding: 0; font-size: 17px; line-height: 1.3; }
.fd-breadcrumbs li { display: flex; align-items: center; min-width: 0; }
.fd-breadcrumbs li + li::before { content: "/"; color: var(--fd-muted); padding-inline: 8px; }
.fd-crumb { all: unset; cursor: pointer; color: var(--fd-accent); border-radius: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-crumb:hover { text-decoration: underline; }
.fd-crumb:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-crumb-current { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-record-actions { position: relative; }
.fd-record-actions[hidden] { display: none; }
.fd-record-gear { display: inline-flex; align-items: center; gap: 6px; }
.fd-record-gear svg { width: 16px; height: 16px; flex: none; }
.fd-record-menu { position: absolute; z-index: 40; inset-block-start: calc(100% + 4px); inset-inline-start: 0; display: grid; min-width: 220px; max-width: min(320px, 90vw); padding: 4px; box-sizing: border-box; background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 4px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16); }
.fd-record-menu[hidden], .fd-record-menu [hidden] { display: none; }
.fd-record-menu [role="group"] { display: grid; }
.fd-record-menu-heading { padding: 6px 12px 2px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--fd-muted); }
.fd-record-menu-rule { margin: 4px 0; border-block-start: 1px solid var(--fd-border); }
.fd-record-menu-item { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 6px 12px; border-radius: 3px; cursor: pointer; color: var(--fd-text); }
.fd-record-menu-item svg { width: 16px; height: 16px; flex: none; color: var(--fd-muted); }
.fd-record-menu-item:hover, .fd-record-menu-item:focus { background: var(--fd-accent-soft); }
.fd-record-menu-item:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-record-menu-danger { color: var(--fd-error); }
.fd-record-pager { display: flex; align-items: center; gap: 4px; margin-inline-start: auto; }
.fd-record-pager[hidden] { display: none; }
.fd-record-pager-text { padding-inline-end: 6px; font-variant-numeric: tabular-nums; color: var(--fd-muted); white-space: nowrap; }
.fd-record-step { min-width: 34px; padding-inline: 8px; font-size: 18px; line-height: 1; }
.fd-record-step[aria-disabled="true"] { opacity: 0.5; cursor: default; }
/* The arrows point the way the page reads. */
[dir="rtl"] .fd-record-arrow { display: inline-block; transform: scaleX(-1); }
@container fd-form (max-width: 520px) {
  .fd-record-bar { padding-inline: 12px; gap: 6px 8px; }
  /* On a phone the gear says nothing more than its picture, and the trail folds to the page before this one, a way back. */
  .fd-record-gear-words { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .fd-breadcrumbs ol { flex-wrap: nowrap; font-size: 15px; }
  .fd-breadcrumbs li:not(:nth-last-child(-n + 2)) { display: none; }
  .fd-breadcrumbs li:nth-last-child(2)::before { content: "‹"; padding-inline: 0 6px; font-size: 20px; color: var(--fd-accent); }
  [dir="rtl"] .fd-breadcrumbs li:nth-last-child(2)::before { content: "›"; }
}

/* The attachment beside the sheet: the sheet and its side panel in the first column, the file in the second. */
.fd-attachment-preview { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); overflow: hidden; }
.fd-attachment-preview[hidden] { display: none; }
.fd-attachment-head { display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 12px; padding-inline: 12px 8px; border-block-end: 1px solid var(--fd-border); min-width: 0; }
.fd-attachment-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.fd-attachment-count { color: var(--fd-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.fd-attachment-head [hidden] { display: none; }
.fd-attachment-body { display: grid; min-height: 0; background: var(--fd-page); }
.fd-attachment-body > iframe { width: 100%; height: 100%; min-height: 70vh; border: 0; background: #fff; }
.fd-attachment-body > img { display: block; max-width: 100%; max-height: 80vh; margin: auto; object-fit: contain; }
.fd-sheet-layout.fd-has-preview:has(> .fd-attachment-preview:not([hidden])) { max-width: none; grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr); }
.fd-sheet-layout.fd-has-preview:has(> .fd-attachment-preview:not([hidden])) > :is(.fd-card, .fd-side) { grid-column: 1; }
.fd-sheet-layout.fd-has-preview > .fd-attachment-preview { grid-column: 2; grid-row: 1 / span 2; position: sticky; top: 8px; height: calc(100vh - 16px); max-height: 1200px; }
@container (max-width: 1000px) {
  .fd-sheet-layout.fd-has-preview:has(> .fd-attachment-preview:not([hidden])) { grid-template-columns: minmax(0, 1fr); }
  .fd-sheet-layout.fd-has-preview > .fd-attachment-preview { grid-column: 1; grid-row: auto; position: static; height: auto; }
  .fd-attachment-body > iframe { min-height: 60vh; }
}
/* A side panel kept beside the sheet: narrower under 1000px, under the sheet only once the form is too narrow for both. */
@container (max-width: 1000px) { .fd-sheet-layout.fd-has-side[data-side-beside="always"]:not(:has(> .fd-attachment-preview:not([hidden]))) { grid-template-columns: minmax(0, 1fr) minmax(240px, 300px); } }
@container (max-width: 600px) { .fd-sheet-layout.fd-has-side[data-side-beside="always"]:not(:has(> .fd-attachment-preview:not([hidden]))) { grid-template-columns: minmax(0, 1fr); } }
`;

/** Puts the record's surroundings' look in the document once. */
export function installRecordStyles(doc: Document): void {
  if (doc.getElementById('fd-record-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fd-record-styles';
  style.textContent = RECORD_STYLES;
  (doc.head ?? doc.documentElement).append(style);
}
