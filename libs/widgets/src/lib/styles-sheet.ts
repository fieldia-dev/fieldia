/**
 * How a record sheet reads, as Flectra draws one: read-only values as words.
 * Appended to Fieldia's stylesheet, scoped and written with logical
 * properties as the rest of it is.
 */
export const SHEET_CSS = /* css */ `
/* ---- a sheet's reading ----------------------------------------------------- */
/* A read-only value as its words: on the line a box's words would sit on, wrapped rather than cut at the box's edge. */
.fd-read-text {
  min-width: 0; min-height: var(--fd-control-height, 30px); padding-block: calc(var(--fd-pad-y) + 1px);
  white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.45; color: var(--fd-text);
}
.fd-field:is([data-type="integer"], [data-type="float"], [data-type="monetary"]) > .fd-read-text { font-variant-numeric: tabular-nums; }
.fd-read-text a, .fd-read-link { color: var(--fd-accent); text-decoration: none; }
.fd-read-link { border: none; background: none; padding: 0; font: inherit; cursor: pointer; text-align: start; }
.fd-read-text a:hover, .fd-read-link:hover { text-decoration: underline; }
.fd-read-link:focus-visible, .fd-read-text a:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; border-radius: 2px; }
/* A choice as a coloured pill, as wide as its words, on the line a box's words sit on. */
.fd-field > .fd-badge { justify-self: start; align-self: start; width: fit-content; margin-block: calc((var(--fd-control-height, 30px) - 24px) / 2); }
.fd-title > .fd-field > .fd-read-text { font-size: 24px; font-weight: 600; line-height: 1.25; }
`;
