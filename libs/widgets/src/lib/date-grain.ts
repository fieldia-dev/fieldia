import { foldTyped, monthNamed, monthWords, readDate, stripMarks, dayTag, type DatePrecision, type DateOrder, type Locale, type Value } from '@fieldia/core';
import { quoted } from './input-rules';
import { fillIn, wordsFor } from './kind-parts';
import type { DateReader, DateReading, GrainBox } from './date-text';
import type { WidgetLabels } from './labels';

/**
 * A month alone and a year alone (a date with `precision`, field.ts in @fieldia/core): a billing period, a card's
 * expiry, a building's year. Typed as people write one — 10/2026, 10-2026, 2026-10, Oct 2026, أكتوبر ٢٠٢٦, octobre
 * 2026; 2026 — in the page's order (the year first where it writes dates so), and kept as its first day: 2026-10-01,
 * 2026-01-01. A whole day typed or pasted gives its month (or its year), and what it leaves out is said, never dropped in
 * silence. Shown at rest as the page's language writes a month ("Oct 2026") or a year. In the months part: the date
 * part's box reads and writes one through `grainBox`.
 */

/** A month or a year: the precision of a date that is not a day. */
export type Grain = Exclude<DatePrecision, 'day'>;

const pad = (n: number) => String(n).padStart(2, '0');
/** The year and month of a day the field holds ("2026-10-01", or any day of the month a server gave); null for none. */
const held = (value: Value | undefined) => {
  const m = typeof value === 'string' ? /^(\d{4})-(\d{2})/.exec(value) : null;
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
};

/** A month or a year as its box shows it while it is typed in: 10/2026 (10.2026 on a German or Turkish page), 2026-10; 2026. */
export function grainTyping(value: Value | undefined, grain: Grain, order: DateOrder, locale: Locale): string {
  const at = held(value);
  if (!at) return value === null || value === undefined ? '' : String(value);
  if (grain === 'year') return String(at.year);
  return order === 'ymd' ? `${at.year}-${pad(at.month)}` : `${pad(at.month)}${locale === 'de' || locale === 'tr' ? '.' : '/'}${at.year}`;
}

/** A month or a year as its box shows it at rest, in the page's language: "Oct 2026", "أكتوبر 2026"; 2026. */
export function grainResting(value: Value | undefined, grain: Grain, locale: Locale): string {
  const at = held(value);
  if (!at) return value === null || value === undefined ? '' : String(value);
  return grain === 'year' ? String(at.year) : monthWords(Date.UTC(at.year, at.month - 1, 1), locale);
}

/** The placeholder: a month in the page's order, "mm/yyyy" or "yyyy-mm"; a year, "yyyy". */
export const grainShape = (grain: Grain, order: DateOrder, words: WidgetLabels): string => (grain === 'year' ? words.yearShape : order === 'ymd' ? words.monthShapeYmd : words.monthShape);

/** A month or a year as words point to one: this year's last month, whose 12 shows which part is the month. */
export const grainExample = (grain: Grain, order: DateOrder, locale: Locale): string => grainTyping(`${new Date().getFullYear()}-12-01`, grain, order, locale);

/** A month or a year typed whole enough to take while it is still typed: its year of four digits, after its month or before it. */
export function grainWhole(text: string, grain: Grain): boolean {
  const t = foldTyped(text).trim();
  return grain === 'year' ? /^\d{4}$/.test(t) : /\D\d{4}$/.test(t) || /^\d{4}\D+\d{1,2}$/.test(t);
}

/**
 * Typed text as a month or a year (`grain`): the first day it is kept as, or why not in the page's words — "Billing
 * month: months go from 1 to 12". A whole day gives its month (or its year), its `leftOut` said.
 */
