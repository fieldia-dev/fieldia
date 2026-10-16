/**
 * The question kinds' part of the stylesheet: a signature pad, a line's grip
 * and a repeating group of cards. A slider, pictures to choose from, a ranking
 * and an address come with their kinds in the survey part
 * (styles-survey-looks.ts). Appended to Fieldia's stylesheet, scoped and
 * written with logical properties as the rest of it is.
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
/* A line's grip, in dots: a ranking's, and a table's lines' (lines.ts). */
.fd-rank-grip { flex: none; width: 10px; height: 16px; touch-action: none; background: radial-gradient(circle, var(--fd-border-strong) 1.3px, transparent 1.7px) 0 0 / 5px 5.33px; }
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
