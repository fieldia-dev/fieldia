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
/* A colour: a swatch of it, and a palette of Flectra's twelve under it; none is a crossed-out square. */
.fd-colour-box { position: relative; display: inline-flex; align-items: center; gap: 8px; }
.fd-colour-button, .fd-colour { width: 24px; height: 24px; padding: 0; border: 1px solid var(--fd-border-strong); border-radius: 4px; background: var(--fd-swatch, transparent); cursor: pointer; }
.fd-colour-button:disabled { cursor: default; }
.fd-colour-none, .fd-colour[data-colour="0"] { background: linear-gradient(to top right, transparent calc(50% - 1px), var(--fd-error) calc(50% - 1px), var(--fd-error) calc(50% + 1px), transparent calc(50% + 1px)); }
.fd-colour-palette { position: absolute; top: calc(100% + 4px); inset-inline-start: 0; z-index: 30; display: grid; grid-template-columns: repeat(6, 24px); gap: 6px; padding: 8px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 6px); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.16); }
.fd-colour[aria-checked="true"] { box-shadow: 0 0 0 2px var(--fd-surface), 0 0 0 4px var(--fd-accent); }
.fd-colour-input { width: 44px; height: 30px; padding: 2px; border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); background: var(--fd-surface); }
.fd-colour-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: var(--fd-muted); }
/* A value to copy: its box, the button after it. */
.fd-copy { display: flex; align-items: center; gap: 8px; min-width: 0; }
.fd-copy > .fd-input { flex: 1 1 auto; min-width: 0; }
.fd-copy-long { align-items: flex-start; }
.fd-copy-button { flex: none; }
/* A range of dates: two boxes, from → to, in one row that wraps on a phone, its calendar under it marking the days between. */
.fd-range { position: relative; display: flex; align-items: center; gap: 6px; min-width: 0; }
.fd-range-box { flex: 1 1 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; }
.fd-range-box > .fd-input { flex: 1 1 9em; min-width: 0; }
.fd-range-arrow { flex: none; display: inline-block; color: var(--fd-muted); }
.fd-range-arrow:dir(rtl) { transform: scaleX(-1); }
.fd-range-calendar .fd-calendar-grid td button.fd-in-range { background: var(--fd-accent-soft); border-radius: 0; }
/* A timer: its time in even digits, a green dot beating while it runs. */
.fd-timer { display: inline-flex; align-items: center; gap: 8px; font-variant-numeric: tabular-nums; font-weight: 600; direction: ltr; unicode-bidi: isolate; }
.fd-timer-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fd-border-strong); }
.fd-timer[data-running] .fd-timer-dot { background: var(--fd-success); animation: fd-timer-beat 1s ease-in-out infinite alternate; }
.fd-timer[data-running] .fd-timer-time { color: var(--fd-success); }
@keyframes fd-timer-beat { to { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .fd-timer[data-running] .fd-timer-dot { animation: none; } }
/* A document shown inline: the browser's own viewer, as wide as the field. */
.fd-embed { display: grid; gap: 8px; min-width: 0; }
.fd-embed-bar { display: flex; align-items: center; gap: 8px; min-width: 0; }
.fd-embed-bar > .fd-input { flex: 1 1 auto; min-width: 0; }
.fd-embed-open { flex: none; }
.fd-embed-frame { display: block; width: 100%; border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 4px); background: var(--fd-page); }
.fd-embed-none { padding: 24px 12px; text-align: center; color: var(--fd-muted); border: 1px dashed var(--fd-border); border-radius: max(var(--fd-control-radius), 4px); }
/* An analytic distribution: lines of an account and its share, their total under them. */
.fd-distribution { display: grid; gap: 6px; min-width: 0; }
.fd-distribution-table .fd-distribution-share { width: 8.5em; }
.fd-distribution-table .fd-share { text-align: end; }
.fd-distribution-total { font-weight: 600; text-align: end; padding-inline-end: calc(var(--fd-pad-x) + 2ch + 4px); font-variant-numeric: tabular-nums; }
.fd-distribution-add { justify-self: start; }
/* Tax totals: words at the start, amounts at the end in even digits, the total in bold over a rule. */
.fd-tax-totals { justify-self: end; border-collapse: collapse; min-width: min(100%, 320px); font-variant-numeric: tabular-nums; }
.fd-tax-totals th { text-align: start; font-weight: 400; color: var(--fd-muted); padding: 3px 16px 3px 0; padding-inline: 0 16px; }
.fd-tax-totals td { text-align: end; padding: 3px 0; white-space: nowrap; }
.fd-tax-totals .fd-tax-subtotal th { color: var(--fd-text); }
.fd-tax-totals .fd-tax-total :is(th, td) { font-weight: 700; color: var(--fd-text); font-size: 15px; border-top: 1px solid var(--fd-border); padding-top: 6px; }
.fd-tax-totals .fd-input { width: 9em; text-align: end; }
/* Payments: each one's button, "Paid on …" and its amount; its details in a small box under it; the amount due in bold. */
.fd-payments { display: grid; gap: 6px; justify-self: end; min-width: min(100%, 320px); font-variant-numeric: tabular-nums; }
.fd-payments-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.fd-payment { position: relative; display: flex; align-items: center; gap: 8px; }
.fd-payment-info { flex: none; width: 20px; height: 20px; padding: 0; border: 1px solid var(--fd-border-strong); border-radius: 50%; background: var(--fd-surface); color: var(--fd-muted); font: italic 600 12px/1 Georgia, serif; cursor: pointer; }
.fd-payment-info:hover, .fd-payment-info[aria-expanded="true"] { color: var(--fd-accent); border-color: var(--fd-accent); }
.fd-payment-date { flex: 1 1 auto; font-style: italic; color: var(--fd-muted); }
.fd-payment-amount { white-space: nowrap; }
.fd-payment-details { position: absolute; top: calc(100% + 4px); inset-inline-start: 0; z-index: 30; min-width: 240px; display: grid; gap: 6px; padding: 10px 12px; background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 6px); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.16); }
.fd-payment-details dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0; }
.fd-payment-details dt { color: var(--fd-muted); }
.fd-payment-details dd { margin: 0; }
.fd-payment-open { justify-self: start; }
.fd-payment-due { display: flex; justify-content: space-between; gap: 16px; padding-top: 6px; border-top: 1px solid var(--fd-border); font-weight: 600; }
/* Properties: in two columns when asked, one on a narrow form; adding one in place, its name and kind in a row. */
.fd-properties-list { display: grid; gap: 8px; min-width: 0; }
.fd-properties[data-columns="2"] > .fd-properties-list { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 24px; }
@container (max-width: 520px) { .fd-properties[data-columns="2"] > .fd-properties-list { grid-template-columns: minmax(0, 1fr); } }
.fd-property-add { justify-self: start; }
.fd-property-new { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.fd-property-new > .fd-input { flex: 1 1 10em; width: auto; }
`;
