import { addDays, dayIn, dayStarts, spanStart, type DateInterval, type DatePeriod, type DayCount, type ResolvedFilter } from '@fieldia/core';

/**
 * A list's days, as it counts them (periods.ts in @fieldia/core counts a day
 * where a time zone says, and the span a value falls in): where a span ends,
 * the days a period names, and the plain conditions a data source reads for
 * them. The list part's own: no page without a list carries them.
 */

/** A day by its numbers, the month from 1, rolled over as the calendar rolls. */
const dayAt = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const numbersOf = (day: string) => day.split('-').map(Number) as [number, number, number];

/** Where the next span starts, after one that starts on `start`. */
export function spanEnd(start: string, interval: DateInterval): string {
  const [y, m, d] = numbersOf(start);
  if (interval === 'day' || interval === 'week') return dayAt(y, m, d + (interval === 'day' ? 1 : 7));
  return interval === 'year' ? dayAt(y + 1, m, d) : dayAt(y, m + (interval === 'quarter' ? 3 : 1), d);
}

/**
 * The days a period holds, counted from `now`: from its first day (none for
 * Overdue, which is every day before today) up to `to`, the day after its
 * last. A week starts on `count.weekStart`; the last 7 and 30 days end with
 * today.
 */
export function periodDays(is: DatePeriod, now: Date, count: DayCount = {}): { from: string | null; to: string } {
  const today = dayIn(now, count.timeZone);
  const week = spanStart(today, 'week', count) as string;
  const [y, m] = numbersOf(today);
  switch (is) {
    case 'today':
      return { from: today, to: addDays(today, 1) };
    case 'yesterday':
      return { from: addDays(today, -1), to: today };
    case 'thisWeek':
      return { from: week, to: addDays(week, 7) };
    case 'lastWeek':
      return { from: addDays(week, -7), to: week };
    case 'thisMonth':
      return { from: dayAt(y, m, 1), to: dayAt(y, m + 1, 1) };
    case 'lastMonth':
      return { from: dayAt(y, m - 1, 1), to: dayAt(y, m, 1) };
    case 'thisYear':
      return { from: dayAt(y, 1, 1), to: dayAt(y + 1, 1, 1) };
    case 'last7Days':
      return { from: addDays(today, -6), to: addDays(today, 1) };
    case 'last30Days':
      return { from: addDays(today, -29), to: addDays(today, 1) };
    case 'overdue':
      return { from: null, to: today };
  }
}

/**
 * The conditions for a field's values from one day up to another, the last
 * left out — as any data source reads them: `>=` and `<` on the days
 * themselves for a date, on their first moments where `timeZone` says for a
 * date and time. No first day: everything before the last.
 */
export function daysFilter(field: string, from: string | null, to: string, kind: 'date' | 'datetime', timeZone?: string): ResolvedFilter[] {
  const bound = (day: string) => (kind === 'date' ? day : dayStarts(day, timeZone));
  return [...(from === null ? [] : [{ field, op: '>=' as const, value: bound(from) }]), { field, op: '<', value: bound(to) }];
}
