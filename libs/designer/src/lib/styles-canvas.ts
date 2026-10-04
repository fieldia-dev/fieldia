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
`;
