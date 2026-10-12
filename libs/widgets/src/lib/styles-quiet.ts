/**
 * The quiet look, as Azure DevOps draws a work item: in a field the viewer
 * marks quiet (`data-quiet`, by the `quiet` skin, or a section or a field that
 * asks), a value reads as plain words; pointed at, a light box and the
 * control's own sign show — the chevron of a choice, a date's calendar, a
 * link's × — and clicked or tabbed into, it is its editor, ringed in the
 * focus colour. Each box is always there, its edge and ground see-through
 * until wanted, so pointing or entering never moves a word. A screen with no
 * pointer to hover with goes from words to the editor in one tap.
 *
 * Read-only by a rule (`data-locked`), a value is its words in the muted
 * colour, with no box to point at; the whole form read-only, it reads in the
 * page's own. After the themes' own shapes and as specific as they are, or
 * more, so it wins over the skins', the themes' and the page's looks where it
 * speaks; written with logical properties as the rest is.
 */
export const QUIET_CSS = /* css */ `
/* ---- the quiet look --------------------------------------------------------- */
/* A state's words by its dot, where the page does not ask for them: the quiet look shows them, as the value it reads. */
.fd-dot-label[data-quiet-words] { display: none; }
/* In a quiet place labels are quieter than values, which read as words: every field's, whatever its own face. */
.fd-form .fd-field[data-in-quiet] > .fd-label { color: var(--fd-muted); }
/* Words set in from a box's edge, though a skin or a theme sets its boxes' words at the edge (Google Forms'). */
.fd-form .fd-field[data-quiet] { --fd-quiet-pad: max(var(--fd-pad-x), 6px); }
.fd-form .fd-field[data-quiet] :where(.fd-input) { padding-inline-start: var(--fd-quiet-pad); }
/* Each box always there, its edge and ground see-through at rest. */
.fd-form .fd-field[data-quiet] :is(.fd-input:not(.fd-tags *), .fd-tags, .fd-dot-box) {
  border: 1px solid transparent; border-radius: max(var(--fd-control-radius), 4px); background-color: transparent; box-shadow: none;
  transition: border-color 0.12s ease, background-color 0.12s ease, box-shadow 0.12s ease;
}
/* A count of characters is for typing: kept out of sight, its room kept, until then. */
.fd-form .fd-field[data-quiet]:not(:focus-within) .fd-count { visibility: hidden; }
/* Long words wrap at rest, with no grip to size them by until they are worked in; a number with its unit is no wider than a number needs. */
.fd-form .fd-field[data-quiet] textarea.fd-input:not(:focus) { resize: none; }
.fd-form .fd-field[data-quiet] > .fd-number:not(.fd-currency-picked) { max-width: 18em; }
/* Read-only, words where the editor's would be, at the same place: the Edit switch moves nothing. */
.fd-form .fd-field[data-quiet] .fd-input:is([readonly], :disabled, [contenteditable="false"]) { color: var(--fd-text); opacity: 1; cursor: default; }
.fd-form .fd-field[data-quiet] .fd-input:is([readonly], :disabled, [contenteditable="false"]):not(.fd-combo[data-avatar] > *) { padding-inline: var(--fd-quiet-pad); }
.fd-form .fd-field[data-quiet] > .fd-read-text { padding-inline: calc(var(--fd-quiet-pad) + 1px); }
/* Locked by a rule: its words muted, its lock by its label. The whole form read-only reads in the page's colour. */
.fd-form .fd-field[data-quiet][data-locked] :is(.fd-input, .fd-dot-label), .fd-form .fd-field[data-quiet][data-locked] > .fd-read-text { color: var(--fd-muted); }
/* Nothing in it yet: the words that say what to add, muted; a date's own mask, muted too, until it is typed in. */
.fd-form .fd-field[data-quiet][data-empty] .fd-input:not(:focus) { color: var(--fd-muted); }
/* A state not set yet says what to add, by its grey dot. */
.fd-form .fd-field[data-quiet][data-empty] .fd-dot-label:empty::before { content: attr(data-hint); color: var(--fd-muted); }
/* A box with a problem keeps its red edge at rest. */
.fd-form .fd-field[data-quiet] :is(.fd-input[aria-invalid="true"]:not(.fd-tags *), .fd-tags:has(.fd-input[aria-invalid="true"]), .fd-dot-box:has(> [aria-invalid="true"])) { border-color: var(--fd-error); }

/* Pointed at: a light box. Only where a pointer can hover, so a tap is never left showing one. */
@media (hover: hover) {
  .fd-form .fd-field[data-quiet] > :hover :is(.fd-input:not(.fd-tags *), .fd-tags):not([readonly], :disabled, [contenteditable="false"]),
  .fd-form .fd-field[data-quiet] > :is(.fd-input, .fd-tags, .fd-dot-box:not(:has(:disabled))):not([readonly], :disabled, [contenteditable="false"]):hover {
    border-color: var(--fd-border); background-color: var(--fd-inputs-bg, var(--fd-surface));
  }
}
/* Clicked or tabbed into: the editor, ringed two pixels wide in the accent, which every theme keeps readable on its
   ground (a theme's own focus colour may be a pale glow, as Bootstrap's and shadcn's are). */
.fd-form .fd-field[data-quiet] :is(.fd-input:not(.fd-tags *):not([readonly], :disabled, [contenteditable="false"]):focus, .fd-tags:focus-within, .fd-dot-box:has(> .fd-dot-button:is(:focus-visible, [aria-expanded="true"]))) {
  border-color: var(--fd-accent); background-color: var(--fd-inputs-bg, var(--fd-surface)); box-shadow: 0 0 0 1px var(--fd-accent);
}
/* A read-only value tabbed to has a ring of its own, and no box: there is nothing to type. */
.fd-form .fd-field[data-quiet] .fd-input:is([readonly], [contenteditable="false"]):focus-visible { outline: 2px solid var(--fd-accent); outline-offset: 0; }

/* A choice: its chevron when pointed at or entered, its room kept at rest. */
.fd-form .fd-field[data-quiet] select.fd-input { appearance: none; padding-inline-end: calc(var(--fd-quiet-pad) + 14px); background-image: none; }
.fd-form .fd-field[data-quiet] select.fd-input:not(:disabled):is(:hover, :focus), .fd-form .fd-field[data-quiet] > :hover select.fd-input:not(:disabled) {
  background-image: linear-gradient(45deg, transparent 50%, var(--fd-muted) 50%), linear-gradient(135deg, var(--fd-muted) 50%, transparent 50%);
  background-position: calc(100% - var(--fd-quiet-pad) - 5px) 55%, calc(100% - var(--fd-quiet-pad)) 55%;
  background-size: 5px 5px; background-repeat: no-repeat;
}
.fd-form .fd-field[data-quiet] select.fd-input:not(:disabled):is(:hover, :focus):dir(rtl), .fd-form .fd-field[data-quiet] > :hover select.fd-input:not(:disabled):dir(rtl) {
  background-position: var(--fd-quiet-pad) 55%, calc(var(--fd-quiet-pad) + 5px) 55%;
}
/* A link, or a long list typed into: a chevron while nothing is picked (a link's × stands there once it is). */
.fd-form .fd-field[data-quiet] .fd-combo:is(.fd-choice-search *, :has(> .fd-combo-clear[hidden])):has(> .fd-combo-input:not([readonly]))::after {
  content: ""; position: absolute; inset-inline-end: 12px; width: 6px; height: 6px; margin-block-start: -4px; pointer-events: none;
  border: solid var(--fd-muted); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); visibility: hidden;
}
.fd-form .fd-field[data-quiet] .fd-combo:focus-within::after { visibility: visible; }
.fd-form .fd-field[data-quiet] .fd-choice-search .fd-combo:has(> .fd-combo-input[readonly])::after { content: none; }
/* Right to left, a date's words start where the others' do, its calendar at the end: the browser lays a date out left to right. */
.fd-form .fd-field[data-quiet] input.fd-input:is([type="date"], [type="datetime-local"], [type="time"]):dir(rtl) { position: relative; text-align: right; }
.fd-form .fd-field[data-quiet] input.fd-input:is([type="date"], [type="datetime-local"], [type="time"]):dir(rtl)::-webkit-calendar-picker-indicator { position: absolute; left: var(--fd-quiet-pad); }
/* A date's calendar, a link's × and ↗: shown when pointed at or entered, their room kept. */
.fd-form .fd-field[data-quiet] .fd-input::-webkit-calendar-picker-indicator { opacity: 0; transition: opacity 0.12s ease; }
.fd-form .fd-field[data-quiet] .fd-input:not([readonly]):focus::-webkit-calendar-picker-indicator { opacity: 1; }
.fd-form .fd-field[data-quiet]:not(:focus-within) :is(.fd-calendar-button, .fd-combo-clear, .fd-combo-open) { visibility: hidden; }
@media (hover: hover) {
  .fd-form .fd-field[data-quiet] > :hover :is(.fd-calendar-button, .fd-combo-clear, .fd-combo-open),
  .fd-form .fd-field[data-quiet] > :hover .fd-combo::after { visibility: visible; }
  .fd-form .fd-field[data-quiet] > :hover .fd-input:not([readonly])::-webkit-calendar-picker-indicator,
  .fd-form .fd-field[data-quiet] > .fd-input:not([readonly]):hover::-webkit-calendar-picker-indicator { opacity: 1; }
}

/* A link's lines under it start where its name does. */
.fd-form .fd-field[data-quiet] .fd-link > .fd-link-details { padding-inline-start: calc(var(--fd-quiet-pad) + 1px); }
/* Tags: the chips are the value, in one box round them and the words typed; no prompt beside chips at rest. */
.fd-form .fd-field[data-quiet] .fd-tags { padding: 1px var(--fd-quiet-pad); min-height: var(--fd-control-height, 30px); }
.fd-form .fd-field[data-quiet] .fd-tags .fd-input { border: 0; background-color: transparent; box-shadow: none; padding-inline-start: 0; }
.fd-form .fd-field[data-quiet] .fd-tags:has(.fd-chip) .fd-combo-input:not(:focus)::placeholder { color: transparent; }

/* A state: its dot and its words, the whole box pressed to open the states, each with its dot and the one picked ticked. */
.fd-form .fd-field[data-quiet] .fd-dot-box {
  display: flex; gap: 8px; min-height: var(--fd-control-height, 30px); padding-block: 0; padding-inline: var(--fd-quiet-pad) calc(var(--fd-quiet-pad) + 16px);
}
.fd-form .fd-field[data-quiet] .fd-dot-box::after {
  content: ""; position: absolute; inset-inline-end: calc(var(--fd-quiet-pad) + 2px); inset-block-start: 50%; width: 6px; height: 6px; margin-block-start: -5px;
  border: solid var(--fd-muted); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); visibility: hidden; pointer-events: none;
}
.fd-form .fd-field[data-quiet] .fd-dot-box:has(> .fd-dot-button:is(:focus-visible, [aria-expanded="true"]))::after { visibility: visible; }
@media (hover: hover) { .fd-form .fd-field[data-quiet] .fd-dot-box:not(:has(:disabled)):hover::after { visibility: visible; } }
/* The dot's own button keeps a finger's room, its dot where the other values' words start. */
.fd-form .fd-field[data-quiet] .fd-dot-button { margin-inline-start: -6px; margin-inline-end: -4px; background: none; }
.fd-form .fd-field[data-quiet] .fd-dot-button::before { content: ""; position: absolute; inset: 0; }
.fd-form .fd-field[data-quiet] .fd-dot-button:focus-visible { outline: none; }
.fd-form .fd-field[data-quiet] .fd-dot-label { display: inline; font-size: inherit; color: var(--fd-text); }

/* Formatted text: words at rest, its toolbar under it while it is worked in, floating, so nothing moves as it comes and goes. */
.fd-form .fd-field[data-quiet] .fd-richtext-box { position: relative; }
.fd-form .fd-field[data-quiet] .fd-richtext { min-height: 64px; }
.fd-form .fd-field[data-quiet] .fd-richtext[contenteditable="false"] { min-height: 0; }
/* Its paragraphs read their own way, as a value read as words does: English on an Arabic page keeps its full stop at its end. */
.fd-form .fd-field[data-quiet] .fd-richtext > * { unicode-bidi: plaintext; text-align: left; }
.fd-form .fd-field[data-quiet] .fd-richtext > :dir(rtl) { text-align: right; }
.fd-form .fd-field[data-quiet] .fd-richtext-box:not(:focus-within) > :is(.fd-richtext-bar, .fd-link-row) { display: none; }
.fd-form .fd-field[data-quiet] .fd-richtext-box > :is(.fd-richtext-bar, .fd-link-row) {
  position: absolute; inset-inline: 0; z-index: 25; border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 4px);
  background: var(--fd-surface); box-shadow: 0 6px 18px rgb(15 20 25 / 0.14);
}
.fd-form .fd-field[data-quiet] .fd-richtext-box > .fd-richtext-bar { inset-block-start: calc(100% + 4px); }
.fd-form .fd-field[data-quiet] .fd-richtext-box > .fd-link-row { inset-block-start: calc(100% + 46px); }

/* The lock of a field read-only by a rule, by its label: why, in a bubble, when pointed at or focused. */
.fd-lock-wrap { position: relative; display: inline-flex; vertical-align: -0.15em; margin-inline-start: 6px; }
.fd-lock { display: inline-grid; place-items: center; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 4px; background: none; color: var(--fd-muted); }
button.fd-lock { cursor: help; }
.fd-lock .fd-icon { width: 14px; height: 14px; margin: 0; }
.fd-lock:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
`;
