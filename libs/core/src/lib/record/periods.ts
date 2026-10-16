/**
 * Days counted as a list counts them: the days of a period its filter names
 * ("This week", "Last 30 days", "Overdue"), and the span a date falls in when
 * the list is grouped by it (its week, month, quarter or year). A date
 * field's value is its day ("2026-10-14"); a date and time's is an instant
 * ("2026-10-14T07:40:00.000Z"), which falls on the day it is where the page
 * is: in the time zone given, or the computer's own. Days are counted by the
 * calendar, never by adding hours, so a change of the clocks moves no day.
 *
 * Here, what both a list and a data source count: a day where a time zone
 * says, a day's first moment there, and the span a value falls in — the
 * memory data source groups by it, as a backend groups by its own. The list
 * part counts a period's days and asks for them (list-days.ts in
 * @fieldia/viewer).
 */

import { clocksSkip, dayIn as zoneDay, instantsAt, isTimeZone, wallOf, zoneOffset, type WallTime } from './zones';

/** The periods a list's filter can name, counted from the day the list is looked at. */
export const DATE_PERIODS = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear', 'last7Days', 'last30Days', 'overdue'] as const;
export type DatePeriod = (typeof DATE_PERIODS)[number];

/** The spans a date's records can be grouped in. */
export const DATE_INTERVALS = ['day', 'week', 'month', 'quarter', 'year'] as const;
export type DateInterval = (typeof DATE_INTERVALS)[number];

/**
 * How days are counted: the day a week starts on, 0 Sunday to 6 Saturday
 * (Monday unless said), and the time zone a date and time's day is told in
 * (IANA: "Africa/Cairo"; the computer's own unless said).
 */
export interface DayCount {
  weekStart?: number;
  timeZone?: string;
}

/** A day by its numbers, the month from 1, rolled over as the calendar rolls: month 13 is next January, day 0 the last of the month before. */
const dayAt = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const numbersOf = (day: string) => day.split('-').map(Number) as [number, number, number];

/** A day `n` days on from another (back, for less than 0). */
export const addDays = (day: string, n: number): string => {
  const [y, m, d] = numbersOf(day);
  return dayAt(y, m, d + n);
};

/** A zone this browser knows, else none — the computer's own: a source's request may name any. */
const known = (timeZone?: string) => (timeZone && isTimeZone(timeZone) ? timeZone : undefined);

/** The day an instant falls on, where the time zone says (zones.ts `dayIn`, the computer's own for a zone it does not know). */
export const dayIn = (at: Date | number, timeZone?: string): string => zoneDay(at, known(timeZone));

/**
 * A day's first moment where the time zone says, as an instant written as a
 * date and time field keeps one ("2026-10-13T21:00:00.000Z" for 14 October in
 * Cairo): its midnight, the first of two where the clocks go back across it,
 * or the moment they go forward on a day they skip midnight.
 */
export function dayStarts(day: string, timeZone?: string): string {
  const zone = known(timeZone);
  const midnight = wallOf(day) as WallTime;
  const [first] = instantsAt(midnight, zone);
  if (first !== undefined) return new Date(first).toISOString();
  const skip = clocksSkip(midnight, zone);
  return new Date(skip ? instantsAt(skip.to, zone)[0] : Date.UTC(midnight.year, midnight.month - 1, midnight.day) - zoneOffset(Date.UTC(midnight.year, midnight.month - 1, midnight.day), zone) * 60000).toISOString();
}

/** Its day of the week, 0 Sunday to 6 Saturday. */
const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

/**
 * The first day of the span a date or a date and time falls in — its day,
 * week, month, quarter or year — where `count` says: "2026-03-01" for any
 * day of March 2026. Null for a value that is no date.
 */
export function spanStart(value: unknown, interval: DateInterval, count: DayCount = {}): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}([T ]|$)/.test(value)) return null;
  let day = value;
  if (value.length > 10) {
    const at = Date.parse(value.replace(' ', 'T'));
    if (Number.isNaN(at)) return null;
    day = dayIn(at, count.timeZone);
  }
  const [y, m] = numbersOf(day);
  switch (interval) {
    case 'day':
      return day;
    case 'week':
      return addDays(day, -((weekday(day) - (count.weekStart ?? 1) + 7) % 7));
    case 'month':
      return dayAt(y, m, 1);
    case 'quarter':
      return dayAt(y, m - ((m - 1) % 3), 1);
    case 'year':
      return dayAt(y, 1, 1);
  }
}
