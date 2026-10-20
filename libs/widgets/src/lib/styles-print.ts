/**
 * What every page's sheet holds for paper (0.26: the rest is the print part's, print-styles.ts in @fieldia/viewer).
 *
 * - The printout's own parts — its head, its footer, a box's words — kept out of sight on the screen, and the lines
 *   of the page's printout words as they are drawn there: a list's printout measures its footer out of sight
 *   (list-print.ts).
 * - A plain look for paper, for a print the browser lays out before the print part came (its menu's Print, the
 *   first time): the page as the screen shows it, its buttons, bars, the record's bar, the side panel, hints, a
 *   field's help and a box's own buttons left out, no words a box shows while empty, light colours whatever the
 *   screen wears, no shadows. The print part is asked for as that print begins, so the next is whole; Ctrl+P and the
 *   page's own Print wait for it, and print the whole look the first time.
 *
 * The whole look — every tab under its name, boxes as their words, tables whole, headings kept with what follows,
 * the record's footer under every sheet, groups side by side in lines — is in the print part's sheet, which goes
 * right after this one (PART_RANK.print), where its rules stood in it until 0.26: before every other part's sheet,
 * whose own rules for paper come after it. These rules are some of its own, the same declarations, so a page that has
 * both lays out on paper as it did with one sheet.
 */
export const PRINT_CSS = /* css */ `
.fd-print-head, .fd-print-end, .fd-print-foot, .fd-print-box { display: none; }
/* A printout's words a line each, one whose value is empty left out (print.ts); a blank line kept as one. */
.fd-print-line { display: block; }
.fd-print-line[hidden] { display: none; }
.fd-print-line:empty { min-block-size: 1.4em; }
/* Every line of it left out: no footer at all, never its rule over nothing. */
.fd-print-foot:not(:has(> .fd-print-line:not([hidden]))) { display: none !important; }
/* A footer's words as paper has them, here too: a list's printout measures its height out of sight (list-print.ts). */
.fd-print-foot { padding-block-start: 8px; border-block-start: 1px solid var(--fd-border); font-size: 11px; line-height: 1.4; color: var(--fd-muted); white-space: pre-line; }
@media print {
  .fd-form, .fd-theme {
    --fd-text: #1d2024 !important; --fd-muted: #545a63 !important; --fd-page: #fff !important; --fd-surface: #fff !important;
    --fd-border: #c9ced4 !important; --fd-border-strong: #8f969e !important; color: var(--fd-text); background: none !important;
  }
  .fd-form *, .fd-form *::before, .fd-form *::after { box-shadow: none !important; text-shadow: none !important; }
  .fd-form :is(.fd-record-bar, .fd-actions, .fd-wizard-nav, .fd-stats, .fd-side, .fd-button, .fd-dialog-close, .fd-help, .fd-help-tip-wrap, .fd-says, .fd-toast,
    .fd-combo-open, .fd-combo-clear, .fd-calendar-button, .fd-chip-remove, .fd-lines-tools, .fd-lines-grip, .fd-lines-adds, .fd-richtext-bar, .fd-count, .fd-choice-clear) { display: none !important; }
  .fd-form :is(input, textarea)::placeholder { color: transparent !important; }
  /* A formatted text's table broken only between its rows, its header row again (whole where it fits: the print part's). */
  .fd-form :is(.fd-richtext, .fd-text-area, .fd-md-view) tr { break-inside: avoid; }
  .fd-form .fd-richtext-box { display: block; }
}
`;
