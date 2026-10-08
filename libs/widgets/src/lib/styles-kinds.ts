/**
 * The question kinds' part of the stylesheet: a signature pad, a slider, tags
 * from a list, pictures to choose from, a ranking, an address and a repeating
 * group of cards. Appended to Fieldia's stylesheet, scoped and written with
 * logical properties as the rest of it is.
 */
export const KINDS_CSS = /* css */ `
/* ---- question kinds -------------------------------------------------------- */
/* A signature: a pad with a line to sign on, a box to type a name in instead, and Clear. */
.fd-signature { display: grid; gap: 8px; justify-items: start; width: 100%; max-width: 480px; min-width: 0; }
.fd-signature-box {
  position: relative; width: 100%; aspect-ratio: 10 / 3; border: 1px dashed var(--fd-border-strong);
  border-radius: var(--fd-control-radius); background: #fff; overflow: hidden;
}
.fd-signature-box:has(.fd-signature-pad:not([hidden]):not(.fd-signature-locked)):hover { border-color: var(--fd-accent); }
.fd-signature-pad, .fd-signature-image { display: block; width: 100%; height: 100%; }
.fd-signature-pad { touch-action: none; cursor: crosshair; }
.fd-signature-pad.fd-signature-locked { cursor: default; }
.fd-signature-image { object-fit: contain; }
.fd-signature-hint {
  position: absolute; inset-inline: 18px; inset-block-end: 16px; padding-block-start: 4px; pointer-events: none;
  border-block-start: 1px solid var(--fd-border-strong); color: var(--fd-muted); font-size: 12.5px;
}
.fd-signature-tools { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; width: 100%; }
.fd-signature-typed { flex: 1 1 200px; min-width: 0; }
.fd-signature-footer { margin-block-start: -4px; color: var(--fd-muted); font-size: 12.5px; }
/* A slider: the value beside the track and its ends under it; dimmed until it is slid. */
.fd-slider { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 14px; row-gap: 0; align-items: center; width: 100%; max-width: 440px; min-width: 0; }
.fd-slider-track { display: contents; }
.fd-slider-input { width: 100%; min-width: 0; height: 26px; margin: 0; accent-color: var(--fd-accent); cursor: pointer; }
.fd-slider-input:disabled { cursor: default; }
.fd-slider-value { min-width: 2.5em; text-align: start; font-variant-numeric: tabular-nums; font-weight: 600; }
.fd-slider-ends { grid-column: 1; display: flex; justify-content: space-between; gap: 12px; font-size: 12.5px; color: var(--fd-muted); font-variant-numeric: tabular-nums; }
/* Grey, not the accent: half filled in colour would read as an answer. */
.fd-slider-empty .fd-slider-input { filter: grayscale(1); opacity: 0.55; }
.fd-slider-empty .fd-slider-value { color: var(--fd-muted); font-weight: 400; }
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
.fd-rank-grip { flex: none; width: 10px; height: 16px; touch-action: none; background: radial-gradient(circle, var(--fd-border-strong) 1.3px, transparent 1.7px) 0 0 / 5px 5.33px; }
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
.fd-address-part.fd-required > .fd-address-label::after { content: " *"; color: var(--fd-error); }
.fd-address-label { font-size: 12.5px; color: var(--fd-muted); }
@container (max-width: 420px) { .fd-address { grid-template-columns: minmax(0, 1fr); } }
/* A repeating group: each line a card of its fields under its numbered title, × at its end; "Add another" under the cards. */
.fd-repeat { display: grid; gap: 10px; justify-items: start; width: 100%; min-width: 0; }
.fd-repeat-list { display: grid; gap: 10px; width: 100%; min-width: 0; }
.fd-repeat-list:empty { display: none; }
.fd-repeat-card {
  display: grid; gap: 8px; min-width: 0; padding: 10px 14px 14px;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: max(var(--fd-radius), 6px);
}
.fd-repeat-head { display: flex; align-items: center; gap: 2px; min-height: 28px; }
.fd-repeat-title { font-weight: 600; font-size: 13.5px; margin-inline-end: auto; }
.fd-repeat-remove, .fd-repeat-tool { border: none; background: none; cursor: pointer; color: var(--fd-muted); font-size: 18px; line-height: 1; padding: 4px 8px; border-radius: 4px; }
.fd-repeat-remove:hover { color: var(--fd-error); background: var(--fd-error-soft); }
.fd-repeat-tool { font-size: 15px; min-width: 24px; min-height: 24px; }
.fd-repeat-tool:hover { color: var(--fd-accent); background: var(--fd-accent-soft); }
.fd-repeat-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 10px 14px; }
.fd-repeat-field { display: grid; gap: 3px; min-width: 0; align-content: start; }
.fd-repeat-label { font-size: 12.5px; color: var(--fd-muted); }
.fd-repeat-add { border-style: dashed; }
`;
