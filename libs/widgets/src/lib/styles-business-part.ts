import { installPartStyles, PART_RANK } from './styles';

/**
 * The business part's sheet (business-part.ts): a record's statusbar, priority
 * stars, an analytic distribution, tax totals, payments, a value to copy and a
 * running timer — put in its place
 * among Fieldia's the first time a page draws one (installPartStyles,
 * PART_RANK.business). Its rules stood in the main sheet before the quiet look
 * and the pickers', and none of the rules after them there reshapes what they
 * draw, so they win and lose as they did.
 */
export const BUSINESS_PART_CSS = /* css */ `
/* ---- a record's statusbar: its steps as arrows, the current one in the accent ----------------------- */
.fd-statusbar { display: flex; list-style: none; margin: 0; padding: 0; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline-start: 24px; scrollbar-width: none; }
.fd-statusbar::-webkit-scrollbar { display: none; }
.fd-statusbar:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
/* At rest on a step, never one cut mid-word; past an edge with more steps, a fade and a sign over it, in its frame. */
.fd-statusbar li { display: flex; scroll-snap-align: start; }
.fd-statusbar-frame { position: relative; display: flex; min-width: 0; max-width: 100%; }
.fd-statusbar-frame > .fd-statusbar { flex: 1 1 auto; min-width: 0; }
.fd-statusbar-frame[hidden] { display: none; }
.fd-statusbar-sign { position: absolute; inset-block: 0; z-index: 1; display: none; align-items: center; width: 24px; pointer-events: none; color: var(--fd-muted); font-size: 18px; line-height: 1; }
.fd-statusbar-sign[data-side="before"] { inset-inline-start: 0; padding-inline-start: 2px; }
.fd-statusbar-sign[data-side="after"] { inset-inline-end: 0; padding-inline-end: 2px; justify-content: flex-end; }
.fd-statusbar-sign[data-side="before"], .fd-statusbar-sign[data-side="after"]:dir(rtl) { background: linear-gradient(to left, transparent, var(--fd-surface) 60%); }
.fd-statusbar-sign[data-side="after"], .fd-statusbar-sign[data-side="before"]:dir(rtl) { background: linear-gradient(to right, transparent, var(--fd-surface) 60%); }
.fd-statusbar[data-more-before] ~ [data-side="before"], .fd-statusbar[data-more-after] ~ [data-side="after"] { display: flex; }
.fd-statusbar li > * {
  font: inherit; font-size: 13px; border: none; background: var(--fd-page); color: var(--fd-muted);
  padding: 5px 18px 5px 22px; margin-inline-start: -6px; white-space: nowrap;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
}
.fd-statusbar li:first-child > * { margin-inline-start: 0; padding-inline-start: 14px;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%); }
.fd-statusbar li > button { cursor: pointer; }
.fd-statusbar li > [aria-current="step"] { background: var(--fd-accent); color: var(--fd-accent-text); font-weight: 600; }
/* Right to left, the arrow is turned round, and its words turned back so they still read. */
[dir="rtl"] .fd-statusbar li > * { transform: scaleX(-1); }
[dir="rtl"] .fd-statusbar li > * > * { display: inline-block; transform: scaleX(-1); }
/* A statusbar's time spent in a step, after its words; its folded stages under More, in a menu fixed to the page so the bar's scrolling never cuts it. */
.fd-step-time { margin-inline-start: 6px; font-size: 11.5px; font-weight: 400; font-variant-numeric: tabular-nums; }
.fd-statusbar li.fd-step-more > button { padding-inline: 16px 20px; letter-spacing: 1px; }
.fd-statusbar li.fd-step-more > .fd-step-menu {
  position: fixed; z-index: 30; display: grid; min-width: 160px; margin: 0; padding: 4px 0; clip-path: none; transform: none;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 4px);
  box-shadow: 0 8px 24px rgba(15, 20, 25, 0.12); white-space: nowrap;
}
.fd-statusbar li.fd-step-more > .fd-step-menu[hidden] { display: none; }
.fd-statusbar .fd-step-menu > button {
  font: inherit; font-size: 13px; text-align: start; border: none; background: none; color: inherit; padding: 6px 14px; cursor: pointer; transform: none;
}
.fd-statusbar .fd-step-menu > button:hover:not(:disabled), .fd-statusbar .fd-step-menu > button:focus-visible { background: var(--fd-accent-soft); outline: none; }
.fd-statusbar .fd-step-menu > button:disabled { cursor: default; color: var(--fd-muted); }
/* ---- tax totals, a note under their boxes; then the rest of the business widgets ------------------------ */
/* A tax box's note, in a row of its own after the totals: the cell gives it no room of its own. */
.fd-tax-note-row > td { padding: 0; border: 0; }
/* Priority: grey stars, gold up to the one picked; hovered, they show what a click would pick. */
.fd-priority { display: inline-flex; align-items: center; gap: 1px; }
.fd-priority-star { border: none; background: none; padding: 0 1px; min-width: 0; font: inherit; font-size: 20px; line-height: 1; color: var(--fd-border-strong); cursor: pointer; }
.fd-priority-star.fd-on { color: #e8a317; }
.fd-priority:not(:has(:disabled)):hover .fd-priority-star { color: #e8a317; }
.fd-priority:not(:has(:disabled)) .fd-priority-star:hover ~ .fd-priority-star { color: var(--fd-border-strong); }
.fd-priority-star:disabled { cursor: default; }
/* On the title's line, a priority star as big as the name's words. */
.fd-title-line .fd-priority-star { font-size: 24px; }
/* An analytic distribution: lines of an account and its share, their total under them. */
.fd-distribution { display: grid; gap: 6px; min-width: 0; }
.fd-distribution-table .fd-distribution-share { width: 8.5em; }
.fd-distribution-table .fd-share { text-align: end; padding-inline-end: calc(var(--fd-pad-x) + 2ch); }
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
/* A value to copy: its box, the button after it. */
.fd-copy { display: flex; align-items: center; gap: 8px; min-width: 0; }
.fd-copy > .fd-input { flex: 1 1 auto; min-width: 0; }
.fd-copy-long { align-items: flex-start; }
.fd-copy-button { flex: none; }
/* A timer: its time in even digits, a green dot beating while it runs. */
.fd-timer { display: inline-flex; align-items: center; gap: 8px; font-variant-numeric: tabular-nums; font-weight: 600; direction: ltr; unicode-bidi: isolate; }
.fd-timer-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fd-border-strong); }
.fd-timer[data-running] .fd-timer-dot { background: var(--fd-success); animation: fd-timer-beat 1s ease-in-out infinite alternate; }
.fd-timer[data-running] .fd-timer-time { color: var(--fd-success); }
@keyframes fd-timer-beat { to { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .fd-timer[data-running] .fd-timer-dot { animation: none; } }
/* On paper: the stage the record is in, as words in the accent's ring — no arrows, no ground, the rest left out. */
@media print {
  .fd-form .fd-statusbar li:not(:has(> [aria-current="step"])) { display: none; }
  .fd-form .fd-statusbar li > [aria-current="step"], .fd-form .fd-statusbar li > [aria-current="step"] > * { transform: none; }
  .fd-form .fd-statusbar li > [aria-current="step"] { clip-path: none; margin: 0; padding: 2px 10px; background: none; color: var(--fd-accent); border: 1px solid; border-radius: 999px; }
  .fd-form .fd-statusbar-sign { display: none !important; }
}
`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installBusinessStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-business-styles', BUSINESS_PART_CSS, PART_RANK.business);
}
