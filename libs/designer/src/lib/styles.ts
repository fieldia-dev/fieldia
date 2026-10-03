/** The designer's own chrome, on top of Fieldia's form stylesheet and tokens. */
export const DESIGNER_CSS = /* css */ `
.fd-designer { display: grid; gap: 14px; }
.fd-designer-bar {
  display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; position: sticky; top: env(safe-area-inset-top, 0px); z-index: 30;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 10px 14px;
}
.fd-designer-title { font-size: 17px; font-weight: 600; flex: 1 1 220px; max-width: 420px; min-width: 0; }
.fd-designer-status { color: var(--fd-muted); font-size: 13px; }
.fd-designer .fd-spacer { flex: 1; }
.fd-designer-issues { white-space: pre-line; }
.fd-designer-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 0.8fr); gap: 20px; align-items: start; }
.fd-survey-body { grid-template-columns: 228px minmax(0, 1fr) minmax(260px, 0.7fr); gap: 16px; }
@container (max-width: 1100px) { .fd-survey-body { grid-template-columns: 228px minmax(0, 1fr); } .fd-survey-body > .fd-designer-preview { grid-column: 1 / -1; position: static; } }
@container (max-width: 900px) { .fd-designer-body, .fd-survey-body { grid-template-columns: minmax(0, 1fr); } .fd-survey-body > .fd-toolbox { position: static; max-height: none; } .fd-survey-body .fd-tools { grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); } }
.fd-designer-editor { display: grid; gap: 14px; justify-items: start; }
.fd-designer-editor > * { width: 100%; }
.fd-designer-editor > .fd-button { width: auto; }
.fd-designer-pages { display: grid; gap: 18px; }
.fd-design-step { display: grid; gap: 10px; padding: 14px; border-radius: var(--fd-radius); background: var(--fd-page); border: 1px solid var(--fd-border); }
.fd-step-head { display: flex; gap: 8px; align-items: center; }
.fd-step-number { font-size: 12px; font-weight: 700; color: var(--fd-surface); background: var(--fd-accent); border-radius: 5px; padding: 2px 9px; white-space: nowrap; }
.fd-step-selected { border-color: var(--fd-accent); }
.fd-step-title { font-weight: 650; font-size: 15px; }
.fd-step-when { color: var(--fd-muted); font-size: 13px; }
.fd-when { display: grid; gap: 6px; justify-items: start; color: var(--fd-muted); font-size: 13px; }
.fd-q .fd-when { padding: 8px 10px; border-inline-start: 3px solid var(--fd-accent-soft); background: var(--fd-page); border-radius: 4px; width: 100%; box-sizing: border-box; }
.fd-when-rules { display: grid; gap: 6px; }
.fd-when-rule, .fd-when-match-row { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; }
.fd-when .fd-select { width: auto; min-width: 140px; }
.fd-when-custom code { font-size: 12.5px; color: var(--fd-text); }
.fd-q-when { padding-inline: 4px; }
.fd-step-cards { display: grid; gap: 10px; position: relative; }
.fd-step-cards.fd-drop-target { outline: 2px dashed var(--fd-accent); outline-offset: 4px; border-radius: 6px; }
/* While a question is carried, the gap under each page's questions is a place to drop it last. */
.fd-designer-editor.fd-dragging { user-select: none; -webkit-user-select: none; }
.fd-designer-editor.fd-dragging .fd-step-cards::after {
  content: "Drop here to put it last"; position: absolute; inset-inline: 0; top: calc(100% + 4px); height: 18px; display: grid; place-items: center;
  color: var(--fd-muted); font-size: 11.5px; border: 1px dashed var(--fd-border-strong); border-radius: 5px; pointer-events: none;
}
.fd-q.fd-drag-source { opacity: 0.35; }
.fd-add-question { display: inline-flex; gap: 6px; align-items: center; }
.fd-design-step > .fd-button { justify-self: start; }
.fd-step-cards:empty::before { content: "No questions on this page yet."; color: var(--fd-muted); font-size: 13px; padding: 4px 2px; }
.fd-q {
  position: relative; display: grid; gap: 10px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius);
  padding: 16px 18px; border-inline-start: 6px solid transparent; cursor: default;
}
/* A question not picked reads as people will see it, and opens where it is clicked. */
.fd-q-closed { cursor: pointer; user-select: none; -webkit-user-select: none; }
.fd-q-closed:hover { border-color: var(--fd-border-strong); border-inline-start-color: transparent; }
.fd-q-title { font-size: 15px; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }
.fd-q-closed.fd-required .fd-q-text::after { content: " *"; color: var(--fd-error); }
.fd-q-when-note { font-size: 11px; font-weight: 600; color: var(--fd-warning); background: var(--fd-warning-soft); border-radius: 4px; padding: 1px 6px; }
.fd-q-closed .fd-q-answer { max-width: 520px; }
/* The question picked: open, the Google Forms way. */
.fd-q-selected { border-inline-start-color: var(--fd-accent); box-shadow: 0 2px 12px rgba(15, 20, 25, 0.12); padding-block-start: 22px; }
.fd-q-grip { all: unset; position: absolute; top: 2px; left: 50%; transform: translateX(-50%) rotate(90deg); width: 18px; height: 22px; display: grid; place-items: center; cursor: grab; color: var(--fd-muted); touch-action: none; }
.fd-q-grip:focus-visible { outline: 2px solid var(--fd-focus); }
.fd-q-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
.fd-q-label { font-size: 15px; }
.fd-q-kind {
  all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 8px; min-width: 190px; padding: 0 12px; min-height: 38px;
  border: 1px solid var(--fd-border); border-radius: 6px; background: var(--fd-surface); color: var(--fd-text); cursor: pointer; font-size: 14px;
}
.fd-q-kind:hover { background: var(--fd-page); }
.fd-q-kind:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-q-kind-icon { display: inline-flex; }
.fd-q-kind > .fd-dicon { margin-inline-start: auto; width: 14px; height: 14px; color: var(--fd-muted); }
.fd-q-help { font-size: 13px; }
.fd-q-sep { width: 1px; height: 24px; background: var(--fd-border); margin-inline: 6px; }
.fd-q-required-words { font-size: 13px; }
.fd-switch { all: unset; position: relative; flex: none; width: 36px; height: 20px; border-radius: 10px; background: var(--fd-border-strong); cursor: pointer; }
.fd-switch::after { content: ""; position: absolute; top: 2px; inset-inline-start: 2px; width: 16px; height: 16px; border-radius: 50%; background: #ffffff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); transition: inset-inline-start 0.15s ease; }
.fd-switch[aria-checked="true"] { background: var(--fd-accent); }
.fd-switch[aria-checked="true"]::after { inset-inline-start: 18px; }
.fd-switch:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .fd-switch::after { transition: none; } }
.fd-q-options { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.fd-q-option { display: flex; gap: 8px; align-items: center; }
.fd-q-bullet { color: var(--fd-muted); width: 16px; text-align: center; }
.fd-q-option-box { display: grid; gap: 4px; justify-items: start; }
.fd-q-option-box > ul { width: 100%; }
.fd-q-foot { display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center; border-block-start: 1px solid var(--fd-border); padding-block-start: 10px; }
.fd-icon-button {
  font: inherit; border: none; background: none; cursor: pointer; color: var(--fd-muted); width: 30px; height: 30px; border-radius: 6px;
  display: inline-grid; place-items: center; font-size: 15px;
}
.fd-icon-button:hover { background: var(--fd-page); color: var(--fd-text); }
.fd-icon-danger:hover { color: var(--fd-error); background: var(--fd-error-soft); }
.fd-designer-preview { position: sticky; top: 76px; display: grid; gap: 8px; }
.fd-designer-preview-title { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fd-muted); }
.fd-designer-preview-host { background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 18px; max-height: 80vh; overflow: auto; }

/* ---- the screen editor: toolbox, canvas, panel ---- */
.fd-screen-body { display: grid; grid-template-columns: 228px minmax(0, 1fr) 280px; gap: 16px; align-items: start; }
.fd-toolbox, .fd-properties {
  position: sticky; top: 76px; display: grid; gap: 6px; align-content: start; max-height: calc(100vh - 96px); overflow: auto;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 12px;
}
.fd-panel-title { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fd-muted); margin-block-end: 2px; }
.fd-properties.fd-flash { animation: fd-flash 0.8s ease; }
@keyframes fd-flash { from { box-shadow: 0 0 0 3px var(--fd-accent-soft), inset 3px 0 0 var(--fd-accent); } to { box-shadow: none; } }

/* The toolbox: icons three to a row, in groups that fold, as Quantia's. */
.fd-toolbox { padding: 10px 6px; gap: 4px; }
.fd-tool-find { font-size: 13px; margin: 0 4px 4px; width: auto; }
.fd-tool-groups { display: grid; gap: 2px; }
.fd-tool-heading {
  all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 6px; width: 100%; cursor: pointer; padding: 8px 8px 3px;
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fd-muted);
}
.fd-tool-heading:hover { color: var(--fd-text); }
.fd-tool-heading:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; border-radius: 3px; }
.fd-tool-count { font-weight: 600; opacity: 0.75; }
.fd-tool-caret { width: 0; height: 0; flex: none; border-inline: 3.5px solid transparent; border-top: 4px solid currentColor; transition: transform 0.12s ease; }
.fd-tool-shut .fd-tool-caret { transform: rotate(-90deg); }
[dir="rtl"] .fd-tool-shut .fd-tool-caret { transform: rotate(90deg); }
.fd-tools { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; }
.fd-tool {
  all: unset; box-sizing: border-box; cursor: grab; display: grid; grid-template-rows: 22px auto; place-items: center; align-content: start; row-gap: 4px;
  height: 60px; padding: 8px 3px 4px; border-radius: 7px; color: var(--fd-muted); min-width: 0; touch-action: none;
}
.fd-tool:hover { background: var(--fd-page); color: var(--fd-text); }
.fd-tool:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-tool:active { cursor: grabbing; }
.fd-tool-model { color: var(--fd-accent); }
.fd-tool .fd-dicon { width: 20px; height: 20px; }
.fd-tool-name {
  font-size: 10.5px; line-height: 1.15; text-align: center; color: var(--fd-text); max-width: 100%; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere;
}
.fd-tool-none { color: var(--fd-muted); font-size: 12.5px; margin: 4px 8px; }
.fd-dicon { width: 16px; height: 16px; flex: none; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

/* The canvas: the page as the viewer draws it, measured against its own width. */
.fd-canvas-scroll { min-width: 0; }
.fd-canvas { container-type: inline-size; display: grid; gap: 18px; min-width: 0; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 22px 24px 30px; }
.fd-canvas-body { display: grid; gap: 26px; }
.fd-canvas-title { all: unset; box-sizing: border-box; cursor: pointer; font-size: 26px; font-weight: 650; line-height: 1.25; color: var(--fd-muted); padding: 8px 14px; border: 1px dashed var(--fd-border-strong); border-radius: var(--fd-radius); background: var(--fd-surface); }
.fd-canvas-title:hover { color: var(--fd-text); }
.fd-canvas-title.fd-canvas-selected { border-style: solid; border-color: var(--fd-accent); }
.fd-canvas-section { border-radius: 6px; outline-offset: 8px; }
.fd-canvas-section:hover { outline: 1px dashed var(--fd-border-strong); }
.fd-canvas-section.fd-canvas-selected { outline: 2px solid var(--fd-accent); }
.fd-canvas-section-title { all: unset; cursor: pointer; }
.fd-canvas-section-title:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-canvas-untitled { color: var(--fd-muted); font-weight: 500; font-style: italic; font-size: 13px; }
.fd-canvas-section-title-input { font: inherit; color: inherit; border: 0; border-bottom: 1px dashed var(--fd-border-strong); background: none; padding: 0 0 1px; min-width: 12em; outline: none; }
.fd-canvas-section-title-input:focus { border-bottom: 1px solid var(--fd-accent); }
.fd-canvas-empty { color: var(--fd-muted); font-size: 13px; border: 1px dashed var(--fd-border); border-radius: 6px; padding: 16px; text-align: center; margin: 0; }
/* A field's ring sits in the gap around it: picking or hovering one moves nothing. */
.fd-canvas-field { position: relative; border-radius: 6px; cursor: pointer; padding: 6px 8px; margin: -6px -8px; }
/* On the canvas a field is picked and moved, not read: pressing on its words starts a drag, not a selection. */
.fd-canvas-field:not(.fd-editing), .fd-canvas-section-title, .fd-canvas.fd-dragging { user-select: none; -webkit-user-select: none; }
.fd-canvas-field:hover { outline: 1px dashed var(--fd-border-strong); }
.fd-canvas-field.fd-editing { outline: 2px solid var(--fd-accent); background: var(--fd-accent-soft); cursor: default; }
.fd-canvas-field.fd-hidden-sometimes::after {
  content: "only sometimes"; position: absolute; top: 4px; inset-inline-end: 6px; font-size: 10.5px; font-weight: 600; line-height: 1.5;
  color: var(--fd-warning); background: var(--fd-warning-soft); border-radius: 4px; padding: 0 5px; pointer-events: none;
}
.fd-canvas-field.fd-editing.fd-hidden-sometimes::after { content: none; }
.fd-canvas-label-row { display: flex; align-items: center; min-height: 1.45em; }
.fd-canvas-label-input {
  font: inherit; font-weight: var(--fd-label-weight); color: var(--fd-text); border: 0; border-bottom: 1px dashed var(--fd-border-strong);
  background: none; padding: 0 0 1px; outline: none; max-width: 100%; min-width: 4ch; field-sizing: content; cursor: text;
}
.fd-canvas-label-input:focus { border-bottom: 1px solid var(--fd-accent); }
.fd-canvas-help-input { font: inherit; font-size: 12.5px; color: var(--fd-muted); border: 0; border-bottom: 1px dashed transparent; background: none; padding: 1px 0; outline: none; width: 100%; box-sizing: border-box; cursor: text; }
.fd-canvas-help-input:hover, .fd-canvas-help-input:focus { border-bottom-color: var(--fd-border-strong); }
.fd-canvas-help-input::placeholder { color: var(--fd-muted); opacity: 0.75; }
.fd-canvas-field .fd-q-option-box { padding-block: 2px; }
.fd-canvas-tabs-head { display: flex; align-items: flex-end; gap: 4px; }
.fd-canvas-tabs-head > .fd-tablist { flex: 1; }
.fd-canvas-tab.fd-canvas-selected { background: var(--fd-accent-soft); border-radius: 3px 3px 0 0; }
.fd-canvas-tabs.fd-canvas-selected { outline: 2px solid var(--fd-accent); outline-offset: 6px; border-radius: 4px; }
.fd-canvas-add-tab { all: unset; cursor: pointer; width: 28px; height: 28px; margin-block-end: 4px; display: grid; place-items: center; border-radius: 4px; color: var(--fd-muted); font-size: 18px; }
.fd-canvas-add-tab:hover { background: var(--fd-page); color: var(--fd-accent); }
.fd-canvas-add-tab:focus-visible, .fd-canvas-title:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }

/* The bar on the field being edited: just above it, or below it right under the tabs. */
.fd-field-bar {
  position: absolute; bottom: calc(100% + 8px); inset-inline-end: 0; z-index: 5; display: flex; align-items: center; gap: 1px; padding: 3px;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: 8px; box-shadow: 0 6px 16px rgba(15, 20, 25, 0.14); cursor: default;
}
.fd-bar-below > .fd-field-bar { bottom: auto; top: calc(100% + 8px); }
.fd-bar-button {
  all: unset; box-sizing: border-box; height: 26px; min-width: 26px; padding: 0 5px; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  color: var(--fd-text); font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.fd-bar-button:hover { background: var(--fd-page); }
.fd-bar-button:focus-visible { outline: 2px solid var(--fd-focus); }
.fd-bar-button[aria-pressed="true"] { background: var(--fd-accent-soft); color: var(--fd-accent); }
.fd-bar-grip { cursor: grab; color: var(--fd-muted); touch-action: none; }
.fd-bar-kind-icon { display: inline-flex; }
.fd-bar-kind > .fd-dicon { width: 12px; height: 12px; color: var(--fd-muted); }
.fd-bar-sep { width: 1px; align-self: stretch; background: var(--fd-border); margin: 3px 2px; }
@container (max-width: 560px) { .fd-bar-kind-name { display: none; } }

/* A menu of choices: the editor a field is shown with, or its width. */
.fd-menu {
  position: fixed; z-index: 60; min-width: 220px; max-width: min(320px, calc(100vw - 16px)); max-height: min(440px, calc(100vh - 16px)); overflow: auto;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: 10px; box-shadow: 0 18px 44px rgba(15, 20, 25, 0.18);
  padding: 6px; display: grid; gap: 1px;
}
.fd-menu-title, .fd-menu-heading { font-size: 10.5px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fd-muted); padding: 6px 8px 2px; }
.fd-menu-item { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 9px; padding: 7px 9px; border-radius: 7px; font-size: 13.5px; cursor: pointer; }
.fd-menu-item:hover, .fd-menu-item:focus-visible { background: var(--fd-page); }
.fd-menu-item[aria-checked="true"] { color: var(--fd-accent); font-weight: 600; }
.fd-menu-item[aria-checked="true"]::after { content: "✓"; margin-inline-start: auto; }
.fd-menu-note { font-size: 12px; color: var(--fd-muted); margin: 4px 8px; line-height: 1.4; }

/* Dragging: a copy follows the pointer, a line shows where it lands. */
.fd-drag-ghost { position: fixed; z-index: 100; pointer-events: none; margin: 0; height: auto !important; opacity: 0.92; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.2); outline: 1px solid var(--fd-accent) !important; background: var(--fd-surface); border-radius: 6px; transform: rotate(-1deg); }
.fd-drag-ghost.fd-tool { display: grid; width: 76px !important; }
.fd-canvas-field.fd-drag-source { opacity: 0.35; }
.fd-drop-marker { position: fixed; z-index: 99; pointer-events: none; background: var(--fd-accent); border-radius: 2px; }
.fd-canvas-section.fd-drop-target { outline: 2px dashed var(--fd-accent); background: var(--fd-accent-soft); }
/* While something is carried, the gap under each section is a place to drop it last — drawn in the gap, so nothing moves. */
.fd-canvas-section { position: relative; }
.fd-canvas.fd-dragging .fd-canvas-section::after {
  content: "Drop here to put it last"; position: absolute; inset-inline: 0; top: calc(100% + 6px); height: 18px; display: grid; place-items: center;
  color: var(--fd-muted); font-size: 11.5px; border: 1px dashed var(--fd-border-strong); border-radius: 5px; pointer-events: none;
}
.fd-canvas.fd-dragging .fd-canvas-section.fd-drop-target::after { border-color: var(--fd-accent); color: var(--fd-accent); }

.fd-props { display: grid; gap: 10px; }
.fd-prop { display: grid; gap: 4px; }
.fd-prop-name { font-size: 12.5px; color: var(--fd-muted); }
.fd-props .fd-q-option-box { padding-inline-start: 2px; }
.fd-columns-box { display: grid; gap: 6px; }
.fd-columns { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.fd-column { display: grid; grid-template-columns: minmax(0, 1fr) 104px 28px; gap: 6px; align-items: center; }
.fd-props-actions { display: flex; flex-wrap: wrap; gap: 8px; padding-block-start: 4px; border-block-start: 1px solid var(--fd-border); }
.fd-properties-hint { color: var(--fd-muted); font-size: 13px; margin: 0; }
.fd-kind-note { font-size: 12px; margin-block-start: -4px; }
.fd-prop-when { gap: 6px; justify-items: start; }
.fd-screen-preview { background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 20px; }
/* After the panel rules, so these win when the editor is narrow: the toolbox and the panel stack around the canvas. */
@container (max-width: 1000px) {
  .fd-screen-body { grid-template-columns: minmax(0, 1fr); }
  .fd-toolbox, .fd-properties { position: static; max-height: none; }
  .fd-tools { grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); }
}
@media (prefers-reduced-motion: reduce) { .fd-properties.fd-flash { animation: none; } .fd-tool-caret { transition: none; } }
`;

const STYLE_ID = 'fieldia-designer-styles';

export function installDesignerStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = DESIGNER_CSS;
  (document.head ?? document.documentElement).append(style);
}
