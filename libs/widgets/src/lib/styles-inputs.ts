/**
 * The text, number and date inputs' part of the stylesheet: a count of
 * characters under a box. Scoped and written with logical properties as the
 * rest of it is; it comes before the question kinds' part.
 */
export const INPUTS_CSS = /* css */ `
/* ---- inputs' details ------------------------------------------------------- */
.fd-counted { display: grid; gap: 2px; min-width: 0; }
.fd-count { justify-self: end; font-size: 12px; color: var(--fd-muted); font-variant-numeric: tabular-nums; }
.fd-count-near { color: var(--fd-warning); font-weight: 600; }
`;
