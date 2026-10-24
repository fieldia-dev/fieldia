import { installPartStyles, PART_RANK } from './styles';

/**
 * A path picker (path-picker.ts): its chevron, its list of suggestions and its
 * tree, measured from a work tracker's; and a checkbox tree (check-tree.ts), its
 * rows each with a box to tick. The path part's sheet, put in its
 * place among Fieldia's — after the pickers' — the first time a page draws one
 * (installPartStyles, PART_RANK.picker).
 */
export const PATH_CSS = /* css */ `
/* ---- a path picker: its chevron at the box's end, and its list as wide as the box ---------------------------- */
.fd-path > .fd-path-input { padding-inline-end: 34px; }
/* Its chevron 13px across and 7 down in a line a little over a pixel, its point a little under the box's middle (20.20.45, 20.24.05). */
.fd-path-chevron { position: absolute; inset-block: 0; inset-inline-end: 5px; display: grid; place-items: center; width: 24px; color: var(--fd-text); cursor: pointer; }
/* Half a pixel over, so its slanted line falls across the pixels' edges, in a shade off the words: as soft as the tracker's
   (#6c6c6c arms, its point darker). */
.fd-path-chevron .fd-icon { width: 24px; height: 24px; margin: 4px 0 0; stroke-width: 1.1; translate: 0.5px 0; color: color-mix(in srgb, var(--fd-text) 82%, var(--fd-surface)); }
.fd-path:has(> .fd-path-input[readonly]) > .fd-path-chevron { display: none; }
.fd-form .fd-field[data-quiet] .fd-path:not(:focus-within) > .fd-path-chevron { visibility: hidden; }
@media (hover: hover) {
  .fd-form .fd-field[data-quiet] .fd-path:hover > .fd-path-chevron { visibility: visible; }
  /* Pointed at, its edge in the strong border colour, as a work tracker's path box: darker than other boxes'. */
  .fd-form .fd-field[data-quiet] .fd-path:hover > .fd-path-input:not([readonly], :focus) { border-color: var(--fd-border-strong); }
}
/* Quiet, its tree open (it closes as the focus leaves it): the box ringed two pixels wide in the accent with a light halo
   of it outside, as a work tracker's path picker; closed again (Escape), the ring alone. */
.fd-form .fd-field[data-quiet] .fd-path.fd-combo > .fd-path-input[aria-expanded="true"]:focus {
  box-shadow: 0 0 0 1px var(--fd-accent), 0 0 0 3px color-mix(in srgb, var(--fd-accent) 20%, transparent);
}
.fd-path-callout {
  box-sizing: border-box; margin: 0; padding: 8px 0; overflow-x: hidden; overflow-y: auto; border: 0; border-radius: 0 0 2px 2px;
  background: var(--fd-surface); color: var(--fd-text); font-family: var(--fd-font); font-size: 14px; line-height: 20px; text-align: start;
  box-shadow: 0 3.2px 7.2px rgba(0, 0, 0, 0.132), 0 0.6px 1.8px rgba(0, 0, 0, 0.108);
}
/* Its scroll bar slim, as the tracker's (20.24.05): an 8px rounded thumb 3px in from its end, no track, no arrows, on
   every system that lets a page draw one; elsewhere the browser's thin one. A part paints no logical border, so its
   sides are physical ones, swapped right to left. Over a dialog's own bars (a work item's window), so said twice. */
.fd-path-callout.fd-path-callout::-webkit-scrollbar { width: 15px; }
.fd-path-callout.fd-path-callout::-webkit-scrollbar-track:vertical { margin-block: 8px; border: 0; background: transparent; }
.fd-path-callout.fd-path-callout::-webkit-scrollbar-thumb:vertical {
  border: solid transparent; border-width: 3px 3px 3px 4px; border-radius: 8px; background: color-mix(in srgb, var(--fd-text) 20%, var(--fd-surface)) padding-box;
}
[dir="rtl"] .fd-path-callout.fd-path-callout::-webkit-scrollbar-thumb:vertical { border-width: 3px 4px 3px 3px; }
.fd-path-callout.fd-path-callout::-webkit-scrollbar-thumb:vertical:hover { background-color: color-mix(in srgb, var(--fd-text) 40%, var(--fd-surface)); }
.fd-path-callout.fd-path-callout::-webkit-scrollbar-button { display: none; }
@supports not selector(::-webkit-scrollbar) {
  .fd-path-callout { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--fd-text) 20%, transparent) transparent; }
}
.fd-path-heading { height: 26px; padding-inline-start: 43px; font-weight: 600; line-height: 26px; white-space: nowrap; }
.fd-path-row { display: grid; grid-template-columns: minmax(0, 1fr); height: 24px; margin: 0 0 2px; padding-inline: 8px; line-height: 24px; white-space: nowrap; cursor: pointer; }
.fd-path-row:has(> .fd-path-aside) { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
.fd-path-name { position: relative; min-width: 0; padding-inline-start: calc(35px + var(--fd-depth, 0) * 16px); overflow: hidden; text-overflow: ellipsis; }
.fd-path-aside { min-width: 0; padding-inline-end: 12px; text-align: end; overflow: hidden; text-overflow: ellipsis; }
/* A path and its dates read their own way: "3/25/2026 - 4/16/2026" stays in its order on a page read right to left. */
.fd-path-words, .fd-path-aside > span { unicode-bidi: plaintext; }
.fd-path-twist {
  position: absolute; inset-block: 0; inset-inline-start: calc(9px + var(--fd-depth, 0) * 16px); display: grid; place-items: center; width: 20px;
  padding: 0; border: 0; background: none; color: var(--fd-text); cursor: pointer;
}
.fd-path-twist .fd-icon { width: 20px; height: 20px; margin: 0; stroke-width: 1.2; }
.fd-path-twist .fd-icon[data-icon="chevron-right"]:dir(rtl) { transform: scaleX(-1); }
/* The divider ends level with the dates' end (20.24.05: 1541 against 1542). */
.fd-path-divider { height: 1px; margin-block: 8px 11px; margin-inline: 20px; background: var(--fd-border); }
.fd-path-empty { padding: 3px 43px; }
@media (hover: hover) { .fd-path-row:hover { background: color-mix(in srgb, var(--fd-text) 5%, transparent); } }
/* The row reached: the selection colour, a focus rectangle round its name and another round its words at the end. */
.fd-path-row[data-active] { background: var(--fd-accent-soft); }
.fd-path-row[data-active] > :is(.fd-path-name, .fd-path-aside) {
  outline: 1px solid var(--fd-focus); outline-offset: -1px; box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--fd-focus) 14%, transparent);
}

/* ---- a checkbox tree (check-tree.ts): its search, its rows each with a box to tick, a count of those chosen ---- */
.fd-tree-box { display: grid; gap: 6px; min-width: 0; }
.fd-check-tree {
  max-height: 320px; overflow-y: auto; padding: 4px 0; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius);
  background: var(--fd-surface); font-size: 14px; line-height: 20px;
}
.fd-tree-row {
  display: grid; grid-template-columns: 20px 18px minmax(0, 1fr) auto; align-items: center; gap: 6px; min-height: 30px;
  padding-inline: calc(6px + var(--fd-depth, 0) * 20px) 10px; cursor: pointer; outline: none;
}
.fd-tree-row[aria-disabled="true"] { cursor: default; color: var(--fd-muted); }
@media (hover: hover) { .fd-tree-row:hover { background: color-mix(in srgb, var(--fd-text) 5%, transparent); } }
.fd-tree-row:focus-visible { background: var(--fd-accent-soft); outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-tree-twist { display: grid; place-items: center; width: 20px; height: 20px; color: var(--fd-muted); }
.fd-tree-twist .fd-icon { width: 18px; height: 18px; margin: 0; stroke-width: 1.4; }
.fd-tree-twist .fd-icon[data-icon="chevron-right"]:dir(rtl) { transform: scaleX(-1); }
/* Its box: empty, ticked, or a dash when some under it are ticked. */
.fd-tree-check {
  display: grid; place-items: center; width: 18px; height: 18px; border: 1.5px solid var(--fd-muted); border-radius: clamp(2px, var(--fd-control-radius), 4px);
  background: var(--fd-surface); color: var(--fd-accent-text);
}
.fd-tree-row:is([aria-checked="true"], [aria-checked="mixed"]) > .fd-tree-check { border-color: var(--fd-accent); background: var(--fd-accent); }
.fd-tree-check .fd-icon { width: 14px; height: 14px; margin: 0; stroke-width: 2.4; }
.fd-tree-row[aria-checked="mixed"] > .fd-tree-check::after { content: ""; width: 8px; height: 2px; border-radius: 1px; background: currentColor; }
.fd-tree-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-tree-aside { font-size: 12.5px; color: var(--fd-muted); white-space: nowrap; }
.fd-tree-count { font-size: 12.5px; color: var(--fd-muted); }
.fd-tree-count:empty, .fd-tree-empty[hidden] { display: none; }
.fd-tree-empty { padding: 6px 10px; }

/* A list too narrow for both side by side (a phone's): the words at the end go under the name, smaller. */
.fd-path-callout { container-type: inline-size; }
@container (max-width: 400px) {
  .fd-path-row:has(> .fd-path-aside) { grid-template-columns: minmax(0, 1fr); height: auto; line-height: 20px; padding-block: 2px; }
  .fd-path-aside { padding-inline: calc(35px + var(--fd-depth, 0) * 16px) 12px; text-align: start; font-size: 12px; line-height: 16px; }
}

`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installPathStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-path-styles', PATH_CSS, PART_RANK.picker);
}
