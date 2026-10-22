/**
 * The endings' look — a light card for each, its name and when it is shown over its boxes, ↑ ↓ × at its end — and the
 * small "{ }" button beside a box of words that puts an answer in them. Logical properties throughout, so right to
 * left mirrors on its own.
 */
export const DESIGNER_ENDINGS_CSS = /* css */ `
/* ---- a box of words with its button that puts an answer in ---- */
.fd-words-box { display: flex; gap: 6px; align-items: flex-start; min-width: 0; }
.fd-words-box > .fd-input { flex: 1 1 auto; min-width: 0; }
.fd-answer-picker { flex: none; min-width: 32px; padding-inline: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; letter-spacing: 0.04em; color: var(--fd-muted); }
.fd-answer-picker:hover, .fd-answer-picker[aria-expanded="true"] { color: var(--fd-text); }
.fd-q-head > .fd-answer-picker, .fd-step-tools > .fd-answer-picker, .fd-q-option > .fd-answer-picker { align-self: center; }
/* On an option's row, as its grip: shown as the row is pointed at or worked in, always on a touch screen. */
.fd-q-option > .fd-answer-picker { opacity: 0; }
.fd-q-option:hover > .fd-answer-picker, .fd-q-option:focus-within > .fd-answer-picker, .fd-q-option > .fd-answer-picker[aria-expanded="true"] { opacity: 1; }
@media (hover: none) { .fd-q-option > .fd-answer-picker { opacity: 1; } }
/* Its list of answers, and the words said while the one picked is empty under them. */
.fd-answer-list { display: grid; gap: 1px; }
.fd-answer-empty-row { display: grid; gap: 4px; padding: 6px 8px 4px; margin-block-start: 4px; border-block-start: 1px solid var(--fd-border); }
.fd-answer-empty-row > .fd-menu-heading { padding: 0; }

/* ---- the endings ---- */
/* Each as wide as the room it has, and no wider, on a phone too: a condition's long choices shrink to it. */
.fd-endings { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-width: 0; }
.fd-endings-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
.fd-endings-list[hidden], .fd-endings [hidden] { display: none; }
.fd-ending { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; padding: 10px 12px; border: 1px solid var(--fd-border); border-radius: 8px; background: var(--fd-surface); min-width: 0; }
.fd-ending-head { display: flex; align-items: center; gap: 6px; min-width: 0; }
.fd-ending-name { font-weight: 650; font-size: 13px; }
.fd-ending-otherwise { font-size: 12.5px; color: var(--fd-muted); }
.fd-ending-head .fd-spacer { flex: 1 1 auto; }
.fd-ending-row { display: grid; gap: 4px; min-width: 0; }
.fd-ending-none { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
.fd-endings-add { justify-self: start; }

/* ---- under a survey's pages ---- */
.fd-survey-endings { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; margin-block-start: 16px; padding: 16px 20px; border: 1px solid var(--fd-border); border-radius: 8px; background: var(--fd-surface); }
.fd-survey-endings-head { margin: 0; font-size: 16px; font-weight: 650; }
`;
