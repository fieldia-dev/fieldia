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
.fd-formula-function::after { content: "( )"; color: var(--fd-muted); margin-inline-start: 1px; }
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

/* ---- a survey question's rules, in its open card ---- */
.fd-q-rules { margin-block-start: 10px; display: grid; gap: 6px; }
.fd-q-rules[hidden] { display: none; }
.fd-q-rules .fd-prop-name { font-size: 12.5px; font-weight: 600; color: var(--fd-text); }
.fd-q-rules-part { display: grid; gap: 6px; }
.fd-q-rules-part[hidden] { display: none; }
`;