export function readGrainText(text: string, reader: DateReader, grain: Grain): DateReading & { leftOut?: string } {
  const words = wordsFor(reader.labels, reader.locale);
  const { label, order, locale } = reader;
  const t = foldTyped(stripMarks(text)).replace(/\s*[,\u060c]\s*/g, ' ').trim();
  if (!t) return { ok: true, value: null };
  const unfinished = { ok: false as const, words: fillIn(grain === 'year' ? words.yearUnfinished : words.monthUnfinished, { label, text: quoted(t), example: grainExample(grain, order, locale) }), problem: 'unfinished' as const };
  const kept = (year: number, month: number) => `${String(year).padStart(4, '0')}-${pad(month)}-01`;
  const yearProblem = (digits: string): DateReading | null => {
    if (digits.length === 2) return { ok: false, words: fillIn(words.yearInFull, { label, short: quoted(digits), early: 1900 + Number(digits), late: 2000 + Number(digits) }), problem: 'shortYear' };
    if (digits.length !== 4 || Number(digits) < 1000) return { ok: false, words: fillIn(words.yearDigits, { label }), problem: 'yearDigits' };
    return null;
  };
  // A whole day — typed, pasted, or as a server writes it — gives its month or its year, and what it leaves out is said.
  const day = readDate(t, { order, locale, ...(reader.zone ? { zone: reader.zone } : {}) });
  if (day.ok && day.value) {
    const [y, m, d] = day.value.split('-').map(Number);
    const value = kept(y, grain === 'year' ? 1 : m);
    if (grain === 'month') return d === 1 ? { ok: true, value } : { ok: true, value, leftOut: fillIn(words.dayLeftOut, { label, day: d }) };
    const left = m === 1 && d === 1 ? '' : new Intl.DateTimeFormat(dayTag(locale), { day: 'numeric', month: 'long', timeZone: 'UTC', numberingSystem: 'latn' }).format(Date.UTC(y, m - 1, d));
    return left ? { ok: true, value, leftOut: fillIn(words.monthLeftOut, { label, day: left }) } : { ok: true, value };
  }
  const pieces = t.split(/\s*[/.\-\s]\s*/).filter(Boolean);
  if (grain === 'year') {
    if (pieces.length !== 1 || !/^\d+$/.test(pieces[0])) return unfinished;
    return yearProblem(pieces[0]) ?? { ok: true, value: kept(Number(pieces[0]), 1) };
  }
  if (pieces.length !== 2) return unfinished;
  // Its month in words, either side of its year; else the year first where it has four digits (2026-10), else last.
  const named = pieces.findIndex((piece) => /\D/.test(piece));
  let yearText: string;
  let month: number | undefined;
  if (named >= 0) {
    yearText = pieces[1 - named];
    month = monthNamed(pieces[named], locale);
    if (month === undefined || !/^\d+$/.test(yearText)) return unfinished;
  } else {
    // A year of four digits tells itself apart whichever way the page writes dates: 2026-10 and 10/2026 alike.
    const first = pieces[0].length === 4 && pieces[1].length <= 2;
    const monthText = first ? pieces[1] : pieces[0];
    yearText = first ? pieces[0] : pieces[1];
    month = monthText.length <= 2 ? Number(monthText) : 0;
  }
  const bad = yearProblem(yearText);
  if (bad) return bad;
  if (!month || month < 1 || month > 12) return { ok: false, words: fillIn(words.noSuchMonth, { label }), problem: 'noSuchMonth' };
  return { ok: true, value: kept(Number(yearText), month) };
}

/** How a date's box reads and writes a month alone or a year alone, in its page's order and words (date-text.ts `GrainBox`). */
export function grainBox(grain: Grain, reader: Omit<DateReader, 'grain'>): GrainBox {
  const words = wordsFor(reader.labels, reader.locale);
  const { order, locale, label } = reader;
  const example = grainExample(grain, order, locale);
  return {
    read: (text) => readGrainText(text, reader, grain),
    typing: (value) => grainTyping(value, grain, order, locale),
    resting: (value) => grainResting(value, grain, locale),
    shape: grainShape(grain, order, words),
    example,
    whole: (text) => grainWhole(text, grain),
    unfinished: (text) => fillIn(grain === 'year' ? words.yearUnfinished : words.monthUnfinished, { label, text: quoted(text), example }),
  };
}
