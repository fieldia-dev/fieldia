import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * A record's head as a work tracker draws a work item's, and the dialog round
 * it: measured from the work item's own window (fieldia's docs/plans,
 * work-item-replica.md §2.3–2.5) and written in the form's tokens, so a
 * theme, a host's colours, the dark scheme and right to left all follow.
 * Greys that are no token of their own are mixed from the text and the
 * surface, in the shares the light window shows them: the band #f8f8f8, the
 * tabs' frame #dadada, a count's pill #ebebeb, a pressed button #d2d2d2.
 *
 * - The dialog of the `inset` size: 96px in from the window's sides and 46px
 *   from its top and bottom, the whole window under 760px; with no dimmed
 *   page behind (`clear`); maximised, the whole window; resized by its grip.
 * - The head: the kind's strip along its start edge through its white part,
 *   the badge row (⤢ and × at its end), the title line, the row of people,
 *   links and buttons, then the band of fields with "Updated by" and the
 *   tabs at its end; the body under it scrolls on its own in a dialog.
 * - Buttons a head holds: quiet ones on a light fill, split ones with a rule
 *   between their press and their chevron, ones shown by their icon alone.
 *
 * Logical properties throughout: right to left mirrors on its own.
 *
 * The head part's own sheet (head-part.ts), put in its place among Fieldia's
 * the first time a page draws a head, a split button, a work heading or the
 * inset dialog (installPartStyles, PART_RANK.head).
 */
