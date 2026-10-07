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
/* A stat button with two values, each after its words, one over the other: "In: 3", "Out: 5". */
.fd-stat-pair { gap: 1px; }
.fd-stat-row { display: inline-flex; align-items: baseline; gap: 5px; }
.fd-stat-row > .fd-stat-label::after { content: ":"; }
.fd-stat-pair .fd-stat-value { font-size: 13.5px; }
/* On a phone, stat buttons two to a row, edged between them, clear of a ribbon in the corner. */
@container (max-width: 520px) {
  .fd-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fd-stat { min-width: 0; padding-inline: 12px; text-align: start; column-gap: 8px; }
  .fd-stat:has(> .fd-icon) { column-gap: 8px; }
  .fd-stat-value { font-size: 14px; }
  .fd-stat:nth-child(odd of :not([hidden])) { border-inline-start: none; }
  .fd-stat:nth-child(n + 3 of :not([hidden])) { border-block-start: 1px solid var(--fd-border); }
  .fd-card:has(> .fd-ribbon-frame > .fd-ribbon:not([hidden])) .fd-stats { padding-inline-end: 0; }
  .fd-card:has(> .fd-ribbon-frame > .fd-ribbon:not([hidden])) .fd-stat:nth-child(2 of :not([hidden])) { padding-inline-end: 64px; }
  .fd-card:has(> .fd-ribbon-frame > .fd-ribbon:not([hidden])) .fd-stat:nth-child(4 of :not([hidden])) { padding-inline-end: 36px; }
}
/* A statusbar's time spent in a step, after its words; its folded stages under More, in a menu fixed to the page so the bar's scrolling never cuts it. */
.fd-step-time { margin-inline-start: 6px; font-size: 11.5px; font-weight: 400; opacity: 0.8; font-variant-numeric: tabular-nums; }
.fd-statusbar li.fd-step-more > button { padding-inline: 16px 20px; letter-spacing: 1px; }
.fd-statusbar li.fd-step-more > .fd-step-menu {
  position: fixed; z-index: 30; display: grid; min-width: 160px; margin: 0; padding: 4px 0; clip-path: none; transform: none;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 4px);
  box-shadow: 0 8px 24px rgba(15, 20, 25, 0.12); white-space: nowrap;
}
.fd-statusbar li.fd-step-more > .fd-step-menu[hidden] { display: none; }
.fd-statusbar .fd-step-menu > button {
  font: inherit; font-size: 13px; text-align: start; border: none; background: none; color: inherit; padding: 6px 14px; cursor: pointer; transform: none;
}
.fd-statusbar .fd-step-menu > button:hover:not(:disabled), .fd-statusbar .fd-step-menu > button:focus-visible { background: var(--fd-accent-soft); outline: none; }
.fd-statusbar .fd-step-menu > button:disabled { cursor: default; color: var(--fd-muted); }
/* A button's key, shown on it while Alt is held, as Flectra shows its hotkeys. */
.fd-hotkey { display: none; }
[data-hotkeys] .fd-hotkey {
  display: inline-block; margin-inline-start: 6px; padding: 0 4px; border: 1px solid currentColor; border-radius: 3px;
  font: 600 10.5px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; opacity: 0.85; vertical-align: 1px;
}
`;
