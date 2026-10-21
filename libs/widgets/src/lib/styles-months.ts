import { installPartStyles, PART_RANK } from './styles';

/**
 * What a date's calendar and box add for a month alone, a year alone and the Hijri calendar (date-grain.ts,
 * hijri-box.ts): a year's twelve months, or twelve years, three to a row; a Hijri date's day small under each day; and
 * its Hijri box beside its date's, under it where the row is narrow. The months part's sheet, put in its place among
 * Fieldia's the first time a page draws one (installPartStyles, PART_RANK.months); the calendar itself and the boxes are
 * the main sheet's.
 */
export const MONTHS_CSS = /* css */ `
/* ---- a month alone or a year alone: a year's twelve months, or twelve years, three to a row ------------------------ */
.fd-calendar-periods td button { width: 64px; height: 36px; }
/* ---- a Hijri date: each day's Hijri day small under it; its box beside the date's, under it where narrow ----------- */
.fd-calendar-hijris td button { height: 36px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
.fd-calendar-hijri { font-size: 9.5px; color: var(--fd-muted); }
.fd-calendar-grid td button[aria-selected="true"] .fd-calendar-hijri { color: inherit; }
.fd-date-hijri { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-width: 0; }
.fd-date-hijri > * { flex: 1 1 12em; min-width: 0; }
`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installMonthsStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-months-styles', MONTHS_CSS, PART_RANK.months);
}
