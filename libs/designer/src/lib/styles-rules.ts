/**
 * The rules' look: answer rules as sentences in boxes that open in place, as
 * the approved mockup draws its answer rules — a light box, the settings'
 * names in small bold words over their boxes. Logical properties throughout,
 * so right to left mirrors on its own.
 */
export const DESIGNER_RULES_CSS = /* css */ `
/* ---- answer rules: a sentence each, its settings in place ---- */
.fd-answer-rules { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; min-width: 0; }
.fd-answer-rules[hidden] { display: none; }
.fd-answer-rule { border: 1px solid var(--fd-border); border-radius: 8px; background: var(--fd-surface); min-width: 0; }
.fd-answer-rule-open { background: var(--fd-page); }
.fd-answer-rule-head { display: flex; align-items: center; gap: 4px; padding-inline: 2px 4px; }
.fd-answer-rule-say {
  all: unset; box-sizing: border-box; cursor: pointer; flex: 1 1 auto; min-width: 0; padding: 7px 8px 7px 10px;
  font-size: 13px; line-height: 1.4; color: var(--fd-text); overflow-wrap: anywhere; border-radius: 6px; display: flex; gap: 7px; align-items: baseline;
}
/* A small arrow before the sentence: across when shut, down when open. */
.fd-answer-rule-say::before {
  content: ""; flex: none; width: 5px; height: 5px; border-inline-end: 1.5px solid var(--fd-muted); border-block-end: 1.5px solid var(--fd-muted);
  transform: translateY(-2px) rotate(-45deg); transition: transform 120ms ease;
}
.fd-answer-rule-say[aria-expanded="true"]::before { transform: translateY(-3px) rotate(45deg); }
.fd-answer-rule-say:dir(rtl)::before { transform: translateY(-2px) rotate(45deg); }
.fd-answer-rule-say:dir(rtl)[aria-expanded="true"]::before { transform: translateY(-3px) rotate(-45deg); }
.fd-answer-rule-say:hover { color: var(--fd-accent); }
.fd-answer-rule-say:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-answer-rule-remove { flex: none; }
.fd-answer-rule-body { display: grid; gap: 10px; padding: 2px 12px 12px; min-width: 0; }
.fd-answer-rule-body[hidden] { display: none; }
.fd-answer-rule-field { display: grid; gap: 4px; min-width: 0; }
.fd-answer-rule-field[hidden] { display: none; }
.fd-answer-rule-word { font-size: 12px; font-weight: 600; color: var(--fd-text); }
.fd-answer-rule-pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
.fd-answer-rule-pattern { display: grid; gap: 8px; }
.fd-answer-rule-code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; }
.fd-answer-rule-body .fd-input { width: 100%; box-sizing: border-box; min-width: 0; }
/* Stops sending or only warns: framed, as wide as the rule, the same in the panel and in a survey's card. */
.fd-answer-rule-body .fd-seg { width: 100%; box-sizing: border-box; border: 1px solid var(--fd-border); grid-auto-columns: minmax(0, 1fr); }
.fd-answer-rule-body .fd-seg > .fd-seg-button { min-width: 0; min-height: 28px; font-size: 13px; font-weight: 600; display: grid; place-items: center; padding: 4px 6px; }
.fd-answer-rule-body .fd-when { width: 100%; }
.fd-answer-rule-body .fd-when .fd-select { min-width: 0; flex: 1 1 120px; }
.fd-answer-rule-body .fd-q-when { justify-self: start; padding-inline: 0; min-height: 26px; }
.fd-answer-rule-problem { margin: 0; font-size: 12px; line-height: 1.45; color: var(--fd-error); }
.fd-answer-rules-add { justify-self: start; padding-inline: 0; min-height: 26px; }
.fd-answer-rules-status { margin: 0; font-size: 12.5px; color: var(--fd-muted); display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; }
.fd-answer-rules-status .fd-button { padding: 0; min-height: 0; }
.fd-answer-rules-box { justify-items: stretch; }

/* ---- worked out from: a formula box, its fields suggested, its result ---- */
.fd-formula { position: relative; min-width: 0; }
.fd-formula-input { width: 100%; box-sizing: border-box; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; }
.fd-formula-suggest {
  position: absolute; z-index: 40; inset-inline: 0; inset-block-start: calc(100% + 4px); max-height: 220px; overflow: auto;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: 8px; box-shadow: 0 12px 28px rgba(15, 20, 25, 0.16); padding: 4px;
}
.fd-formula-suggest[hidden] { display: none; }
.fd-formula-suggest-option { display: flex; align-items: baseline; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 13px; min-width: 0; }
.fd-formula-suggest-option:hover { background: var(--fd-page); }
.fd-formula-suggest-option[aria-selected="true"] { background: var(--fd-accent-soft); }
.fd-formula-suggest-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fd-text); }
.fd-formula-suggest-name { flex: none; font-size: 11.5px; color: var(--fd-muted); }
.fd-formula-functions { display: flex; flex-wrap: wrap; gap: 4px; }
.fd-formula-function {
  all: unset; box-sizing: border-box; cursor: pointer; font: 12px/1 ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: var(--fd-text);
  padding: 5px 8px; border-radius: 999px; background: var(--fd-page);
}
.fd-formula-function::after { content: "()"; color: var(--fd-muted); }
.fd-formula-function:hover { background: var(--fd-accent-soft); color: var(--fd-accent); }
.fd-formula-function:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-formula-result { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--fd-text); padding: 6px 9px; border-radius: 6px; background: var(--fd-success-soft, var(--fd-page)); overflow-wrap: anywhere; }
.fd-formula-result[hidden], .fd-formula-problem[hidden], .fd-formula-reads[hidden] { display: none; }
.fd-formula-result { display: grid; gap: 2px; }
.fd-formula-reads { color: var(--fd-muted); }
.fd-formula-problem { margin: 0; display: grid; gap: 4px; font-size: 12px; line-height: 1.45; color: var(--fd-error); }
.fd-formula-copy { font: 12px/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: var(--fd-text); white-space: pre-wrap; overflow-wrap: anywhere; }
.fd-formula-copy[hidden] { display: none; }
.fd-formula-copy mark { background: var(--fd-error-soft); color: var(--fd-error); border-block-end: 2px solid var(--fd-error); border-radius: 2px; padding: 0 1px; }
.fd-worked-out { justify-items: stretch; }

/* ---- the rules overview: every rule as a sentence, by what it does ---- */
.fd-rules-view { display: grid; gap: 12px; min-width: 0; align-content: start; }
.fd-rules-view[hidden] { display: none; }
.fd-rules-bar {
  display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 10px 14px;
}
.fd-rules-heading { flex: 1 1 220px; min-width: 0; display: grid; gap: 2px; }
.fd-rules-title { margin: 0; font-size: 16px; font-weight: 650; }
.fd-rules-note { margin: 0; font-size: 13px; color: var(--fd-muted); }
.fd-rules-filter { position: relative; flex: 0 1 320px; min-width: 0; display: block; }
.fd-rules-filter-icon { position: absolute; inset-inline-start: 10px; inset-block-start: 50%; transform: translateY(-50%); display: inline-flex; color: var(--fd-muted); pointer-events: none; }
.fd-rules-filter-icon > .fd-dicon { width: 14px; height: 14px; }
.fd-rules-view .fd-rules-filter-box { width: 100%; box-sizing: border-box; padding-inline-start: 32px; }
/* The view's words are English: in a page right to left they keep their own order, where the page puts them. */
.fd-rules-empty, .fd-rules-view .fd-rules-filter-box, .fd-rules-view .fd-rules-filter-box::placeholder { unicode-bidi: plaintext; }
/* Their own order, and the page's side: the end of an English line is where a line right to left starts. */
.fd-rules-view .fd-rules-filter-box:dir(rtl), .fd-rules-view .fd-rules-filter-box:dir(rtl)::placeholder { text-align: end; }
.fd-rules-groups { display: grid; gap: 12px; min-width: 0; }
.fd-rules-group { background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 12px 6px 6px; min-width: 0; display: grid; gap: 6px; }
.fd-rules-group-title { margin: 0; padding-inline: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fd-muted); }
.fd-rules-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; }
.fd-rules-item {
  all: unset; box-sizing: border-box; cursor: pointer; width: 100%; display: grid; grid-template-columns: minmax(90px, 200px) minmax(0, 1fr); gap: 4px 16px;
  align-items: baseline; padding: 8px 10px; border-radius: 6px; font-size: 14px; line-height: 1.45; text-align: start;
}
.fd-rules-item:hover { background: var(--fd-page); }
.fd-rules-item:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-rules-item[aria-disabled="true"] { cursor: default; color: var(--fd-muted); }
.fd-rules-item-name { font-weight: 600; color: var(--fd-text); overflow-wrap: anywhere; text-align: start; }
.fd-rules-item-say { color: var(--fd-text); overflow-wrap: anywhere; text-align: start; }
.fd-rules-branches { margin: 0 10px 4px; }
.fd-rules-empty { margin: 0; padding: 28px 16px; text-align: center; color: var(--fd-muted); font-size: 14px; background: var(--fd-surface); border: 1px dashed var(--fd-border-strong); border-radius: var(--fd-radius); }
.fd-rules-empty[hidden] { display: none; }
/* A phone's width: a rule's part over its sentence; the views three to a row (Simple or Advanced two), the whole
   width of the bar, so none is left alone on a line. */
@container (max-width: 560px) {
  .fd-rules-item { grid-template-columns: minmax(0, 1fr); }
  .fd-designer-bar .fd-mode { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); flex: 1 1 100%; box-sizing: border-box; }
  .fd-designer-bar .fd-mode-switch { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fd-designer-bar .fd-mode-button { justify-content: center; min-width: 0; }
}

/* ---- marks on the canvas: a part with a rule says so; pointed at, its sentence ---- */
.fd-rule-marks { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.fd-canvas-field > .fd-rule-marks { position: absolute; inset-block-start: 0; inset-inline-end: 6px; z-index: 2; }
.fd-canvas-section > .fd-rule-marks { position: absolute; inset-block-start: 0; inset-inline-end: 8px; z-index: 2; }
.fd-step-head-row > .fd-rule-marks { flex: none; }
/* A small chip, in a button 24px tall: a target a finger can hit (WCAG 2.5.8), the chip drawn inside it by ::before. */
.fd-rule-mark {
  all: unset; box-sizing: border-box; cursor: pointer; position: relative; isolation: isolate; display: inline-flex; align-items: center; gap: 3px; min-height: 24px;
  font-size: 10.5px; font-weight: 600; line-height: 1.6; padding: 0 6px; border-radius: 4px; color: var(--fd-muted); --fd-mark-ground: var(--fd-page);
}
.fd-rule-mark::before { content: ""; position: absolute; inset-inline: 0; inset-block: calc(50% - 0.8em); z-index: -1; border-radius: 4px; background: var(--fd-mark-ground); }
.fd-rule-mark[data-mark="sometimes"] { color: var(--fd-warning); --fd-mark-ground: var(--fd-warning-soft); }
.fd-rule-mark[data-mark="worked-out"] { color: var(--fd-accent); --fd-mark-ground: var(--fd-accent-soft); }
.fd-rule-mark > .fd-dicon { width: 11px; height: 11px; flex: none; }
.fd-rule-mark-fx { font: italic 700 10.5px/1 Georgia, "Times New Roman", serif; }
.fd-rule-mark:hover { filter: brightness(0.96); }
.fd-rule-mark:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-rule-tip {
  display: none; position: absolute; inset-block-start: calc(100% + 6px); inset-inline-end: 0; z-index: 50; width: max-content; max-width: 260px;
  white-space: pre-line; text-align: start; padding: 6px 9px; border-radius: 6px; background: var(--fd-text); color: var(--fd-surface);
  font-size: 12px; font-weight: 500; line-height: 1.45; box-shadow: 0 8px 20px rgba(15, 20, 25, 0.2); pointer-events: none;
}
.fd-rule-mark:hover > .fd-rule-tip, .fd-rule-mark:focus-visible > .fd-rule-tip { display: block; }
.fd-q-title .fd-rule-tip, .fd-step-head-row .fd-rule-tip { inset-inline-end: auto; inset-inline-start: 0; }
/* The marks stand in for the canvas's own "only sometimes" and the card's "Shown only for some answers". */
.fd-canvas-field.fd-hidden-sometimes:has(> .fd-rule-marks)::after { content: none; }
.fd-q-title:has(.fd-rule-mark[data-mark="sometimes"]) > .fd-q-when-note { display: none; }

/* ---- a survey question's rules, in its open card ---- */
.fd-q-rules { margin-block-start: 10px; display: grid; gap: 6px; }
.fd-q-rules[hidden] { display: none; }
.fd-q-rules .fd-prop-name { font-size: 12.5px; font-weight: 600; color: var(--fd-text); }
.fd-q-rules-part { display: grid; gap: 6px; }
.fd-q-rules-part[hidden] { display: none; }
`;
