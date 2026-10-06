/**
 * The steps' look: a list of sentences in light boxes that open in place, as
 * the answer rules are, with a grip to move each; the steps run once a page
 * is saved indented under the step that opened it, by a line on one side, so
 * no box stands in a box; the form's moments one under another; and the mark
 * a part that does something wears on the canvas. Logical properties
 * throughout, so right to left mirrors on its own.
 */
export const DESIGNER_STEPS_CSS = /* css */ `
/* ---- the list ---- */
.fd-do { display: grid; gap: 6px; min-width: 0; }
.fd-do-holder { display: grid; gap: 6px; min-width: 0; }
.fd-do-holder[hidden], .fd-do-list[hidden] { display: none; }
.fd-do-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; min-width: 0; }
.fd-do-head { gap: 0; padding-inline: 0 4px; }
.fd-do-grip { flex: none; display: grid; place-items: center; width: 18px; align-self: stretch; color: var(--fd-muted); cursor: grab; touch-action: none; }
.fd-do-grip > .fd-dicon { width: 14px; height: 14px; }
.fd-do-grip[hidden] { display: none; }
.fd-do-grip:hover { color: var(--fd-text); }
.fd-do-grip:not([hidden]) + .fd-do-say { padding-inline-start: 4px; }
.fd-do-lifted { box-shadow: 0 8px 20px rgba(15, 20, 25, 0.16); position: relative; z-index: 2; }
.fd-do-lifted .fd-do-grip { cursor: grabbing; }
.fd-do-begun > .fd-do-head .fd-do-say { color: var(--fd-muted); font-style: italic; }
.fd-do-code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; padding: 0 3px; border-radius: 3px; background: var(--fd-page); }
.fd-do-add { justify-self: start; padding-inline: 0; min-height: 28px; display: inline-flex; align-items: center; gap: 6px; }
.fd-do-add > .fd-dicon { width: 14px; height: 14px; }
.fd-do-add[hidden] { display: none; }
.fd-do-body .fd-do-settings { display: grid; gap: 10px; min-width: 0; }
.fd-do-body .fd-formula-reads { margin: 0; font-size: 12px; color: var(--fd-muted); }
.fd-do-when-start { justify-self: start; padding-inline: 0; min-height: 26px; }
.fd-do-when[hidden], .fd-do-when-start[hidden] { display: none; }
.fd-do-fields { display: grid; gap: 4px; padding-block-start: 4px; }
.fd-do-fields[hidden] { display: none; }
/* "Add a step": its groups closer together, so the whole list fits in view. */
.fd-menu.fd-do-menu { max-height: calc(100vh - 16px); }
.fd-do-menu .fd-menu-item { padding-block: 5px; }
.fd-do-menu .fd-menu-heading { padding-block-start: 8px; }
.fd-do-menu .fd-menu-heading:first-child { padding-block-start: 4px; }
.fd-do-words { min-width: 0; }
/* ---- the steps once a page is saved: under the step that opened it, a line on one side ---- */
.fd-do-then { margin: 0 12px 10px; margin-inline-start: 22px; padding-inline-start: 10px; border-inline-start: 2px solid var(--fd-border); }
.fd-do-then[hidden] { display: none; }
.fd-do-then .fd-do-step { border-color: transparent; background: var(--fd-page); }
.fd-do-then .fd-do-step.fd-answer-rule-open { background: var(--fd-surface); }
.fd-answer-rule-open > .fd-do-then .fd-do-step:not(.fd-answer-rule-open) { background: var(--fd-surface); }
/* ---- a small map of names to values ---- */
.fd-do-map { display: grid; gap: 6px; min-width: 0; }
.fd-do-map-rows { display: grid; gap: 6px; min-width: 0; }
.fd-do-map-rows:empty { display: none; }
.fd-do-map-row { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr) auto; gap: 6px; align-items: start; min-width: 0; }
.fd-do-map-row > .fd-formula-problem { grid-column: 1 / -1; margin: 0; }
.fd-do-map-add { justify-self: start; padding-inline: 0; min-height: 26px; }
/* ---- where they are set ---- */
.fd-do-setting { justify-items: stretch; }
.fd-do-moments { display: grid; gap: 14px; }
.fd-do-moment { display: grid; gap: 6px; min-width: 0; }
.fd-do-moment[hidden] { display: none; }
.fd-do-moment-name, .fd-do-show-name { font-size: 12.5px; font-weight: 600; color: var(--fd-text); }
.fd-do-moment > .fd-properties-hint { margin: 0; }
.fd-do-shows { display: grid; gap: 12px; }
.fd-do-shows:empty { display: none; }
.fd-do-show { display: grid; gap: 6px; }
.fd-do-show-name { font-weight: 500; color: var(--fd-muted); }
.fd-do-show-pick { justify-self: start; max-width: 100%; }
.fd-do-show-pick[hidden] { display: none; }
.fd-do-keeps[hidden], .fd-do-status[hidden] { display: none; }
/* ---- the Rules view: a step a line ---- */
.fd-rules-steps .fd-rules-item-say { white-space: pre-line; }
/* ---- on the canvas: a button that does something wears a small bolt after its words ---- */
.fd-canvas-block.fd-button[data-steps]::after, .fd-canvas-part.fd-button[data-steps]::after, .fd-canvas-part.fd-stat[data-steps] .fd-stat-label::after {
  content: ""; display: inline-block; width: 0.8em; height: 0.8em; margin-inline-start: 6px; vertical-align: -0.05em; background: currentColor; opacity: 0.75;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M13 2 4 14h7l-1 8 9-12h-7z'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M13 2 4 14h7l-1 8 9-12h-7z'/%3E%3C/svg%3E") center / contain no-repeat;
}
.fd-rule-mark[data-mark="steps"] { color: var(--fd-accent); --fd-mark-ground: var(--fd-accent-soft); }
`;
