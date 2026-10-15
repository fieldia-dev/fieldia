/**
 * The date part (parts.ts): Fieldia's own box for a date, a date and time and
 * a time of day (date-box.ts) — its guard, what it keeps once left — with a
 * date's calendar (calendar.ts) and a range of dates on its own calendar
 * (date-range.ts). Loaded the first time a page shows one, through
 * `datePart`; a plain text box with the same reader meanwhile
 * (`plainDateWidget`, date-text.ts). The reader itself is the main script's:
 * a table's cell, a pasted block and a list's filter read dates with it. The
 * box's input rules (`dateRules`) guard any other box a date is typed into: a
 * designer's setting.
 */
export { dateBox, dateBoxWidget, dateRules, type DateBox, type DateBoxOptions } from './date-box';
export { weekdayHead, withCalendar, type CalendarOptions } from './calendar';
export { dateRangeWidget } from './date-range';
