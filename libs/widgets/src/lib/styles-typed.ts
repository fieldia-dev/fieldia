import { installPartStyles, PART_RANK } from './styles';

/**
 * A one-time code's boxes (code-box.ts): a box for each character, drawn under one text box the person types in, the
 * box the caret is at ringed. The typed part's sheet, put in its place among Fieldia's the first time a page draws a
 * code (installPartStyles, PART_RANK.typed): after the sheets cut from Fieldia's own and before the themes', so a
 * theme still reshapes the boxes' corners and their focus as it does a text box's. A masked box is a text box, drawn
 * by the main sheet, its text left to right at the end of a right-to-left page.
 */
export const TYPED_CSS = /* css */ `
/* ---- a one-time code: a box per character, one text box over them that the person types in ----------------------- */
.fd-code { position: relative; display: inline-flex; justify-self: start; width: max-content; gap: 8px; max-width: 100%; direction: ltr; }
.fd-code-cell {
  display: grid; place-items: center; width: 2.4em; height: 2.8em; flex: 0 1 auto; min-width: 1.6em;
  border: 1px solid var(--fd-border-strong, var(--fd-border)); border-radius: var(--fd-control-radius); background: var(--fd-surface);
  font-size: 1.15em; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--fd-text);
}
.fd-code-cell.fd-code-caret { border-color: var(--fd-focus); box-shadow: var(--fd-focus-ring); }
.fd-code[data-invalid] .fd-code-cell { border-color: var(--fd-error); }
.fd-code[data-readonly] .fd-code-cell { background: var(--fd-page); color: var(--fd-muted); }
/* The text box itself over them, unseen: its caret and text are the boxes'. */
.fd-code-input {
  position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; outline: none; background: transparent;
  color: transparent; caret-color: transparent; font-size: 16px; letter-spacing: 0; cursor: text;
}
.fd-form .fd-code-input:focus-visible { outline: none; }
.fd-code-input::selection { background: transparent; }
/* A masked box reads left to right, as its digits and groups are written, its text at the end of a right-to-left page. */
[dir="rtl"] .fd-masked[dir="ltr"] { text-align: right; }
/* ---- an amount in shorthand: what it reads, said under its box while it is typed -------------------------------- */
.fd-shorthand-said { margin-block-start: 4px; font-size: 12.5px; line-height: 1.4; color: var(--fd-muted); font-variant-numeric: tabular-nums; }
.fd-shorthand-said[hidden] { display: none; }
.fd-code-size { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installTypedStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-typed-styles', TYPED_CSS, PART_RANK.typed);
}
