import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * The look of what the viewer's survey part draws: a quiz's results under the thanks. On the form's tokens, so dark and
 * the themes follow; logical sides, so right to left follows. Its sheet takes the survey part's own rank
 * (PART_RANK.survey), beside the survey kinds' sheet: it names only its own parts and the wizard's, which no part's
 * sheet between it and the themes' names, and a theme still reshapes its buttons and type after it.
 */
const FLOW_CSS = /* css */ `
.fd-quiz { display: grid; gap: 12px; width: min(100%, 40em); margin: 8px auto 4px; text-align: start; }
.fd-quiz-title { margin: 0; font-size: 18px; font-weight: 650; color: var(--fd-text); }
.fd-quiz-title:focus { outline: none; }
.fd-quiz-score { margin: 0; font-size: 16px; font-weight: 600; color: var(--fd-text); font-variant-numeric: tabular-nums; }
.fd-quiz-later { margin: 0; color: var(--fd-muted); line-height: 1.5; }
.fd-quiz-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.fd-quiz-item { display: grid; gap: 4px; padding: 10px 12px; border: 1px solid var(--fd-border); border-inline-start-width: 4px; border-radius: var(--fd-control-radius, 6px); background: var(--fd-surface); }
.fd-quiz-item[data-mark="right"] { border-inline-start-color: var(--fd-success); }
.fd-quiz-item[data-mark="wrong"], .fd-quiz-item[data-mark="missed"] { border-inline-start-color: var(--fd-error); }
.fd-quiz-head { display: flex; align-items: baseline; gap: 8px; margin: 0; color: var(--fd-text); font-weight: 600; }
.fd-quiz-question { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.fd-quiz-points { flex: none; color: var(--fd-muted); font-weight: 400; font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fd-quiz-sign { flex: none; width: 1.2em; text-align: center; }
.fd-quiz-item[data-mark="right"] .fd-quiz-sign, .fd-quiz-item[data-mark="right"] .fd-quiz-verdict { color: var(--fd-success); }
.fd-quiz-item:is([data-mark="wrong"], [data-mark="missed"]) :is(.fd-quiz-sign, .fd-quiz-verdict) { color: var(--fd-error); }
.fd-quiz-verdict { font-size: 13px; font-weight: 600; padding-inline-start: calc(1.2em + 8px); }
.fd-quiz-answer, .fd-quiz-right-answer, .fd-quiz-feedback { margin: 0; padding-inline-start: calc(1.2em + 8px); line-height: 1.45; overflow-wrap: anywhere; }
.fd-quiz-answer, .fd-quiz-feedback { color: var(--fd-muted); }
.fd-quiz-right-answer { color: var(--fd-text); }
`;

/** The viewer's survey part's sheet in a document, once, in the survey part's place among Fieldia's (PART_RANK.survey). */
export function installFlowStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-flow-styles', FLOW_CSS, PART_RANK.survey);
}
