import { instantsAt, wallTime, zoneOffset, dayTag, firstWeekday, type CalendarView, type ListCalendar, type Locale, type Page, type Value, intlFormat } from '@fieldia/core';

/**
 * A calendar's days, on its zone's clock: the zone its start field names, else its page's (`timeZone`), else the
 * reader's own. Every moment the calendar draws, moves and counts is a time on that clock — a `Date` whose UTC fields
 * are the clock's day and time (`toWall`), so neither the reader's own zone nor its clocks' changes move a slot — and
 * becomes the instant it is only as it is written (`writeWhen`). Whole days are counted by the calendar's date, never
 * by adding 24 hours, so a change of the clocks moves no day.
 */

export type WhenKind = 'date' | 'datetime';

const MINUTE = 60000;
const DAY = 86400000;
const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/**
 * The zone a calendar is on the clock of, by its IANA name: its start's own, when a date and time names one; else its
 * page's; undefined for the reader's own — as a date and time field's box is (`zoneOf` in @fieldia/widgets).
 */
export function zoneOfCalendar(page: Page, spec: Pick<ListCalendar, 'start'>): string | undefined {
  const field = page.fields[spec.start];
  return (field?.type === 'datetime' ? field.timeZone : undefined) ?? page.timeZone;
}

/** An instant as a time on the zone's clock: its day and time in the Date's UTC fields, its seconds kept. */
export function toWall(at: Date | number, zone?: string): Date {
  const ms = typeof at === 'number' ? at : at.getTime();
  const wall = wallTime(ms, zone);
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute) + (((ms % MINUTE) + MINUTE) % MINUTE));
}

/**
 * A time on the zone's clock as the instant it is: the earlier of the two in the hour the clocks repeat; in the hour
 * they skip, as far past the change as it is past the hour it skips from (02:30 is 03:30), as a clock's own day reads it.
 */
export function fromWall(d: Date, zone?: string): number {
  const wall = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  const seconds = d.getTime() - Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const found = instantsAt(wall, zone);
  const local = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  return (found.length ? found[0] : local - zoneOffset(local - DAY, zone) * MINUTE) + seconds;
}

/** A day's key, as a date field keeps it: "2026-10-14". */
export const dayKey = (d: Date) => `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
/** A day on the clock: its year, its month (0 to 11) and its day, at midnight; a day past a month's end is the next month's. */
export const dayOn = (year: number, month: number, day: number, minutes = 0) => new Date(Date.UTC(year, month, day, Math.floor(minutes / 60), minutes % 60));
export const startOfDay = (d: Date) => dayOn(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
export const addDays = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n, d.getUTCHours(), d.getUTCMinutes()));
export const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * MINUTE);
export const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);
/** Minutes since the day's midnight. */
export const minutesOf = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
/** The day of the week: 0 Sunday to 6 Saturday. */
export const weekdayOf = (d: Date) => d.getUTCDay();
/** The moment `minutes` after a day's midnight, by the clock on the wall. */
export const atMinutes = (day: Date, minutes: number) => dayOn(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), minutes);
/** Whole days from one day to another, by the calendar. */
export const daysBetween = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);

/** A field's value as a moment on the zone's clock: a date at its midnight, a date and time as it holds. Null when it holds none. */
export function readWhen(value: Value | undefined, kind: WhenKind, zone?: string): Date | null {
  if (typeof value !== 'string' || !value) return null;
  if (kind === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return m ? dayOn(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }
  const at = new Date(value).getTime();
  return Number.isNaN(at) ? null : toWall(at, zone);
}

/**
 * A day as a date input writes it, "2026-10-14", at its midnight: null for one that is no day ("2026-02-30", "", a
 * year of more than four digits). A year is read as written: "0026" is the year 26, never 1926.
 */
export function readDay(text: string): Date | null {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(text);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const day = new Date(0);
  day.setUTCFullYear(y, mo, d);
  return day.getUTCFullYear() === y && day.getUTCMonth() === mo && day.getUTCDate() === d ? day : null;
}

/** A moment as its field keeps it: a date's day, or a date and time as the date widgets write one — the instant it is on the zone's clock, in UTC. */
export const writeWhen = (d: Date, kind: WhenKind, zone?: string) => (kind === 'date' ? dayKey(d) : new Date(fromWall(d, zone)).toISOString());

/**
 * The week's first day, unless the page says: CLDR's for the page's own region, else the reader's where the browser
 * asks for the same language, else the one the language is most spoken in (`firstWeekday`).
 */
export function firstDayOf(locale: string, page: { readonly language?: string }, own?: number): number {
  if (own !== undefined) return own;
  return firstWeekday(locale, page);
}

export const startOfWeek = (d: Date, firstDay: number) => addDays(startOfDay(d), -((weekdayOf(d) - firstDay + 7) % 7));

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
    from = startOfWeek(dayOn(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1), firstDay);
    const last = dayOn(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0);
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
  const last = dayOn(anchor.getUTCFullYear(), anchor.getUTCMonth() + by + 1, 0).getUTCDate();
  return dayOn(anchor.getUTCFullYear(), anchor.getUTCMonth() + by, Math.min(anchor.getUTCDate(), last));
}

/** The language as Intl reads it: British English's day before month, every language on the Gregorian calendar and its digits Latin, as Fieldia writes dates. */
export const intlTag = (locale: Locale) => dayTag(locale);
/** A moment on the calendar's clock in words: its UTC fields, which are that clock's day and time. */
export const format = (locale: Locale, options: Intl.DateTimeFormatOptions) => intlFormat('DateTimeFormat', intlTag(locale), { numberingSystem: 'latn', ...options, timeZone: 'UTC' });
