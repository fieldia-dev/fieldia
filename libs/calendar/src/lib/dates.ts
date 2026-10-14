import type { CalendarView, Locale, Value } from '@fieldia/core';

/**
 * A calendar's days, in the reader's own time. Whole days are counted by the
 * calendar's date, never by adding 24 hours, so a change of the clocks moves
 * no day.
 */

export type WhenKind = 'date' | 'datetime';

const pad = (n: number) => String(n).padStart(2, '0');

/** A day's key, as a date field keeps it: "2026-10-14". */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * 60000);
export const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);
/** Minutes since the day's midnight. */
export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
/** The moment `minutes` after a day's midnight, by the clock on the wall. */
export const atMinutes = (day: Date, minutes: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
/** Whole days from one day to another, by the calendar. */
export const daysBetween = (from: Date, to: Date) => Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000);

/** A field's value as a moment: a date at its midnight, a date and time as it holds. Null when it holds none. */
export function readWhen(value: Value | undefined, kind: WhenKind): Date | null {
  if (typeof value !== 'string' || !value) return null;
  if (kind === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * A day as a date input writes it, "2026-10-14", at its midnight: null for one that is no day ("2026-02-30", "", a
 * year of more than four digits). A year is read as written: "0026" is the year 26, never 1926.
 */
export function readDay(text: string): Date | null {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(text);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const day = new Date(2000, 0, 1);
  day.setFullYear(y, mo, d);
  return day.getFullYear() === y && day.getMonth() === mo && day.getDate() === d ? day : null;
}

/** A moment as its field keeps it: a date's day, or a date and time as the date widgets write one (ISO, in UTC). */
export const writeWhen = (d: Date, kind: WhenKind) => (kind === 'date' ? dayKey(d) : d.toISOString());

/** The week's first day by language: Saturday in Arabic (as Egypt's week runs), Monday elsewhere, as Fieldia's date picker has it. */
export function firstDayOf(locale: Locale, own?: number): number {
  if (own !== undefined) return own;
  return locale === 'ar' ? 6 : 1;
}

export const startOfWeek = (d: Date, firstDay: number) => addDays(startOfDay(d), -((d.getDay() - firstDay + 7) % 7));

/** What a view shows from a day in it — a day, its week, its month in whole weeks, or a week on from it (the agenda) — from the first moment of the first day to the first of the day after the last. */
export interface Range {
  from: Date;
  to: Date;
  days: Date[];
}

export function rangeOf(view: CalendarView, anchor: Date, firstDay: number): Range {
  let from: Date;
  let count: number;
  if (view === 'day' || view === 'agenda') {
    // The agenda: what comes, the day shown and the six after it.
    from = startOfDay(anchor);
    count = view === 'day' ? 1 : 7;
  } else if (view === 'month') {
    // Whole weeks round the month: from the week of its first day to the week of its last.
    from = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1), firstDay);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    count = daysBetween(from, startOfWeek(last, firstDay)) + 7;
  } else {
    from = startOfWeek(anchor, firstDay);
    count = 7;
  }
  const days = Array.from({ length: count }, (_, i) => addDays(from, i));
  return { from, to: addDays(from, count), days };
}

/** A view's next span, or its last: a day, a week, or a month (to its last day where the next month is shorter). */
export function stepFrom(view: CalendarView, anchor: Date, by: 1 | -1): Date {
  if (view === 'day') return addDays(anchor, by);
  if (view !== 'month') return addDays(anchor, 7 * by);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + by + 1, 0).getDate();
  return new Date(anchor.getFullYear(), anchor.getMonth() + by, Math.min(anchor.getDate(), last));
}

/** The language as Intl reads it: British English's day before month, every language's digits Latin, as Fieldia writes dates. */
export const intlTag = (locale: Locale) => (locale === 'en' ? 'en-GB' : locale);
export const format = (locale: Locale, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlTag(locale), { numberingSystem: 'latn', ...options });
