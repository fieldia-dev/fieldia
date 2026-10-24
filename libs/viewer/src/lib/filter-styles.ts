import { fieldiaStyle } from '@fieldia/widgets';
/** The filter bar (filter-bar.ts): the filters part's sheet, put after the list's own the first time a list draws one. */
export const FILTER_CSS = /* css */ `
/* The filter bar (search "fields"): a card with a keyword box at its start, each field's list of values at its end, then the gear and ×. */
.fd-filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; flex: 1 1 100%; min-width: 0; min-height: 45px; box-sizing: border-box; padding: 6px 8px 6px 16px; padding-inline: 16px 8px; background: var(--fd-surface); border-radius: var(--fd-radius); box-shadow: 0 3.2px 7.2px rgba(0, 0, 0, 0.132), 0 0.6px 1.8px rgba(0, 0, 0, 0.108); }
.fd-filter-search { flex: 1 1 200px; min-width: 0; display: flex; align-items: center; gap: 8px; color: var(--fd-muted); }
.fd-filter-icon { width: 16px; height: 16px; flex: none; }
.fd-filter-keyword { flex: 1; min-width: 0; border: 0; outline: none; background: none; font: inherit; font-size: 14px; color: var(--fd-text); padding: 6px 0; }
.fd-filter-keyword::placeholder { color: var(--fd-muted); opacity: 1; }
.fd-filter-keyword::-webkit-search-cancel-button { display: none; }
.fd-filter-search:focus-within { box-shadow: inset 0 -2px 0 var(--fd-focus); }
.fd-filter-fields { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-inline-start: auto; }
.fd-filter-field { position: relative; display: inline-flex; }
.fd-filter-pick { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; max-width: 220px; min-height: 32px; padding-inline: 8px; border-radius: 2px; font-size: 14px; color: var(--fd-muted); }
.fd-filter-pick[data-picked] { color: var(--fd-text); font-weight: 600; }
.fd-filter-words { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-filter-chevron { width: 16px; height: 16px; flex: none; color: var(--fd-muted); }
.fd-filter-tool { all: unset; box-sizing: border-box; cursor: pointer; display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 2px; color: var(--fd-muted); }
.fd-filter-clear { color: var(--fd-text); }
.fd-filter-tool svg { width: 16px; height: 16px; }
.fd-filter-pick:hover, .fd-filter-tool:hover, .fd-filter-pick[aria-expanded="true"], .fd-filter-tool[aria-expanded="true"] { background: var(--fd-page); }
.fd-filter-pick:focus-visible, .fd-filter-tool:focus-visible { outline: 1px solid var(--fd-focus); outline-offset: -1px; }
.fd-filter-menu { position: absolute; z-index: 30; inset-inline-end: 0; top: calc(100% + 4px); box-sizing: border-box; min-width: 200px; max-width: min(320px, 90vw); max-height: 320px; overflow: auto; padding-block: 4px; background: var(--fd-surface); border-radius: 4px; box-shadow: 0 3.2px 7.2px rgba(0, 0, 0, 0.132), 0 0.6px 1.8px rgba(0, 0, 0, 0.108); }
.fd-filter-option { display: flex; align-items: center; gap: 10px; min-height: 32px; padding-inline: 12px; cursor: pointer; font-size: 14px; color: var(--fd-text); outline: none; }
.fd-filter-option:hover { background: var(--fd-page); }
.fd-filter-option:focus-visible, .fd-filter-option:focus { background: var(--fd-page); box-shadow: inset 0 0 0 1px var(--fd-focus); }
.fd-filter-box { display: grid; place-items: center; width: 16px; height: 16px; flex: none; box-sizing: border-box; border: 1px solid var(--fd-border-strong); border-radius: 2px; color: transparent; }
.fd-filter-box svg { width: 12px; height: 12px; }
.fd-filter-option[aria-checked="true"] .fd-filter-box { background: var(--fd-accent); border-color: var(--fd-accent); color: var(--fd-accent-text, #fff); }
.fd-filter-option-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* A range (filterRanges): the presses for its least values, then From and To side by side (the list's sheet), what is wrong said under them. */
.fd-filter-range-menu { padding: 12px; width: 300px; max-width: min(320px, 90vw); max-height: none; overflow: visible; }
.fd-filter-range { display: grid; gap: 10px; }
.fd-filter-range-presses { display: flex; flex-wrap: wrap; gap: 6px; }
.fd-filter-range-press {
  all: unset; box-sizing: border-box; cursor: pointer; display: inline-grid; place-items: center; min-width: 38px; min-height: 32px; padding-inline: 8px;
  border: 1px solid var(--fd-border-strong); border-radius: 999px; font-size: 13.5px; color: var(--fd-text); font-variant-numeric: tabular-nums;
}
.fd-filter-range-press:hover { background: var(--fd-page); }
.fd-filter-range-press[aria-pressed="true"] { background: var(--fd-accent); border-color: var(--fd-accent); color: var(--fd-accent-text, #fff); }
.fd-filter-range-press:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
/* On a phone (filterSheet): the fields behind one Filters button, how many are on beside its words. */
.fd-filter-sheet-open {
  all: unset; box-sizing: border-box; cursor: pointer; display: none; align-items: center; gap: 6px; min-height: 36px; padding-inline: 10px;
  border-radius: 2px; font-size: 14px; color: var(--fd-text);
}
.fd-filter-sheet-open[data-picked] { font-weight: 600; }
.fd-filter-sheet-open:hover { background: var(--fd-page); }
.fd-filter-sheet-open:focus-visible { outline: 1px solid var(--fd-focus); outline-offset: -1px; }
.fd-filter-sheet-icon { width: 16px; height: 16px; flex: none; }
.fd-filter-badge { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding-inline: 5px; box-sizing: border-box; border-radius: 9px; background: var(--fd-accent); color: var(--fd-accent-text, #fff); font-size: 11.5px; font-weight: 600; }
.fd-filter-badge[hidden] { display: none; }
.fd-filter-bar[data-sheet] { container: fd-filter-bar / inline-size; }
@container fd-filter-bar (max-width: 520px) {
  .fd-filter-bar[data-sheet] .fd-filter-field { display: none; }
  .fd-filter-bar[data-sheet] .fd-filter-sheet-open { display: inline-flex; }
}
/* The sheet: from the foot of a phone's screen, every field at once, Clear all and Show held at its foot. */
.fd-filter-sheet { max-width: 480px; }
.fd-filter-sheet-body { display: grid; gap: 18px; align-content: start; }
.fd-filter-sheet-field { margin: 0; padding: 0; border: 0; min-width: 0; display: grid; gap: 6px; }
.fd-filter-sheet-name { padding: 0; margin-block-end: 2px; font-size: 14px; font-weight: 600; color: var(--fd-text); }
.fd-filter-sheet-values { display: grid; }
.fd-filter-sheet-option { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 15px; color: var(--fd-text); cursor: pointer; border-block-end: 1px solid var(--fd-border); }
.fd-filter-sheet-box { --fd-tick-size: 20px; }
.fd-filter-sheet .fd-filter-range-press { min-height: 40px; min-width: 48px; font-size: 15px; }
.fd-filter-sheet .fd-filter-range-box { min-height: 44px; font-size: 16px; }
.fd-filter-sheet-foot { display: flex; align-items: center; gap: 12px; }
.fd-filter-sheet-foot .fd-button { min-height: 44px; }
.fd-filter-sheet-show { flex: 1 1 auto; justify-content: center; }
@media (max-width: 600px) {
  .fd-filter-sheet-backdrop { padding: 0; align-items: end; }
  .fd-filter-sheet { max-width: none; max-height: 92dvh; border-radius: 12px 12px 0 0; }
  .fd-filter-sheet-foot { padding-block-end: max(12px, env(safe-area-inset-bottom, 0px)); }
}
/* Fluent's filter bar: a card 50px tall, its words a little above the middle, 16px over the table's card (measured). */
.fd-form[data-fd-theme="fluent"] .fd-list:has(> .fd-list-bar > .fd-filter-bar) { row-gap: 16px; }
.fd-form[data-fd-theme="fluent"] .fd-filter-bar { min-height: 50px; padding-block: 7px 5px; padding-inline-end: 10px; }
/* Its fields 28px apart, word to word, each with a chevron 12px by 7 in a one-pixel line a shade lighter than the words,
   a pixel above their middle; the settings' small light cog 24px after the last chevron, the × 12px wide further on
   (measured on 08_18: the chevrons #8a8a8a, Tags' ending at 1790, the cog at 1815). */
.fd-form[data-fd-theme="fluent"] .fd-filter-fields { gap: 6px; }
.fd-form[data-fd-theme="fluent"] .fd-filter-chevron {
  position: relative; inset-block-start: -1px; width: 22px; height: 22px; margin-inline: -3px -1px; stroke-width: 1.1; color: var(--fd-muted);
}
.fd-form[data-fd-theme="fluent"] .fd-filter-tool:not(.fd-filter-clear) { margin-inline-start: -5px; }
.fd-form[data-fd-theme="fluent"] .fd-filter-tool:not(.fd-filter-clear) svg { width: 13px; height: 13px; }
.fd-form[data-fd-theme="fluent"] .fd-filter-clear { margin-inline-start: 4px; }
.fd-form[data-fd-theme="fluent"] .fd-filter-clear svg { width: 19px; height: 19px; }
.fd-form[data-fd-theme="fluent"] .fd-list-scroll { border: 0; border-radius: 4px; box-shadow: 0 1.6px 3.6px rgba(0, 0, 0, 0.132), 0 0.3px 0.9px rgba(0, 0, 0, 0.108); }
`;

/** The sheet in a document, once: after the list's own (list-styles.ts), whose rules it adds to. */
export function installFilterStyles(doc: Document): void {
  if (doc.getElementById('fd-filter-styles')) return;
  const style = fieldiaStyle(doc, FILTER_CSS, 'fd-filter-styles');
  const list = doc.getElementById('fd-list-styles');
  if (list) list.after(style);
  else doc.head.append(style);
}
