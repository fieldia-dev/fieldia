/**
 * The designer's styles for what closes the gap with other form builders:
 * looks to start from on the Look tab, the mark of a group that folds, and
 * an icon by what Find anything lists, where it has one of its own.
 */
export const DESIGNER_GAP_CSS = /* css */ `
/* Looks to start from: a tile each, its words in its font and accent on its scheme's surface. */
.fd-look-presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.fd-look-preset, .fd-look-own {
  display: grid; justify-items: center; align-content: center; gap: 2px; min-width: 0; min-height: 54px; box-sizing: border-box; padding: 5px 4px;
  border: 1px solid var(--fd-border); border-radius: 8px; background: var(--fd-surface); font: inherit; font-size: 12px; font-weight: 600; color: var(--fd-muted); cursor: pointer;
}
.fd-look-preset:hover { border-color: var(--fd-border-strong); color: var(--fd-text); }
.fd-look-preset:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-look-preset[aria-pressed="true"] { border-color: var(--fd-accent); color: var(--fd-accent); box-shadow: inset 0 0 0 1px var(--fd-accent); }
.fd-look-preset-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-look-preset-sample { padding: 0 6px; border-radius: 4px; font-size: 17px; line-height: 24px; font-weight: 700; color: var(--fd-preset-accent, var(--fd-accent)); }
.fd-look-preset-sample[data-scheme="dark"] { background: #1f2329; }
.fd-look-preset-sample[data-font="serif"] { font-family: "Source Serif 4", Georgia, serif; }
.fd-look-preset-sample[data-font="rounded"] { font-family: Nunito, "Varela Round", system-ui; }
/* The look the page wears when it is none of them: said, not pressed. */
.fd-look-own { cursor: default; border-style: dashed; color: var(--fd-text); font-weight: 600; text-align: center; }
.fd-look-own[hidden] { display: none; }
/* Looks of one's own: under Fieldia's, drawn as they are, a menu at each tile's corner. */
.fd-look-saved-head { margin: 6px 0 6px; font-size: 12.5px; font-weight: 600; color: var(--fd-text); }
.fd-look-saved-tile { position: relative; display: grid; min-width: 0; }
.fd-look-saved-tile > .fd-look-preset { padding-inline: 6px; }
/* A name of one's own, on two lines before it is cut short: the whole of it is the tile's title and its name. */
.fd-look-saved-tile .fd-look-preset-name { white-space: normal; overflow-wrap: anywhere; text-align: center; line-height: 1.25; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
.fd-look-saved-more {
  position: absolute; inset-block-start: 2px; inset-inline-end: 2px; display: grid; place-items: center; width: 24px; height: 24px; padding: 0;
  border: 0; border-radius: 6px; background: transparent; color: var(--fd-muted); cursor: pointer;
}
.fd-look-saved-more:hover, .fd-look-saved-more[aria-expanded="true"] { background: var(--fd-page); color: var(--fd-text); }
.fd-look-saved-more:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 0; }
.fd-look-saved-more .fd-dicon { width: 16px; height: 16px; }
.fd-properties .fd-look-save { justify-self: start; min-height: 24px; padding: 0 2px; font-size: 12.5px; }
.fd-look-save[hidden], .fd-look-name[hidden], .fd-look-status[hidden], .fd-look-problem[hidden], .fd-look-name-problem[hidden] { display: none; }
/* Naming one: a box on the page, its refusal under it in words. */
.fd-look-name { display: grid; gap: 6px; padding: 8px; border-radius: 8px; background: var(--fd-page); }
.fd-look-name-label { font-size: 12.5px; font-weight: 600; color: var(--fd-text); }
.fd-look-name > .fd-input { min-width: 0; }
.fd-look-name > .fd-input[aria-invalid="true"] { border-color: var(--fd-error); }
.fd-look-name-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
.fd-look-name-problem { margin: 0; font-size: 12.5px; line-height: 1.4; color: var(--fd-error); }
/* What was done, with Undo; what failed, with Try again. */
.fd-look-status, .fd-look-problem { margin: 0; font-size: 12.5px; line-height: 1.4; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; overflow-wrap: anywhere; }
.fd-look-status { color: var(--fd-muted); }
.fd-look-problem { color: var(--fd-error); }
.fd-look-status .fd-button, .fd-look-problem .fd-button { min-height: 24px; padding: 0 4px; }
/* A group that folds by its title: an arrow before the title, as the form draws it; along the line while it starts folded. */
.fd-canvas-fold { display: inline-flex; vertical-align: -2px; margin-inline-end: 6px; color: var(--fd-muted); }
.fd-canvas-fold[hidden] { display: none; }
.fd-canvas-fold .fd-dicon { width: 15px; height: 15px; }
.fd-canvas-fold[data-fold="folded"] .fd-dicon { transform: rotate(-90deg); }
.fd-canvas-fold[data-fold="folded"]:dir(rtl) .fd-dicon { transform: rotate(90deg); }
/* Find anything: an icon before what has one of its own, as the bar shows it. */
.fd-find-option > .fd-dicon { width: 16px; height: 16px; margin-inline-end: -4px; color: var(--fd-muted); }
.fd-find-option[aria-selected="true"] > .fd-dicon { color: var(--fd-accent); }
/* Where some of what is found has an icon, the rest keep its room, so the words line up. */
.fd-find-icon-room { flex: none; width: 16px; margin-inline-end: -4px; }
/* A rule across fields that does not hold on the made-up values: said, not as a success. */
.fd-formula-result[data-fails] { background: var(--fd-warning-soft, var(--fd-page)); }
`;
