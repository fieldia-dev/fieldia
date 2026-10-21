import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * The look of what the viewer's survey part draws: a quiz's results under the thanks, a review of the answers before
 * they are sent, one question at a time, a time limit's Start and countdown. On the form's tokens, so dark and
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
/* ---- one question at a time (flow-one.ts) ---- */
.fd-flow-one [data-fd-away] { display: none !important; }
.fd-flow-one .fd-wizard > .fd-progress, .fd-flow-one .fd-steps { display: none; }
.fd-flow-one :is(.fd-wizard-nav, .fd-actions) > button:not(.fd-flow-ok):not(.fd-back-to-review):not(.fd-later-button) { display: none; }
.fd-flow-one .fd-grid { grid-template-columns: minmax(0, 1fr) !important; align-content: start; }
.fd-flow-one .fd-grid > * { grid-column: 1 / -1 !important; }
.fd-flow-one [data-fd-current] { padding-block: clamp(16px, 8vh, 96px) clamp(16px, 6vh, 72px); align-content: start; }
.fd-flow-one .fd-step-title { font-size: 13px; font-weight: 600; color: var(--fd-muted); text-transform: none; }
.fd-flow-one [data-fd-current] > .fd-label, .fd-flow-one [data-fd-current] .fd-label:first-child { font-size: 22px; font-weight: 600; line-height: 1.3; color: var(--fd-text); }
.fd-flow-one [data-fd-current] { animation: fd-flow-in 180ms ease-out; }
.fd-flow-one [data-fd-current] .fd-choices { flex-direction: column; align-items: stretch; gap: 8px; counter-reset: fd-key; }
.fd-flow-one [data-fd-current] .fd-choices > .fd-choice { counter-increment: fd-key; padding: 10px 12px; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius, 6px); background: var(--fd-surface); max-width: 32em; }
.fd-flow-one [data-fd-current] .fd-choices > .fd-choice:has(input:checked) { border-color: var(--fd-accent); background: var(--fd-accent-soft, var(--fd-surface)); }
.fd-flow-one [data-fd-current] .fd-choices > label.fd-choice::after { content: counter(fd-key, upper-alpha); content: counter(fd-key, upper-alpha) / ""; margin-inline-start: auto; min-width: 1.6em; padding: 0 4px; border: 1px solid var(--fd-border); border-radius: 4px; font-size: 12px; text-align: center; color: var(--fd-muted); }
.fd-flow-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex: 1 1 100%; }
.fd-flow-progress { display: grid; gap: 4px; min-width: 9em; color: var(--fd-muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.fd-flow-bar { display: block; width: 9em; height: 4px; border-radius: 2px; background: var(--fd-border); overflow: hidden; }
.fd-flow-bar-fill { display: block; height: 100%; background: var(--fd-accent); transition: width 200ms ease-out; }
.fd-flow-moves { display: inline-flex; gap: 4px; }
.fd-flow-move { min-width: 36px; padding-inline: 8px; }
.fd-flow-move[hidden] { display: none; }
.fd-flow-hint { color: var(--fd-muted); font-size: 13px; }
.fd-flow-nav > .fd-spacer { flex: 1 1 auto; }
@container (max-width: 520px) { .fd-flow-hint { display: none; } .fd-flow-one [data-fd-current] > .fd-label { font-size: 19px; } }
@keyframes fd-flow-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .fd-flow-one [data-fd-current] { animation: none; } .fd-flow-bar-fill { transition: none; } }
/* ---- a time limit (flow-timer.ts) ---- */
.fd-time-start { display: grid; gap: 10px; justify-items: center; padding: 40px 16px; text-align: center; }
.fd-time-start[hidden], .fd-time-bar[hidden] { display: none; }
.fd-time-start-title { margin: 0; font-size: 20px; font-weight: 650; color: var(--fd-text); }
.fd-time-start-words { margin: 0; max-width: 36em; color: var(--fd-muted); line-height: 1.5; }
.fd-time-bar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; padding: 8px 12px; margin-block-end: 12px; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius, 6px); background: var(--fd-surface); font-variant-numeric: tabular-nums; }
.fd-time-clock { font-weight: 600; color: var(--fd-text); }
.fd-time-clock:empty { display: none; }
.fd-time-bar[data-stage="warning"] { border-color: var(--fd-warning); background: var(--fd-warning-soft, var(--fd-surface)); }
.fd-time-bar[data-stage="up"] { border-color: var(--fd-error); background: var(--fd-error-soft, var(--fd-surface)); }
.fd-time-said { color: var(--fd-text); }
.fd-time-said:empty { display: none; }
.fd-time-done { margin: 0; color: var(--fd-muted); }
`;

/** The viewer's survey part's sheet in a document, once, in the survey part's place among Fieldia's (PART_RANK.survey). */
export function installFlowStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-flow-styles', FLOW_CSS, PART_RANK.survey);
}
