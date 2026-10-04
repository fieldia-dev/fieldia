/**
 * The panel beside the canvas, as the approved mockup draws it: a head saying
 * what is picked, the tabs under it, then one tab's settings — each a name in
 * small bold words over its control, with a line of help under it where it
 * needs one. Logical properties throughout, so right to left mirrors on its own.
 */
export const DESIGNER_PANEL_CSS = /* css */ `
/* ---- the panel: what is picked, its tabs, one tab's settings ---- */
.fd-properties.fd-inspector { display: flex; flex-direction: column; padding: 0; gap: 0; overflow: hidden; }
.fd-insp-head { flex: none; padding: 12px 14px 8px; display: grid; gap: 2px; border-block-end: 1px solid var(--fd-border); min-width: 0; }
.fd-insp-kind { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fd-muted); }
.fd-insp-kind > .fd-panel-title { font-size: inherit; font-weight: inherit; letter-spacing: inherit; color: inherit; margin: 0; }
.fd-insp-note { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fd-insp-icon { display: inline-flex; flex: none; }
.fd-insp-icon > .fd-dicon { width: 13px; height: 13px; }
.fd-insp-name { font-size: 15px; font-weight: 600; color: var(--fd-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-insp-top { flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column; }
.fd-insp-top:empty { display: none; }
/* Search the settings: a box under the head; what it finds, by tab, in place of the tabs. */
.fd-insp-search { position: relative; flex: none; margin: 10px 14px 4px; }
.fd-insp-search-icon { position: absolute; inset-inline-start: 9px; inset-block-start: 50%; transform: translateY(-50%); display: inline-flex; color: var(--fd-muted); pointer-events: none; }
.fd-insp-search-icon > .fd-dicon { width: 14px; height: 14px; }
.fd-properties .fd-insp-search-box { padding-inline-start: 30px; min-height: 32px; font-size: 13px; }
.fd-insp-found { display: grid; gap: 10px; align-content: start; padding: 6px 6px 14px; min-height: 0; overflow: auto; }
.fd-insp-found-group { display: grid; gap: 1px; }
.fd-insp-found-tab { font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fd-muted); padding: 4px 8px 2px; }
.fd-insp-found-option { display: flex; align-items: baseline; gap: 8px; padding: 7px 8px; border-radius: 6px; cursor: pointer; font-size: 13.5px; }
.fd-insp-found-option:hover { background: var(--fd-page); }
.fd-insp-found-option[aria-selected="true"] { background: var(--fd-accent-soft); }
.fd-insp-found-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-insp-found-value { flex: none; font-size: 12px; color: var(--fd-muted); }
.fd-properties .fd-insp-none { padding: 8px 14px 14px; margin: 0; }
.fd-insp-tabs { flex: none; display: flex; padding-inline: 8px; border-block-end: 1px solid var(--fd-border); overflow-x: auto; scrollbar-width: none; }
.fd-insp-tab {
  all: unset; box-sizing: border-box; cursor: pointer; white-space: nowrap; padding: 9px 8px 8px;
  font-size: 13px; font-weight: 600; color: var(--fd-muted); border-block-end: 2px solid transparent;
}
.fd-insp-tab:hover { color: var(--fd-text); }
.fd-insp-tab[aria-selected="true"] { color: var(--fd-accent); border-block-end-color: var(--fd-accent); }
.fd-insp-tab:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -3px; border-radius: 6px; }
.fd-insp-panels { flex: 1 1 auto; min-height: 0; overflow: auto; }
.fd-insp-panel { display: grid; gap: 14px; align-content: start; padding: 12px 14px 18px; min-width: 0; }
.fd-insp-panel > .fd-props { gap: 14px; }

/* A setting: its name over its control, a line of help under it. */
.fd-properties .fd-prop { gap: 6px; min-width: 0; }
.fd-properties .fd-prop-name { font-size: 12.5px; font-weight: 600; color: var(--fd-text); }
.fd-properties .fd-properties-hint { font-size: 12px; line-height: 1.45; }
.fd-properties .fd-kind-note { margin-block-start: 0; }
.fd-properties .fd-props-actions { border-block-start: 0; padding-block-start: 0; gap: 6px; }
.fd-properties .fd-q-required { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 13px; cursor: pointer; }
.fd-properties .fd-q-required > input { width: 16px; height: 16px; margin: 0; accent-color: var(--fd-accent); }
.fd-insp-area { resize: vertical; min-height: 56px; font: inherit; }
.fd-insp-code {
  font: 12.5px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: var(--fd-text); overflow-wrap: anywhere;
  padding: 6px 9px; border: 1px solid var(--fd-border); border-radius: 6px; background: var(--fd-page);
}
.fd-insp-chip {
  justify-self: start; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--fd-muted);
  background: var(--fd-page); border: 1px solid var(--fd-border); border-radius: 999px; padding: 1px 9px;
}
/* A setting gone to, from the search or Find anything: pointed out a moment. */
.fd-set-found { animation: fd-set-found 1.2s ease; border-radius: 6px; }
@keyframes fd-set-found { from { box-shadow: 0 0 0 4px var(--fd-accent-soft); background: var(--fd-accent-soft); } to { box-shadow: 0 0 0 4px transparent; background: transparent; } }

/* A choice of a few, side by side, as wide as the panel. */
.fd-properties .fd-insp-seg { width: 100%; box-sizing: border-box; border: 1px solid var(--fd-border); grid-auto-columns: minmax(max-content, 1fr); }
.fd-properties .fd-insp-seg > .fd-seg-button { min-height: 28px; font-size: 13px; font-weight: 600; display: grid; place-items: center; padding: 4px 6px; white-space: nowrap; }
.fd-properties .fd-insp-seg > .fd-seg-button[hidden] { display: none; }
/* Columns on each size of screen: its name, then its counts, a row each. */
.fd-insp-screens { display: grid; gap: 5px; }
.fd-insp-screen { display: grid; grid-template-columns: 62px minmax(0, 1fr); align-items: center; gap: 8px; }
.fd-insp-screen-name { font-size: 12.5px; color: var(--fd-muted); }
.fd-properties .fd-insp-screen .fd-seg-button { min-height: 26px; padding-inline: 2px; }
.fd-properties .fd-insp-screen .fd-seg-button[data-choice="0"] { font-size: 12px; }
/* A width in pixels: a slider and the number, side by side. */
.fd-insp-range { display: flex; align-items: center; gap: 8px; }
.fd-insp-slider { flex: 1; min-width: 0; margin: 0; accent-color: var(--fd-accent); }
.fd-properties .fd-insp-number { width: 64px; flex: none; min-height: 30px; padding-block: 3px; font-variant-numeric: tabular-nums; }
.fd-insp-unit { font-size: 12px; color: var(--fd-muted); }
/* The accent: round swatches, then any colour, and the skin's own back. */
.fd-properties .fd-insp-swatches { width: auto; display: flex; flex-wrap: wrap; gap: 8px; padding: 2px; border: 0; background: none; }
.fd-properties .fd-insp-swatches > .fd-seg-button {
  width: 26px; height: 26px; min-height: 0; padding: 0; border-radius: 50%; box-sizing: border-box;
  background: var(--fd-swatch); border: 2px solid var(--fd-surface); box-shadow: 0 0 0 1px var(--fd-border);
}
.fd-properties .fd-insp-swatches > .fd-seg-button[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--fd-text); }
.fd-insp-any { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; }
.fd-insp-any-colour { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--fd-muted); cursor: pointer; }
.fd-insp-colour { width: 26px; height: 20px; padding: 0; border: 1px solid var(--fd-border); border-radius: 5px; background: none; cursor: pointer; flex: none; }
.fd-insp-colour::-webkit-color-swatch-wrapper { padding: 2px; }
.fd-insp-colour::-webkit-color-swatch { border: 0; border-radius: 3px; }
.fd-insp-colour::-moz-color-swatch { border: 0; border-radius: 3px; }
.fd-properties .fd-insp-reset { padding: 0; min-height: 0; font-size: 12.5px; }
/* A group's style: a small drawing over each word. */
.fd-properties .fd-insp-styles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; padding: 0; border: 0; background: none; }
.fd-properties .fd-insp-styles > .fd-seg-button {
  display: grid; justify-items: center; gap: 3px; min-height: 0; padding: 6px 2px 5px; border: 1px solid var(--fd-border); border-radius: 8px;
  background: var(--fd-surface); box-shadow: none; font-size: 11.5px; font-weight: 600; color: var(--fd-muted);
}
.fd-properties .fd-insp-styles > .fd-seg-button[aria-pressed="true"] { border-color: var(--fd-accent); color: var(--fd-accent); box-shadow: inset 0 0 0 1px var(--fd-accent); }
.fd-insp-style-picture { display: block; line-height: 0; }
.fd-insp-style-picture svg { width: 40px; height: 27px; }
/* The survey designer's Look: the same settings, in a sheet at the side of the cards. */
.fd-properties.fd-look-sheet {
  position: fixed; z-index: 50; inset-block-start: var(--fd-sheet-top, 84px); inset-inline-end: 16px; width: min(320px, calc(100vw - 32px));
  max-height: calc(100vh - var(--fd-sheet-top, 84px) - 16px);
  display: flex; flex-direction: column; padding: 0; gap: 0; overflow: hidden; box-shadow: 0 18px 44px rgba(15, 20, 25, 0.18);
  animation: fd-menu-in 120ms cubic-bezier(0, 0, 0.2, 1);
}
.fd-look-sheet-head { flex: none; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding-block: 12px 8px; padding-inline: 14px 10px; border-block-end: 1px solid var(--fd-border); }
.fd-look-sheet-body { flex: 1 1 auto; min-height: 0; overflow: auto; }
/* The survey's cards wearing the page's look: the page tinted with its accent, in either scheme; the editor's own room round them. */
.fd-survey-canvas.fd-look-worn { container-type: normal; }
.fd-survey-canvas.fd-look-worn[data-scheme] { background: color-mix(in srgb, var(--fd-accent) 8%, var(--fd-page)); }
/* The canvas wearing the page's look keeps the editor's own frame round it. */
.fd-canvas.fd-look-worn[data-scheme] { border: 1px solid var(--fd-border); }
@media (prefers-reduced-motion: reduce) { .fd-set-found, .fd-properties.fd-look-sheet { animation: none; } }
`;
