/**
 * The business widgets' part of the stylesheet: the title's line, a state's
 * dot and its menu, a range of dates and a document shown inline. Scoped, and
 * written with logical properties, as the rest of it is; it comes after the
 * inputs' part. The business part's widgets — a statusbar, priority stars, an
 * analytic distribution, tax totals, payments, a value to copy and a running
 * timer — bring their rules with them (styles-business-part.ts); a colour's
 * and properties' come with their kinds in the survey part (styles-survey.ts).
 */
export const BUSINESS_CSS = /* css */ `
/* ---- business widgets ------------------------------------------------------- */
/* Fields on the title's line: a priority star before the name, a state's dot after it; the name keeps the room and its big words. */
.fd-title-line { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; min-width: 0; }
/* On a phone the name takes a row of its own rather than be cut. */
.fd-title-line > .fd-title-name { flex: 1 1 18em; min-width: 0; }
.fd-title-line > .fd-title-name .fd-input { font-size: 24px; font-weight: 600; min-height: 40px; }
/* A read-only name on the title's line reads as the title too, as it does alone. */
.fd-title-line > .fd-title-name > .fd-read-text { font-size: 24px; font-weight: 600; line-height: 1.25; }
.fd-form .fd-title-line > .fd-field { grid-template-columns: minmax(0, 1fr); }
.fd-form .fd-title-line > .fd-field > * { grid-column: 1 !important; }
.fd-form .fd-title-line > .fd-title-side { display: flex; align-items: center; flex: none; }
.fd-title-line > .fd-field > .fd-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
/* A state's dot: grey, red, green…, in the state's tone; its menu floats under it. */
.fd-dot-box { position: relative; display: inline-flex; align-items: center; gap: 6px; }
.fd-dot-button { display: inline-grid; place-items: center; width: 24px; height: 24px; padding: 0; border: none; border-radius: 50%; background: none; cursor: pointer; }
.fd-dot-button:hover:not(:disabled) { background: var(--fd-accent-soft); }
.fd-dot-button:disabled { cursor: default; }
.fd-dot { display: inline-block; width: 12px; height: 12px; flex: none; border-radius: 50%; background: var(--fd-dot, var(--fd-border-strong)); }
.fd-dot-button[data-tone="muted"], .fd-dot-item[data-tone="muted"] { --fd-dot: var(--fd-border-strong); }
.fd-dot-button[data-tone="danger"], .fd-dot-item[data-tone="danger"] { --fd-dot: var(--fd-error); }
.fd-dot-button[data-tone="success"], .fd-dot-item[data-tone="success"] { --fd-dot: var(--fd-success); }
.fd-dot-button[data-tone="warning"], .fd-dot-item[data-tone="warning"] { --fd-dot: #d97706; }
.fd-dot-button[data-tone="info"], .fd-dot-item[data-tone="info"] { --fd-dot: var(--fd-info); }
.fd-dot-label { font-size: 13px; color: var(--fd-muted); }
.fd-dot-menu { position: absolute; top: calc(100% + 4px); inset-inline-start: 0; z-index: 30; min-width: 180px; padding: 4px; display: grid; background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 6px); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.16); }
.fd-dot-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 4px; cursor: pointer; white-space: nowrap; font-size: 14px; }
.fd-dot-item:hover, .fd-dot-item:focus { background: var(--fd-accent-soft); outline: none; }
.fd-dot-item[aria-checked="true"] { font-weight: 600; }
/* The state picked, ticked at the menu's end too: told by more than its weight. */
.fd-dot-item[aria-checked="true"]::after { content: "✓"; margin-inline-start: auto; padding-inline-start: 16px; color: var(--fd-accent); }
/* A range of dates: two boxes, from → to, in one row that wraps on a phone, its calendar under it marking the days between. */
.fd-range { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
/* Too narrow for a date and the calendar's button beside it, the button goes under: a date is never cut. */
.fd-range-box { flex: 1 1 8em; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; }
.fd-range-box > .fd-input { flex: 1 1 9em; min-width: 0; }
.fd-range-box > .fd-input.fd-range-input:is([data-kind="datetime"]) { flex-basis: 13em; }
/* Under the range, on a line of its own: a box's hint, and the end's own problem; nothing at all while there is none. */
.fd-range-notes { flex: 1 0 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
.fd-range-notes:not(:has(> :not([hidden]))) { display: none; }
.fd-range-notes > .fd-refusal-hint { margin: 0; }
.fd-range-arrow { flex: none; display: inline-block; color: var(--fd-muted); }
.fd-range-arrow:dir(rtl) { transform: scaleX(-1); }
.fd-range-calendar .fd-calendar-grid td button.fd-in-range { background: var(--fd-accent-soft); border-radius: 0; }
/* A document shown inline: the browser's own viewer, as wide as the field. */
.fd-embed { display: grid; gap: 8px; min-width: 0; }
.fd-embed-bar { display: flex; align-items: center; gap: 8px; min-width: 0; }
.fd-embed-bar > .fd-input { flex: 1 1 auto; min-width: 0; }
.fd-embed-open { flex: none; }
.fd-embed-frame { display: block; width: 100%; border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 4px); background: var(--fd-page); }
.fd-embed-none { padding: 24px 12px; text-align: center; color: var(--fd-muted); border: 1px dashed var(--fd-border); border-radius: max(var(--fd-control-radius), 4px); }

`;
