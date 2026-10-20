/**
 * The survey part's looks (styles-survey.ts): a slider, pictures to choose from, a ranking and an address, cut from
 * the question kinds' rules, and pictures' sizes and fit, a ranking's top few and a matrix whose rows become cards on
 * a phone, cut from the choice kinds' details — in that order, as they stood at the head of the page's own looks.
 */
export const SURVEY_LOOKS_CSS = /* css */ `
/* ---- the survey kinds' looks, cut from the question kinds' and the choice kinds' rules --------------------- */
/* A slider: the value beside the track and its ends under it; dimmed until it is slid. */
.fd-slider { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 14px; row-gap: 0; align-items: center; width: 100%; max-width: 440px; min-width: 0; }
.fd-slider-track { display: contents; }
.fd-slider-input { width: 100%; min-width: 0; height: 26px; margin: 0; accent-color: var(--fd-accent); cursor: pointer; }
.fd-slider-input:disabled { cursor: default; }
.fd-slider-value { min-width: 2.5em; text-align: start; font-variant-numeric: tabular-nums; font-weight: 600; }
.fd-slider-ends { grid-column: 1; display: flex; justify-content: space-between; gap: 12px; font-size: 12.5px; color: var(--fd-muted); font-variant-numeric: tabular-nums; }
/* Not answered: the range out of sight (still taking the pointer and the keys), and in its place a track with nothing
   filled and a hollow ring at its start — no knob halfway, which reads as an answer — "Not answered" beside it. */
.fd-slider-rail { position: relative; display: block; min-width: 0; }
.fd-slider-empty .fd-slider-input { opacity: 0; position: relative; z-index: 1; }
.fd-slider-blank { position: absolute; inset: 0; display: flex; align-items: center; pointer-events: none; }
.fd-slider-blank[hidden] { display: none; }
.fd-slider-blank::before { content: ""; position: absolute; inset-inline: 2px; height: 4px; border-radius: 2px; background: var(--fd-border-strong, var(--fd-border)); }
.fd-slider-ring { position: relative; width: 14px; height: 14px; box-sizing: border-box; border: 2px solid var(--fd-muted); border-radius: 50%; background: var(--fd-surface); }
.fd-slider-empty:has(.fd-slider-input:focus-visible) .fd-slider-ring { outline: 2px solid var(--fd-accent); outline-offset: 2px; }
.fd-slider-empty .fd-slider-value { color: var(--fd-muted); font-weight: 400; }
/* The value and the room its words "Not answered" take share one cell: the track is as long answered or not. */
.fd-slider-value, .fd-slider-room { grid-column: 2; grid-row: 1; white-space: nowrap; }
.fd-slider-room { visibility: hidden; pointer-events: none; }
.fd-slider .fd-choice-clear { grid-column: 1 / -1; }
/* Pictures to choose from: cards of a picture over its words, a ring or a box before the words, the card picked edged in the accent. */
.fd-image-choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 130px), 1fr)); gap: 12px; width: 100%; min-width: 0; }
.fd-image-card {
  position: relative; display: grid; grid-template-rows: auto 1fr; padding: 0; margin: 0; overflow: hidden; cursor: pointer;
  font: inherit; color: var(--fd-text); text-align: start; background: var(--fd-surface);
  border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 6px);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.fd-image-card:hover:not(:disabled) { border-color: var(--fd-accent); }
.fd-image-card:disabled { cursor: default; }
.fd-image-card:disabled:not([aria-checked="true"]) { opacity: 0.6; }
.fd-image-card[aria-checked="true"] { border-color: var(--fd-accent); box-shadow: 0 0 0 1px var(--fd-accent); }
.fd-image-card-picture { display: block; aspect-ratio: 4 / 3; background: var(--fd-page); border-block-end: 1px solid var(--fd-border); }
.fd-image-card-picture img { display: block; width: 100%; height: 100%; object-fit: cover; }
.fd-image-card-blank { display: grid; place-items: center; width: 100%; height: 100%; color: var(--fd-border-strong); }
.fd-image-card-blank svg { width: 36%; height: 36%; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.fd-image-card-words { display: flex; align-items: flex-start; gap: 8px; padding: 9px 10px; font-size: 13.5px; line-height: 1.35; }
.fd-image-card-words::before {
  content: ""; flex: none; width: 16px; height: 16px; margin-block-start: 1px; box-sizing: border-box;
  border: 1.5px solid var(--fd-border-strong); border-radius: 50%; background: var(--fd-surface);
}
.fd-image-card[role="checkbox"] .fd-image-card-words::before { border-radius: 4px; }
.fd-image-card[aria-checked="true"] .fd-image-card-words::before { border-color: var(--fd-accent); background: var(--fd-accent); box-shadow: inset 0 0 0 3px var(--fd-surface); }
.fd-image-card[role="checkbox"][aria-checked="true"] .fd-image-card-words::before {
  box-shadow: none;
  background: var(--fd-accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 13px no-repeat;
}
.fd-image-choices + .fd-choice-clear { justify-self: end; }
/* A ranking: numbered lines dragged by their grip, or moved with their arrows; the line being dragged lifts. */
.fd-ranking { width: 100%; max-width: 480px; min-width: 0; }
.fd-rank-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.fd-rank-item {
  display: flex; align-items: center; gap: 10px; padding-block: 5px; padding-inline: 8px 5px; min-height: 40px;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius);
  cursor: grab; user-select: none; -webkit-user-select: none;
}
.fd-rank-item.fd-rank-lifted { position: relative; z-index: 1; cursor: grabbing; border-color: var(--fd-accent); box-shadow: 0 6px 18px rgba(15, 20, 25, 0.16); }
.fd-ranking-locked .fd-rank-item { cursor: default; }
.fd-ranking-locked .fd-rank-grip { visibility: hidden; }
.fd-rank-place {
  flex: none; display: grid; place-items: center; min-width: 24px; height: 24px; padding-inline: 4px; border-radius: 999px;
  background: var(--fd-accent-soft); color: var(--fd-accent); font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums;
}
.fd-rank-words { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.fd-rank-tools { flex: none; display: inline-flex; gap: 2px; }
.fd-rank-move {
  width: 30px; height: 30px; padding: 0; font: inherit; font-size: 15px; line-height: 1; color: var(--fd-muted);
  background: none; border: 1px solid transparent; border-radius: 4px; cursor: pointer;
}
.fd-rank-move:hover:not(:disabled) { background: var(--fd-page); border-color: var(--fd-border); color: var(--fd-text); }
.fd-rank-move:disabled { opacity: 0.3; cursor: default; }
/* An address: its parts in two columns, the street across both, each named above its box; one column when narrow. */
.fd-address { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; width: 100%; max-width: 560px; min-width: 0; }
.fd-address-part { display: grid; gap: 3px; min-width: 0; align-content: start; }
.fd-address-street, .fd-address-line2 { grid-column: 1 / -1; }
.fd-address-part.fd-required > .fd-address-label::after { content: "*"; margin-inline-start: 0.25em; color: var(--fd-error); }
.fd-address-label { font-size: 12.5px; color: var(--fd-muted); }
@container (max-width: 420px) { .fd-address { grid-template-columns: minmax(0, 1fr); } }
.fd-image-choices[data-size="small"] { --fd-card: 96px; }
.fd-image-choices[data-size="large"] { --fd-card: 210px; }
.fd-image-choices[data-size] { grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--fd-card, 130px)), 1fr)); }
.fd-image-choices[data-fit="whole"] img { object-fit: contain; }
.fd-image-choices-bare .fd-image-card-words { position: absolute; inset-block-start: 6px; inset-inline-start: 6px; padding: 0; font-size: 0; }
.fd-rank-pool { display: flex; flex-wrap: wrap; gap: 8px; margin-block: 6px 10px; }
.fd-rank-pick {
  min-height: 32px; padding: 4px 12px; font: inherit; color: inherit; cursor: pointer;
  background: var(--fd-surface); border: 1px dashed var(--fd-border-strong); border-radius: 999px;
}
.fd-rank-pick:disabled { opacity: 0.5; cursor: default; }
.fd-rank-list:empty { display: none; }
.fd-rank-keep { margin-block-start: 8px; }
.fd-matrix-pick { display: inline-flex; align-items: center; gap: 8px; }
.fd-matrix-column { display: none; }
@container (max-width: 520px) {
  .fd-image-choices.fd-image-choices { grid-auto-flow: row; grid-template-columns: repeat(auto-fill, minmax(min(100%, 130px), 1fr)); }
  .fd-matrix-table, .fd-matrix-table :is(tbody, tr, th, td) { display: block; }
  .fd-matrix-table thead { display: none; }
  .fd-matrix-table tr { padding: 10px 12px; margin-block-end: 10px; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); }
  .fd-matrix-table :is(th, td) { padding: 2px 0; border: 0; text-align: start; }
  .fd-matrix-pick { min-height: 32px; }
  .fd-matrix-column { display: inline; }
}
`;
