/**
 * The choice kinds' details: options in columns or in a row, the words that
 * say a limit is reached, a dropdown that searches. A yes or no takes the
 * points' look. Pictures' sizes and fit, a ranking's top few and a matrix whose
 * rows become cards on a phone come with their kinds in the survey part
 * (styles-survey-looks.ts). Appended to Fieldia's stylesheet, with logical
 * properties.
 */
export const CHOICES_CSS = /* css */ `
.fd-yes-no button { min-width: 76px; }
.fd-choices-columns { display: grid; grid-template-columns: repeat(var(--fd-choice-columns), minmax(0, 1fr)); }
.fd-choices-row { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
.fd-choice-limit { grid-column: 1 / -1; flex-basis: 100%; font-size: 12.5px; color: var(--fd-muted); }
.fd-choice-limit:empty { display: none; }
/* A dropdown that searches: a chevron says it is one. */
.fd-choice-search .fd-combo::after {
  content: ""; position: absolute; inset-inline-end: 12px; width: 6px; height: 6px; margin-block-start: -4px; pointer-events: none;
  border: solid var(--fd-muted); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg);
}
@container (max-width: 520px) {
  .fd-choices-columns { grid-template-columns: minmax(0, 1fr); }
}
`;
