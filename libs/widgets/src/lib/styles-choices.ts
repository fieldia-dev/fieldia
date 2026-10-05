/**
 * The choice kinds' details: options in columns or in a row, the words that
 * say a limit is reached, pictures' sizes and fit, a ranking's top few, and a
 * matrix whose rows become cards on a phone. A yes or no takes the points'
 * look. Appended to Fieldia's stylesheet, with logical properties.
 */
export const CHOICES_CSS = /* css */ `
.fd-yes-no button { min-width: 76px; }
.fd-choices-columns { display: grid; grid-template-columns: repeat(var(--fd-choice-columns), minmax(0, 1fr)); }
.fd-choices-row { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
.fd-choice-limit { grid-column: 1 / -1; flex-basis: 100%; font-size: 12.5px; color: var(--fd-muted); }
.fd-choice-limit:empty { display: none; }
.fd-image-choices[data-size="small"] { --fd-card: 96px; }
.fd-image-choices[data-size="large"] { --fd-card: 210px; }
.fd-image-choices[data-size] { grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--fd-card, 130px)), 1fr)); }
.fd-image-choices[data-fit="whole"] img { object-fit: contain; }
.fd-image-choices-bare .fd-image-card-words { position: absolute; inset-block-start: 6px; inset-inline-start: 6px; padding: 0; font-size: 0; }
/* A dropdown that searches: a chevron says it is one. */
.fd-choice-search .fd-combo::after {
  content: ""; position: absolute; inset-inline-end: 12px; width: 6px; height: 6px; margin-block-start: -4px; pointer-events: none;
  border: solid var(--fd-muted); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg);
}
.fd-rank-pool { display: flex; flex-wrap: wrap; gap: 8px; margin-block: 6px 10px; }
.fd-rank-pick {
  min-height: 32px; padding: 4px 12px; font: inherit; color: inherit; cursor: pointer;
  background: var(--fd-surface); border: 1px dashed var(--fd-border-strong); border-radius: 999px;
}
.fd-rank-pick:disabled { opacity: 0.5; cursor: default; }
.fd-rank-list:empty { display: none; }
.fd-rank-keep { margin-block-start: 8px; }
.fd-matrix-pick { display: inline-flex; align-items: center; gap: 8px; }
.fd-matrix-column { display: none; }
@container (max-width: 520px) {
  .fd-choices-columns { grid-template-columns: minmax(0, 1fr); }
  .fd-image-choices.fd-image-choices { grid-auto-flow: row; grid-template-columns: repeat(auto-fill, minmax(min(100%, 130px), 1fr)); }
  .fd-matrix-table, .fd-matrix-table :is(tbody, tr, th, td) { display: block; }
  .fd-matrix-table thead { display: none; }
  .fd-matrix-table tr { padding: 10px 12px; margin-block-end: 10px; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); }
  .fd-matrix-table :is(th, td) { padding: 2px 0; border: 0; text-align: start; }
  .fd-matrix-pick { min-height: 32px; }
  .fd-matrix-column { display: inline; }
}
`;
