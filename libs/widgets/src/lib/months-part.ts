/**
 * The months part (parts.ts): a date of a month alone or a year alone (its field's `precision`) and a date shown and
 * typed in the Hijri calendar beside its Gregorian day (`hijri`) — how a month's text is read and written (date-grain.ts),
 * Umm al-Qura's days by Intl (hijri.ts), the Hijri box (hijri-box.ts), their calendars (months-calendar.ts) and their
 * sheet (styles-months.ts). Loaded with the date part the first time a page shows such a date, through `monthsPart`:
 * the date part's box and calendar draw from it (`monthsPartIn`). What every page needs of them — a month's or a year's
 * limits, a month, a year and a Hijri day written where a value is read — is the main script's.
 */
export { grainBox, readGrainText, grainTyping, grainResting, type Grain } from './date-grain';
export { hijriOf, gregorianOf, readHijriText, hijriTyping, hijriResting, type HijriDay } from './hijri';
export { hijriBox, hijriPair, type HijriBox, type HijriBoxOptions } from './hijri-box';
export { periodCalendar, hijriCalendar } from './months-calendar';
export { installMonthsStyles } from './styles-months';
