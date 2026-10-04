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
`;
