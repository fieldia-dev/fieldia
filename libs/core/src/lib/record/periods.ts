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

const pad = (n: number) => String(n).padStart(2, '0');
/** A day by its numbers, the month from 1, rolled over as the calendar rolls: month 13 is next January, day 0 the last of the month before. */
const dayAt = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const numbersOf = (day: string) => day.split('-').map(Number) as [number, number, number];

/** A day `n` days on from another (back, for less than 0). */
export const addDays = (day: string, n: number): string => {
  const [y, m, d] = numbersOf(day);
  return dayAt(y, m, d + n);
};

const zones = new Map<string, Intl.DateTimeFormat | null>();
/** The year, month, day, hour, minute and second an instant is in a time zone; null for a zone no browser knows. */
function wallClock(at: number, timeZone: string): number[] | null {
  let format = zones.get(timeZone);
  if (format === undefined) {
    try {
      format = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    } catch {
      format = null;
    }
    zones.set(timeZone, format);
  }
  if (!format) return null;
  const got: Record<string, number> = {};
  for (const part of format.formatToParts(at)) if (part.type !== 'literal') got[part.type] = Number(part.value);
  return [got['year'], got['month'], got['day'], got['hour'] % 24, got['minute'], got['second']];
}

/** The day an instant falls on, where the time zone says. */
export function dayIn(at: Date | number, timeZone?: string): string {
  const time = typeof at === 'number' ? at : at.getTime();
  const wall = timeZone ? wallClock(time, timeZone) : null;
  if (wall) return dayAt(wall[0], wall[1], wall[2]);
  const local = new Date(time);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

/**
 * A day's first moment where the time zone says, as an instant written as a
 * date and time field keeps one ("2026-10-13T21:00:00.000Z" for 14 October in
 * Cairo): its midnight, or the first moment after it on a day the clocks go
 * forward at midnight.
 */
export function dayStarts(day: string, timeZone?: string): string {
  const [y, m, d] = numbersOf(day);
  const wall = Date.UTC(y, m - 1, d);
  /** How far ahead of UTC the zone's clock is at an instant, in milliseconds. */
  const ahead = (at: number) => {
    const clock = timeZone ? wallClock(at, timeZone) : null;
    return clock ? Date.UTC(clock[0], clock[1] - 1, clock[2], clock[3], clock[4], clock[5]) - Math.floor(at / 1000) * 1000 : null;
  };
  const first = ahead(wall);
  if (first === null) return new Date(y, m - 1, d).toISOString();
  let at = wall - first;
  // Across a change of the clocks the zone is a different distance ahead at its midnight: counted again from there.
  const then = ahead(at) as number;
  if (then !== first) at = wall - then;
  return new Date(at).toISOString();
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
