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
`;
