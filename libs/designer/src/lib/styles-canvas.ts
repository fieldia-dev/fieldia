/**
 * The Advanced canvas's own styles: what keeps the canvas drawing each part
 * where the form puts it, and the marks of Advanced — the drop line and the
 * group tinted under it, the chip that says where, the width handle and the
 * gutter between two parts, the guides of a grid's columns, the bar for
 * several picked, the handle the canvas's own width is dragged by, and the
 * note Simple mode shows on an arrangement.
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
/* 24px wide, a target a finger can hit (WCAG 2.5.8); the line drawn down its middle. */
.fd-gutter { position: absolute; z-index: 9; width: 24px; cursor: col-resize; touch-action: none; border-radius: 6px; }
/* While a part is carried, what floats over the parts lets the pointer through: a drop at a picked part's edge goes beside it, not onto its handle. */
.fd-canvas.fd-dragging :is(.fd-width-handle, .fd-gutter, .fd-field-bar, .fd-canvas-resize) { pointer-events: none; }
.fd-gutter::before { content: ""; position: absolute; inset-block: 6px; inset-inline-start: 11px; width: 2px; border-radius: 2px; background: color-mix(in srgb, var(--fd-accent) 55%, transparent); }
.fd-gutter:hover::before, .fd-gutter:focus-visible::before { inset-inline-start: 10px; width: 4px; background: var(--fd-accent); }
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
.fd-multi-dock { position: sticky; top: var(--fd-bar-room, 76px); z-index: 40; height: 0; display: flex; justify-content: center; align-items: flex-start; }
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
/* The keys, behind a small "?" at the stage's end. */
.fd-canvas-help { position: relative; z-index: 35; margin-inline-start: auto; }
.fd-canvas-help-button {
  all: unset; box-sizing: border-box; display: grid; place-items: center; width: 22px; height: 22px; margin-inline-start: auto; border-radius: 50%;
  color: var(--fd-muted); font-size: 12px; font-weight: 700; cursor: pointer; background: var(--fd-page);
}
/* Filled, not ringed: a ring so near the canvas's own border would read as a box in a box. */
.fd-canvas-help-button:hover, .fd-canvas-help-button[aria-expanded="true"] { color: var(--fd-text); background: color-mix(in srgb, var(--fd-text) 10%, var(--fd-page)); }
.fd-canvas-help-button:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-canvas-keys {
  position: absolute; inset-inline-end: 0; inset-block-start: 28px; width: max-content; max-width: min(420px, 80vw); margin: 0; padding: 10px 12px;
  display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: 8px;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.16); font-size: 12.5px;
}
.fd-canvas-keys[hidden] { display: none; }
.fd-canvas-keys dt { font-weight: 650; white-space: nowrap; }
.fd-canvas-keys dd { margin: 0; color: var(--fd-muted); }

/* ---- Advanced: the guides ---- */
/* The columns of the grid a picked part sits on: tinted bands under the parts, laid out as the grid's own columns, numbered. */
.fd-canvas .fd-grid:has(> .fd-guides) { position: relative; }
.fd-canvas .fd-grid:has(> .fd-guides) > [data-node] { position: relative; z-index: 1; }
.fd-guides {
  position: absolute; inset: 0; z-index: 0; pointer-events: none; display: grid;
  grid-template-columns: repeat(var(--fd-cols, 1), minmax(0, 1fr)); column-gap: var(--fd-gap-x);
}
.fd-guides > i { position: relative; border-radius: 4px; background: color-mix(in srgb, var(--fd-accent) 7%, transparent); }
/* Twelfths: twelve thin tracks, fainter, with no numbers. */
.fd-guides-fine > i { border-radius: 2px; background: color-mix(in srgb, var(--fd-accent) 4.5%, transparent); }
.fd-guides > i::after {
  content: attr(data-n); position: absolute; inset-block-start: -15px; inset-inline-start: 50%; translate: -50% 0;
  font: 600 10px/1 system-ui, sans-serif; font-style: normal; color: color-mix(in srgb, var(--fd-accent) 70%, var(--fd-muted));
}

