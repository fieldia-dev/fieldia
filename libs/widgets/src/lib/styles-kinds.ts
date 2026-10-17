/**
 * The question kinds' part of the stylesheet: a line's grip. A slider,
 * pictures to choose from, a ranking and an address come with their kinds in
 * the survey part (styles-survey-looks.ts); a repeating group of cards with its
 * widget, in the lines part (styles-cards.ts); a signature pad's with its
 * widget, in the files part (styles-files.ts).
 * Appended to Fieldia's stylesheet, scoped and written with logical
 * properties as the rest of it is.
 */
export const KINDS_CSS = /* css */ `
/* ---- question kinds -------------------------------------------------------- */
/* A line's grip, in dots: a ranking's, and a table's lines' (lines.ts). */
.fd-rank-grip { flex: none; width: 10px; height: 16px; touch-action: none; background: radial-gradient(circle, var(--fd-border-strong) 1.3px, transparent 1.7px) 0 0 / 5px 5.33px; }
`;
