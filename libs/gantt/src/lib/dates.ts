import { instantsAt, wallTime, zoneOffset, type ListGantt, type Locale, type Page, type Value } from '@fieldia/core';

/**
 * A timeline's days, on its zone's clock: the zone its start field names, else its page's (`timeZone`), else the
 * reader's own. Every moment the timeline draws, moves and counts is a time on that clock — a `Date` whose UTC fields
 * are the clock's day and time (`toWall`), so neither the reader's own zone nor its clocks' changes move a bar — and
 * becomes the instant it is only as it is written (`writeWhen`). Whole days are counted by the calendar's date, never
 * by adding 24 hours, so a change of the clocks moves no day.
 */

export type WhenKind = 'date' | 'datetime';

const MINUTE = 60000;
export const DAY = 86400000;
const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** The zone a timeline is on the clock of, by its IANA name: its start's own, when a date and time names one; else its page's; undefined for the reader's own. */
export function zoneOfGantt(page: Page, spec: Pick<ListGantt, 'start'>): string | undefined {
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
export const dayOn = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day));
export const startOfDay = (d: Date) => dayOn(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
/** So many days on by the calendar, the time on the clock kept. */
export const addDays = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
/** Whole days from one day to another, by the calendar. */
export const daysBetween = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);
/** Days from one moment to another on the clock, with their part of a day: 1.5 from Monday 00:00 to Tuesday 12:00. */
export const daysFrom = (from: Date, to: Date) => (to.getTime() - from.getTime()) / DAY;
export const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);
/** Whether a moment is a day's midnight on the clock. */
export const atMidnight = (d: Date) => d.getUTCHours() === 0 && d.getUTCMinutes() === 0;

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

/** A moment as its field keeps it: a date's day, or a date and time as the date widgets write one — the instant it is on the zone's clock, in UTC. */
export const writeWhen = (d: Date, kind: WhenKind, zone?: string) => (kind === 'date' ? dayKey(d) : new Date(fromWall(d, zone)).toISOString());

/** The week's first day by language: Saturday in Arabic (as Egypt's week runs), Monday elsewhere, as Fieldia's date picker has it. */
export function firstDayOf(locale: Locale, own?: number): number {
  if (own !== undefined) return own;
  return locale === 'ar' ? 6 : 1;
}

export const startOfWeek = (d: Date, firstDay: number) => addDays(startOfDay(d), -((d.getUTCDay() - firstDay + 7) % 7));
export const startOfMonth = (d: Date) => dayOn(d.getUTCFullYear(), d.getUTCMonth(), 1);

/** The language as Intl reads it: British English's day before month, every language's digits Latin, as Fieldia writes dates. */
export const intlTag = (locale: Locale) => (locale === 'en' ? 'en-GB' : locale);
/** A moment on the timeline's clock in words: its UTC fields, which are that clock's day and time. */
export const format = (locale: Locale, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlTag(locale), { numberingSystem: 'latn', ...options, timeZone: 'UTC' });

/** What joins the parts of a sentence as the language writes it: ", ", or in Arabic its own comma, "، ". */
export function comma(locale: Locale): string {
  return locale.split('-')[0] === 'ar' ? '، ' : ', ';
}
