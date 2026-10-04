/**
 * The designer's part for what an app adds: its own kinds' settings, the
 * templates a blank page starts from, and the app's assistant. Appended to
 * the designer's stylesheet.
 */
export const DESIGNER_EXTEND_CSS = /* css */ `
/* ---- an app's kind: its settings flow with the field's own ---------------- */
.fd-app-settings { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; min-width: 0; }
.fd-prop > .fd-app-settings { font-size: 13px; color: var(--fd-muted); }

/* ---- a blank page: templates to start from -------------------------------- */
.fd-start-area { display: contents; }
.fd-canvas-scroll .fd-start, .fd-canvas-scroll .fd-start-done { margin-block-end: 14px; }
.fd-start { display: grid; gap: 16px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: 8px; padding: 20px 24px 22px; }
.fd-start-head { display: grid; gap: 4px; }
.fd-start-title { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.3; color: var(--fd-text); }
.fd-start-lead { margin: 0; font-size: 13.5px; line-height: 1.45; color: var(--fd-muted); }
.fd-start-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 12px; }
.fd-start-item { display: flex; min-width: 0; }
.fd-start-card {
  font: inherit; color: var(--fd-text); text-align: start; cursor: pointer; flex: 1; min-width: 0; box-sizing: border-box;
  display: grid; align-content: start; gap: 4px; padding: 14px 14px 12px; margin: 0;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: 8px;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.fd-start-card:hover { border-color: var(--fd-accent); box-shadow: 0 2px 8px rgba(15, 20, 25, 0.08); }
.fd-start-card:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-start-card-title { font-size: 15px; font-weight: 600; line-height: 1.3; }
.fd-start-card-description { font-size: 13px; line-height: 1.4; color: var(--fd-muted); }
.fd-start-preview { display: grid; gap: 5px; margin-block-start: 8px; padding-block-start: 10px; border-block-start: 1px dashed var(--fd-border); }
.fd-start-preview-row { display: flex; align-items: center; gap: 7px; min-width: 0; font-size: 12.5px; line-height: 1.3; }
.fd-start-preview-row > .fd-dicon { flex: none; width: 14px; height: 14px; color: var(--fd-muted); }
.fd-start-preview-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-start-preview-more { font-size: 12px; color: var(--fd-muted); padding-inline-start: 21px; }
.fd-start-foot { display: flex; flex-wrap: wrap; gap: 8px; }

/* ---- what a whole-page edit did, with Undo -------------------------------- */
.fd-start-done {
  display: flex; align-items: flex-start; gap: 12px; padding: 12px 12px 12px 16px; border-radius: 8px;
  background: var(--fd-accent-soft); border: 1px solid color-mix(in srgb, var(--fd-accent) 28%, transparent); color: var(--fd-text);
}
.fd-start-done:focus { outline: none; }
.fd-start-done:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-start-done-body { flex: 1; min-width: 0; display: grid; gap: 6px; padding-block-start: 5px; }
.fd-start-done-words { margin: 0; font-size: 14px; font-weight: 500; line-height: 1.4; }
.fd-start-done-changes { margin: 0; padding-inline-start: 18px; display: grid; gap: 2px; font-size: 13px; line-height: 1.45; }
.fd-start-done-more { list-style: none; margin-inline-start: -18px; color: var(--fd-muted); }
.fd-start-done-actions { flex: none; display: flex; align-items: center; gap: 4px; }
@media (prefers-reduced-motion: reduce) { .fd-start-card { transition: none; } }
`;
