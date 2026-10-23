import type { GanttZoom, Locale } from '@fieldia/core';
import { addDays, dayOn, daysBetween, format, startOfDay, startOfMonth, startOfWeek } from './dates';

/** The pixels a day takes at each scale: a column a day wide enough for its number, a week's, a month's. */
export const DAY_WIDTH: Record<GanttZoom, number> = { day: 40, week: 18, month: 5 };

/** The days a timeline shows: from a midnight on its clock, so many days on. */
export interface Span {
  from: Date;
  days: number;
}

/** Days of room before the first bar and after the last, at each scale. */
const ROOM: Record<GanttZoom, number> = { day: 2, week: 7, month: 14 };
/** The pixels a milestone's words take beside it: a milestone keeps them in the days shown. */
const LABEL = 160;

/** The first day of a scale's unit holding a day: the day, its week's first, its month's first. */
function unitStart(d: Date, zoom: GanttZoom, firstDay: number): Date {
  return zoom === 'day' ? startOfDay(d) : zoom === 'week' ? startOfWeek(d, firstDay) : startOfMonth(d);
}
/** The unit after the one starting on a day. */
const nextUnit = (d: Date, zoom: GanttZoom) => (zoom === 'day' ? addDays(d, 1) : zoom === 'week' ? addDays(d, 7) : dayOn(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

/**
 * The days a timeline shows: every bar and today, with room round them, in whole units of its scale (whole weeks,
 * whole months), and as many as fill `least` pixels where there are fewer.
 */
export function spanOf(bars: readonly { start: Date | null; end: Date | null }[], today: Date, zoom: GanttZoom, firstDay: number, least = 0): Span {
  let first = startOfDay(today);
  let last = addDays(first, 1);
  for (const bar of bars) {
    if (!bar.start || !bar.end) continue;
    if (bar.start < first) first = startOfDay(bar.start);
    const point = bar.end.getTime() === bar.start.getTime() ? addDays(bar.end, Math.ceil(LABEL / DAY_WIDTH[zoom])) : bar.end;
    const end = startOfDay(point) < point ? addDays(startOfDay(point), 1) : point;
    if (end > last) last = end;
  }
  const from = unitStart(addDays(first, -ROOM[zoom]), zoom, firstDay);
  let to = unitStart(addDays(last, ROOM[zoom]), zoom, firstDay);
  to = nextUnit(to, zoom);
  while (daysBetween(from, to) * DAY_WIDTH[zoom] < least) to = nextUnit(to, zoom);
  return { from, days: daysBetween(from, to) };
}

/** A mark on the axis: from so many days into the span, for so many days, in words — short, and in full for a screen reader. */
export interface Tick {
  at: number;
  days: number;
  text: string;
  full: string;
  /** For a day: its weekday's letter over its number. */
  sub?: string;
}

/** The units of a scale across a span, each cut to it: days, weeks, months or years. */
function units(span: Span, unit: 'day' | 'week' | 'month' | 'year', firstDay: number): { from: Date; to: Date }[] {
  const end = addDays(span.from, span.days);
  const start = (d: Date) => (unit === 'day' ? startOfDay(d) : unit === 'week' ? startOfWeek(d, firstDay) : unit === 'month' ? startOfMonth(d) : dayOn(d.getUTCFullYear(), 0, 1));
  const next = (d: Date) => (unit === 'year' ? dayOn(d.getUTCFullYear() + 1, 0, 1) : nextUnit(d, unit));
  const out: { from: Date; to: Date }[] = [];
  for (let at = start(span.from); at < end; at = next(at)) out.push({ from: at < span.from ? span.from : at, to: next(at) > end ? end : next(at) });
  return out;
}

/**
 * The axis's two rows: months over days, months over weeks, or years over months — each mark as the language writes
 * it (Latin digits, as Fieldia writes dates).
 */
export function ticksOf(span: Span, zoom: GanttZoom, locale: Locale, firstDay: number): { upper: Tick[]; lower: Tick[] } {
  const tick = (part: { from: Date; to: Date }, text: string, full: string, sub?: string): Tick => ({ at: daysBetween(span.from, part.from), days: daysBetween(part.from, part.to), text, full, ...(sub ? { sub } : {}) });
  const monthYear = format(locale, { month: 'long', year: 'numeric' });
  const longDay = format(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (zoom === 'month') {
    const year = format(locale, { year: 'numeric' });
    const month = format(locale, { month: 'short' });
    return {
      upper: units(span, 'year', firstDay).map((u) => tick(u, year.format(u.from), year.format(u.from))),
      lower: units(span, 'month', firstDay).map((u) => tick(u, month.format(u.from), monthYear.format(u.from))),
    };
  }
  const upper = units(span, 'month', firstDay).map((u) => tick(u, monthYear.format(u.from), monthYear.format(u.from)));
  if (zoom === 'week') {
    const short = format(locale, { day: 'numeric', month: 'short' });
    return { upper, lower: units(span, 'week', firstDay).map((u) => tick(u, short.format(u.from), longDay.format(u.from))) };
  }
  const number = format(locale, { day: 'numeric' });
  // Its letter, in the language's own script: where CLDR gives a language English's letters (Urdu's S M T W T F S), the
  // short names, for the whole week.
  const narrow = format(locale, { weekday: 'narrow' });
  const short = format(locale, { weekday: 'short' });
  const latin = /\p{Script=Latin}/u;
  const own = [7, 8, 9, 10, 11, 12, 13].every((d) => !latin.test(narrow.format(Date.UTC(2024, 0, d))) || latin.test(short.format(Date.UTC(2024, 0, d))));
  const weekday = own ? narrow : short;
  return { upper, lower: units(span, 'day', firstDay).map((u) => tick(u, number.format(u.from), longDay.format(u.from), weekday.format(u.from))) };
}
