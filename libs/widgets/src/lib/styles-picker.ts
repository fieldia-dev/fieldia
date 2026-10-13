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
/* Rows 30.3px apart, as the tracker's (20.20.45: New, Active, Resolved and Closed at 380, 410, 441 and 471): a box's line of
   20.3px and its room round it. */
.fd-pick-row {
  display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 0; height: 29.3px; margin: 0 0 1px; padding: 0; padding-inline-end: 20px;
  border-radius: 0; color: var(--fd-text); font-weight: 400; white-space: nowrap; cursor: pointer; outline: none;
}
.fd-pick-row[aria-checked="true"] { font-weight: 400; }
/* The tick is the row's own, before its words: not the dot menu's after them. */
.fd-pick-list .fd-pick-row::after { content: none; }
.fd-pick-tick { display: grid; place-items: center; visibility: hidden; color: var(--fd-text); }
.fd-pick-tick .fd-icon { width: 16px; height: 16px; margin: 0; stroke-width: 1.5; }
.fd-pick-row:is([aria-checked="true"], [aria-selected="true"]) > .fd-pick-tick { visibility: visible; }
/* Its words at the very start of their frame, as the tracker's. */
.fd-pick-words { display: block; min-width: 0; padding-inline: 0 6px; line-height: 29.3px; overflow: hidden; text-overflow: ellipsis; }
@media (hover: hover) { .fd-pick-row:hover { background: color-mix(in srgb, var(--fd-text) 5%, transparent); } }
/* The row worked on: the selection colour, and a focus rectangle round its words. */
.fd-pick-row:is(:focus, [data-active]) { background: var(--fd-accent-soft); outline: none; }
.fd-pick-row:is(:focus, [data-active]) > .fd-pick-words {
  outline: 1px solid var(--fd-focus); outline-offset: -1px; box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--fd-focus) 14%, transparent);
}

/* ---- a state's dot: in the lead slot before its value, where the field has one (data-lead, a work item's band) */
.fd-field[data-lead] .fd-dot-box:not(.fd-own-box) > .fd-dot-button {
  position: absolute; inset-inline-end: 100%; inset-block: 0; width: 24px; height: auto; margin: 0; border-radius: 0; background: none;
}
.fd-field[data-lead] .fd-dot-box:not(.fd-own-box) > .fd-dot-button > .fd-dot { width: 10px; height: 10px; }
.fd-field[data-lead] .fd-dot-box:not(.fd-own-box) { cursor: pointer; }
/* Its list open (drawn as Fieldia's own, a tick alone), the value stays its words: no box, no chevron, pointed at or not.
   The list's row with the focus shows where the person is; a caret after the words says typing finds a state. */
.fd-form .fd-field[data-quiet] > .fd-dot-box.fd-dot-box[data-list="own"]:not(.fd-own-box):has(> .fd-dot-button[aria-expanded="true"]) {
  border-color: transparent; background-color: transparent; box-shadow: none;
}
.fd-form .fd-field[data-quiet] > .fd-dot-box.fd-dot-box[data-list="own"]:not(.fd-own-box):has(> .fd-dot-button[aria-expanded="true"])::after { visibility: hidden; }
.fd-form .fd-field[data-quiet] > .fd-dot-box[data-list="own"]:not(.fd-own-box):has(> .fd-dot-button[aria-expanded="true"]) > .fd-dot-label::after {
  content: ""; display: inline-block; width: 1px; height: 17px; margin-inline-start: 1px; vertical-align: -4px; background: var(--fd-text);
  animation: fd-caret 1.06s steps(1, end) infinite;
}
@keyframes fd-caret { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .fd-form .fd-field[data-quiet] .fd-dot-label::after { animation: none; } }

/* ---- tags added from a button: "Add Tag" in a light fill, the tags' box only while one is typed --------------- */
.fd-tags-adder {
  display: inline-flex; align-items: center; height: 19px; padding: 0 1px; border: 0; border-radius: 2px;
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
/* Its words 6px after the outline, as the tracker's "No one selected" (20.22.23: the outline's ink 129–138, the words at 150). */
.fd-form .fd-field[data-quiet] .fd-combo[data-avatar] > .fd-link-nobody:not([hidden]) ~ .fd-combo-input { padding-inline-start: calc(var(--fd-quiet-pad) + 22px); }
.fd-form .fd-field[data-quiet] .fd-combo[data-avatar] > .fd-combo-input::placeholder { color: var(--fd-muted); opacity: 1; }
`;
