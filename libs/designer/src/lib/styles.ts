/** The designer's own chrome, on top of Fieldia's form stylesheet and tokens. */
export const DESIGNER_CSS = /* css */ `
.fd-designer { display: grid; gap: 14px; }
.fd-designer-bar {
  display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; position: sticky; top: env(safe-area-inset-top, 0px); z-index: 30;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 10px 14px;
}
.fd-designer-title { font-size: 17px; font-weight: 600; max-width: 420px; }
.fd-designer-status { color: var(--fd-muted); font-size: 13px; }
.fd-designer .fd-spacer { flex: 1; }
.fd-designer-issues { white-space: pre-line; }
.fd-designer-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 0.8fr); gap: 20px; align-items: start; }
@container (max-width: 900px) { .fd-designer-body { grid-template-columns: minmax(0, 1fr); } }
.fd-designer-editor { display: grid; gap: 14px; justify-items: start; }
.fd-designer-editor > * { width: 100%; }
.fd-designer-editor > .fd-button { width: auto; }
.fd-designer-pages { display: grid; gap: 18px; }
.fd-design-step { display: grid; gap: 10px; padding: 14px; border-radius: var(--fd-radius); background: var(--fd-page); border: 1px solid var(--fd-border); }
.fd-step-head { display: flex; gap: 8px; align-items: center; }
.fd-step-title { font-weight: 650; font-size: 15px; }
.fd-step-when { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; color: var(--fd-muted); font-size: 13px; }
.fd-step-when .fd-select { width: auto; min-width: 140px; }
.fd-step-cards { display: grid; gap: 10px; }
.fd-design-step > .fd-button { justify-self: start; }
.fd-step-cards:empty::before { content: "No questions on this page yet."; color: var(--fd-muted); font-size: 13px; padding: 4px 2px; }
.fd-q {
  display: grid; gap: 10px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius);
  padding: 14px 16px; border-inline-start: 4px solid transparent; cursor: default;
}
.fd-q-selected { border-inline-start-color: var(--fd-accent); box-shadow: 0 2px 10px rgba(15, 20, 25, 0.08); }
.fd-q-head { display: grid; grid-template-columns: minmax(0, 1fr) minmax(130px, 200px); gap: 10px; }
.fd-q-label { font-size: 15px; }
.fd-q-options { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.fd-q-option { display: flex; gap: 8px; align-items: center; }
.fd-q-bullet { color: var(--fd-muted); width: 16px; text-align: center; }
.fd-q-option-box { display: grid; gap: 4px; justify-items: start; }
.fd-q-option-box > ul { width: 100%; }
.fd-q-foot { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; border-block-start: 1px solid var(--fd-border); padding-block-start: 10px; }
.fd-q-required { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; }
.fd-q-help { flex: 1 1 180px; min-width: 0; font-size: 13px; }
.fd-q-tools { display: flex; gap: 2px; margin-inline-start: auto; }
.fd-icon-button {
  font: inherit; border: none; background: none; cursor: pointer; color: var(--fd-muted); width: 30px; height: 30px; border-radius: 6px;
  display: inline-grid; place-items: center; font-size: 15px;
}
.fd-icon-button:hover { background: var(--fd-page); color: var(--fd-text); }
.fd-icon-danger:hover { color: var(--fd-error); background: var(--fd-error-soft); }
.fd-designer-preview { position: sticky; top: 76px; display: grid; gap: 8px; }
.fd-designer-preview-title { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fd-muted); }
.fd-designer-preview-host { background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 18px; max-height: 80vh; overflow: auto; }

/* ---- the screen editor: palette, canvas, properties ---- */
.fd-screen-body { display: grid; grid-template-columns: 172px minmax(0, 1fr) 270px; gap: 16px; align-items: start; }
@container (max-width: 1000px) {
  .fd-screen-body { grid-template-columns: minmax(0, 1fr); }
  /* Stacked, a sticky panel would sit over the canvas: let them scroll, and lay the palette out in a row. */
  .fd-palette, .fd-properties { position: static; }
  .fd-palette { display: flex; flex-wrap: wrap; }
  .fd-palette .fd-panel-title { flex-basis: 100%; }
}
.fd-palette, .fd-properties {
  position: sticky; top: 76px; display: grid; gap: 6px; align-content: start;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 12px;
}
.fd-panel-title { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fd-muted); margin-block-end: 2px; }
.fd-palette-item {
  font: inherit; font-size: 13.5px; text-align: start; color: var(--fd-text); cursor: pointer;
  background: var(--fd-page); border: 1px solid var(--fd-border); border-radius: 6px; padding: 6px 10px;
}
.fd-palette-item:hover { border-color: var(--fd-accent); color: var(--fd-accent); }
.fd-canvas { display: grid; gap: 16px; justify-items: start; min-width: 0; }
.fd-canvas > * { width: 100%; }
.fd-canvas > .fd-button { width: auto; }
.fd-canvas-sections { display: grid; gap: 16px; }
.fd-canvas-section { background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 12px 6px 6px; }
.fd-canvas-section.fd-canvas-selected { border-color: var(--fd-accent); box-shadow: 0 0 0 1px var(--fd-accent); }
.fd-canvas-section-head { display: flex; align-items: baseline; gap: 10px; padding-inline: 8px; }
.fd-canvas-section-title { font: inherit; font-size: 15px; font-weight: 650; color: var(--fd-text); background: none; border: none; padding: 0; cursor: pointer; }
.fd-canvas-section-title:hover { color: var(--fd-accent); }
.fd-canvas-section-meta { color: var(--fd-muted); font-size: 12.5px; }
.fd-canvas-board { position: relative; }
.fd-canvas-empty { color: var(--fd-muted); font-size: 13px; padding: 14px 8px 10px; }
.fd-canvas-field {
  height: 100%; box-sizing: border-box; padding: 7px 10px; overflow: hidden; align-content: start;
  background: var(--fd-surface); border: 1px dashed var(--fd-border); border-radius: 6px;
}
/* A paragraph's box fills the rows it was given, as a hint of the room it takes. */
.fd-canvas-field[data-type="text"] { grid-template-rows: auto minmax(0, 1fr) auto; }
.fd-canvas-field[data-type="text"] > textarea { height: 100%; min-height: 0; box-sizing: border-box; resize: none; }
/* The spare row at the end of a section, painted under the cards as a place to drop one last. */
.fd-canvas-board::before {
  content: "Drop a field here to put it last"; position: absolute; inset-inline: 8px; bottom: 8px; height: var(--fd-spare-height, 92px); box-sizing: border-box;
  display: grid; place-items: center; color: var(--fd-muted); font-size: 12.5px; pointer-events: none;
  border: 1px dashed var(--fd-border); border-radius: 6px;
}
.fd-canvas-field.fd-canvas-selected { border: 1px solid var(--fd-accent); box-shadow: inset 0 0 0 1px var(--fd-accent); }
.fd-props { display: grid; gap: 10px; }
.fd-prop { display: grid; gap: 4px; }
.fd-prop-name { font-size: 12.5px; color: var(--fd-muted); }
.fd-props .fd-q-option-box { padding-inline-start: 2px; }
.fd-props-actions { display: flex; flex-wrap: wrap; gap: 8px; padding-block-start: 4px; border-block-start: 1px solid var(--fd-border); }
.fd-properties-hint { color: var(--fd-muted); font-size: 13px; margin: 0; }
.fd-screen-preview { background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 20px; }
`;

const STYLE_ID = 'fieldia-designer-styles';

export function installDesignerStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = DESIGNER_CSS;
  (document.head ?? document.documentElement).append(style);
}