export const HEAD_PART_CSS = /* css */ `
/* ---- the dialog ---------------------------------------------------------------------- */
/* Nothing dimmed behind: the page stays as it is, out of reach while the dialog is open. */
.fd-dialog-backdrop.fd-backdrop-clear { background: transparent; }
/* As a work item's window over its list: in from the window's edges, its corners small, its shadow deep. */
.fd-form-dialog.fd-size-inset {
  position: fixed; inset: 46px 96px; width: auto; height: auto; max-width: none; max-height: none;
  border-radius: 4px; background: var(--fd-surface);
  /* An edge of its own where the scheme has one: in the dark a shadow is lost on the page behind. */
  box-shadow: 0 0 0 1px var(--fd-edge, transparent), 0 25.6px 57.6px rgba(0, 0, 0, 0.22), 0 4.8px 14.4px rgba(0, 0, 0, 0.18);
}
/* Under 760px it is the whole window already: nothing to maximise or resize. */
@media (max-width: 759.98px) { .fd-form-dialog.fd-size-inset { inset: 0; border-radius: 0; } .fd-form-dialog.fd-size-inset :is(.fd-dialog-max, .fd-dialog-grip) { display: none !important; } }
/* Resized by its grip: where it stands and how big, set on it. */
.fd-form-dialog[data-resized] { position: fixed; max-width: none; max-height: none; margin: 0; }
/* Maximised: the whole window, whatever its size or place was; Restore puts it back. */
.fd-form-dialog[data-maximised] { position: fixed; inset: 0 !important; width: auto !important; height: auto !important; max-width: none; max-height: none; border-radius: 0; }
.fd-form-dialog[data-maximised] > .fd-dialog-grip { display: none; }
/* ⤢ beside ×, and the head's own window buttons: an icon in a box a finger's size. */
.fd-dialog-max { display: inline-grid; place-items: center; border: none; background: none; cursor: pointer; padding: 2px 8px; border-radius: 4px; color: var(--fd-muted); }
.fd-dialog-max:hover { background: var(--fd-page); color: var(--fd-text); }
.fd-dialog-max .fd-icon { width: 16px; height: 16px; margin: 0; }
.fd-form-dialog :is(.fd-dialog-max, .fd-head-window .fd-dialog-close) {
  display: inline-grid; place-items: center; width: 32px; height: 32px; padding: 0; font-size: 16px;
  color: var(--fd-text); border-radius: 2px;
}
.fd-form-dialog :is(.fd-dialog-max, .fd-head-window .fd-dialog-close) .fd-icon { width: 16px; height: 16px; margin: 0; }
/* The grip at the end-bottom corner: a small triangle in outline, in the words' colour, a finger's room round it (08_19). */
.fd-dialog-grip {
  position: absolute; inset-inline-end: 0; inset-block-end: 0; width: 16px; height: 16px; padding: 0; border: 0; z-index: 2;
  background: none; cursor: nwse-resize; color: color-mix(in srgb, var(--fd-text) 90%, var(--fd-surface)); border-end-end-radius: 4px;
}
.fd-dialog-grip:dir(rtl) { cursor: nesw-resize; }
.fd-dialog-grip::before {
  content: ""; position: absolute; inset-inline-end: 4px; inset-block-end: 4px; box-sizing: border-box; width: 7px; height: 7px;
  border-inline-end: 1.5px solid currentColor; border-block-end: 1.5px solid currentColor;
  background: linear-gradient(to top left, transparent calc(50% - 0.75px), currentColor calc(50% - 0.75px) calc(50% + 0.75px), transparent calc(50% + 0.75px));
}
.fd-dialog-grip:dir(rtl)::before {
  background: linear-gradient(to top right, transparent calc(50% - 0.75px), currentColor calc(50% - 0.75px) calc(50% + 0.75px), transparent calc(50% + 0.75px));
}
.fd-form-dialog:has(> .fd-dialog-grip) { position: relative; }
/* The grip has a band of its own at the foot: the body's scrollbar ends above it, as a work item's window has it; a
   history filling the body keeps 20px under its list, its foot 38px from the window's edge as before. */
.fd-form-dialog[data-headed]:not([data-maximised]):has(> .fd-dialog-grip) > .fd-form-dialog-body { padding-block-end: 18px; --fd-history-foot: 20px; }
@media (max-width: 759.98px) { .fd-form-dialog.fd-size-inset[data-headed]:has(> .fd-dialog-grip) > .fd-form-dialog-body { padding-block-end: 0; --fd-history-foot: 38px; } }
.fd-form-dialog.fd-size-inset:has(> .fd-dialog-grip), .fd-form-dialog[data-resized] { position: fixed; }

/* A page with a head of its own is the dialog: its head stays, its body scrolls under it. */
.fd-form-dialog[data-headed] > .fd-form-dialog-body { display: flex; flex-direction: column; overflow: hidden; padding: 0; background: var(--fd-surface); }
.fd-form-dialog[data-headed] > .fd-form-dialog-body > .fd-form { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.fd-form-dialog[data-headed] > .fd-form-dialog-body > .fd-form > .fd-content { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.fd-form-dialog[data-headed] .fd-head-page { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.fd-form-dialog[data-headed] .fd-head-page > .fd-head { flex: none; }
.fd-form-dialog[data-headed] .fd-head-page > :is(.fd-head-body, .fd-head-layout) { flex: 1 1 auto; min-height: 0; overflow: auto; }

/* ---- scroll bars, as the tracker's window draws them on every system: 15px, a light track with a hairline at its
   inner edge, a rounded thumb inset in it, no arrows (where the browser lets a page draw them: Chrome, Edge, Safari).
   Each selector written out: Chrome drops a scroll bar part's :vertical or :horizontal under an :is() ancestor, and a
   part paints no logical border, so its sides are physical ones, swapped right to left. ---- */
.fd-head-page ::-webkit-scrollbar { width: 15px; height: 15px; }
.fd-head-page ::-webkit-scrollbar-track,
.fd-head-page ::-webkit-scrollbar-corner { background: color-mix(in srgb, var(--fd-text) 2.2%, var(--fd-surface)); }
.fd-head-page ::-webkit-scrollbar-track:vertical {
  border-left: 1px solid color-mix(in srgb, var(--fd-text) 10%, var(--fd-surface)); border-right: 1px solid color-mix(in srgb, var(--fd-text) 7.5%, var(--fd-surface));
}
[dir="rtl"] .fd-head-page ::-webkit-scrollbar-track:vertical {
  border-left-color: color-mix(in srgb, var(--fd-text) 7.5%, var(--fd-surface)); border-right-color: color-mix(in srgb, var(--fd-text) 10%, var(--fd-surface));
}
.fd-head-page ::-webkit-scrollbar-track:horizontal {
  border-top: 1px solid color-mix(in srgb, var(--fd-text) 10%, var(--fd-surface)); border-bottom: 1px solid color-mix(in srgb, var(--fd-text) 7.5%, var(--fd-surface));
}
.fd-head-page ::-webkit-scrollbar-thumb {
  border: solid transparent; border-width: 3px 3px 3px 4px; border-radius: 8px; background: color-mix(in srgb, var(--fd-text) 24.5%, var(--fd-surface)) padding-box;
}
.fd-head-page ::-webkit-scrollbar-thumb:horizontal { border-width: 4px 3px 3px; }
[dir="rtl"] .fd-head-page ::-webkit-scrollbar-thumb:vertical { border-width: 3px 4px 3px 3px; }
.fd-head-page ::-webkit-scrollbar-thumb:hover { background-color: color-mix(in srgb, var(--fd-text) 40%, var(--fd-surface)); }
.fd-head-page ::-webkit-scrollbar-button { display: none; }

/* ---- the head ------------------------------------------------------------------------ */
.fd-head-page { padding: 0; background: var(--fd-surface); }
.fd-head {
  --fd-head-edge: color-mix(in srgb, var(--fd-text) 16.2%, var(--fd-surface));
  --fd-head-pill: color-mix(in srgb, var(--fd-text) 8.7%, var(--fd-surface));
  --fd-head-pressed: color-mix(in srgb, var(--fd-text) 19.7%, var(--fd-surface));
  --fd-head-fill: var(--fd-fill, color-mix(in srgb, var(--fd-text) 5.7%, var(--fd-surface)));
  --fd-head-icon: color-mix(in srgb, var(--fd-text) 79%, var(--fd-surface));
  --fd-head-link: var(--fd-link, var(--fd-accent));
  --fd-control-height: 32px;
  container: fd-head / inline-size;
  position: relative; background: var(--fd-surface); color: var(--fd-text); font-size: 14px;
}
/* The white part: the strip of the kind's colour along its start edge, through it and no further. */
.fd-head-top { position: relative; padding-block-end: 6px; }
.fd-head-strip { position: absolute; inset-block: 0; inset-inline-start: 0; width: 10px; background: var(--fd-kind, transparent); }
.fd-head:not([data-kind]) .fd-head-strip { display: none; }
/* The badge row: the kind's icon in its colour, its name in capitals and the number in the link colour; ⤢ and × at its end. */
.fd-head-badge-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 42px; padding-inline: 20px 4px; }
.fd-head-badge { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; line-height: 16px; color: var(--fd-head-link); white-space: nowrap; }
.fd-head-badge-icon { display: inline-grid; color: var(--fd-kind, var(--fd-head-link)); }
/* The kind's icon 14px, its box 2px before the badge's start so its drawing starts there, the words 39px in (20.22.23). */
.fd-head-badge-icon .fd-icon { width: 14px; height: 14px; margin: 0; margin-inline-start: -2px; stroke-width: 2.2; }
.fd-head-window { display: inline-flex; align-items: center; gap: 3px; margin-inline-start: auto; }
/* The title line: the number before the title, its box from 64px in, Copy title at its end. What stands beside the
   title keeps to its first line, 32px tall, where a long title runs onto more. */
.fd-head-title { display: flex; align-items: flex-start; min-height: 32px; margin-block-start: 1px; padding-inline: 19px 8px; }
.fd-head-number { flex: none; min-inline-size: 40px; margin-block-start: 4px; margin-inline-end: 5px; font-size: 18px; line-height: 24px; color: color-mix(in srgb, var(--fd-text) 85%, #000); font-variant-numeric: tabular-nums; }
.fd-form .fd-head-title > .fd-field { flex: 1 1 auto; min-width: 0; display: block; }
.fd-form .fd-head-title > .fd-title-side { flex: none; min-height: 32px; align-content: center; }
.fd-form .fd-head-title > .fd-field > .fd-input { width: 100%; height: 32px; font-size: 18px; padding-inline: 11px; color: var(--fd-text); }
/* The title wraps rather than being cut (a textarea that says it is one line): one line of it 32px tall, its
   words where a box's stand, 12px in; a long one grows a line of 24px at a time, read from its start. No margin round
   it, which Firefox gives a textarea and an input has none of. */
.fd-form .fd-head-title > .fd-field > .fd-line-wraps { height: auto; min-height: 32px; margin: 0; padding-block: 3px; line-height: 24px; }
/* Copy title: there while the title is pointed at or worked in, its room always kept; always where nothing can point. */
.fd-head-copy {
  flex: none; display: inline-grid; place-items: center; width: 34px; height: 32px; padding: 0; border: 0; border-radius: 2px;
  background: var(--fd-head-fill); color: var(--fd-head-icon); cursor: pointer; visibility: hidden;
}
.fd-head-copy .fd-icon { width: 16px; height: 16px; margin: 0; }
.fd-head-title:focus-within > .fd-head-copy { visibility: visible; }
@media (hover: hover) { .fd-head-title:hover > .fd-head-copy { visibility: visible; } }
@media (hover: none) { .fd-head-copy { visibility: visible; } }
.fd-head-copy:hover { background: var(--fd-head-pressed); }

/* The row under the title: people and links from its start, the record's buttons at its end. */
.fd-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px 16px; min-height: 32px; margin-block-start: 9px; padding-inline: 21px 6px; }
.fd-head-meta { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 auto; }
.fd-form .fd-head-meta > .fd-field { flex: 0 1 269px; min-width: 0; }
.fd-form .fd-head-meta > .fd-field:is([data-type="many2many"], [data-widget="tags"]) { flex: 0 1 auto; }
/* Tags with their "Add Tag" button: the button just after the comments' link, as the tracker's (08_19): no box room round it. */
.fd-form .fd-head-meta .fd-field[data-quiet] .fd-tags:has(> .fd-tags-adder:not([hidden])) { padding-inline: 0; }
.fd-head-link {
  display: inline-flex; align-items: center; gap: 2px; padding: 0 2px; border: 0; background: none; cursor: pointer;
  font: inherit; font-size: 14px; color: var(--fd-head-link); white-space: nowrap; border-radius: 2px;
}
.fd-head-link .fd-icon { width: 16px; height: 16px; margin: 0; }
/* A link led by its icon: the icon at the link's start, its words 2px after it (the comments' bubble, 20.22.23). */
.fd-head-link:has(> .fd-icon:first-child) { padding-inline-start: 0; }
button.fd-head-link:hover .fd-head-link-words { text-decoration: underline; }
span.fd-head-link { cursor: default; color: var(--fd-text); }
.fd-head-actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 10px; flex: none; }

/* The head's buttons: quiet on a light fill, 14px in 600; the primary one in the accent; icons alone with no fill. */
.fd-head .fd-button, .fd-split > .fd-button { min-height: 32px; height: 32px; padding: 0 12px; gap: 10px; border: 0; border-radius: 2px; font-size: 14px; font-weight: 600; white-space: nowrap; }
.fd-head .fd-button .fd-icon, .fd-split > .fd-button .fd-icon { width: 16px; height: 16px; margin: 0; flex: none; }
.fd-button.fd-button-subtle { background: var(--fd-head-fill, var(--fd-fill, var(--fd-page))); color: var(--fd-text); border-color: transparent; }
.fd-button.fd-button-subtle:hover { background: color-mix(in srgb, var(--fd-text) 9%, var(--fd-surface)); color: var(--fd-text); }
.fd-button.fd-button-subtle[aria-expanded="true"], .fd-button.fd-button-subtle:active { background: var(--fd-head-pressed, var(--fd-border)); }
.fd-head .fd-button-secondary { background: var(--fd-head-fill); color: var(--fd-text); }
.fd-head .fd-button-secondary:hover { background: color-mix(in srgb, var(--fd-text) 9%, var(--fd-surface)); color: var(--fd-text); }
.fd-head .fd-button-primary, .fd-split[data-look="primary"] > .fd-button { background: var(--fd-accent); color: var(--fd-accent-text); }
.fd-head .fd-button-primary:hover { filter: none; background: var(--fd-accent-hover, var(--fd-accent)); color: var(--fd-accent-text); }
/* Its icon alone: a box 34 by 32, no fill, the icon a shade off the words. */
.fd-button.fd-button-icon-only { width: 34px; padding: 0; justify-content: center; }
.fd-head .fd-button.fd-button-icon-only:not(.fd-button-primary) { background: none; color: var(--fd-head-icon); }
.fd-head .fd-button.fd-button-icon-only:not(.fd-button-primary):hover { background: var(--fd-head-fill); }
/* ⋮, the record's menu, as an icon alone. */
.fd-head .fd-record-actions { position: relative; }
.fd-head .fd-head-more { width: 34px; padding: 0; background: none; color: var(--fd-head-icon); }
.fd-head .fd-head-more:hover { background: var(--fd-head-fill); }
.fd-head .fd-head-more[aria-expanded="true"] { background: var(--fd-head-pressed); }
/* Undo with nothing changed: idle in a light grey, as the tracker's (08_19), still at 3:1 as a usable button's icon must
   be; its tooltip and a press say why. */
.fd-head .fd-button.fd-button-icon-only[data-idle]:not(.fd-button-primary) { color: color-mix(in srgb, var(--fd-text) 48%, var(--fd-surface)); }
/* An arrow that points back points the other way right to left. */
.fd-head .fd-icon[data-icon="undo"]:dir(rtl) { transform: scaleX(-1); }
/* A toggle pressed: Following. */
.fd-head .fd-button[aria-pressed="true"]:not(.fd-button-primary) { color: var(--fd-text); }

/* A split button: its press, a rule, its chevron or its own icon (Follow's gear); its menu under it. */
.fd-split { position: relative; display: inline-flex; align-items: stretch; flex: none; }
.fd-split > .fd-split-rule { width: 1px; background: var(--fd-head-pressed, var(--fd-border)); }
.fd-split[data-look="primary"] > .fd-split-rule { background: color-mix(in srgb, var(--fd-accent-text) 35%, var(--fd-accent)); }
.fd-split > .fd-button:first-child:not(:last-of-type) { border-start-end-radius: 0; border-end-end-radius: 0; }
.fd-split > .fd-split-more { padding: 0; width: 30px; border-start-start-radius: 0; border-end-start-radius: 0; }
.fd-split > .fd-split-more:has(> .fd-icon:not([data-icon="chevron-down"])) { width: 34px; }
/* Its chevron 13px across in a thin line; Follow's gear 12px (08_19). */
.fd-split > .fd-split-more > .fd-icon[data-icon="chevron-down"] { width: 20px; height: 20px; stroke-width: 1.3; }
.fd-split > .fd-split-more > .fd-icon:not([data-icon="chevron-down"]) { width: 13px; height: 13px; }
.fd-split-alone > .fd-button .fd-split-icon { width: 14px; height: 14px; }
.fd-split > .fd-button-menu { position: absolute; inset-block-start: calc(100% + 2px); inset-inline-start: 0; z-index: 40; }
.fd-split > .fd-button-menu[data-end] { inset-inline-start: auto; inset-inline-end: 0; }

/* ---- the band ---------------------------------------------------------------------- */
.fd-head-band {
  display: flex; align-items: stretch; gap: 9px; min-height: 78px; background: var(--fd-band, color-mix(in srgb, var(--fd-text) 3%, var(--fd-surface)));
  padding-inline: 16px 8px;
}
/* Its fields on its columns, two rows of 32px a pixel apart, each label in a track of 76px, the last 24px of it the lead slot. */
.fd-head-fields {
  --fd-head-label: 76px;
  flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: var(--fd-head-tracks, 1fr 1fr); grid-auto-rows: minmax(32px, auto);
  column-gap: 8px; row-gap: 1px; align-content: start; padding-block: 7px 6px;
}
.fd-form .fd-head-fields > .fd-field[data-labels] {
  display: grid; grid-template-columns: calc(var(--fd-head-label) - 24px) 24px minmax(0, 1fr); align-items: center; gap: 0; container-type: normal; min-width: 0;
}
.fd-form .fd-head-fields > .fd-field[data-labels] > .fd-label {
  grid-column: 1 / 3; grid-row: 1; align-self: center; padding: 0; margin: 0; font-size: 12px; line-height: 16px; font-weight: 400; color: var(--fd-muted);
  white-space: nowrap; overflow: hidden; text-overflow: clip;
}
.fd-form .fd-head-fields > .fd-field[data-labels] > :not(.fd-label) { grid-column: 3; }
.fd-form .fd-head-fields > .fd-field[data-labels] > .fd-label + * { grid-row: 1; }
/* The lead slot: a lock at the value's start, its words muted. */
/* Its middle 2px past the slot's, toward the value, as the tracker's lock stands under the state's dot. */
.fd-form .fd-head-fields > .fd-field[data-labels] > .fd-lock-wrap { grid-column: 2; grid-row: 1; justify-self: center; margin: 0; margin-inline-start: 4px; z-index: 1; }
.fd-form .fd-head-fields > .fd-field[data-labels] > .fd-lock-wrap + * { grid-row: 1; }
.fd-head-fields .fd-lock .fd-icon { width: 16px; height: 16px; }
.fd-head-fields .fd-lock { color: var(--fd-text); }
/* A locked value's words on a row of exactly 32px, as a box's: the rows and all under them on whole pixels. */
.fd-form .fd-head-fields > .fd-field > .fd-read-text { line-height: 20px; }
/* Every box in the head 32px tall, as the rows they stand in, its corners as small as a button's. */
.fd-form .fd-head :is(input, select).fd-input { box-sizing: border-box; height: 32px; min-height: 32px; }
.fd-form .fd-head .fd-field[data-quiet] :is(.fd-input:not(.fd-tags *), .fd-tags, .fd-dot-box) { border-radius: 2px; }
/* Values in 14px, their words 12px in from their box's edge. */
.fd-form .fd-head-fields > .fd-field[data-quiet] { --fd-quiet-pad: 11px; font-size: 14px; }
.fd-form .fd-head-fields > .fd-field > .fd-input, .fd-form .fd-head-fields > .fd-field .fd-input { font-size: 14px; }
/* A state's dot in the lead slot, its words where the other values' start. */
.fd-form .fd-head-fields .fd-field[data-quiet] .fd-dot-box { box-sizing: border-box; gap: 0; padding-inline-start: 11px; height: 32px; min-height: 32px; }
/* Its button the lead slot's 24px before the box, a finger's room; pressed anywhere on the box, it opens the states all the same. */
.fd-form .fd-head-fields .fd-field[data-quiet] .fd-dot-button { width: 24px; height: 32px; margin-inline: -36px 12px; }
.fd-form .fd-head-fields .fd-dot-button > .fd-dot { width: 10px; height: 10px; }
/* A box pointed at in the head, as the title's and Area's: an edge of the strong border. */
@media (hover: hover) {
  .fd-form .fd-head .fd-field[data-quiet] > :hover :is(.fd-input:not(.fd-tags *), .fd-tags):not([readonly], :disabled, [contenteditable="false"], :focus, :focus-within),
  .fd-form .fd-head .fd-field[data-quiet] > :is(.fd-input, .fd-tags, .fd-dot-box:not(:has(:disabled))):not([readonly], :disabled, [contenteditable="false"], :focus, :focus-within):hover {
    border-color: var(--fd-border-strong);
  }
}
/* The band's end: "Updated by" at its top, the tabs at its bottom. */
.fd-head-aside { flex: none; display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 4px; padding-block-start: 4px; min-width: 0; }
.fd-head-updated { font: inherit; font-size: 12px; line-height: 16px; color: var(--fd-muted); white-space: nowrap; padding: 0; border: 0; background: none; }
button.fd-head-updated { cursor: pointer; border-radius: 2px; }
button.fd-head-updated:hover { text-decoration: underline; }
.fd-head-tabs { display: flex; min-width: 0; max-width: 100%; }
.fd-head-tabs .fd-tabbar { min-width: 0; }
.fd-head-tabs .fd-tablist { gap: 0; border: 0; }
.fd-head-tabs .fd-tab {
  position: relative; display: inline-flex; align-items: center; gap: 6px; height: 36px; margin: 0; padding: 0 8px;
  border: 1px solid var(--fd-head-edge); border-block-end: 0; border-radius: 0; background: transparent;
  font: inherit; font-size: 14px; font-weight: 400; color: var(--fd-text); white-space: nowrap;
}
.fd-head-tabs .fd-tab:has(> .fd-tab-count) { padding-inline-end: 8px; }
.fd-head-tabs .fd-tab .fd-icon { width: 16px; height: 16px; margin: 0; }
/* An icon alone in thin lines, a little above the middle, as the tracker's; a link's and a paperclip's 12px across (08_19). */
.fd-head-tabs .fd-tab-icon-only > .fd-icon { margin-block-end: 3px; stroke-width: 1.5; }
.fd-head-tabs .fd-tab-icon-only > .fd-icon[data-icon="link"] { width: 14px; height: 14px; stroke-width: 1.7; }
/* The paperclip in its own one-pixel lines, its box 16px and the count as close as with the link's 14 (20.22.23). */
.fd-head-tabs .fd-tab-icon-only > .fd-icon[data-icon="attach"]:not(:only-child) { margin-inline-end: -2px; }
.fd-head-tabs .fd-tab-icon-only > .fd-icon:only-child { margin-inline: 3px; }
.fd-head-tabs .fd-tab[aria-selected="true"] { font-weight: 600; color: var(--fd-text); border-color: var(--fd-head-edge); }
.fd-head-tabs .fd-tab[aria-selected="true"] .fd-icon { stroke-width: 2.3; }
/* The tab shown: two pixels of the accent under its words. */
.fd-head-tabs .fd-tab[aria-selected="true"]::after {
  content: ""; position: absolute; inset-inline: 8px; inset-block-end: 4px; height: 2px; background: var(--fd-accent); border-radius: 1px;
}
.fd-head-tabs .fd-tab:has(> .fd-tab-count)[aria-selected="true"]::after { inset-inline-end: 8px; }
.fd-head-tabs .fd-tab:hover { background: color-mix(in srgb, var(--fd-text) 4%, transparent); }

/* ---- the body under it --------------------------------------------------------------- */
.fd-head-body { padding: 0 12px 12px; background: var(--fd-surface); min-width: 0; }
.fd-head-body > .fd-alert { margin-block: 12px 0; }
.fd-tabs.fd-tabs-in-head > .fd-tabpanel { padding-block: 0; }
/* A tab of fields keeps room after its last ones, as the tracker's window scrolls on past them (20.22.25: 54px past a
   929px window), and no more: in a window 54px taller (08_19) they fit, with no scrollbar; a history fitting the window
   keeps its own. */
.fd-form-dialog[data-headed] .fd-tabs.fd-tabs-in-head > .fd-tabpanel:not(:has(.fd-history)) { padding-block-end: 30px; }
.fd-head-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
@media (min-width: 1534px) { .fd-head-layout:has(> .fd-side) { grid-template-columns: minmax(0, 1fr) minmax(320px, 0.6fr); } }
.fd-form-dialog .fd-head-layout > .fd-side { display: none; }

/* ---- a narrow head: one column, the buttons and tabs under what they followed ------------------ */
@container fd-head (max-width: 760px) {
  .fd-head-row { flex-wrap: wrap; }
  .fd-head-meta { flex-wrap: wrap; flex-basis: 100%; }
  .fd-head-actions { flex: 1 1 100%; justify-content: flex-start; gap: 8px; }
  .fd-head-band { flex-direction: column; gap: 4px; padding-inline: 12px 8px; }
  .fd-head-fields { grid-template-columns: minmax(0, 1fr); padding-block-end: 0; }
  .fd-head-aside { align-items: stretch; padding-block-start: 0; }
  .fd-head-updated { align-self: flex-start; white-space: normal; text-align: start; }
  .fd-head-tabs { align-self: flex-start; }
}
/* On paper: the work item's head and band without their buttons (Copy title too: its title's words the line's whole
   width), the body under them, the side panel left out. */
@media print {
  .fd-form :is(.fd-head-actions, .fd-head-copy) { display: none !important; }
  .fd-form .fd-head-layout { display: block !important; }
  .fd-form :is(.fd-head-band, .fd-head-body) { background: none !important; }
}
`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installHeadStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-head-styles', HEAD_PART_CSS, PART_RANK.head);
}
