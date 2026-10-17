/**
 * A form on paper (`@media print`): a clean page whatever prints it — the
 * browser's Ctrl+P or its menu, a `print` step, the gear menu's Print — and
 * the viewer's print.ts, which as printing begins draws every tab not opened
 * yet, writes each box's words beside it and fills the printout's head.
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
 * - Light: the light scheme's tokens whatever the screen wears, no shadows,
 *   no grounds — the accent kept for the headings, the title and the rule
 *   under the printout's head.
 * - A table of lines whole, no scrolling, its header again on each sheet;
 *   no field, line or heading cut across two sheets, nor a heading left at a
 *   sheet's foot.
 * - Printed by its own Print (`fd-print-one` on the document), the form
 *   alone: what is round it in the app's page is left out.
 *
 * It is in every page's sheet, after its rules and before the page's own looks: every page may print,
 * and a print the browser lays out by itself — an engine that says nothing as
 * it prints — still gets it. A part loaded as printing begins comes too late:
 * the browser lays the page out for paper the moment its `beforeprint` is
 * told, before anything asked for then can come. A part's own rules for paper
 * are in its own sheet: a table of lines' (styles-lines), the statusbar's
 * (styles-business-part), a file's (styles-files), a work item's text and
 * head (styles-editor, head-styles), a phone's (styles-phone), a survey's
 * (styles-survey), a list's (list-styles, with its printout's). What is hidden
 * or shown here insists (!important): a part's sheet comes after this one.
 */
export const PRINT_CSS = /* css */ `
.fd-print-head, .fd-print-foot, .fd-print-box { display: none; }
/* A footer's words as paper has them, here too: its height is measured as printing begins (print.ts), out of sight. */
.fd-print-foot { padding-block-start: 8px; border-block-start: 1px solid var(--fd-border); font-size: 11px; line-height: 1.4; color: var(--fd-muted); white-space: pre-line; }
@media print {
  .fd-form, .fd-theme {
    --fd-text: #1d2024 !important; --fd-muted: #545a63 !important; --fd-page: #fff !important; --fd-surface: #fff !important;
    --fd-border: #c9ced4 !important; --fd-border-strong: #8f969e !important; color: var(--fd-text); background: none !important;
  }
  .fd-form { max-width: none !important; margin: 0 !important; padding: 0 !important; }
  .fd-form *, .fd-form *::before, .fd-form *::after { box-shadow: none !important; text-shadow: none !important; animation: none !important; transition: none !important; }
  .fd-form :is(.fd-card, .fd-sheet-page, .fd-content, .fd-section, .fd-step, .fd-head) { background: none !important; }
  .fd-form .fd-card { border: 0 !important; padding: 0 !important; }
  /* The card and a column of parts as blocks on paper, their gaps as margins: Firefox moves a grid's part it cannot
     break to the next sheet whole (a record's first group left its first sheet empty), and breaks a block where it may. */
  .fd-form :is(.fd-card, .fd-grid[data-columns="1"]) { display: block !important; }
  .fd-form .fd-card > * + * { margin-block-start: 18px; }
  .fd-form .fd-grid[data-columns="1"] > * + * { margin-block-start: 16px; }
  .fd-form .fd-sheet-layout { display: block !important; max-width: none !important; }

  /* Left out: what is pressed, chosen from or said for the screen. */
  .fd-form :is(.fd-record-bar, .fd-actions, .fd-wizard-nav, .fd-progress, .fd-steps, .fd-tabbar, .fd-stats, .fd-side, .fd-attachment-preview,
    .fd-button, .fd-dialog-close, .fd-help, .fd-help-tip-wrap, .fd-lock-wrap, .fd-valid-mark, .fd-error, .fd-warning, .fd-section-chevron,
    .fd-status-box, .fd-banner, .fd-draft, .fd-says, .fd-toast, .fd-alert-actions, .fd-alert-close, .fd-combo-open, .fd-combo-clear,
    .fd-calendar-button, .fd-chip-remove, .fd-lines-tools, .fd-lines-grip, .fd-lines-adds, .fd-lines-control, .fd-richtext-bar, .fd-link-row,
    .fd-link-avatar, .fd-link-nobody, .fd-count, .fd-choice-clear, [data-print-box]) { display: none !important; }

  /* Every tab under its name, every step, every folded part open; one hidden by a condition stays hidden (and what is
     hidden on screen is hidden with !important, .fd-form [hidden]: so is what shows it here). */
  .fd-form .fd-tabpanel[hidden]:not([data-off]) { display: block !important; }
  /* A tab's name over it, kept on the sheet with what follows: the panel a block on paper, its first part held to it. */
  .fd-form .fd-tabpanel { display: block; }
  .fd-form .fd-tabpanel > * + * { margin-block-start: 16px; }
  .fd-form .fd-tabpanel > :first-child { break-before: avoid; }
  .fd-form .fd-tabpanel::before { content: attr(data-fd-tab); display: block; margin-block-end: 12px; padding-block-end: 4px; border-block-end: 1px solid var(--fd-border); font-size: 15px; font-weight: 600; color: var(--fd-accent); break-after: avoid; }
  .fd-form .fd-step[hidden]:not([data-off]) { display: block !important; }
  .fd-form .fd-section-folded > :is(.fd-grid, .fd-section-description)[hidden] { display: grid !important; }
  .fd-form .fd-section-toggle { padding: 0; border: 0; background: none; color: inherit; font: inherit; }
  .fd-form :is(.fd-section-title, .fd-step-title, .fd-page-title, h2, h3) { color: var(--fd-accent); break-after: avoid; }

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
  /* A question asked, or a file shown over the page, is no part of it on paper. */
  .fd-dialog-backdrop:not(.fd-form-dialog-backdrop) { display: none !important; }

  /* Printed by its own Print, or in front in a dialog: the form alone, what is round it in the app's page left out —
     a dialog's frame, its title and buttons, and the page behind it. */
  html.fd-print-one :has(.fd-print-this) > :not(.fd-print-this, :has(.fd-print-this)) { display: none !important; }
  html.fd-print-one :has(.fd-print-this) { display: block !important; position: static !important; overflow: visible !important; width: auto !important; max-width: none !important; height: auto !important; max-height: none !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; background: none !important; box-shadow: none !important; transform: none !important; translate: none !important; filter: none !important; backdrop-filter: none !important; contain: none !important; animation: none !important; place-self: auto !important; place-items: normal !important; container-type: normal !important; }
}
`;
