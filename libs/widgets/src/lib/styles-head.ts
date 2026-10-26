/**
 * What every page has of a work item's head: a field's access key, underlined
 * in its label; a lock at a value's start, outside a head's band; and the
 * focus ring of the head's controls and its dialog's. The head itself, its
 * band, its buttons and the inset dialog are the head part's
 * (@fieldia/viewer's head-styles.ts), loaded the first time a page draws one.
 */
export const HEAD_CSS = /* css */ `
/* ---- a field's access key and a lock at its value ---------------------------------------- */
.fd-access-key { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
/* A lock at the value's start, outside a head's band (which has a lead slot for it): before the value, on its row. The
   field says its lock shows (data-lock-shown, the viewer's) — a :has() there made every change in a form lay it all out. */
.fd-form .fd-field[data-lock-at="value"][data-lock-shown]:not(.fd-head-fields > *) { grid-template-columns: auto minmax(0, 1fr); column-gap: 6px; }
.fd-form .fd-field[data-lock-at="value"][data-lock-shown]:not(.fd-head-fields > *) > * { grid-column: 1 / -1; }
.fd-form .fd-field[data-lock-at="value"][data-lock-shown]:not(.fd-head-fields > *) > .fd-lock-wrap { grid-column: 1; align-self: center; margin: 0; }
/* Its value beside it: the widget, or the words a locked value reads as (readonlyShown "text") after the widget it hides. */
.fd-form .fd-field[data-lock-at="value"][data-lock-shown]:not(.fd-head-fields > *) > .fd-lock-wrap + :not([hidden]),
.fd-form .fd-field[data-lock-at="value"][data-lock-shown]:not(.fd-head-fields > *) > .fd-lock-wrap + [hidden] + .fd-read-text { grid-column: 2; }

/* ---- focus: every control of the head and its dialog ringed in the focus colour, inside its box where it fills one ---- */
:is(.fd-head, .fd-split, .fd-form-dialog) :is(.fd-button, .fd-head-link, .fd-head-updated):focus-visible { outline: 2px solid var(--fd-focus, var(--fd-accent)); outline-offset: 1px; }
:is(.fd-form-dialog :is(.fd-dialog-max, .fd-dialog-close), .fd-dialog-grip, .fd-head-copy, .fd-head-tabs .fd-tab):focus-visible { outline: 2px solid var(--fd-focus, var(--fd-accent)); outline-offset: -2px; }

`;
