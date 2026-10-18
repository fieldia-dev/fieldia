import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * A form on paper (`@media print`), the print part's sheet: a clean page whatever prints it — Ctrl+P, a `print` step,
 * the gear menu's Print, the browser's menu once the part came — with the part's print-look.ts, which as printing
 * begins draws every tab not opened yet, writes each box's words beside it and fills the printout's head.
 *
 * - Every tab one after another, each under its name (`data-fd-tab`); every
 *   wizard step; every folded part open — but for those a condition hides
 *   (`data-off`).
 * - Buttons, bars, the gear menu, the pager, the tabs' strip, hints, a
 *   field's help and lock, the side panel and the attachment beside the
 *   sheet left out; a box drawn as the words a person reads in it (a choice
 *   by its label, a link by its name, money with its currency, a date as the
 *   page writes it), wrapping rather than cut; a choice of several shows the
 *   one picked; the statusbar the stage the record is in.
 * - Light: the light scheme's tokens whatever the screen wears (in the main
 *   sheet, styles-print.ts in @fieldia/widgets, for a print before this part
 *   came too), no shadows, no grounds — the accent kept for the headings, the
 *   title and the rule under the printout's head.
 * - A table of lines whole, no scrolling, its header again on each sheet;
 *   no field, line or heading cut across two sheets, nor a heading left at a
 *   sheet's foot: a tab's name, a group's title, a step's, kept with the start
 *   of what follows it (room kept under it, which it takes to the next sheet
 *   where there is not as much at this one's foot).
 * - The page's footer (`print.footer`) at the foot of every sheet: the
 *   record's content a table on paper, the footer its footer group, which
 *   Chromium and Firefox repeat under each sheet's part of it and keep room
 *   for, so nothing runs under it.
 * - The grids parts are laid out on as rows that break between sheets: every
 *   engine breaks a block or a flex box's rows where it may, where Chromium
 *   laid a grid's next row over a part it had carried to the next sheet.
 * - Printed by its own Print (`fd-print-one` on the document), the form
 *   alone: what is round it in the app's page is left out.
 *
 * Its rules stood at the end of every page's sheet until 0.26; the sheet goes right after that one (PART_RANK.print,
 * the first of the parts'), so they stand where they stood: before every other part's sheet, whose own rules for paper
 * come after them — a table of lines' (styles-lines), the statusbar's (styles-business-part), a file's (styles-files), a
 * work item's text and head (styles-editor, head-styles), a phone's (styles-phone), a survey's (styles-survey), a list's
 * (list-styles, with its printout's). What is hidden or shown here insists (!important): a part's sheet comes after
 * this one. A part loaded as printing begins comes too late — the browser lays the page out for paper the moment its
 * `beforeprint` is told — so the part is asked for before: as Ctrl+P is pressed, a Print pressed, the gear opened, a
 * pointer resting on a Print button, or a page meant for paper drawn (print.ts). On the screen this sheet lays out
 * nothing but a form being measured for paper (`data-fd-measure`, for a moment as printing begins).
 */
export const PRINT_PART_CSS = /* css */ `
/* As wide as a sheet (A4's or Letter's, less its margins), every tab shown, each box as its words and what paper leaves
   out left out — but where the focus is, which stays — while what each heading keeps under it on paper is measured, as
   printing begins (print-look.ts), no frame drawn between: its columns and labels as paper lays them out. */
.fd-form[data-fd-measure] { inline-size: 720px !important; max-inline-size: none !important; }
.fd-form[data-fd-measure] .fd-tabpanel[hidden]:not([data-off], [data-print="off"]) { display: block !important; }
.fd-form[data-fd-measure] .fd-print-box { display: block; white-space: pre-wrap; }
.fd-form[data-fd-measure] .fd-richtext { min-height: 0 !important; }
@media print {
  .fd-form { max-width: none !important; margin: 0 !important; padding: 0 !important; }
  .fd-form *, .fd-form *::before, .fd-form *::after { box-shadow: none !important; text-shadow: none !important; animation: none !important; transition: none !important; }
  .fd-form :is(.fd-card, .fd-sheet-page, .fd-content, .fd-section, .fd-step, .fd-head) { background: none !important; }
  .fd-form .fd-card { border: 0 !important; padding: 0 !important; }
  /* The card, a group, a step, the page's groups and every grid of parts blocks on paper, the gaps between their parts
     as margins: every engine breaks a block between its parts, and its lines, where it may and carries what follows
     after what it carried. Chromium laid a grid's next row over a part the row before had carried to the next sheet
     (the invoice's Total under "Exchange Rate Info"); Firefox moved a grid's part whole, and laid a flex box's next
     row over one it had carried. A grid with tracks of its own (a work item's head) keeps them. */
  .fd-form :is(.fd-card, .fd-grid:not([data-tracks])) { display: block !important; }
  .fd-form :is(div.fd-section, .fd-sections, .fd-step, .fd-wizard) { display: flow-root; }
  .fd-form > .fd-content { display: block !important; }
  .fd-form .fd-wizard > .fd-step ~ .fd-step { margin-block-start: 20px; }
  .fd-form .fd-card > * + * { margin-block-start: 18px; }
  .fd-form .fd-grid:not([data-tracks]) > :where(:not([hidden]) ~ :not([hidden])) { margin-block-start: var(--fd-gap-y); }
  /* A grid's parts kept whole (a short group as one box) are its lines on paper: a sheet breaks between any two of them,
     never carrying one that fits away with the last (a sheet's "two lines at its head" carried the sales order's
     Delivery group to the next sheet with Tracking, the room for it left blank). Words inside a part keep two. */
  .fd-form .fd-grid { orphans: 1; widows: 1; }
  .fd-form .fd-grid > * { orphans: 2; widows: 2; }
  .fd-form div.fd-section > :where(:not([hidden]) ~ :not([hidden])) { margin-block-start: 14px; }
  .fd-form .fd-sections > :where(:not([hidden]) ~ :not([hidden])) { margin-block-start: var(--fd-gap-block, 24px); }
  .fd-form .fd-step > :where(:not([hidden]) ~ :not([hidden])) { margin-block-start: 18px; }
  .fd-form .fd-sheet-layout { display: block !important; max-width: none !important; }
  /* Left out: what is pressed, chosen from or said for the screen, and what its page leaves off paper (a tab's, a
     group's, a field's or a related list's "print": false). */
  .fd-form :is(.fd-record-bar, .fd-actions, .fd-wizard-nav, .fd-progress, .fd-steps, .fd-tabbar, .fd-stats, .fd-side, .fd-attachment-preview,
    .fd-button, .fd-dialog-close, .fd-help, .fd-help-tip-wrap, .fd-lock-wrap, .fd-valid-mark, .fd-error, .fd-warning, .fd-section-chevron,
    .fd-status-box, .fd-banner, .fd-draft, .fd-says, .fd-toast, .fd-alert-actions, .fd-alert-close, .fd-combo-open, .fd-combo-clear,
    .fd-calendar-button, .fd-chip-remove, .fd-lines-tools, .fd-lines-grip, .fd-lines-adds, .fd-lines-control, .fd-richtext-bar, .fd-link-row,
    .fd-link-avatar, .fd-link-nobody, .fd-count, .fd-choice-clear, [data-print-box], [data-print="off"]) { display: none !important; }

  /* Every tab under its name, every step, every folded part open; one hidden by a condition stays hidden (and what is
     hidden on screen is hidden with !important, .fd-form [hidden]: so is what shows it here). */
  .fd-form .fd-tabpanel[hidden]:not([data-off], [data-print="off"]) { display: block !important; }
  /* A tab's name over it, kept on the sheet with the start of what follows: its box as tall as its name and that start
     (--fd-print-keep, measured as printing begins: print-look.ts), which a sheet may not break and so takes to the next
     sheet where this one's foot has less, what follows drawn over it — Firefox keeps no heading with what follows it,
     break-after: avoid or not, and leaves a box's padding behind at a sheet's foot, so the room is its height. Its rule
     drawn as its ground, which prints. The panel a block on paper, ending where its last part does. */
  .fd-form .fd-tabpanel { display: block; padding-block-end: 0; --fd-print-keep: 147px; }
  .fd-form .fd-tabpanel > * + * { margin-block-start: 16px; }
  .fd-form .fd-tabpanel > :first-child { break-before: avoid; }
  .fd-form .fd-tabpanel::before {
    content: attr(data-fd-tab); display: block; min-block-size: calc(37px + var(--fd-print-keep)); margin-block-end: calc(-1 * var(--fd-print-keep));
    line-height: 20px; font-size: 15px; font-weight: 600; color: var(--fd-accent);
    background: linear-gradient(var(--fd-border), var(--fd-border)) no-repeat 0 24px / 100% 1px; print-color-adjust: exact; -webkit-print-color-adjust: exact;
    break-inside: avoid; break-after: avoid;
  }
  /* A group's title, a table's label and header (a related list's too), a step's title so too: a box at the top of the
     group (of the field) as tall as the title and the first row under it — a group's, room for a table's header and
     first line — which it may not leave, what follows drawn over it. A table's field and a related list blocks that
     break between their rows. */
  .fd-form fieldset.fd-section { --fd-print-keep: 144px; display: var(--fd-print-whole, flow-root); inline-size: 100%; vertical-align: top; }
  .fd-form fieldset.fd-section:has(> .fd-section-title)::before { content: ""; display: block; block-size: var(--fd-print-keep); margin-block-end: calc(-1 * var(--fd-print-keep)); break-inside: avoid; }
  .fd-form :is(.fd-field:has(thead), .fd-related) { display: block; break-inside: auto; --fd-print-keep: 96px; }
  .fd-form :is(.fd-field:has(thead), .fd-related)::before { content: ""; display: block; block-size: var(--fd-print-keep); margin-block-end: calc(-1 * var(--fd-print-keep)); break-inside: avoid; }
  .fd-form .fd-related > :where(:not([hidden]) ~ :not([hidden])) { margin-block-start: 8px; }
  .fd-form .fd-field:has(thead) > .fd-label { display: block; margin-block-end: 4px; }
  .fd-form :is(.fd-step-title, .fd-text-heading, .fd-richtext :is(h1, h2, h3, h4)) { break-inside: avoid; break-after: avoid; }
  .fd-form :is(.fd-step-title, .fd-text-heading, .fd-richtext :is(h1, h2, h3, h4))::after { content: ""; display: block; block-size: 80px; margin-block-end: -80px; }
  /* The room under a last heading never past the record's end: Firefox gave what stood out a blank sheet of its own. */
  .fd-form > .fd-content > :not(.fd-print-end) { overflow-y: clip; overflow-x: visible; }
  .fd-form .fd-step[hidden]:not([data-off]) { display: block !important; }
  .fd-form .fd-section-folded > :is(.fd-grid, .fd-section-description)[hidden] { display: block !important; }
  .fd-form .fd-section-toggle { padding: 0; border: 0; background: none; color: inherit; font: inherit; }
  .fd-form :is(.fd-section-title, .fd-step-title, .fd-page-title, h2, h3) { color: var(--fd-accent); break-after: avoid; }

  /* No required mark on paper, in any skin or theme: a star says what must be filled in, which paper cannot. */
  .fd-form .fd-required > :is(.fd-label, .fd-address-label)::before, .fd-form .fd-required > :is(.fd-label, .fd-address-label)::after { content: none !important; }
  /* A box as its words: wrapped, never cut; a choice of several, the one picked. */
  .fd-form .fd-print-box { display: block; min-width: 0; white-space: pre-wrap; overflow-wrap: break-word; line-height: 1.35; padding-block: 2px; }
  .fd-form :is(.fd-input, .fd-combo, .fd-tags) { border-color: transparent !important; background: none !important; padding-inline: 0 !important; }
  .fd-form :is(input, textarea)::placeholder { color: transparent !important; }
  .fd-form .fd-richtext.fd-blank::before { content: none !important; }
  .fd-form .fd-richtext { border-color: transparent !important; padding-inline: 0 !important; min-height: 0 !important; }
  /* A number's unit and an amount's currency beside its words, where the box laid them over its own room. */
  .fd-form .fd-number { display: flex; align-items: baseline; gap: 0.3em; }
  .fd-form .fd-number > .fd-unit { position: static; }
  .fd-form .fd-number > .fd-print-box { flex: none; }
  .fd-form select { appearance: none; }
  .fd-form .fd-choices > .fd-choice:not(:has(input:checked)), .fd-form .fd-choices > .fd-choice > input { display: none !important; }
  .fd-form .fd-ribbon { color: var(--fd-accent); background: none !important; border: 2px solid; inset-block-start: 14px; }

  /* Tables whole, their header again on each sheet; nothing cut across two. */
  .fd-form .fd-lines-scroll { overflow: visible !important; }
  .fd-form table { width: 100% !important; }
  .fd-form thead { display: table-header-group; }
  .fd-form tfoot { display: table-row-group; }
  .fd-form :is(tr, .fd-field, .fd-alert, .fd-badges, .fd-title-row, .fd-print-head, .fd-print-foot) { break-inside: avoid; }

  /* The printout's head: the logo and the app's words, the record's title and the day; its footer under it. */
  .fd-form .fd-print-head { display: flex; align-items: center; gap: 16px; margin-block-end: 16px; padding-block-end: 10px; border-block-end: 2px solid var(--fd-accent); }
  .fd-print-logo { max-height: 56px; max-width: 220px; object-fit: contain; }
  .fd-print-words { white-space: pre-line; font-size: 12px; line-height: 1.4; }
  .fd-print-what { margin-inline-start: auto; text-align: end; }
  .fd-print-title { font-weight: 600; color: var(--fd-accent); }
  .fd-print-when { font-size: 11px; color: var(--fd-muted); }
  .fd-form .fd-print-foot { display: block; margin-block-start: 20px; }
  /* The footer under every sheet: the record a table on paper, its footer the table's footer group, which Chromium and
     Firefox draw again under each sheet's part of it, keeping its room there — no field or line under it; under the
     last, after the record. (Chromium repeats a footer group it may not break, and only that. A footer fixed at each
     sheet's foot over room kept by padding, as a list's printout's is, was overlaid where a sheet broke a group.) The
     form stays a block, the container its parts' widths are read by. Nothing at its end pushed onto a sheet of its own.
     Elsewhere — Safari, which breaks no table's cell between sheets — the footer once, after the record; and none
     where a part of it prints alone (a list's printout, its own footer under it). */
  .fd-form > .fd-content > .fd-print-end { display: block; }
  @supports (box-decoration-break: clone) {
    .fd-form > .fd-content:has(> .fd-print-end):not(:has(.fd-print-this)) { display: table !important; inline-size: 100%; table-layout: fixed; }
    .fd-form > .fd-content > .fd-print-end { display: table-footer-group !important; break-inside: avoid; }
  }
  .fd-form .fd-sheet-page { padding-block-end: 0 !important; }
  /* A question asked, or a file shown over the page, is no part of it on paper. */
  .fd-dialog-backdrop:not(.fd-form-dialog-backdrop) { display: none !important; }

  /* Printed by its own Print, or in front in a dialog: the form alone, what is round it in the app's page left out —
     a dialog's frame, its title and buttons, and the page behind it. */
  html.fd-print-one :has(.fd-print-this) > :not(.fd-print-this, :has(.fd-print-this)) { display: none !important; }
  html.fd-print-one :has(.fd-print-this) { display: block !important; position: static !important; overflow: visible !important; width: auto !important; max-width: none !important; height: auto !important; max-height: none !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; background: none !important; box-shadow: none !important; transform: none !important; translate: none !important; filter: none !important; backdrop-filter: none !important; contain: none !important; animation: none !important; place-self: auto !important; place-items: normal !important; container-type: normal !important; }
}
`;

/*
 * What follows is made as the module loads, for what the sheet above says many times over: a grid's parts side by
 * side in each of the widths its columns are counted for, and what paper leaves out, left out too while a heading's
 * room is measured. Kept short, as the sheet's own minifier leaves it as it is.
 */

/** What paper leaves out (as the sheet above lists it): what is pressed, chosen from or said for the screen, a box written as its words. */
export const LEFT_OUT =
  '.fd-record-bar, .fd-actions, .fd-wizard-nav, .fd-progress, .fd-steps, .fd-tabbar, .fd-stats, .fd-side, .fd-attachment-preview, ' +
  '.fd-button, .fd-dialog-close, .fd-help, .fd-help-tip-wrap, .fd-lock-wrap, .fd-valid-mark, .fd-error, .fd-warning, .fd-section-chevron, ' +
  '.fd-status-box, .fd-banner, .fd-draft, .fd-says, .fd-toast, .fd-alert-actions, .fd-alert-close, .fd-combo-open, .fd-combo-clear, ' +
  '.fd-calendar-button, .fd-chip-remove, .fd-lines-tools, .fd-lines-grip, .fd-lines-adds, .fd-lines-control, .fd-richtext-bar, .fd-link-row, ' +
  '.fd-link-avatar, .fd-link-nobody, .fd-count, .fd-choice-clear, [data-print-box], [data-print="off"]';

/** Grids no band's count changes: one with tracks of its own (a work item's head), one sharing a cell (a part's own). */
const OWN = '[data-tracks], [data-place="shared"] > *';
/** And a grid of one column at every width. */
const ONE = `[data-columns="1"], ${OWN}`;

/**
 * On paper, the parts of the grids `grids` names side by side as boxes in lines, each its span of the grid's columns
 * at the sheet's width (--fd-cols) and the gap after it, the grid as wide as its parts and gaps: a line goes to the next
 * sheet whole, and the lines after it after it, in every engine. A field keeps its label and value as the screen lays
 * them; a table's field, a related list or tabs, which must break between sheets, is a block of its own width. The grid
 * a box of its own, its parts' gaps under the last line kept inside it; one line at a sheet's foot or head is enough
 * (Chromium kept two, carrying a group's first line away from its title).
 *
 * At the width `query` asks of the sheet — a media query, never a container's: a part's box made another kind (a block
 * an inline box) by a container query is never drawn in Firefox's print, its room left blank (the sales order's
 * customer group, 0.26's walk), where a media query's is. The form is as wide as the sheet on paper, so the sheet's
 * width is its own. Without a query, at every width.
 */
function sideBySide(query: string | null, grids: string): string {
  const parts = `:is(${grids})>`;
  const rules =
    `${grids}{display:flow-root!important;margin-inline-end:calc(-1*var(--fd-print-gap));orphans:1;widows:1}` +
    `${parts}*{display:inline-block;vertical-align:top;box-sizing:border-box;margin-block:0 var(--fd-gap-y);margin-inline:0 var(--fd-print-gap);` +
    `inline-size:calc(100%*min(var(--fd-span,1),var(--fd-cols))/var(--fd-cols) - var(--fd-print-gap) - .5px)}` +
    `${parts}.fd-field{display:inline-grid}${parts}:is(.fd-field:has(thead),.fd-related,.fd-tabs){display:block}`;
  return query ? `@media ${query}{${rules}}` : rules;
}

/**
 * The sheet's rules made as it loads (above): what paper leaves out, left out while a heading's room is measured — but
 * where the focus is, which stays — and, on paper, a grid of more than one column at the sheet's width — its own count
 * where the sheet is wide, its medium one (the underline skin's one) at most 760px, its narrow one at most 520px: the
 * columns --fd-cols counts as styles.ts and layout-styles.ts count them — its parts side by side; and a part sharing a
 * cell's grid of its own (its columns counted by its own width, layout-styles.ts) side by side at every width. The gap
 * between them the grid's, a twelfths grid's as narrow as it may be (styles.ts).
 */
export const PRINT_GRIDS_CSS =
  `.fd-form[data-fd-measure] :is(${LEFT_OUT}):not(:focus-within){display:none!important}` +
  '@media print{.fd-form .fd-grid{--fd-print-gap:var(--fd-gap-x)}.fd-form .fd-grid[data-twelfths]{--fd-print-gap:min(var(--fd-gap-x),100%/24)}' +
  sideBySide('(min-width:761px)', `.fd-form .fd-grid[data-columns]:not(${ONE})`) +
  sideBySide(
    '(min-width:521px) and (max-width:760px)',
    `.fd-form .fd-grid[data-columns-medium]:not([data-columns-medium="1"],${OWN}),.fd-form:not([data-fd-skin="underline"]) .fd-grid[data-columns]:not(${ONE},[data-columns-medium])`
  ) +
  sideBySide('(max-width:520px)', `.fd-form .fd-grid[data-columns-narrow]:not([data-columns-narrow="1"],${OWN})`) +
  sideBySide(null, '.fd-form [data-place="shared"] > .fd-grid[data-columns]:not([data-columns="1"],[data-tracks])') +
  '}';

/** The print part's sheet in a document, once, in its place among Fieldia's: first of the parts' (PART_RANK.print). */
export function installPrintStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-print-styles', PRINT_PART_CSS + PRINT_GRIDS_CSS, PART_RANK.print);
}
