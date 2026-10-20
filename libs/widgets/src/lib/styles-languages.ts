import { installPartStyles, PART_RANK } from './styles';

/**
 * A text kept in several languages (languages-part.ts): the switch between its languages over its box, each language's
 * box written its own way, and — in a list's cell or a card — the mark beside a text shown in a language other than
 * the reader's. The languages part's sheet, put in its place among Fieldia's the first time a page draws either
 * (installPartStyles, PART_RANK.languages).
 *
 * It is new, cut from no rule: it lays out its own switch and mark alone, and draws each language's box with the main
 * sheet's rules. So it goes after the sheets cut from Fieldia's first and before the themes', which reshape a box's
 * corners and focus — the switch's tabs take the box's corner radius and focus from the same tokens, and a theme still
 * reshapes them all — and before the quiet look's, which quietens the boxes it holds.
 */
export const LANGUAGES_CSS = /* css */ `
/* The switch at the box's end, beside it: one press for each language, the one shown pressed; over the box on a phone. */
.fd-langs { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; column-gap: 8px; min-width: 0; }
.fd-lang-tabs { grid-column: 2; grid-row: 1; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 2px; padding-block-start: max(0px, calc((var(--fd-control-height, 30px) - 24px) / 2)); }
.fd-lang-pane { grid-column: 1; grid-row: 1; min-width: 0; }
@media (max-width: 520px) {
  .fd-langs { grid-template-columns: minmax(0, 1fr); row-gap: 4px; }
  .fd-lang-tabs { grid-column: 1; padding-block-start: 0; }
  .fd-lang-pane { grid-row: 2; }
}
.fd-lang-tab { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; padding: 0 10px; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius, 6px); background: var(--fd-surface); color: var(--fd-muted); font: inherit; font-size: 13px; line-height: 1.2; white-space: nowrap; cursor: pointer; }
.fd-lang-tab:hover { color: var(--fd-text); border-color: var(--fd-border-strong, var(--fd-border)); }
.fd-lang-tab[aria-selected="true"] { color: var(--fd-text); background: var(--fd-accent-soft); border-color: var(--fd-accent); font-weight: 600; }
.fd-lang-tab:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
/* A language with nothing typed yet: a ring; one a required answer still needs, or whose text does not fit: a dot. */
.fd-lang-tab > .fd-lang-state { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.fd-lang-tab[data-empty] > .fd-lang-state { box-shadow: inset 0 0 0 1.5px currentColor; opacity: 0.7; }
.fd-lang-tab[data-fault] > .fd-lang-state { background: var(--fd-error); box-shadow: none; opacity: 1; }
.fd-lang-pane[hidden] { display: none; }
/* On paper: every language, each under its name. */
@media print {
  .fd-form .fd-langs { display: block; }
  .fd-form .fd-lang-tabs { display: none; }
  .fd-form .fd-lang-pane[hidden] { display: block; }
  .fd-form .fd-lang-pane::before { content: attr(data-language); display: block; font-size: 11px; color: var(--fd-muted); }
}
/* In a list's cell or a card: a text shown in another language than the reader's, said so by its language's code. */
.fd-lang-mark { display: inline-block; margin-inline-start: 6px; padding: 0 4px; border: 1px solid var(--fd-border); border-radius: 4px; color: var(--fd-muted); font-size: 10px; font-weight: 600; line-height: 14px; letter-spacing: 0.04em; vertical-align: 1px; white-space: nowrap; }
`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installLanguagesStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-languages-styles', LANGUAGES_CSS, PART_RANK.languages);
}
