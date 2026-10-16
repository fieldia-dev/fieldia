import { installPartStyles, PART_RANK } from './styles';

/**
 * Booking slots (slots.ts): a month whose days are shaded by how they are
 * booked, beside the chosen day's free times as chips. The slots part's sheet,
 * put in its place among Fieldia's the first time a page draws one
 * (installPartStyles, PART_RANK.slots). The month's head and grid are a date's
 * calendar's (`.fd-calendar-head`, `.fd-calendar-grid`), which every page has.
 */
export const SLOTS_CSS = /* css */ `
/* ---- booking slots: the month, the day's free times as chips, the booking chosen, the zone -------------------- */
.fd-slots { display: grid; gap: 8px; min-width: 0; }
.fd-slots-picker { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px 20px; min-width: 0; }
.fd-slots-picker[hidden] { display: none; }
.fd-slots-month {
  flex: 0 0 auto; max-width: 100%; padding: 8px; background: var(--fd-surface);
  border: 1px solid var(--fd-border); border-radius: max(var(--fd-control-radius), 6px);
}
.fd-slots[aria-invalid="true"] .fd-slots-month { border-color: var(--fd-error); }
.fd-slots-step { border: none; background: none; cursor: pointer; font-size: 18px; line-height: 1; padding: 4px 8px; border-radius: 4px; color: var(--fd-text); }
.fd-slots-step:hover { background: var(--fd-page); }
.fd-slots-step:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-slots-days[aria-busy="true"] tbody { opacity: 0.6; }
/* Days shaded by how they are booked: free times left, fully booked (hatched), closed or gone by (faint), a holiday. */
.fd-slots-days td button[data-state="open"] { background: var(--fd-accent-soft); font-weight: 600; }
.fd-slots-days td button[data-state="full"] {
  color: var(--fd-muted);
  background: repeating-linear-gradient(135deg, transparent 0 3px, color-mix(in srgb, var(--fd-muted) 28%, transparent) 3px 4px);
}
/* Closed, gone by, or of the month before or after: the muted words, never fainter, which a person must still read. */
.fd-slots-days td button:is([data-state="closed"], [data-state="past"], .fd-outside) { color: var(--fd-muted); opacity: 1; }
.fd-slots-days td button[data-state="holiday"] { color: var(--fd-warning); background: var(--fd-warning-soft); }
.fd-slots-days td button[aria-pressed="true"] { background: var(--fd-accent); color: var(--fd-accent-text); }
.fd-slots-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; max-width: 17em; margin-block-start: 6px; font-size: 12px; color: var(--fd-muted); }
.fd-slots-legend > span::before {
  content: ""; display: inline-block; width: 10px; height: 10px; margin-inline-end: 5px; vertical-align: -1px;
  border-radius: 3px; border: 1px solid var(--fd-border);
}
.fd-slots-legend > [data-state="open"]::before { background: var(--fd-accent-soft); }
.fd-slots-legend > [data-state="full"]::before { background: repeating-linear-gradient(135deg, transparent 0 2px, color-mix(in srgb, var(--fd-muted) 40%, transparent) 2px 3px); }
.fd-slots-legend > [data-state="closed"]::before { background: var(--fd-surface); }
.fd-slots-legend > [data-state="holiday"]::before { background: var(--fd-warning-soft); }
.fd-slots-times { flex: 1 1 14em; min-width: 0; display: grid; align-content: start; gap: 8px; }
.fd-slots-heading { margin: 0; font-weight: 600; }
.fd-slots-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.fd-slots-chips:empty { display: none; }
.fd-slots-chip {
  min-width: 4.75em; padding: 5px 10px; font: inherit; font-size: 13px; font-variant-numeric: tabular-nums; cursor: pointer;
  color: var(--fd-text); background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: 999px;
}
.fd-slots-chip:hover { border-color: var(--fd-accent); background: var(--fd-accent-soft); }
.fd-slots-chip:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-slots-chip[aria-pressed="true"] { color: var(--fd-accent-text); background: var(--fd-accent); border-color: var(--fd-accent); font-weight: 600; }
.fd-slots-chip[aria-busy="true"] { opacity: 0.6; cursor: progress; }
.fd-slots-note { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 0; font-size: 12.5px; line-height: 1.4; color: var(--fd-muted); }
.fd-slots-note:has(> .fd-slots-said:empty):has(> .fd-slots-retry[hidden]) { display: none; }
.fd-slots-note[data-tone="warning"] { padding: 4px 8px; color: var(--fd-warning); background: var(--fd-warning-soft); border-radius: var(--fd-control-radius); }
.fd-slots-retry { font-size: 12.5px; padding: 2px 10px; }
.fd-slots-chosen { margin: 0; font-weight: 600; }
.fd-slots-zone { margin: 0; font-size: 12px; color: var(--fd-muted); }
:is(.fd-slots-chosen, .fd-slots-zone, .fd-slots-retry)[hidden] { display: none; }
`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installSlotsStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-slots-styles', SLOTS_CSS, PART_RANK.slots);
}
