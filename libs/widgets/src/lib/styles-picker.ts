/**
 * The pickers as a work tracker draws them (Azure DevOps's work item, in its
 * Fluent look): Fieldia's own lists — a choice's (own-list.ts) and a state's
 * with a tick alone (state-dot.ts) — a path picker's list of suggestions and
 * its tree (path-picker.ts), a state's dot in the lead slot before its value,
 * tags added from a button, and a link with no one picked yet. Its sizes are
 * measured from the work tracker's own screens; its colours are the form's
 * tokens, so a host's tokens (a work tracker's #0078d4, #deecf9, #eaeaea)
 * draw it exactly, and a dark scheme or another theme draws it in theirs.
 * After the quiet look, which it adds to; written with logical properties,
 * so right to left mirrors it.
 */
export const PICKER_CSS = /* css */ `
/* ---- Fieldia's own lists: a row for each choice, a tick before the one picked ----------------------------- */
.fd-pick-list {
  position: absolute; inset-block-start: 100%; inset-inline-start: 0; z-index: 30; display: block; min-width: 100%; max-height: 320px;
  margin: 0; padding: 8px 0; overflow-x: hidden; overflow-y: auto; border: 0; border-radius: 4px; outline: none;
  background: var(--fd-surface); color: var(--fd-text); font-size: 14px; line-height: 20px;
  box-shadow: 0 3.2px 7.2px rgba(0, 0, 0, 0.132), 0 0.6px 1.8px rgba(0, 0, 0, 0.108);
}
.fd-pick-row {
  display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 0; height: 29px; margin: 0 0 1px; padding: 0; padding-inline-end: 20px;
  border-radius: 0; color: var(--fd-text); font-weight: 400; white-space: nowrap; cursor: pointer; outline: none;
}
.fd-pick-row[aria-checked="true"] { font-weight: 400; }
/* The tick is the row's own, before its words: not the dot menu's after them. */
.fd-pick-list .fd-pick-row::after { content: none; }
.fd-pick-tick { display: grid; place-items: center; visibility: hidden; color: var(--fd-text); }
.fd-pick-tick .fd-icon { width: 16px; height: 16px; margin: 0; stroke-width: 1.5; }
.fd-pick-row:is([aria-checked="true"], [aria-selected="true"]) > .fd-pick-tick { visibility: visible; }
.fd-pick-words { display: block; min-width: 0; padding-inline: 2px 6px; line-height: 29px; overflow: hidden; text-overflow: ellipsis; }
@media (hover: hover) { .fd-pick-row:hover { background: color-mix(in srgb, var(--fd-text) 5%, transparent); } }
/* The row worked on: the selection colour, and a focus rectangle round its words. */
.fd-pick-row:is(:focus, [data-active]) { background: var(--fd-accent-soft); outline: none; }
.fd-pick-row:is(:focus, [data-active]) > .fd-pick-words {
  outline: 1px solid var(--fd-focus); outline-offset: -1px; box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--fd-focus) 14%, transparent);
}

/* ---- a choice in Fieldia's own list: a box as a choice's, its words the value, opened by the whole box -------- */
.fd-own-box.fd-dot-box { display: flex; align-items: center; gap: 0; width: 100%; min-width: 0; min-height: var(--fd-control-height, 30px); padding-inline-end: calc(var(--fd-pad-x) + 18px); cursor: pointer; }
:is(.fd-own-box, .fd-field[data-quiet] .fd-own-box) > .fd-own-button {
  position: absolute; inset: 0; width: auto; height: auto; margin: 0; padding: 0; border: 0; border-radius: inherit; background: none; cursor: pointer;
}
:is(.fd-own-box, .fd-field[data-quiet] .fd-own-box) > .fd-own-button:focus-visible { outline: none; }
.fd-own-box > .fd-own-button:disabled { cursor: default; }
.fd-own-box > .fd-own-words { display: block; min-width: 0; font-size: inherit; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
.fd-own-box > .fd-own-words:empty::before { content: attr(data-placeholder); color: var(--fd-muted); }
.fd-own-box:has(> .fd-own-button:is(:focus-visible, [aria-expanded="true"])) { border-color: var(--fd-focus); box-shadow: var(--fd-focus-ring); }
.fd-own-box::after {
  content: ""; position: absolute; inset-inline-end: calc(var(--fd-pad-x) + 2px); inset-block-start: 50%; width: 6px; height: 6px; margin-block-start: -5px;
  border: solid var(--fd-muted); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); pointer-events: none;
}
.fd-own-box:has(> .fd-own-button:disabled) { cursor: default; color: var(--fd-muted); }
.fd-own-box:has(> .fd-own-button:disabled)::after { content: none; }

/* ---- a state's dot: in the lead slot before its value, where the field has one (data-lead, a work item's band) */
.fd-field[data-lead] .fd-dot-box:not(.fd-own-box) > .fd-dot-button {
  position: absolute; inset-inline-end: 100%; inset-block: 0; width: 24px; height: auto; margin: 0; border-radius: 0; background: none;
}
.fd-field[data-lead] .fd-dot-box:not(.fd-own-box) > .fd-dot-button > .fd-dot { width: 10px; height: 10px; }
.fd-field[data-lead] .fd-dot-box:not(.fd-own-box) { cursor: pointer; }

/* ---- a path picker: its chevron at the box's end, and its list as wide as the box ---------------------------- */
.fd-path > .fd-path-input { padding-inline-end: 34px; }
.fd-path-chevron { position: absolute; inset-block: 0; inset-inline-end: 7px; display: grid; place-items: center; width: 20px; color: var(--fd-text); cursor: pointer; }
.fd-path-chevron .fd-icon { width: 20px; height: 20px; margin: 0; stroke-width: 1.2; }
.fd-path:has(> .fd-path-input[readonly]) > .fd-path-chevron { display: none; }
.fd-form .fd-field[data-quiet] .fd-path:not(:focus-within) > .fd-path-chevron { visibility: hidden; }
@media (hover: hover) { .fd-form .fd-field[data-quiet] .fd-path:hover > .fd-path-chevron { visibility: visible; } }
.fd-path-callout {
  box-sizing: border-box; margin: 0; padding: 8px 0; overflow-x: hidden; overflow-y: auto; border: 0; border-radius: 0 0 2px 2px;
  background: var(--fd-surface); color: var(--fd-text); font-family: var(--fd-font); font-size: 14px; line-height: 20px; text-align: start;
  box-shadow: 0 3.2px 7.2px rgba(0, 0, 0, 0.132), 0 0.6px 1.8px rgba(0, 0, 0, 0.108);
  scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--fd-text) 20%, transparent) transparent;
}
.fd-path-heading { height: 26px; padding-inline-start: 43px; font-weight: 600; line-height: 26px; white-space: nowrap; }
.fd-path-row { display: grid; grid-template-columns: minmax(0, 1fr); height: 24px; margin: 0 0 2px; padding-inline: 8px; line-height: 24px; white-space: nowrap; cursor: pointer; }
.fd-path-row:has(> .fd-path-aside) { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
.fd-path-name { position: relative; min-width: 0; padding-inline-start: calc(35px + var(--fd-depth, 0) * 16px); overflow: hidden; text-overflow: ellipsis; }
.fd-path-aside { min-width: 0; padding-inline-end: 12px; text-align: end; overflow: hidden; text-overflow: ellipsis; }
/* A path and its dates read their own way: "3/25/2026 - 4/16/2026" stays in its order on a page read right to left. */
.fd-path-words, .fd-path-aside > span { unicode-bidi: plaintext; }
.fd-path-twist {
  position: absolute; inset-block: 0; inset-inline-start: calc(9px + var(--fd-depth, 0) * 16px); display: grid; place-items: center; width: 20px;
  padding: 0; border: 0; background: none; color: var(--fd-text); cursor: pointer;
}
.fd-path-twist .fd-icon { width: 20px; height: 20px; margin: 0; stroke-width: 1.2; }
.fd-path-twist .fd-icon[data-icon="chevron-right"]:dir(rtl) { transform: scaleX(-1); }
.fd-path-divider { height: 1px; margin-block: 8px 11px; margin-inline: 20px 12px; background: var(--fd-border); }
.fd-path-empty { padding: 3px 43px; }
@media (hover: hover) { .fd-path-row:hover { background: color-mix(in srgb, var(--fd-text) 5%, transparent); } }
/* The row reached: the selection colour, a focus rectangle round its name and another round its words at the end. */
.fd-path-row[data-active] { background: var(--fd-accent-soft); }
.fd-path-row[data-active] > :is(.fd-path-name, .fd-path-aside) {
  outline: 1px solid var(--fd-focus); outline-offset: -1px; box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--fd-focus) 14%, transparent);
}

/* A list too narrow for both side by side (a phone's): the words at the end go under the name, smaller. */
.fd-path-callout { container-type: inline-size; }
@container (max-width: 400px) {
  .fd-path-row:has(> .fd-path-aside) { grid-template-columns: minmax(0, 1fr); height: auto; line-height: 20px; padding-block: 2px; }
  .fd-path-aside { padding-inline: calc(35px + var(--fd-depth, 0) * 16px) 12px; text-align: start; font-size: 12px; line-height: 16px; }
}

/* ---- tags added from a button: "Add Tag" in a light fill, the tags' box only while one is typed --------------- */
.fd-tags-adder {
  display: inline-flex; align-items: center; height: 19px; padding: 0 3px; border: 0; border-radius: 2px;
  background: var(--fd-fill, color-mix(in srgb, var(--fd-text) 6%, var(--fd-surface))); color: var(--fd-text);
  font: inherit; font-size: 14px; font-weight: 600; line-height: 19px; white-space: nowrap; cursor: pointer;
}
.fd-tags-adder:hover { background: color-mix(in srgb, var(--fd-text) 10%, var(--fd-surface)); }
.fd-tags-adder:active { background: color-mix(in srgb, var(--fd-text) 18%, var(--fd-surface)); }
/* The button showing, the tags are words and a button: no box round them, pointed at or not. */
.fd-tags:has(> .fd-tags-adder:not([hidden])) { border-color: transparent !important; background-color: transparent !important; box-shadow: none !important; }

/* ---- a link with no one picked yet, in the quiet look: a person's outline and the page's words, muted -------- */
.fd-link-nobody { display: none; }
.fd-form .fd-field[data-quiet] .fd-combo[data-avatar] > .fd-link-nobody:not([hidden]) {
  position: absolute; inset-inline-start: var(--fd-quiet-pad); display: grid; place-items: center; width: 16px; height: 16px; color: var(--fd-muted); pointer-events: none;
}
.fd-form .fd-field[data-quiet] .fd-combo[data-avatar] > .fd-link-nobody .fd-icon { width: 16px; height: 16px; margin: 0; stroke-width: 1.5; }
.fd-form .fd-field[data-quiet] .fd-combo[data-avatar] > .fd-link-nobody:not([hidden]) ~ .fd-combo-input { padding-inline-start: calc(var(--fd-quiet-pad) + 25px); }
.fd-form .fd-field[data-quiet] .fd-combo[data-avatar] > .fd-combo-input::placeholder { color: var(--fd-muted); opacity: 1; }
`;
