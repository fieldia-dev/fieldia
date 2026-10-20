import { installPartStyles, PART_RANK } from './styles';

/**
 * A choice in Fieldia's own list (own-list.ts): a box as a choice's, its words
 * the value, opened by the whole box. The choice part's sheet, put in its
 * place among Fieldia's — after the pickers', whose list rows it opens — the
 * first time a page draws one (installPartStyles, PART_RANK.picker).
 */
export const CHOICE_CSS = /* css */ `
/* ---- a choice in Fieldia's own list: a box as a choice's, its words the value, opened by the whole box -------- */
.fd-own-box.fd-dot-box { display: flex; align-items: center; gap: 0; width: 100%; min-width: 0; min-height: var(--fd-control-height, 30px); padding-inline-end: calc(var(--fd-pad-x) + 18px); cursor: pointer; }
:is(.fd-own-box, .fd-field[data-quiet] .fd-own-box) > .fd-own-button {
  position: absolute; inset: 0; width: auto; height: auto; margin: 0; padding: 0; border: 0; border-radius: inherit; background: none; cursor: pointer;
}
:is(.fd-own-box, .fd-field[data-quiet] .fd-own-box) > .fd-own-button:focus-visible { outline: none; }
.fd-own-box > .fd-own-button:disabled { cursor: default; }
.fd-own-box > .fd-own-words { display: block; min-width: 0; min-height: 1lh; font-size: inherit; color: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
.fd-own-box > .fd-own-words:empty::before { content: attr(data-placeholder); color: var(--fd-muted); }
.fd-own-box:has(> .fd-own-button:is(:focus-visible, [aria-expanded="true"])) { border-color: var(--fd-focus); box-shadow: var(--fd-focus-ring); }
.fd-own-box::after {
  content: ""; position: absolute; inset-inline-end: calc(var(--fd-pad-x) + 2px); inset-block-start: 50%; width: 6px; height: 6px; margin-block-start: -5px;
  border: solid var(--fd-muted); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); pointer-events: none;
}
.fd-own-box:has(> .fd-own-button:disabled) { cursor: default; color: var(--fd-muted); }
.fd-own-box:has(> .fd-own-button:disabled)::after { content: none; }
/* An option's places left after its words, as a radio's: a column of their own, the words cut before them. */
.fd-own-list .fd-pick-row:has(> .fd-seats) { grid-template-columns: 26px minmax(0, 1fr) auto; }
.fd-own-list .fd-pick-row > .fd-seats { align-self: center; padding-inline-start: 6px; }
`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installChoiceStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-choice-styles', CHOICE_CSS, PART_RANK.picker);
}
