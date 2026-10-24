/**
 * The layout on top of the skins: arrangements on their grid's columns, how
 * each group is drawn, where labels sit, and the page's own look — accent,
 * font, room, corners, light or dark. The viewer hands these over as
 * attributes and tokens on the form (see `place.ts` and `look.ts` in
 * @fieldia/viewer); this stylesheet comes after the skins, so it wins where it
 * speaks and leaves everything else as the skin draws it.
 *
 * Logical properties throughout, so right to left mirrors on its own.
 */
export const LAYOUT_CSS = /* css */ `
/* ---- arrangements: parts side by side or one under another, nothing drawn round them ---- */
/* On its grid's columns: the grid's own tracks and gaps, so its parts line up with everything above and below. */
.fd-grid > .fd-section[data-place="tracks"] {
  /* The columns it covers: its span, never more than its grid has at this width. */
  --fd-tracks: min(var(--fd-span, 1), var(--fd-cols));
  grid-template-columns: subgrid;
  column-gap: var(--fd-gap-x);
}
.fd-form .fd-section[data-place="tracks"] > .fd-grid { --fd-cols: var(--fd-tracks); grid-column: 1 / -1; grid-template-columns: subgrid; }
.fd-section[data-place] > .fd-section-description { grid-column: 1 / -1; }
/* Parts sharing one cell, side by side; one under the other where the cell is too narrow for that. */
.fd-grid > .fd-section[data-place="shared"] { container-type: inline-size; }
.fd-form .fd-section[data-place="shared"] > .fd-grid { --fd-cols: var(--fd-columns, 1); }
@container (max-width: 330px) {
  .fd-form .fd-section[data-place="shared"] > .fd-grid { --fd-cols: 1; }
}

/* ---- how a group is drawn: a card, plain, a line under its title, or a frame round it ---- */
/* A group of its own paints the ground it stands on, so nothing of the grid round it shows through. */
.fd-form { --fd-ground: transparent; }
.fd-card, .fd-form:is([data-fd-skin="outlined"], [data-fd-skin="quiet"]) .fd-section[data-style="card"][data-on-page] { --fd-ground: var(--fd-surface); }
fieldset.fd-section[data-style] { background-color: var(--fd-ground); }
/* A group's title, its words and its parts, one under another, 14px apart (--fd-section-gap): blocks, the title floated
   across the top. Neither a grid's rows nor a flex column: Safari floats nothing in either, and a legend that does not
   float is drawn on its fieldset's border, so every card's title broke the card's top edge; and Safari never lays a
   title out again in a grid that narrows, so a title kept its old width, past the group's edge. The gaps are margins:
   the title's below it, as what clears it (styles.ts) starts below its margin; each part's above it, after one shown. */
fieldset.fd-section { display: flow-root; }
fieldset.fd-section > .fd-section-title { margin-block-end: var(--fd-section-gap, 14px); }
fieldset.fd-section.fd-section-folded > .fd-section-title { margin-block-end: 0; }
fieldset.fd-section > :where(:not(legend, [hidden]) ~ :not([hidden])) { margin-block-start: var(--fd-section-gap, 14px); }
.fd-form .fd-section[data-style="line"] > .fd-section-title { border-block-end: 1px solid var(--fd-border); padding-block-end: 8px; }
.fd-form .fd-section[data-style="plain"] > .fd-section-title { border-block-end: 0; padding-block-end: 0; }
.fd-form .fd-section[data-style="framed"] {
  border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); padding: 6px 18px 18px;
}
/* The title sits on the frame, as a fieldset's legend does: the frame breaks round it. */
.fd-form .fd-section[data-style="framed"] > .fd-section-title {
  float: none; width: auto; max-width: 100%; padding: 0 6px; margin-inline-start: -6px; margin-block-end: 0; border: 0;
}

/* ---- where labels sit: as the page, a group or the field itself says (data-labels), in either skin ---- */
.fd-form .fd-field[data-labels] { grid-template-columns: minmax(0, 1fr); }
.fd-form .fd-field[data-labels] > * { grid-column: 1 / -1; }
/* Beside: the label in a column of its own while the field has room for both. In a cell narrower
   than that the label goes back above its box, so the box is never crushed. */
.fd-form .fd-field[data-labels="beside"] {
  container-type: inline-size;
  grid-template-columns: minmax(0, var(--fd-label-width, 140px)) minmax(0, 1fr);
  column-gap: 14px;
}
@container (min-width: 300px) {
  .fd-form .fd-field[data-labels="beside"] > .fd-label {
    grid-column: 1; align-self: start; padding-block-start: max(0px, calc((var(--fd-control-height, 30px) - 1.45em) / 2));
  }
  .fd-form .fd-field[data-labels="beside"] > :not(.fd-label) { grid-column: 2; }
}
/* On a narrow form — a phone: 520px or less, the form's own narrow, as its columns and hideOn count it — a label beside
   its value would take half the width and cut the value ("+20 100 912 4…", "salma.adel@glo…"): every label goes above
   its value, as the underline skin's do there, and the value has the whole width. In every theme. */
@container fd-form (max-width: 520px) {
  .fd-form .fd-field[data-labels="beside"] { grid-template-columns: minmax(0, 1fr); }
  .fd-form .fd-field[data-labels="beside"] > :not(.fd-label) { grid-column: 1 / -1; }
  .fd-form .fd-field[data-labels="beside"] > .fd-label { grid-column: 1 / -1; padding-block-start: 0; }
}
/* Hidden: out of sight, still the box's name for a screen reader; the empty box shows it instead. */
.fd-form .fd-field[data-labels="hidden"] > .fd-label {
  position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
}
/* After: a tick box, then its words on the same line, as a sentence; its help and messages under the words. They
   drop to sit level with the boxes beside them in a row, by margins: the field's own padding is left to whoever
   draws round it (a designer's canvas rings a part there). */
.fd-form .fd-field[data-labels="after"] {
  grid-template-columns: auto minmax(0, 1fr); column-gap: 9px; align-items: start;
  --fd-tick-drop: max(0px, calc((var(--fd-control-height, 30px) - 1.45em) / 2));
}
/* The box, or what holds it (a designer's canvas wraps each answer box). */
.fd-form .fd-field[data-labels="after"] > :is(.fd-tick, :has(> .fd-tick)) { grid-column: 1; grid-row: 1; margin-block-start: calc(var(--fd-tick-drop) + (1.45em - var(--fd-tick-size, 18px)) / 2); }
.fd-form .fd-field[data-labels="after"] > :has(> .fd-tick) { display: flex; }
.fd-form .fd-field[data-labels="after"] > :not(.fd-tick, :has(> .fd-tick)) { grid-column: 2; }
.fd-form .fd-field[data-labels="after"] > .fd-label { grid-row: 1; margin-block-start: var(--fd-tick-drop); font-weight: inherit; line-height: 1.45; cursor: pointer; }
/* A field or a cell that measures itself is drawn over its neighbours while it is worked in: its lists and calendars open over them. */
.fd-form .fd-field[data-labels="beside"]:focus-within, .fd-grid > .fd-section[data-place="shared"]:focus-within { z-index: 3; }

/* ---- widths for tabs, words and buttons: they span columns like fields; a button stays as wide as its words ---- */
:is(.fd-grid, .fd-sections) > .fd-button { justify-self: start; }
/* A note: words set apart in a soft panel, a shade off whatever it stands on — a card, the page, or the dark. */
.fd-form .fd-text-note { background: color-mix(in srgb, var(--fd-text) 6%, transparent); color: var(--fd-text); border-radius: var(--fd-control-radius, 6px); padding: 10px 12px; }

/* ---- the page's look: worn by the form, and by a dialog it opens (its box and the page in it) ----
   Its tokens are look-styles.ts's, in Fieldia's tokens' layer: a host's own rule sets them over the page's. */
/* Light or dark: a page that names its scheme paints its own ground, so it reads the same on any page round it.
   Its native controls (scroll bars, date pickers) follow it. */
.fd-form[data-scheme] { color-scheme: light; background: var(--fd-page); color: var(--fd-text); border-radius: var(--fd-radius); }
:is(.fd-form, .fd-form-dialog)[data-scheme="dark"] { color-scheme: dark; }
@media (prefers-color-scheme: dark) { :is(.fd-form, .fd-form-dialog)[data-scheme="auto"] { color-scheme: dark; } }
.fd-form[data-scheme] > .fd-content:not(:has(> .fd-sheet-page)) { padding: 20px; }
/* A page in a dialog paints no ground of its own and adds no room: the dialog is its ground. */
.fd-form-dialog-body > .fd-form[data-scheme] { background: none; border-radius: 0; }
.fd-form-dialog-body > .fd-form[data-scheme] > .fd-content:not(:has(> .fd-sheet-page)) { padding: 0; }
:is(.fd-form, .fd-form-dialog)[data-accent] .fd-button-primary:hover { filter: none; background: var(--fd-accent-hover); border-color: var(--fd-accent-hover); }
/* A band of the accent under the page's title. */
.fd-form[data-accent] .fd-page-head { border-block-end: 3px solid var(--fd-accent); padding-block-end: 14px; }
`;
