/**
 * A look for each kind of part, over the page's: what a page sets for its text
 * boxes, choices, groups, buttons and tables. The viewer names what is set on
 * the form (`data-inputs="bg radius"`, …) and hands each value over as a token
 * of that kind (`--fd-inputs-bg`, …), worked out already for the page's scheme:
 * a ground light enough, or dark enough, for the page's words to read on it,
 * an accent moved until words in it and on it read (see `look.ts` in
 * @fieldia/viewer). Each is worn by its own kind of part alone, in either skin.
 *
 * Where a part's own rules draw it from a token (its edge, its corners), the
 * token is set on the part; where a skin draws it otherwise (the underline
 * skin's boxes have no ground), the setting is drawn outright. Last in the
 * stylesheet, so it wins where it speaks; colours and sizes only, so right to
 * left needs nothing of its own.
 */
export const PARTS_CSS = /* css */ `
/* ---- each kind of part's own look ---------------------------------------------- */
/* Boxes typed in or picked from: text, numbers, dates, dropdowns, and a date's calendar button. */
.fd-form[data-inputs~=bg] :is(.fd-input:not([readonly]), .fd-calendar-button) { background: var(--fd-inputs-bg); }
.fd-form[data-inputs~=border] :is(.fd-input, .fd-calendar-button) { --fd-border: var(--fd-inputs-border); --fd-border-strong: var(--fd-inputs-border); }
.fd-form[data-inputs~=radius] :is(.fd-input, .fd-calendar-button) { --fd-control-radius: var(--fd-inputs-radius); }
/* A record's title keeps its own big words. */
.fd-form[data-inputs~=size] :where(.fd-input) { font-size: var(--fd-inputs-size); }
/* The edge of the box being typed in and its glow (the underline skin draws its own line instead), the option and the day picked. */
.fd-form[data-inputs~=accent] :is(.fd-input, .fd-combo, .fd-tags, .fd-date-pick) {
  --fd-accent: var(--fd-inputs-accent); --fd-accent-text: var(--fd-inputs-accent-text); --fd-focus: var(--fd-accent);
  --fd-accent-soft: color-mix(in srgb, var(--fd-accent) 12%, var(--fd-surface));
  --fd-focus-ring: 0 0 0 2px color-mix(in srgb, var(--fd-accent) 22%, transparent);
}

/* Options picked: rings and ticks take the accent; a scale's points, Yes and No, pictures and a ranking's lines are boxes too. */
.fd-form[data-choices~=accent] :is(.fd-choices, .fd-points, .fd-image-choices, .fd-ranking, .fd-checkbox, .fd-switch, .fd-matrix-table, .fd-slider) {
  --fd-accent: var(--fd-choices-accent); --fd-accent-text: var(--fd-choices-accent-text); --fd-focus: var(--fd-accent);
  --fd-accent-soft: color-mix(in srgb, var(--fd-accent) 12%, var(--fd-surface));
}
.fd-form[data-choices~=bg] :is(.fd-points button, .fd-image-card, .fd-rank-item) { --fd-surface: var(--fd-choices-bg); }
.fd-form[data-choices~=border] :is(.fd-points button, .fd-image-card, .fd-rank-item) { --fd-border: var(--fd-choices-border); }
.fd-form[data-choices~=radius] :is(.fd-points button, .fd-image-card, .fd-rank-item) { --fd-control-radius: var(--fd-choices-radius); }
.fd-form[data-choices~=size] :is(.fd-choices, .fd-points, .fd-image-card-words, .fd-rank-list) { font-size: var(--fd-choices-size); }

/* Groups drawn as a card or a frame: a section, a record's sheet, a repeating group's cards. In the
   underline skin, which draws no card round a section, one given a ground or an edge becomes a card. */
.fd-form[data-groups~=bg] :is(.fd-sections > .fd-section:not([data-style]), .fd-section[data-style=card][data-on-page], .fd-section[data-style=framed], .fd-card, .fd-repeat-card) {
  background: var(--fd-groups-bg); --fd-ground: var(--fd-groups-bg);
}
.fd-form[data-groups~=border] :is(.fd-sections > .fd-section:not([data-style]), .fd-section[data-style=card][data-on-page], .fd-section[data-style=framed], .fd-card, .fd-repeat-card) { border: 1px solid var(--fd-groups-border); }
.fd-form[data-groups~=radius] :is(.fd-sections > .fd-section:not([data-style]), .fd-section[data-style=card][data-on-page], .fd-section[data-style=framed], .fd-card, .fd-repeat-card) { border-radius: var(--fd-groups-radius); }
.fd-form[data-fd-skin=underline]:is([data-groups~=bg], [data-groups~=border]) :is(.fd-sections > .fd-section:not([data-style]), .fd-section[data-style=card][data-on-page]) {
  padding: var(--fd-group-pad, 18px 22px); border-radius: var(--fd-groups-radius, var(--fd-radius));
}

/* Buttons: Send, Next, Save, Add another — in a form, and in a dialog it opens. */
:is(.fd-form, .fd-form-dialog)[data-buttons~=accent] .fd-button {
  --fd-accent: var(--fd-buttons-accent); --fd-accent-text: var(--fd-buttons-accent-text); --fd-focus: var(--fd-accent);
  --fd-accent-hover: color-mix(in srgb, var(--fd-accent) 84%, var(--fd-text));
}
:is(.fd-form, .fd-form-dialog)[data-buttons~=accent] .fd-button-primary:hover { filter: none; background: var(--fd-accent-hover); border-color: var(--fd-accent-hover); }
:is(.fd-form, .fd-form-dialog)[data-buttons~=radius] .fd-button { border-radius: var(--fd-buttons-radius); }
:is(.fd-form, .fd-form-dialog)[data-buttons~=size] .fd-button { font-size: var(--fd-buttons-size); }

/* Tables of lines and a matrix's grid: the ground of their heading row, their lines, their words. */
.fd-form[data-tables~=bg] :is(.fd-lines-table, .fd-matrix-table) thead th { background: var(--fd-tables-bg); }
.fd-form[data-tables~=border] :is(.fd-lines-table, .fd-matrix-table) :is(th, td) { border-color: var(--fd-tables-border); }
.fd-form[data-tables~=size] :is(.fd-lines-table, .fd-matrix-table) :is(th, td) { font-size: var(--fd-tables-size); }
`;
