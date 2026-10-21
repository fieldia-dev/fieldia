import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * The look of what the viewer's survey part draws: a quiz's results under the thanks, a review of the answers before
 * they are sent. On the form's tokens, so dark and
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
.fd-review { display: grid; gap: 14px; }
.fd-review[hidden] { display: none; }
.fd-review-title { margin: 0; font-size: 20px; font-weight: 650; color: var(--fd-text); }
.fd-review-title:focus { outline: none; }
.fd-review-text { margin: 0; color: var(--fd-muted); line-height: 1.5; }
.fd-review-groups { display: grid; gap: 16px; }
.fd-review-group { display: grid; gap: 6px; }
.fd-review-group-title { margin: 0; font-size: 15px; font-weight: 650; color: var(--fd-text); }
.fd-review-list { margin: 0; border-block-start: 1px solid var(--fd-border); }
.fd-review-row { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr) auto; gap: 4px 16px; align-items: baseline; padding: 10px 0; border-block-end: 1px solid var(--fd-border); }
.fd-review-question { color: var(--fd-muted); overflow-wrap: anywhere; }
.fd-review-answer { margin: 0; color: var(--fd-text); overflow-wrap: anywhere; white-space: pre-line; }
.fd-review-answer[data-empty] { color: var(--fd-muted); font-style: italic; }
.fd-review-tools { margin: 0; justify-self: end; }
.fd-review-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.fd-review-actions > .fd-spacer { flex: 1 1 auto; }
.fd-review-send[aria-busy="true"] { opacity: 0.7; cursor: progress; }
@container (max-width: 520px) { .fd-review-row { grid-template-columns: minmax(0, 1fr) auto; } .fd-review-question { grid-column: 1 / -1; } }
`;

/** The viewer's survey part's sheet in a document, once, in the survey part's place among Fieldia's (PART_RANK.survey). */
export function installFlowStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-flow-styles', FLOW_CSS, PART_RANK.survey);
}
