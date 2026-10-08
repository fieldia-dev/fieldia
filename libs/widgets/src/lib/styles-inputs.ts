/**
 * The text, number and date inputs' part of the stylesheet: a count of
 * characters under a box, a number's unit and an amount's currency inside
 * its box, a rating's hearts and thumbs, words at a slider's ends, an NPS
 * scale's colours. Scoped
 * and written with logical properties as the rest of it is; it comes before
 * the question kinds' part.
 */
export const INPUTS_CSS = /* css */ `
/* ---- inputs' details ------------------------------------------------------- */
.fd-counted { display: grid; gap: 2px; min-width: 0; }
/* "12 / 100" reads so on a right-to-left page too. */
.fd-count { justify-self: end; direction: ltr; unicode-bidi: isolate; font-size: 12px; color: var(--fd-muted); font-variant-numeric: tabular-nums; }
.fd-count-near { color: var(--fd-warning); font-weight: 600; }
/* A unit inside the number's box, at its start or end; the box keeps room for it. */
.fd-number:not(.fd-currency-picked) { position: relative; display: block; }
/* As tall as its box, not its row: a label on two lines would stretch it, and the unit would sit below the value. */
.fd-field > .fd-number:not(.fd-currency-picked) { align-self: start; }
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
/* An NPS scale: 0–6, 7–8 and 9–10 tinted red, amber and green in either scheme, and set apart by a gap. */
.fd-nps [data-tone="low"] { --fd-tone: var(--fd-error); --fd-tone-soft: var(--fd-error-soft); }
.fd-nps [data-tone="mid"] { --fd-tone: var(--fd-warning); --fd-tone-soft: var(--fd-warning-soft); }
.fd-nps [data-tone="high"] { --fd-tone: var(--fd-success); --fd-tone-soft: var(--fd-success-soft); }
.fd-nps button { background: var(--fd-tone-soft); border-color: var(--fd-tone); color: var(--fd-tone); font-weight: 600; }
.fd-nps button.fd-on { background: var(--fd-tone); border-color: var(--fd-tone); color: var(--fd-surface); }
.fd-nps [data-value="7"], .fd-nps [data-value="9"] { margin-inline-start: 8px; }
/* A rating's or a scale's end words under its first and last points, not the field's edges. */
.fd-choices-box > .fd-scale-box { justify-self: start; }
`;
