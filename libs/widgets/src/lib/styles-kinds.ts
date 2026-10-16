/**
 * The question kinds' part of the stylesheet: a line's grip and a repeating
 * group of cards. A slider, pictures to choose from, a ranking and an address
 * come with their kinds in the survey part (styles-survey-looks.ts); a
 * signature pad's with its widget, in the files part (styles-files.ts).
 * Appended to Fieldia's stylesheet, scoped and written with logical
 * properties as the rest of it is.
 */
export const KINDS_CSS = /* css */ `
/* ---- question kinds -------------------------------------------------------- */
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
