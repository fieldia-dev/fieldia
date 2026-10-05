/**
 * The text, number and date inputs' part of the stylesheet: a count of
 * characters under a box, a number's unit and an amount's currency inside
 * its box, a rating's hearts and thumbs, words at a slider's ends. Scoped
 * and written with logical properties as the rest of it is; it comes before
 * the question kinds' part.
 */
export const INPUTS_CSS = /* css */ `
/* ---- inputs' details ------------------------------------------------------- */
.fd-counted { display: grid; gap: 2px; min-width: 0; }
.fd-count { justify-self: end; font-size: 12px; color: var(--fd-muted); font-variant-numeric: tabular-nums; }
.fd-count-near { color: var(--fd-warning); font-weight: 600; }
/* A unit inside the number's box, at its start or end; the box keeps room for it. */
.fd-number:not(.fd-currency-picked) { position: relative; display: block; }
.fd-number > .fd-unit { position: absolute; inset-block: 0; display: flex; align-items: center; pointer-events: none; color: var(--fd-muted); }
.fd-number > .fd-unit:first-child { inset-inline-start: var(--fd-pad-x); }
.fd-number > .fd-unit:last-child { inset-inline-end: var(--fd-pad-x); }
/* A rating of hearts or thumbs up: grey until picked, then filled. */
.fd-rating-heart button.fd-on { color: #e5484d; }
.fd-rating-thumb button.fd-on { color: var(--fd-accent); }
.fd-rating .fd-icon { display: block; width: 1em; height: 1em; }
.fd-rating .fd-on .fd-icon { fill: currentColor; }
/* Words under a slider's ends, each under its own end. */
.fd-slider-word { display: block; max-width: 12em; }
.fd-slider-last { text-align: end; }
`;
