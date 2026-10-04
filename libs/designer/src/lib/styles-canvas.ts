/**
 * The Advanced canvas's own styles: what keeps the canvas drawing each part
 * where the form puts it, and the marks of Advanced — the drop line and the
 * group tinted under it, the chip that says where, the width handle and the
 * gutter between two parts, the guides of a grid's columns, the bar for
 * several picked, and the note Simple mode shows on an arrangement.
 *
 * Logical properties throughout, so right to left mirrors on its own.
 */
export const DESIGNER_CANVAS_CSS = /* css */ `
/* ---- the canvas draws each part where the form puts it ---- */
/* The page's own parts, the same room between them as the form leaves. */
.fd-canvas-body.fd-sections { gap: var(--fd-gap-block, 24px); }
/* A field's widget sits in the field as the form puts it, nothing drawn round it to take room. */
.fd-canvas-widget:not([hidden]) { display: contents; }

/* ---- Simple and Advanced ---- */
/* Simple keeps an arrangement as Advanced laid it out, and says so on its top edge, where it is seen as it is picked. */
.fd-simple-lock {
  position: absolute; z-index: 8; inset-inline-end: 0; inset-block-start: 0; translate: 0 -50%; width: max-content; max-width: min(420px, 100%);
  display: grid; gap: 8px; padding: 10px 12px; border: 1px dashed var(--fd-border-strong); border-radius: 8px;
  background: var(--fd-surface); color: var(--fd-muted); font-size: 13px; line-height: 1.45; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
}
.fd-simple-lock[hidden] { display: none; }
.fd-simple-lock > .fd-button { justify-self: start; }

/* ---- Advanced: where a carried part would go ---- */
/* The marks are drawn in the canvas, placed against it, so they wear its colours; none takes the pointer. */
.fd-canvas { position: relative; }
.fd-canvas > :is(.fd-drop-bar, .fd-drop-zone, .fd-drop-chip) { position: absolute; pointer-events: none; }
/* The line where it would go: beside a part, under it, or across a grid between its rows. */
.fd-drop-bar { z-index: 30; background: var(--fd-accent); border-radius: 3px; box-shadow: 0 0 0 2px color-mix(in srgb, var(--fd-accent) 25%, transparent); }
/* A whole group as the target: tinted, never outlined. */
.fd-drop-zone { z-index: 29; background: color-mix(in srgb, var(--fd-accent) 7%, transparent); border-radius: 10px; }
/* The chip by the pointer: what is carried, and where it would go — or why not. */
.fd-drop-chip {
  z-index: 31; display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; width: max-content; max-width: 300px;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-accent); border-radius: 7px; padding: 5px 9px;
  font-size: 12.5px; font-weight: 600; line-height: 1.35; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.18);
}
.fd-drop-where { flex-basis: 100%; font-weight: 500; font-size: 11.5px; color: var(--fd-muted); }
.fd-drop-chip.fd-drop-refused { border-color: var(--fd-error); }
.fd-drop-chip.fd-drop-refused .fd-drop-where { color: var(--fd-error); }
/* What is carried stays where it is, dimmed, until it is let go. */
.fd-drag-carried { opacity: 0.35; }

/* ---- Advanced: widths ---- */
/* A picked part's width handle on its end edge: dragged, it snaps to the columns. */
.fd-width-handle {
  position: absolute; z-index: 9; width: 8px; height: 30px; border-radius: 4px; background: var(--fd-surface);
  box-shadow: 0 0 0 1.5px var(--fd-accent), 0 1px 3px rgba(15, 23, 42, 0.2); cursor: ew-resize; touch-action: none;
}
.fd-width-handle::after { content: ""; position: absolute; inset: 9px 3px; border-inline: 1px solid var(--fd-accent); }
/* The gutter between two parts of a row: a slim line in the gap, dragged or moved with the arrow keys to trade columns. */
.fd-gutter { position: absolute; z-index: 9; width: 12px; cursor: col-resize; touch-action: none; border-radius: 6px; }
.fd-gutter::before { content: ""; position: absolute; inset-block: 6px; inset-inline-start: 5px; width: 2px; border-radius: 2px; background: color-mix(in srgb, var(--fd-accent) 55%, transparent); }
.fd-gutter:hover::before, .fd-gutter:focus-visible::before { inset-inline-start: 4px; width: 4px; background: var(--fd-accent); }
.fd-gutter:focus-visible { outline: none; }
.fd-width-handle[hidden], .fd-gutter[hidden] { display: none; }
/* How many columns, while the edge or the gutter is dragged. */
.fd-width-chip {
  position: absolute; z-index: 32; pointer-events: none; background: var(--fd-text); color: var(--fd-surface);
  font-size: 12px; font-weight: 600; line-height: 1; padding: 6px 8px; border-radius: 6px; white-space: nowrap;
}

/* ---- Advanced: several picked ---- */
/* Each picked part tinted, with the room round it, as the field being edited is; a block picked alone too. */
.fd-canvas :is(.fd-canvas-picked:not(.fd-editing):not(.fd-canvas-selected), .fd-canvas-block.fd-canvas-selected) {
  background: color-mix(in srgb, var(--fd-accent) 9%, transparent); border-radius: 6px; box-shadow: 0 0 0 6px color-mix(in srgb, var(--fd-accent) 9%, transparent);
}
/* An arrangement picked: softly tinted, with the room round it, as the mockup marks a plain group. */
.fd-canvas .fd-canvas-arrangement.fd-canvas-selected { background: color-mix(in srgb, var(--fd-accent) 4%, transparent); border-radius: 6px; box-shadow: 0 0 0 8px color-mix(in srgb, var(--fd-accent) 4%, transparent); }
/* The bar at the top of the canvas as it scrolls, under the designer's own bar as the rails are, taking no room. */
.fd-multi-dock { position: sticky; top: 76px; z-index: 40; height: 0; display: flex; justify-content: center; align-items: flex-start; }
.fd-multi {
  display: flex; align-items: center; gap: 4px; margin-block-start: -12px; padding: 5px 6px 5px 12px; max-width: calc(100% - 24px); overflow-x: auto;
  background: var(--fd-text); color: var(--fd-surface); border-radius: 10px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25); font-size: 13px; white-space: nowrap;
}
.fd-multi[hidden] { display: none; }
.fd-multi-count { margin-inline-end: 6px; }
.fd-multi-button { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 3px 9px; border-radius: 7px; cursor: pointer; }
.fd-multi-button:hover { background: rgba(127, 127, 127, 0.28); }
.fd-multi-button:focus-visible { outline: 2px solid var(--fd-surface); outline-offset: 1px; }
.fd-multi-button[hidden] { display: none; }
.fd-multi-down > svg { rotate: 45deg; }
.fd-multi-why { opacity: 0.75; font-size: 12px; padding-inline: 6px; }
.fd-multi-why[hidden] { display: none; }

/* ---- Advanced: the keyboard ---- */
/* What a key just did, said to a screen reader and not shown. */
.fd-canvas-said { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
/* The keys, behind a small "?" in the canvas's corner; Advanced only. */
.fd-canvas-help { position: absolute; z-index: 35; inset-block-start: 6px; inset-inline-end: 8px; }
.fd-canvas:not([data-mode="advanced"]) > .fd-canvas-help { display: none; }
.fd-canvas-help-button {
  all: unset; box-sizing: border-box; display: grid; place-items: center; width: 22px; height: 22px; margin-inline-start: auto; border-radius: 50%;
  border: 1px solid var(--fd-border); color: var(--fd-muted); font-size: 12px; font-weight: 700; cursor: pointer; background: var(--fd-surface);
}
.fd-canvas-help-button:hover, .fd-canvas-help-button[aria-expanded="true"] { color: var(--fd-text); border-color: var(--fd-border-strong); }
.fd-canvas-help-button:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-canvas-keys {
  position: absolute; inset-inline-end: 0; inset-block-start: 28px; width: max-content; max-width: min(420px, 80vw); margin: 0; padding: 10px 12px;
  display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: 8px;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.16); font-size: 12.5px;
}
.fd-canvas-keys[hidden] { display: none; }
.fd-canvas-keys dt { font-weight: 650; white-space: nowrap; }
.fd-canvas-keys dd { margin: 0; color: var(--fd-muted); }
`;
