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
.fd-card, .fd-form[data-fd-skin="outlined"] .fd-section[data-style="card"][data-on-page] { --fd-ground: var(--fd-surface); }
fieldset.fd-section[data-style] { background-color: var(--fd-ground); }
.fd-form .fd-section[data-style="line"] > .fd-section-title { border-block-end: 1px solid var(--fd-border); padding-block-end: 8px; }
.fd-form .fd-section[data-style="plain"] > .fd-section-title { border-block-end: 0; padding-block-end: 0; }
.fd-form .fd-section[data-style="framed"] {
  border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); padding: 6px 18px 18px;
}
/* The title sits on the frame, as a fieldset's legend does: the frame breaks round it. */
.fd-form .fd-section[data-style="framed"] > .fd-section-title {
  float: none; width: auto; max-width: 100%; padding: 0 6px; margin-inline-start: -6px; border: 0;
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
/* Hidden: out of sight, still the box's name for a screen reader; the empty box shows it instead. */
.fd-form .fd-field[data-labels="hidden"] > .fd-label {
  position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
}
/* After: a tick box, then its words on the same line, as a sentence; its help and messages under the words. The
   padding sets it level with the boxes beside it in a row. */
.fd-form .fd-field[data-labels="after"] {
  grid-template-columns: auto minmax(0, 1fr); column-gap: 9px; align-items: start;
  padding-block-start: max(0px, calc((var(--fd-control-height, 30px) - 1.45em) / 2));
}
.fd-form .fd-field[data-labels="after"] > .fd-tick { grid-column: 1; grid-row: 1; width: 17px; height: 17px; margin-block-start: calc((1.45em - 17px) / 2); }
.fd-form .fd-field[data-labels="after"] > :not(.fd-tick) { grid-column: 2; }
.fd-form .fd-field[data-labels="after"] > .fd-label { grid-row: 1; font-weight: inherit; line-height: 1.45; cursor: pointer; }
/* A field or a cell that measures itself is drawn over its neighbours while it is worked in: its lists and calendars open over them. */
.fd-form .fd-field[data-labels="beside"]:focus-within, .fd-grid > .fd-section[data-place="shared"]:focus-within { z-index: 3; }

/* ---- widths for tabs, words and buttons: they span columns like fields; a button stays as wide as its words ---- */
:is(.fd-grid, .fd-sections) > .fd-button { justify-self: start; }
/* A note: words set apart in a soft panel, a shade off whatever it stands on — a card, the page, or the dark. */
.fd-form .fd-text-note { background: color-mix(in srgb, var(--fd-text) 6%, transparent); color: var(--fd-text); border-radius: var(--fd-control-radius, 6px); padding: 10px 12px; }

/* ---- the page's look ---- */
.fd-form[data-font="serif"] { --fd-font: "Source Serif 4", Georgia, serif; }
.fd-form[data-font="rounded"] { --fd-font: Nunito, "Varela Round", system-ui; }
/* Room between and inside parts: gaps, the height of a box, a group's padding, the space between groups. */
.fd-form[data-density="compact"] { --fd-gap-y: 10px; --fd-gap-x: 16px; --fd-control-height: 30px; --fd-gap-block: 16px; --fd-group-pad: 14px 16px; }
.fd-form[data-density="comfortable"] { --fd-gap-y: 16px; --fd-gap-x: 20px; --fd-control-height: 36px; --fd-gap-block: 22px; --fd-group-pad: 18px 22px; }
.fd-form[data-density="roomy"] { --fd-gap-y: 22px; --fd-gap-x: 28px; --fd-control-height: 42px; --fd-gap-block: 30px; --fd-group-pad: 24px 30px; }
.fd-form[data-corners="square"] { --fd-radius: 0px; --fd-control-radius: 0px; }
.fd-form[data-corners="soft"] { --fd-radius: 10px; --fd-control-radius: 6px; }
.fd-form[data-corners="round"] { --fd-radius: 16px; --fd-control-radius: 12px; }

/* Light or dark: a page that names its scheme paints its own ground, so it reads the same on any page round it. */
.fd-form[data-scheme] { color-scheme: light; background: var(--fd-page); color: var(--fd-text); border-radius: var(--fd-radius); --fd-ground: var(--fd-page); }
.fd-form[data-scheme] > .fd-content:not(:has(> .fd-sheet-page)) { padding: 20px; }
.fd-form[data-scheme="dark"] {
  color-scheme: dark;
  --fd-text: #e8eaed;
  --fd-muted: #a3a9b2;
  --fd-page: #16191e;
  --fd-surface: #1f2329;
  --fd-border: #3a4048;
  --fd-border-strong: #59616c;
  --fd-accent: #5aa2ff;
  --fd-accent-text: #0b1220;
  --fd-accent-soft: rgba(90, 162, 255, 0.16);
  --fd-focus: #5aa2ff;
  --fd-error: #ff8a7a;
  --fd-error-soft: rgba(255, 138, 122, 0.13);
  --fd-success: #6fd08e;
  --fd-success-soft: rgba(111, 208, 142, 0.14);
  --fd-warning: #f2b55c;
  --fd-warning-soft: rgba(242, 181, 92, 0.13);
  --fd-info: #7db7ff;
  --fd-info-soft: rgba(90, 162, 255, 0.14);
}
/* Auto follows the reader's system: the same dark tokens, when it is dark. */
@media (prefers-color-scheme: dark) {
  .fd-form[data-scheme="auto"] {
    color-scheme: dark;
    --fd-text: #e8eaed;
    --fd-muted: #a3a9b2;
    --fd-page: #16191e;
    --fd-surface: #1f2329;
    --fd-border: #3a4048;
    --fd-border-strong: #59616c;
    --fd-accent: #5aa2ff;
    --fd-accent-text: #0b1220;
    --fd-accent-soft: rgba(90, 162, 255, 0.16);
    --fd-focus: #5aa2ff;
    --fd-error: #ff8a7a;
    --fd-error-soft: rgba(255, 138, 122, 0.13);
    --fd-success: #6fd08e;
    --fd-success-soft: rgba(111, 208, 142, 0.14);
    --fd-warning: #f2b55c;
    --fd-warning-soft: rgba(242, 181, 92, 0.13);
    --fd-info: #7db7ff;
    --fd-info-soft: rgba(90, 162, 255, 0.14);
  }
}

/* The page's accent, and the softer and hover shades mixed from it on whatever surface the scheme has. */
.fd-form[data-accent] {
  --fd-accent: var(--fd-look-accent);
  --fd-accent-text: var(--fd-look-accent-text);
  --fd-focus: var(--fd-look-accent);
  --fd-accent-soft: color-mix(in srgb, var(--fd-accent) 12%, var(--fd-surface));
  --fd-accent-hover: color-mix(in srgb, var(--fd-accent) 84%, var(--fd-text));
}
/* On a dark page, the accent the viewer lightened, when it had to be, so it still reads there. */
.fd-form[data-scheme="dark"][data-accent] {
  --fd-accent: var(--fd-look-accent-dark);
  --fd-accent-text: var(--fd-look-accent-dark-text);
  --fd-focus: var(--fd-look-accent-dark);
}
@media (prefers-color-scheme: dark) {
  .fd-form[data-scheme="auto"][data-accent] {
    --fd-accent: var(--fd-look-accent-dark);
    --fd-accent-text: var(--fd-look-accent-dark-text);
    --fd-focus: var(--fd-look-accent-dark);
  }
}
.fd-form[data-fd-skin="outlined"][data-accent] { --fd-focus-ring: 0 0 0 2px color-mix(in srgb, var(--fd-accent) 22%, transparent); }
.fd-form[data-accent] .fd-button-primary:hover { filter: none; background: var(--fd-accent-hover); border-color: var(--fd-accent-hover); }
/* A band of the accent under the page's title. */
.fd-form[data-accent] .fd-page-head { border-block-end: 3px solid var(--fd-accent); padding-block-end: 14px; }
`;
