import { DESIGNER_KINDS_CSS } from './styles-kinds';
import { DESIGNER_JSON_CSS } from './styles-json';

/** The designer's own chrome, on top of Fieldia's form stylesheet and tokens. */
export const DESIGNER_CSS = /* css */ `
.fd-designer { display: grid; gap: 14px; }
.fd-designer-bar {
  display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; position: sticky; top: env(safe-area-inset-top, 0px); z-index: 30;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 10px 14px;
}
.fd-designer-title { font-size: 17px; font-weight: 600; flex: 1 1 220px; max-width: 420px; min-width: 0; }
/* Where the page stands; pressed, the versions published. */
.fd-designer-status-box { display: inline-flex; }
.fd-designer-status { all: unset; box-sizing: border-box; cursor: pointer; color: var(--fd-muted); font-size: 13px; padding: 4px 8px; border-radius: 6px; }
.fd-designer-status::after { content: ""; display: inline-block; width: 5px; height: 5px; margin-inline-start: 7px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: translateY(-3px) rotate(45deg); }
.fd-designer-status:hover, .fd-designer-status[aria-expanded="true"] { background: var(--fd-page); color: var(--fd-text); }
.fd-designer-status:focus-visible { outline: 2px solid var(--fd-focus); }
/* Checks: a count of what to look at, the colour of the worst of them. */
.fd-checks-button { display: inline-flex; align-items: center; gap: 6px; }
.fd-checks-button > .fd-dicon { width: 15px; height: 15px; }
.fd-checks-count { min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px; display: inline-grid; place-items: center; font-size: 11.5px; font-weight: 700; font-variant-numeric: tabular-nums; background: var(--fd-page); color: var(--fd-muted); }
.fd-checks-button[data-state="clear"] .fd-checks-count { background: var(--fd-success-soft); color: var(--fd-success); }
.fd-checks-button[data-state="should"] .fd-checks-count { background: var(--fd-warning-soft); color: var(--fd-warning); }
.fd-checks-button[data-state="must"] .fd-checks-count { background: var(--fd-error-soft); color: var(--fd-error); }
.fd-checks {
  position: fixed; z-index: 60; width: min(380px, calc(100vw - 16px)); max-height: min(480px, calc(100vh - 16px)); overflow: auto; box-sizing: border-box;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: 10px; box-shadow: 0 18px 44px rgba(15, 20, 25, 0.18);
  padding: 6px; display: grid; gap: 4px; animation: fd-menu-in 120ms cubic-bezier(0, 0, 0.2, 1);
}
.fd-check { display: grid; gap: 6px; justify-items: start; padding: 10px; border-radius: 8px; }
.fd-check + .fd-check { border-block-start: 1px solid var(--fd-border); border-radius: 0; }
.fd-check-severity { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; border-radius: 4px; padding: 1px 6px; }
.fd-check[data-severity="must"] .fd-check-severity { color: var(--fd-error); background: var(--fd-error-soft); }
.fd-check[data-severity="should"] .fd-check-severity { color: var(--fd-warning); background: var(--fd-warning-soft); }
.fd-check-text { margin: 0; font-size: 13.5px; line-height: 1.45; }
.fd-check-fix { min-height: 30px; padding-block: 2px; font-size: 13px; }
/* Find anything: one box over all the editor can add, go to or do. */
.fd-find-button { display: inline-flex; align-items: center; gap: 6px; color: var(--fd-muted); }
.fd-find-button > .fd-dicon { width: 15px; height: 15px; }
.fd-find-keys { font: inherit; font-size: 11.5px; padding: 1px 5px; border-radius: 4px; background: var(--fd-page); color: var(--fd-muted); }
.fd-find-backdrop { z-index: 80; place-items: start center; padding-block-start: 12vh; }
.fd-find {
  width: min(560px, 100%); display: grid; overflow: hidden; background: var(--fd-surface); color: var(--fd-text);
  border: 1px solid var(--fd-border); border-radius: 12px; box-shadow: 0 24px 64px rgba(15, 20, 25, 0.3); animation: fd-menu-in 120ms cubic-bezier(0, 0, 0.2, 1);
}
.fd-find-input { font: inherit; font-size: 16px; color: inherit; background: none; border: 0; border-block-end: 1px solid var(--fd-border); padding: 14px 18px; outline: none; }
.fd-designer .fd-find-input:focus-visible { outline: none; }
.fd-find-list { max-height: min(360px, 50vh); overflow: auto; padding: 6px; display: grid; gap: 1px; }
.fd-find-list:empty { display: none; }
.fd-find-option { display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: 7px; cursor: pointer; font-size: 14px; }
.fd-find-option[aria-selected="true"] { background: var(--fd-accent-soft); }
.fd-find-option:hover { background: var(--fd-page); }
.fd-find-option[aria-selected="true"]:hover { background: var(--fd-accent-soft); }
.fd-find-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-find-hint { flex: none; font-size: 12px; color: var(--fd-muted); max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-find-none { margin: 0; padding: 16px 18px; color: var(--fd-muted); }
@media (prefers-reduced-motion: reduce) { .fd-find { animation: none; } }
/* Publish, asked first. */
.fd-publish-backdrop { z-index: 70; }
.fd-publish-dialog { max-width: 480px; background: var(--fd-surface); }
.fd-publish-body { display: grid; gap: 12px; padding: 16px 18px 4px; overflow: auto; }
.fd-publish-lead { margin: 0; font-weight: 600; }
.fd-publish-changes { margin: 0; padding-inline-start: 20px; display: grid; gap: 4px; font-size: 14px; }
.fd-publish-more { list-style: none; margin-inline-start: -20px; color: var(--fd-muted); }
.fd-publish-blocked { display: grid; gap: 4px; border: 1px solid var(--fd-error); border-radius: 8px; padding: 6px; background: color-mix(in srgb, var(--fd-error-soft) 50%, var(--fd-surface)); }
.fd-publish-blocked-head { margin: 4px 10px 0; font-weight: 600; color: var(--fd-error); }
.fd-publish-failed { margin: 0; color: var(--fd-error); }
.fd-publish-dialog .fd-form-dialog-foot { margin: 0; padding: 12px 18px 16px; }
.fd-designer .fd-spacer { flex: 1; }
.fd-designer-issues { white-space: pre-line; }
.fd-designer-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 0.8fr); gap: 20px; align-items: start; }
.fd-survey-body { grid-template-columns: 228px minmax(0, 1fr); gap: 16px; }
.fd-survey-body > .fd-designer-editor { max-width: none; }
@container (max-width: 900px) { .fd-designer-body, .fd-survey-body { grid-template-columns: minmax(0, 1fr); } .fd-survey-body > .fd-toolbox, .fd-survey-body > .fd-rail { position: static; max-height: none; } .fd-survey-body .fd-tools { grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); } }
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
.fd-designer-editor.fd-dragging { user-select: none; -webkit-user-select: none; }
/* Carried, a question leaves its place: the gap shows where it goes. */
.fd-q.fd-drag-source { display: none; }
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
/* Material's switch, as Google Forms has it: a 14px track, a 20px thumb that slides over in 90ms. */
.fd-switch { all: unset; position: relative; flex: none; width: 36px; height: 20px; cursor: pointer; border-radius: 10px; }
.fd-switch::before { content: ""; position: absolute; inset-inline: 0; top: 3px; height: 14px; border-radius: 7px; background: var(--fd-border-strong); transition: background-color 90ms cubic-bezier(0.4, 0, 0.2, 1); }
.fd-switch::after {
  content: ""; position: absolute; top: 0; inset-inline-start: 0; width: 20px; height: 20px; border-radius: 50%; background: #ffffff;
  box-shadow: 0 2px 1px -1px rgba(0, 0, 0, 0.2), 0 1px 1px 0 rgba(0, 0, 0, 0.14), 0 1px 3px 0 rgba(0, 0, 0, 0.12);
  transition: inset-inline-start 90ms cubic-bezier(0.4, 0, 0.2, 1), background-color 90ms cubic-bezier(0.4, 0, 0.2, 1);
}
.fd-switch[aria-checked="true"]::before { background: color-mix(in srgb, var(--fd-accent) 54%, transparent); }
.fd-switch[aria-checked="true"]::after { inset-inline-start: 16px; background: var(--fd-accent); }
.fd-switch:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .fd-switch::before, .fd-switch::after { transition: none; } }
.fd-q-options { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.fd-q-option { display: flex; gap: 8px; align-items: center; }
.fd-q-bullet { color: var(--fd-muted); width: 16px; text-align: center; }
.fd-q-option-box { display: grid; gap: 4px; justify-items: start; }
.fd-q-option-box > ul { width: 100%; }
/* "Add option or add "Other"", and "Other…" once added: words and links, never boxes — pointed at, only a line under them. */
.fd-q-add-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.fd-q-option-box .fd-q-add-row > .fd-button-link { border: 0; background-color: transparent; box-shadow: none; padding: 2px 0; min-height: 0; font-weight: 400; }
.fd-q-option-box .fd-q-add-row > .fd-button-link:hover { text-decoration: underline; text-underline-offset: 4px; }
.fd-q-option-box .fd-q-add-row > .fd-button-link:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; border-radius: 2px; }
.fd-q-or { color: var(--fd-muted); font-size: 13px; }
.fd-q-option-other { display: flex; align-items: center; gap: 8px; width: 100%; }
.fd-q-other-words { flex: 1; min-width: 0; color: var(--fd-muted); padding: 6px 0; border-bottom: 1px dotted color-mix(in srgb, var(--fd-text) 38%, transparent); }
.fd-q-foot { display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center; border-block-start: 1px solid var(--fd-border); padding-block-start: 10px; }
.fd-icon-button {
  font: inherit; border: none; background: none; cursor: pointer; color: var(--fd-muted); width: 30px; height: 30px; border-radius: 6px;
  display: inline-grid; place-items: center; font-size: 15px;
}
.fd-icon-button:hover { background: var(--fd-page); color: var(--fd-text); }
.fd-icon-danger:hover { color: var(--fd-error); background: var(--fd-error-soft); }

/* ---- Design or Try it: the page working as people will use it ---- */
.fd-mode { display: inline-flex; padding: 2px; border-radius: 9px; background: var(--fd-page); border: 1px solid var(--fd-border); }
.fd-mode-button { all: unset; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 7px; font-size: 13.5px; font-weight: 600; color: var(--fd-muted); cursor: pointer; }
.fd-mode-button[aria-pressed="true"] { background: var(--fd-surface); color: var(--fd-text); box-shadow: 0 1px 2px rgba(15, 20, 25, 0.12); }
.fd-mode-button[data-mode="try"][aria-pressed="true"] { background: var(--fd-success); color: #ffffff; }
.fd-mode-button:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-try { display: grid; gap: 14px; }
.fd-try-bar { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: space-between; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 8px 12px; }
.fd-try-group { display: inline-flex; padding: 2px; border-radius: 8px; background: var(--fd-page); border: 1px solid var(--fd-border); }
.fd-try-button { all: unset; display: inline-grid; place-items: center; min-width: 30px; height: 28px; padding: 0 9px; border-radius: 6px; font-size: 13px; font-weight: 600; color: var(--fd-muted); cursor: pointer; }
.fd-try-button[aria-pressed="true"] { background: var(--fd-surface); color: var(--fd-text); box-shadow: 0 1px 2px rgba(15, 20, 25, 0.12); }
.fd-try-button:focus-visible { outline: 2px solid var(--fd-focus); }
.fd-try-note { margin: 0; color: var(--fd-muted); font-size: 13px; flex: 1 1 220px; text-align: center; }
.fd-try-frame { margin-inline: auto; width: 100%; max-width: 1100px; box-sizing: border-box; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 20px; transition: max-width 0.3s ease; }
.fd-try-frame[data-width="tablet"] { max-width: 768px; }
.fd-try-frame[data-width="phone"] { max-width: 390px; padding: 14px; }
/* A quiz sent in Try it: its score, under the thanks. */
.fd-try-score { margin: 0; font-size: 17px; font-weight: 650; color: var(--fd-accent); font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { .fd-try-frame { transition: none; } }

/* ---- the screen editor: toolbox, canvas, panel ---- */
.fd-screen-body { display: grid; grid-template-columns: 228px minmax(0, 1fr) 280px; gap: 16px; align-items: start; }
.fd-toolbox, .fd-properties, .fd-rail {
  position: sticky; top: 76px; display: grid; gap: 6px; align-content: start; max-height: calc(100vh - 96px); overflow: auto;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 12px;
}
.fd-panel-title { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fd-muted); margin-block-end: 2px; }
.fd-properties.fd-flash { animation: fd-flash 0.8s ease; }
@keyframes fd-flash { from { box-shadow: 0 0 0 3px var(--fd-accent-soft), inset 3px 0 0 var(--fd-accent); } to { box-shadow: none; } }

/* The toolbox: icons three to a row, in groups that fold, as Quantia's. */
.fd-toolbox { padding: 10px 6px; gap: 4px; }
/* Beside the page: Add (the toolbox), Outline and Data, in tabs. */
.fd-rail { padding: 8px 6px 10px; gap: 8px; }
.fd-rail > .fd-rail-pane { position: static; max-height: none; overflow: visible; border: 0; padding: 0; background: none; }
.fd-rail-tabs { display: flex; gap: 2px; padding: 2px; margin: 0 4px; border-radius: 8px; background: var(--fd-page); }
.fd-rail-tab { all: unset; box-sizing: border-box; flex: 1; text-align: center; cursor: pointer; padding: 5px 4px; border-radius: 6px; font-size: 12.5px; font-weight: 600; color: var(--fd-muted); }
.fd-rail-tab[aria-selected="true"] { background: var(--fd-surface); color: var(--fd-text); box-shadow: 0 1px 2px rgba(15, 20, 25, 0.12); }
.fd-rail-tab:focus-visible { outline: 2px solid var(--fd-focus); }
.fd-outline, .fd-data { display: grid; gap: 8px; padding: 0 4px; min-width: 0; }
.fd-outline-tree { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; }
.fd-outline-tree button {
  all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: flex; align-items: center; gap: 6px; padding: 5px 6px;
  padding-inline-start: calc(6px + var(--fd-level, 0) * 14px); border-radius: 6px; font-size: 13px; min-width: 0;
}
.fd-outline-tree button:hover { background: var(--fd-page); }
.fd-outline-tree button[aria-current="true"] { background: var(--fd-accent-soft); color: var(--fd-accent); }
.fd-outline-tree button:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-outline-tree button[data-level="0"] { font-weight: 600; }
.fd-outline-tree .fd-dicon { width: 14px; height: 14px; flex: none; color: var(--fd-muted); }
.fd-outline-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-outline-when { display: inline-flex; color: var(--fd-warning); }
.fd-outline-kind { flex: none; font-size: 11px; color: var(--fd-muted); max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-data-card { display: grid; gap: 2px; padding: 10px; border-radius: 8px; background: var(--fd-page); font-size: 12.5px; color: var(--fd-muted); }
.fd-data-model { font-size: 14px; color: var(--fd-text); overflow-wrap: anywhere; }
.fd-seg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 2px; padding: 2px; border-radius: 8px; background: var(--fd-page); }
.fd-seg-button { all: unset; box-sizing: border-box; cursor: pointer; padding: 4px 6px; border-radius: 6px; font-size: 12px; color: var(--fd-muted); text-align: center; font-variant-numeric: tabular-nums; }
.fd-seg-button[aria-pressed="true"] { background: var(--fd-surface); color: var(--fd-text); box-shadow: 0 1px 2px rgba(15, 20, 25, 0.12); }
.fd-seg-button:focus-visible { outline: 2px solid var(--fd-focus); }
.fd-data-rows { display: grid; gap: 0; }
.fd-data-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1px 8px; padding: 7px 2px; border-block-start: 1px solid var(--fd-border); font-size: 13px; align-items: center; }
.fd-data-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-data-used { font-size: 11px; color: var(--fd-muted); }
.fd-data-used.fd-data-on { color: var(--fd-success); }
.fd-data-row code { grid-column: 1; font-size: 11px; color: var(--fd-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-data-row .fd-button-link { grid-column: 2; justify-self: end; padding: 0; min-height: 0; font-size: 12px; }
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
.fd-canvas { container-type: inline-size; display: grid; gap: 18px; min-width: 0; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 22px 32px 30px; }
/* A field's grip: six dots just beside it, shown when it is pointed at or picked. */
.fd-card-grip {
  all: unset; box-sizing: border-box; position: absolute; top: 6px; inset-inline-start: -20px; width: 16px; height: 24px; display: grid; place-items: center;
  border-radius: 4px; color: var(--fd-muted); cursor: grab; opacity: 0; transition: opacity 120ms; touch-action: none;
}
.fd-card-grip > .fd-dicon { width: 14px; height: 14px; }
.fd-canvas-field:hover > .fd-card-grip, .fd-canvas-field.fd-editing > .fd-card-grip, .fd-card-grip:focus-visible { opacity: 1; }
.fd-card-grip:hover { background: var(--fd-page); color: var(--fd-text); }
.fd-card-grip:active { cursor: grabbing; }
@media (prefers-reduced-motion: reduce) { .fd-card-grip { transition: none; } }
.fd-canvas-body { display: grid; gap: 26px; }
.fd-canvas-title.fd-canvas-title-filled { color: var(--fd-text); }
.fd-canvas-title { all: unset; box-sizing: border-box; cursor: pointer; font-size: 26px; font-weight: 650; line-height: 1.25; color: var(--fd-muted); padding: 8px 14px; border: 1px dashed var(--fd-border-strong); border-radius: var(--fd-radius); background: var(--fd-surface); }
.fd-canvas-title:hover { color: var(--fd-text); }
.fd-canvas-title.fd-canvas-selected { border-style: solid; border-color: var(--fd-accent); }
/* A section pointed at or picked: a bar down its side, just outside it — never a frame round the frames of its fields. */
.fd-canvas-section { border-radius: 6px; }
.fd-canvas-section::before { content: ""; position: absolute; inset-block: 0; inset-inline-start: -12px; width: 3px; border-radius: 2px; background: transparent; pointer-events: none; }
.fd-canvas-section:hover::before { background: var(--fd-border-strong); }
.fd-canvas-section.fd-canvas-selected::before { background: var(--fd-accent); }
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
.fd-canvas-field:hover { background: color-mix(in srgb, var(--fd-text) 4%, transparent); }
/* Picked, the Google Forms way: tinted, with a bar down its side — no frame round its box's own frame. */
.fd-canvas-field.fd-editing { background: var(--fd-accent-soft); box-shadow: inset 3px 0 0 var(--fd-accent); cursor: default; }
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
.fd-canvas-label-input:focus { border-bottom: 2px solid var(--fd-accent); padding-bottom: 0; }
/* Typed in where they stand, the line under the words is the focus: no ring round them too. */
.fd-designer .fd-canvas-label-input:focus-visible, .fd-designer .fd-canvas-help-input:focus-visible, .fd-designer .fd-part-input:focus-visible, .fd-designer .fd-canvas-section-title-input:focus-visible { outline: none; }
/* A picked choice's options: words on a line, as the survey's, not boxes in the picked field. */
.fd-canvas-field .fd-q-option > .fd-input { border: 0; border-bottom: 1px solid var(--fd-border); border-radius: 0; background: none; box-shadow: none; padding-inline: 0; min-height: 30px; }
.fd-canvas-field .fd-q-option > .fd-input:focus { border-bottom: 2px solid var(--fd-accent); }
.fd-canvas-help-input { font: inherit; font-size: 12.5px; color: var(--fd-muted); border: 0; border-bottom: 1px dashed transparent; background: none; padding: 1px 0; outline: none; width: 100%; box-sizing: border-box; cursor: text; }
.fd-canvas-help-input:hover, .fd-canvas-help-input:focus { border-bottom-color: var(--fd-border-strong); }
.fd-canvas-help-input::placeholder { color: var(--fd-muted); opacity: 0.75; }
.fd-canvas-field .fd-q-option-box { padding-block: 2px; }
/* A kind's own settings, in the picked field: words and a line to type or pick on — no boxes in it. */
.fd-inline-settings { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; padding-block: 4px 2px; font-size: 13px; color: var(--fd-muted); }
.fd-inline-setting { display: inline-flex; align-items: center; gap: 6px; }
.fd-inline-select, .fd-inline-input, .fd-inline-settings .fd-column > .fd-input {
  font: inherit; font-size: 13.5px; color: var(--fd-text); background: none; border: 0; border-bottom: 1px solid var(--fd-border-strong);
  border-radius: 0; box-shadow: none; padding: 2px 0; min-height: 0;
}
.fd-inline-select { padding-inline-end: 2px; cursor: pointer; }
.fd-inline-input { width: 12ch; }
.fd-inline-currency { width: 4.5ch; text-transform: uppercase; }
.fd-designer .fd-inline-select:focus-visible, .fd-designer .fd-inline-input:focus-visible, .fd-designer .fd-inline-settings .fd-column > .fd-input:focus-visible { outline: none; }
.fd-inline-select:focus, .fd-inline-input:focus, .fd-inline-settings .fd-column > .fd-input:focus { border-bottom: 2px solid var(--fd-accent); padding-bottom: 1px; }
.fd-inline-settings .fd-columns-box { width: 100%; justify-items: start; }
.fd-inline-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; width: 100%; }
/* A scale's end, its number then its words. */
.fd-inline-end { display: flex; align-items: center; gap: 12px; width: 100%; max-width: 360px; }
.fd-inline-end-number { min-width: 20px; color: var(--fd-text); font-variant-numeric: tabular-nums; }
.fd-inline-end-words { flex: 1; width: auto; }
/* Kinds of file, on or off. */
.fd-inline-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.fd-inline-chip {
  all: unset; box-sizing: border-box; cursor: pointer; padding: 3px 10px; border-radius: 999px; font-size: 12.5px; color: var(--fd-text);
  background: color-mix(in srgb, var(--fd-text) 6%, transparent);
}
.fd-inline-chip:hover { background: color-mix(in srgb, var(--fd-text) 10%, transparent); }
.fd-inline-chip[aria-pressed="true"] { background: var(--fd-accent-soft); color: var(--fd-accent); font-weight: 600; }
.fd-inline-chip:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-inline-settings .fd-columns { width: 100%; }
.fd-inline-settings .fd-column { grid-template-columns: minmax(0, 1fr) 110px 28px; }
.fd-canvas-tabs-head { display: flex; align-items: flex-end; gap: 4px; }
.fd-canvas-tabs-head > .fd-tablist { flex: 1; }
.fd-canvas-tab.fd-canvas-selected { background: var(--fd-accent-soft); border-radius: 3px 3px 0 0; }
.fd-canvas-tabs.fd-canvas-selected { outline: 2px solid var(--fd-accent); outline-offset: 6px; border-radius: 4px; }
.fd-canvas-add-tab { all: unset; cursor: pointer; width: 28px; height: 28px; margin-block-end: 4px; display: grid; place-items: center; border-radius: 4px; color: var(--fd-muted); font-size: 18px; }
.fd-canvas-add-tab:hover { background: var(--fd-page); color: var(--fd-accent); }
.fd-canvas-add-tab:focus-visible, .fd-canvas-title:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }

/* A record's header on the canvas: the viewer's own parts, picked by a click, with a quiet way to add each kind. */
.fd-canvas-header { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: space-between; padding: 6px 0 12px; border-block-end: 1px solid var(--fd-border); }
.fd-canvas-header-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.fd-canvas-header-card { display: grid; gap: 10px; justify-items: stretch; }
/* Not at the card's edge here, as the viewer's are: no reaching out to it. */
.fd-canvas .fd-canvas-stats { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; align-items: center; margin: 0; border-block-end: 0; }
.fd-canvas-badges { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.fd-canvas-part { position: relative; cursor: pointer; outline-offset: 3px; }
.fd-canvas-part:hover { box-shadow: 0 0 0 2px var(--fd-border); }
/* Picked: its own edge turns the accent, one line, not a ring round it. */
.fd-canvas-part.fd-editing { box-shadow: 0 0 0 2px var(--fd-accent); cursor: default; }
.fd-canvas-part:focus-visible { outline: 2px solid var(--fd-focus); }
.fd-canvas-statusbar { border-radius: 6px; min-width: 0; }
.fd-canvas-statusbar .fd-canvas-widget { pointer-events: none; }
.fd-part-input { font: inherit; color: inherit; background: none; border: 0; border-bottom: 1px dashed currentColor; padding: 0; outline: none; min-width: 4ch; field-sizing: content; cursor: text; }
.fd-stat .fd-part-input { font-size: 12px; }
.fd-part-bar { bottom: calc(100% + 8px); }
.fd-canvas-add-part {
  all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; padding: 4px 9px; border-radius: 6px;
  border: 1px dashed var(--fd-border-strong); color: var(--fd-muted); font-size: 12.5px; white-space: nowrap;
}
.fd-canvas-add-part:hover { color: var(--fd-accent); border-color: var(--fd-accent); }
.fd-canvas-add-part:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-canvas-add-part .fd-dicon { width: 13px; height: 13px; }

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
.fd-menu { animation: fd-menu-in 120ms cubic-bezier(0, 0, 0.2, 1); transform-origin: top center; }
@keyframes fd-menu-in { from { opacity: 0; transform: scale(0.94); } }
.fd-menu-divider { height: 1px; background: var(--fd-border); margin: 5px -6px; }
/* Google Forms' roomy menu: full-width rows, an icon on each, the choice tinted. */
.fd-menu-roomy { padding: 8px 0; min-width: 224px; border-radius: 6px; }
.fd-menu-roomy .fd-menu-title { padding: 4px 16px 6px; }
.fd-menu-roomy .fd-menu-item { min-height: 44px; padding: 0 16px; gap: 16px; border-radius: 0; font-size: 14px; }
.fd-menu-roomy .fd-menu-item > .fd-dicon { width: 22px; height: 22px; color: var(--fd-muted); flex: none; }
.fd-menu-roomy .fd-menu-item[aria-checked="true"] { background: var(--fd-accent-soft); }
.fd-menu-roomy .fd-menu-item[aria-checked="true"] > .fd-dicon { color: var(--fd-accent); }
.fd-menu-roomy .fd-menu-divider { margin: 8px 0; }
@media (prefers-reduced-motion: reduce) { .fd-menu { animation: none; } }

/* Dragging: a chip with its name follows the pointer; a gap its size opens where it lands, the others moving aside. */
.fd-drag-ghost.fd-drag-chip {
  position: fixed; z-index: 100; pointer-events: none; margin: 0; max-width: 260px; padding: 6px 12px; box-sizing: border-box;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; color: var(--fd-text);
  background: var(--fd-surface); border: 1px solid var(--fd-accent); border-radius: 8px; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
}
.fd-drop-slot {
  box-sizing: border-box; min-height: 44px; border: 2px dashed var(--fd-accent); border-radius: 8px; background: var(--fd-accent-soft);
  grid-column: span min(var(--fd-span, 1), var(--fd-columns, 1));
}
.fd-canvas-field.fd-drag-source { display: none; }
.fd-drag-source-dim { opacity: 0.35; }
.fd-drop-marker { position: fixed; z-index: 99; pointer-events: none; background: var(--fd-accent); border-radius: 2px; }
.fd-canvas-section { position: relative; }
/* With the gap in it, an empty section says nothing about being empty. */
.fd-canvas-section:has(.fd-drop-slot) .fd-canvas-empty { display: none; }

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
.fd-q-required-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }

/* ---- The survey, the Google Forms way ------------------------------------------------------------
   On a page tinted with the accent: a card heading the form, then quiet white cards 8px round, 24px in,
   12px apart, no wider than 770px. The card picked lifts, a 6px bar down its side; its words sit in a
   filled box whose line grows from the middle; its tools are beside it, following it down the page. */
.fd-survey-canvas { background: color-mix(in srgb, var(--fd-accent) 8%, var(--fd-surface)); border-radius: var(--fd-radius); padding: 16px 68px 28px 16px; padding-inline: 16px 68px; }
.fd-survey-column { position: relative; width: 100%; max-width: 770px; margin-inline: auto; display: grid; gap: 12px; }
.fd-survey-column > .fd-button { justify-self: start; }
.fd-line { position: relative; display: block; border-block-end: 1px solid transparent; }
.fd-line > input { font: inherit; color: inherit; background: none; border: 0; outline: none; width: 100%; box-sizing: border-box; padding: 6px 0; margin: 0; }
.fd-line > input::placeholder { color: var(--fd-muted); }
/* The growing line is the focus here, as in Google Forms: no ring around it too. */
.fd-designer .fd-line > input:focus, .fd-designer .fd-line > input:focus-visible { outline: none; box-shadow: none; }
.fd-line:hover { border-block-end-color: var(--fd-border); }
.fd-line::after { content: ""; position: absolute; inset-inline: 0; bottom: -1px; height: 2px; background: var(--fd-accent); transform: scaleX(0); transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1); }
.fd-line:focus-within::after { transform: scaleX(1); }
.fd-survey-head { position: relative; display: grid; gap: 6px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: 8px; padding: 26px 24px 22px; }
.fd-survey-head::before { content: ""; position: absolute; top: -1px; inset-inline: -1px; height: 10px; background: var(--fd-accent); border-radius: 8px 8px 0 0; }
.fd-survey-head-title { font-size: 32px !important; line-height: 1.25; }
.fd-survey-head-description { font-size: 14px !important; }
.fd-survey-canvas .fd-designer-pages { gap: 12px; }
/* A page: its own card, its number on a tab over it. */
.fd-survey-canvas .fd-design-step { background: none; border: 0; padding: 0; gap: 12px; border-radius: 0; }
.fd-survey-canvas .fd-step-head {
  position: relative; display: grid; gap: 8px; margin-block-start: 30px; padding: 18px 24px 20px;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: 0 8px 8px 8px;
}
.fd-survey-canvas .fd-step-number { position: absolute; bottom: 100%; inset-inline-start: -1px; border-radius: 8px 8px 0 0; padding: 5px 14px; font-size: 13px; font-weight: 500; }
.fd-step-head-row { display: flex; gap: 8px; align-items: center; }
.fd-step-title-box { flex: 1; min-width: 0; }
.fd-survey-canvas .fd-step-title { font-size: 22px; font-weight: 400; }
.fd-survey-canvas .fd-step-selected { border: 0; }
.fd-survey-canvas .fd-step-selected > .fd-step-head { box-shadow: 0 2px 1px -1px rgba(0, 0, 0, 0.2), 0 1px 1px 0 rgba(0, 0, 0, 0.14), 0 1px 3px 0 rgba(0, 0, 0, 0.12); }
.fd-survey-canvas .fd-step-selected > .fd-step-head::after { content: ""; position: absolute; inset-block: -1px; inset-inline-start: -1px; width: 6px; background: var(--fd-accent); border-end-start-radius: 8px; }
.fd-survey-canvas .fd-step-cards { gap: 12px; }
.fd-survey-canvas .fd-add-question { justify-self: start; color: var(--fd-muted); }
.fd-survey-canvas .fd-add-question:hover { color: var(--fd-accent); }
/* A question: flat until picked. */
.fd-survey-canvas .fd-q { border: 1px solid var(--fd-border); border-radius: 8px; padding: 24px; gap: 12px; }
.fd-survey-canvas .fd-q-closed:hover { border-color: var(--fd-border); }
.fd-survey-canvas .fd-q-title { font-size: 16px; }
.fd-survey-canvas .fd-q-selected { padding-block-start: 24px; box-shadow: 0 2px 1px -1px rgba(0, 0, 0, 0.2), 0 1px 1px 0 rgba(0, 0, 0, 0.14), 0 1px 3px 0 rgba(0, 0, 0, 0.12); }
.fd-survey-canvas .fd-q-selected::before { content: ""; position: absolute; inset-block: -1px; inset-inline-start: -1px; width: 6px; background: var(--fd-accent); border-start-start-radius: 8px; border-end-start-radius: 8px; }
/* The six dots, across the top, only where the pointer is. */
.fd-survey-canvas .fd-q-grip { top: 0; height: 24px; transform: translateX(-50%) rotate(90deg); opacity: 0; transition: opacity 150ms; }
.fd-survey-canvas .fd-q:hover .fd-q-grip, .fd-survey-canvas .fd-q-grip:focus-visible { opacity: 1; }
.fd-survey-canvas .fd-q-head { gap: 16px; align-items: start; }
.fd-q-label-box { background: color-mix(in srgb, var(--fd-text) 3%, var(--fd-surface)); border-block-end: 1px solid var(--fd-muted); border-radius: 4px 4px 0 0; }
.fd-q-label-box:hover { border-block-end-color: var(--fd-text); }
.fd-q-label-box > .fd-q-label { padding: 16px; min-height: 56px; font-size: 16px; }
.fd-q-help-box { border-block-end-color: var(--fd-border); }
.fd-q-help-box > .fd-q-help { font-size: 14px; }
.fd-survey-canvas .fd-q-kind { min-height: 48px; min-width: 222px; padding: 0 14px; gap: 12px; border-radius: 4px; font-weight: 500; }
.fd-survey-canvas .fd-q-kind-icon .fd-dicon { color: var(--fd-muted); }
/* What goes in the answer, said on a dotted line. */
.fd-q-preview { color: var(--fd-muted); font-size: 14px; padding-block: 8px 6px; border-block-end: 1px dotted color-mix(in srgb, var(--fd-text) 38%, transparent); width: min(50%, 380px); }
.fd-q-preview-long { width: min(80%, 600px); }
.fd-q-preview-date { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.fd-q-preview-date > .fd-dicon { width: 18px; height: 18px; flex: none; }
.fd-q-preview-list { list-style: none; margin: 0; padding: 0; border: 0; width: auto; display: grid; gap: 10px; color: var(--fd-text); }
/* Where answers lead: the pages on one line, those for some answers off it and back. */
.fd-branch-map { background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: 8px; padding: 10px 16px 12px; min-width: 0; }
.fd-branch-summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--fd-muted); }
.fd-branch-summary:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; border-radius: 4px; }
.fd-branch-scroll { overflow-x: auto; margin-block-start: 10px; }
.fd-branch-svg { display: block; height: auto; }
.fd-branch-edge { fill: none; stroke: var(--fd-muted); stroke-width: 1.5; }
.fd-branch-off { stroke: var(--fd-warning); }
.fd-branch-head { fill: var(--fd-muted); }
.fd-branch-box { fill: var(--fd-surface); stroke: var(--fd-border-strong); stroke-width: 1; transition: stroke 120ms; }
.fd-branch-page { cursor: pointer; outline: none; }
.fd-branch-page:hover .fd-branch-box, .fd-branch-page:focus-visible .fd-branch-box { stroke: var(--fd-accent); }
.fd-branch-page:focus-visible .fd-branch-box { stroke-width: 2; }
.fd-branch-page.fd-picked .fd-branch-box { fill: var(--fd-accent-soft); stroke: var(--fd-accent); stroke-width: 2; }
.fd-branch-title { fill: var(--fd-text); font-size: 14px; font-weight: 600; }
.fd-branch-when { fill: var(--fd-warning); font-size: 12.5px; font-weight: 600; }
@media (prefers-reduced-motion: reduce) { .fd-branch-box { transition: none; } }
/* Options: a ring or a box, the words on a line that shows when pointed at, × at the end. */
.fd-survey-canvas .fd-q-options { gap: 0; }
.fd-survey-canvas .fd-q-option { min-height: 44px; gap: 12px; }
.fd-survey-canvas .fd-q-bullet { font-size: 0; flex: none; width: 20px; height: 20px; box-sizing: border-box; border: 2px solid var(--fd-border-strong); border-radius: 50%; }
.fd-survey-canvas [data-multiple] .fd-q-bullet { border-radius: 3px; }
.fd-survey-canvas .fd-q-option > .fd-input { flex: 1; min-width: 0; border: 0; border-block-end: 1px solid transparent; border-radius: 0; background: none; box-shadow: none; padding: 6px 0; min-height: 0; font-size: 14.5px; }
.fd-survey-canvas .fd-q-option > .fd-input:hover { border-block-end-color: var(--fd-border); }
.fd-survey-canvas .fd-q-option > .fd-input:focus { border-block-end: 2px solid var(--fd-accent); padding-block-end: 5px; outline: none; box-shadow: none; }
.fd-survey-canvas .fd-q-option > .fd-icon-button { opacity: 0.55; font-size: 20px; }
.fd-survey-canvas .fd-q-option > .fd-icon-button:hover { opacity: 1; }
.fd-survey-canvas .fd-q-option-box { gap: 0; }
.fd-survey-canvas .fd-q-add-row { min-height: 44px; gap: 6px; }
/* The ghost of the next option: an empty ring, box or number before "Add option", as Google Forms draws it. */
.fd-survey-canvas .fd-q-add-option { display: inline-flex; align-items: center; gap: 12px; color: var(--fd-muted) !important; text-decoration: none; }
.fd-survey-canvas .fd-q-add-option::before { content: ""; flex: none; width: 20px; height: 20px; box-sizing: border-box; border: 2px solid var(--fd-border); border-radius: 50%; }
.fd-survey-canvas [data-multiple] .fd-q-add-option::before { border-radius: 3px; }
.fd-survey-canvas [data-numbered] .fd-q-add-option::before { content: var(--fd-next-number, ""); border: 0; width: auto; min-width: 20px; height: auto; font-size: 14px; color: var(--fd-muted); }
/* Pointed at: a line grows under its words, past the ring — a box never. */
.fd-survey-canvas .fd-q-add-option { background-image: linear-gradient(currentColor, currentColor); background-size: 0 1px; background-repeat: no-repeat; background-position: 32px 100%; padding-bottom: 3px !important; transition: background-size 200ms; }
.fd-survey-canvas .fd-q-add-option:hover { color: var(--fd-text) !important; text-decoration: none !important; background-size: calc(100% - 32px) 1px; }
.fd-survey-canvas .fd-q-add-other { color: var(--fd-accent); }
.fd-survey-canvas [data-numbered] .fd-q-bullet { font-size: 14px; border: 0; border-radius: 0; width: auto; min-width: 20px; height: auto; color: var(--fd-text); }
.fd-survey-canvas .fd-q-option-other { min-height: 44px; gap: 12px; }
@media (prefers-reduced-motion: reduce) { .fd-survey-canvas .fd-q-add-option { transition: none; } }
/* The foot: copy, delete, a line, Required, ⋮ — at the end, as Google Forms has them. */
.fd-survey-canvas .fd-q-foot { justify-content: flex-end; gap: 2px; min-height: 48px; padding-block-start: 8px; margin-block-start: 4px; }
.fd-q-tool { all: unset; box-sizing: border-box; width: 40px; height: 40px; border-radius: 50%; display: inline-grid; place-items: center; color: var(--fd-muted); cursor: pointer; transition: background-color 150ms; }
.fd-q-tool:hover, .fd-q-tool[aria-expanded="true"] { background: color-mix(in srgb, var(--fd-text) 7%, transparent); color: var(--fd-text); }
.fd-q-tool:focus-visible { outline: 2px solid var(--fd-focus); }
.fd-q-tool > .fd-dicon { width: 21px; height: 21px; }
.fd-q-tool-danger:hover { color: var(--fd-error); }
.fd-survey-canvas .fd-q-sep { height: 32px; margin-inline: 10px; }
.fd-survey-canvas .fd-q-required-words { font-size: 14px; font-weight: 500; margin-inline-end: 8px; }
.fd-survey-canvas .fd-q-foot .fd-switch { margin-inline-end: 6px; }
/* The tools beside the card picked, level with its top, sliding to the next one picked. */
.fd-q-rail {
  position: absolute; top: 0; inset-inline-start: calc(100% + 12px); z-index: 4; display: grid; gap: 2px; padding: 4px;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: 8px;
  box-shadow: 0 2px 1px -1px rgba(0, 0, 0, 0.2), 0 1px 1px 0 rgba(0, 0, 0, 0.14), 0 1px 3px 0 rgba(0, 0, 0, 0.12);
  transform: translateY(var(--fd-rail-y, 0px)); transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
}
.fd-rail-button { all: unset; box-sizing: border-box; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; color: var(--fd-muted); cursor: pointer; }
.fd-rail-button:hover { background: color-mix(in srgb, var(--fd-text) 7%, transparent); color: var(--fd-text); }
.fd-rail-button:focus-visible { outline: 2px solid var(--fd-focus); }
.fd-rail-button > .fd-dicon { width: 22px; height: 22px; }
@container (max-width: 620px) {
  .fd-survey-canvas { padding-inline: 10px; }
  .fd-q-rail { position: sticky; bottom: 12px; inset-inline-start: auto; justify-self: center; display: flex; transform: none; }
}
@media (prefers-reduced-motion: reduce) { .fd-line::after, .fd-q-rail, .fd-survey-canvas .fd-q-grip { transition: none; } }
.fd-props > .fd-prop > .fd-button { justify-self: start; }
.fd-list-search-fields { display: flex; flex-wrap: wrap; gap: 4px 14px; }
.fd-list-filters { display: grid; gap: 8px; }
.fd-list-filter { margin: 0; display: grid; gap: 6px; padding: 8px; border: 1px solid var(--fd-border); border-radius: 6px; min-width: 0; }
.fd-list-filter-condition { display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); gap: 6px; }
.fd-list-filter-value { display: contents; }
.fd-list-filter-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.fd-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.fd-chips:empty { display: none; }
.fd-chip { display: inline-flex; align-items: center; gap: 4px; padding-block: 2px; padding-inline: 8px 2px; border-radius: 4px; background: var(--fd-success-soft); color: var(--fd-success); font-size: 13px; }
.fd-chip-remove { all: unset; cursor: pointer; width: 18px; height: 18px; display: grid; place-items: center; border-radius: 3px; font-size: 15px; line-height: 1; }
.fd-chip-remove:hover, .fd-chip-remove:focus-visible { background: var(--fd-surface); }

/* A list on the canvas: the viewer's own list, its columns picked by a click and carried along the row. */
.fd-list-canvas .fd-canvas-search { cursor: pointer; border-radius: var(--fd-control-radius); }
.fd-list-canvas .fd-canvas-search:hover .fd-search-field { border-color: var(--fd-accent); }
.fd-list-canvas .fd-canvas-search:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-search-placeholder { color: var(--fd-muted); font-size: 14px; padding: 5px 4px; }
.fd-canvas-selection { display: flex; }
.fd-canvas-selection-hint { color: var(--fd-muted); font-size: 12.5px; margin-inline-end: 4px; }
.fd-canvas-list-actions { display: contents; }
.fd-canvas-list-scroll { position: relative; }
.fd-list-canvas .fd-list-table th.fd-canvas-column { position: relative; cursor: grab; user-select: none; }
.fd-list-canvas .fd-list-table th.fd-canvas-column:hover { background: var(--fd-page); }
.fd-list-canvas .fd-list-table th.fd-canvas-column:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-list-canvas .fd-list-table th.fd-picked { box-shadow: inset 0 0 0 2px var(--fd-accent); background: var(--fd-accent-soft); }
.fd-list-canvas .fd-list-table td.fd-picked { background: var(--fd-accent-soft); }
.fd-list-canvas .fd-list-table td { cursor: pointer; }
/* Narrower than the running list, so a list's columns fit beside the toolbox and the panel. */
.fd-list-canvas .fd-list-table td, .fd-list-canvas .fd-list-table th.fd-canvas-column { max-width: 12em; overflow: hidden; text-overflow: ellipsis; }
.fd-list-canvas .fd-list-table .fd-list-checkbox { cursor: default; }
.fd-list-canvas .fd-list-row:hover td { background: none; }
.fd-list-canvas .fd-list-row:hover td.fd-picked { background: var(--fd-accent-soft); }
.fd-column-bar { bottom: auto; top: calc(100% + 6px); inset-inline-end: auto; inset-inline-start: 0; }
/* "+ Column" stays at the row's end however far the table scrolls. */
.fd-list-canvas .fd-list-table .fd-canvas-add-column { position: sticky; inset-inline-end: 0; z-index: 1; width: 1%; padding-inline: 8px; background: var(--fd-surface); border-inline-start: 1px solid var(--fd-border); box-shadow: -6px 0 8px -6px rgba(15, 23, 42, 0.18); }
.fd-canvas-add-column .fd-canvas-add-part { padding: 2px 6px; font-weight: 400; border: 0; color: var(--fd-accent); }
.fd-canvas.fd-dragging .fd-list-table th.fd-canvas-column { cursor: grabbing; }
/* After the panel rules, so these win when the editor is narrow: the toolbox and the panel stack around the canvas. */
@container (max-width: 1000px) {
  .fd-screen-body { grid-template-columns: minmax(0, 1fr); }
  .fd-toolbox, .fd-properties, .fd-rail { position: static; max-height: none; }
  .fd-tools { grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); }
}
@media (prefers-reduced-motion: reduce) { .fd-properties.fd-flash { animation: none; } .fd-tool-caret { transition: none; } }
`;

const STYLE_ID = 'fieldia-designer-styles';

export function installDesignerStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = DESIGNER_CSS + DESIGNER_JSON_CSS + DESIGNER_KINDS_CSS;
  (document.head ?? document.documentElement).append(style);
}
