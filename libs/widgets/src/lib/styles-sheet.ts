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
/* A ribbon with words to point at takes the pointer, though its frame lets clicks through. */
.fd-ribbon[title] { pointer-events: auto; cursor: help; }
/* A field's value inside an alert's or a text's words, set apart by its weight. */
.fd-value { font-weight: 600; }
/* An alert's own buttons, after its words: links in the alert's colour, wrapping under the words on a narrow screen. */
.fd-alert:has(> .fd-alert-actions) { flex-wrap: wrap; align-items: baseline; }
.fd-alert-actions { display: inline-flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
.fd-alert-actions .fd-button { min-height: 0; padding-block: 0; font-size: inherit; }
.fd-alert-actions .fd-button-link { color: inherit; padding-inline: 0; text-decoration: underline; text-underline-offset: 2px; font-weight: 600; }
/* An alert among a page's parts, as Flectra's in a tab: across its row. */
.fd-text-alert { grid-column: 1 / -1; margin: 0; }
/* The first alert on a card clears the ribbon in its corner, when no stat buttons stand between them. */
.fd-card:has(> .fd-ribbon-frame > .fd-ribbon:not([hidden])) > :is(.fd-ribbon-frame + .fd-alert, .fd-ribbon-frame + .fd-stats[hidden] + .fd-alert) { margin-inline-end: 72px; }
`;
