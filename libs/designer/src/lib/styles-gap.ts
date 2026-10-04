/**
 * The designer's styles for what closes the gap with other form builders:
 * looks to start from on the Look tab, and the mark of a group that folds.
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
.fd-look-preset-sample { padding: 0 6px; border-radius: 4px; font-size: 17px; line-height: 24px; font-weight: 700; color: var(--fd-preset-accent); }
.fd-look-preset-sample[data-scheme="dark"] { background: #1f2329; }
.fd-look-preset-sample[data-font="serif"] { font-family: "Source Serif 4", Georgia, serif; }
.fd-look-preset-sample[data-font="rounded"] { font-family: Nunito, "Varela Round", system-ui; }
/* The look the page wears when it is none of them: said, not pressed. */
.fd-look-own { cursor: default; border-style: dashed; color: var(--fd-text); font-weight: 600; text-align: center; }
.fd-look-own[hidden] { display: none; }
/* A group that folds by its title: an arrow by the title, along the line while it starts folded. */
.fd-canvas-fold { display: inline-flex; vertical-align: -2px; margin-inline-start: 6px; color: var(--fd-muted); }
.fd-canvas-fold[hidden] { display: none; }
.fd-canvas-fold .fd-dicon { width: 15px; height: 15px; }
.fd-canvas-fold[data-fold="folded"] .fd-dicon { transform: rotate(-90deg); }
.fd-canvas-fold[data-fold="folded"]:dir(rtl) .fd-dicon { transform: rotate(90deg); }
`;
