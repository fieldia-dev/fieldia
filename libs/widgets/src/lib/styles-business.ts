/**
 * The business widgets' part of the stylesheet: priority stars, a state's
 * dot and its menu, a tag colour, a copy button, a range of dates, a running
 * timer, a document shown inline, an analytic distribution, tax totals and a
 * list of payments. Scoped, and written with logical properties, as the rest
 * of it is; it comes after the inputs' part.
 */
export const BUSINESS_CSS = /* css */ `
/* ---- business widgets ------------------------------------------------------- */
/* Priority: grey stars, gold up to the one picked; hovered, they show what a click would pick. */
.fd-priority { display: inline-flex; align-items: center; gap: 1px; }
.fd-priority-star { border: none; background: none; padding: 0 1px; min-width: 0; font: inherit; font-size: 20px; line-height: 1; color: var(--fd-border-strong); cursor: pointer; }
.fd-priority-star.fd-on { color: #e8a317; }
.fd-priority:not(:has(:disabled)):hover .fd-priority-star { color: #e8a317; }
.fd-priority:not(:has(:disabled)) .fd-priority-star:hover ~ .fd-priority-star { color: var(--fd-border-strong); }
.fd-priority-star:disabled { cursor: default; }
/* Fields on the title's line: a priority star before the name, a state's dot after it; the name keeps the room and its big words. */
.fd-title-line { display: flex; align-items: center; gap: 4px 10px; min-width: 0; }
.fd-title-line > .fd-title-name { flex: 1 1 auto; min-width: 0; }
.fd-title-line > .fd-title-name .fd-input { font-size: 24px; font-weight: 600; min-height: 40px; }
.fd-form .fd-title-line > .fd-field { grid-template-columns: minmax(0, 1fr); }
.fd-form .fd-title-line > .fd-field > * { grid-column: 1 !important; }
.fd-form .fd-title-line > .fd-title-side { display: flex; align-items: center; flex: none; }
.fd-title-line > .fd-field > .fd-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.fd-title-line .fd-priority-star { font-size: 24px; }
`;