/* ---- Advanced: the stage — the size of screen shown, and the keys ---- */
/* Room under the screen sizes for the bar of a field picked in the first group's first row, lifted over the group's name. */
.fd-canvas-stage { display: flex; align-items: center; gap: 8px; margin-block-end: 16px; }
.fd-canvas:not([data-mode="advanced"]) > .fd-canvas-stage { display: none; }
.fd-canvas-sizes { display: inline-flex; padding: 2px; border-radius: 9px; background: var(--fd-page); border: 1px solid var(--fd-border); }
.fd-canvas-size {
  all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 7px;
  font-size: 12.5px; font-weight: 600; color: var(--fd-muted); cursor: pointer;
}
.fd-canvas-size[aria-pressed="true"] { background: var(--fd-surface); color: var(--fd-text); box-shadow: 0 1px 2px rgba(15, 20, 25, 0.12); }
.fd-canvas-size:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
/* Pictures only where the canvas has no room for their names. */
@container (max-width: 520px) { .fd-canvas-size-name { display: none; } }
/* On a tablet or a phone, the canvas is as wide as one. */
.fd-canvas[data-size="tablet"] { width: 100%; max-width: 768px; margin-inline: auto; }
.fd-canvas[data-size="phone"] { width: 100%; max-width: 390px; margin-inline: auto; }

/* ---- Advanced: a width of the canvas's own ---- */
/* Dragged or keyed to: as wide as that, never wider than the stage, in its middle as a tablet's is. */
.fd-canvas[data-mode="advanced"][data-width] { width: var(--fd-canvas-width); max-width: 100%; margin-inline: auto; }
/* The width beside the switch, once the canvas has one of its own. */
/* Its words, and the chip's, run the way they are written — "640 px" stays so on a right-to-left page. */
.fd-canvas-size-px { font-size: 12.5px; font-weight: 600; color: var(--fd-muted); font-variant-numeric: tabular-nums; white-space: nowrap; unicode-bidi: plaintext; }
.fd-canvas-size-px[hidden] { display: none; }
/* The handle: the canvas's whole end edge takes the pointer, 24px wide (WCAG 2.5.8), inside the canvas so the page is never
   wider for it; its grip stays in the middle of what is in view. */
.fd-screen-designer { container-name: fd-designer; }
.fd-canvas-resize { position: absolute; z-index: 4; inset-block: 0; inset-inline-end: 0; width: 24px; cursor: ew-resize; touch-action: none; user-select: none; -webkit-user-select: none; }
.fd-canvas:not([data-mode="advanced"]) > .fd-canvas-resize { display: none; }
/* A designer narrower than a tablet shows the canvas as wide as it is: no handle, and no width of its own to note. */
@container fd-designer (max-width: 767px) { .fd-canvas-resize, .fd-canvas-size-px { display: none; } }
.fd-canvas-resize:focus-visible { outline: none; }
/* The edge itself, drawn over the canvas's border while the handle is pointed at, focused or dragged. */
.fd-canvas-resize::before { content: ""; position: absolute; inset-block: 0; inset-inline-end: -1px; width: 2px; background: transparent; transition: background 120ms; }
.fd-canvas-resize:is(:hover, :focus-visible, [data-active])::before { background: var(--fd-accent); }
.fd-canvas-resize-grip {
  position: sticky; top: calc(50vh - 20px); display: block; width: 8px; height: 40px; margin-inline: auto 3px; border-radius: 4px;
  background: var(--fd-surface); box-shadow: 0 0 0 1.5px var(--fd-border-strong), 0 1px 3px rgba(15, 23, 42, 0.16);
}
.fd-canvas-resize-grip::after { content: ""; position: absolute; inset: 13px 2px; border-inline: 1px solid var(--fd-muted); }
.fd-canvas-resize:is(:hover, :focus-visible, [data-active]) .fd-canvas-resize-grip { box-shadow: 0 0 0 1.5px var(--fd-accent), 0 1px 3px rgba(15, 23, 42, 0.2); }
.fd-canvas-resize:is(:hover, :focus-visible, [data-active]) .fd-canvas-resize-grip::after { border-color: var(--fd-accent); }
.fd-canvas-resize:focus-visible .fd-canvas-resize-grip { outline: 2px solid var(--fd-focus); outline-offset: 3px; }
/* The width and the size the form takes it for, beside the grip while it moves. */
.fd-canvas-resize-chip {
  position: absolute; inset-inline-end: calc(100% + 10px); top: 50%; translate: 0 -50%; display: none; pointer-events: none;
  background: var(--fd-text); color: var(--fd-surface); font-size: 12px; font-weight: 600; line-height: 1; padding: 6px 8px; border-radius: 6px;
  white-space: nowrap; font-variant-numeric: tabular-nums; unicode-bidi: plaintext;
}
.fd-canvas-resize[data-active] .fd-canvas-resize-chip { display: block; }
@media (prefers-reduced-motion: reduce) { .fd-canvas-resize::before { transition: none; } }
`;
