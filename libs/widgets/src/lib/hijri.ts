import { foldForSearch, foldTyped, hijriWords, stripMarks, type DateOrder, type Locale, type Value } from '@fieldia/core';
import { quoted } from './input-rules';
import { fillIn, wordsFor } from './kind-parts';
import type { DateReader, DateReading } from './date-text';

/**
 * The Hijri calendar by Umm al-Qura's reckoning, as the browser's Intl keeps it (`islamic-umalqura`): a date with
 * `hijri` (field.ts in @fieldia/core) is shown and typed in it beside the Gregorian day it keeps. A Gregorian day gives
 * its Hijri day through Intl; a Hijri day typed is found among the Gregorian days by Intl too, so the two never part —
 * a month of 29 days or 30 as Umm al-Qura has it, never as a rule of thumb has it. In the months part.
 */

export interface HijriDay {
  year: number;
  month: number;
  day: number;
}

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const numbers = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', numberingSystem: 'latn', timeZone: 'UTC' });

/** A Gregorian day as an instant (midnight UTC) in the Hijri calendar. */
function hijriAt(at: number): HijriDay {
  const parts = numbers.formatToParts(at);
  const part = (type: string) => Number(parts.find((one) => one.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

/** A day the field holds ("2026-10-13") in the Hijri calendar: { year: 1448, month: 5, day: 2 }; null for what is no day. */
export function hijriOf(value: Value | undefined): HijriDay | null {
  const at = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? Date.parse(`${value.slice(0, 10)}T00:00Z`) : NaN;
  return Number.isNaN(at) ? null : hijriAt(at);
}

/** How far one Hijri day is from another, in days near enough to move by: a month is 29.53 days. */
const apart = (a: HijriDay, b: HijriDay) => Math.round((a.year - b.year) * 354.367 + (a.month - b.month) * 29.5306 + (a.day - b.day));

/** The instant (midnight UTC) of a Hijri month's first day: found from a guess, moved until Intl says it is. */
function firstOf(year: number, month: number): number | null {
  const wanted = { year, month, day: 1 };
  // The Hijri era began on 16 July 622 (Julian), 19 July in the Gregorian calendar carried back.
  let at = Date.UTC(622, 6, 19) + apart(wanted, { year: 1, month: 1, day: 1 }) * DAY;
  for (let tries = 0; tries < 8; tries++) {
    const now = hijriAt(at);
    const off = apart(wanted, now);
    if (!off) return now.year === year && now.month === month && now.day === 1 ? at : null;
    at += off * DAY;
  }
  return null;
}

/** A Hijri day as the Gregorian day the field keeps, or the days its month has where it has fewer. */
export function gregorianOf(year: number, month: number, day: number): { ok: true; value: string } | { ok: false; days: number } {
  const first = firstOf(year, month);
  const next = month === 12 ? firstOf(year + 1, 1) : firstOf(year, month + 1);
  if (first === null || next === null) return { ok: false, days: 0 };
  const days = Math.round((next - first) / DAY);
  if (day < 1 || day > days) return { ok: false, days };
  return { ok: true, value: new Date(first + (day - 1) * DAY).toISOString().slice(0, 10) };
}

/** A Hijri day as its box shows it while it is typed in, in the page's order: 02/05/1448, 1448-05-02. */
export function hijriTyping(value: Value | undefined, order: DateOrder, locale: Locale): string {
  const h = hijriOf(value);
  if (!h) return '';
  const [y, m, d] = [String(h.year), pad(h.month), pad(h.day)];
  if (order === 'ymd') return `${y}-${m}-${d}`;
  const mark = locale === 'de' ? '.' : '/';
  return order === 'mdy' ? `${m}/${d}/${y}` : `${d}${mark}${m}${mark}${y}`;
}

/** A Hijri day as its box shows it at rest: "2 Jumada I 1448 AH", "2 جمادى الأولى 1448 هـ". */
export const hijriResting = (value: Value | undefined, locale: Locale): string => (hijriOf(value) ? hijriWords(String(value), locale) : '');

const monthNames = new Map<string, Map<string, number>>();
/** A Hijri month's names as Intl writes them, long and short, in English, Arabic, French, German and the page's language. */
function hijriMonths(locale: Locale): Map<string, number> {
  let found = monthNames.get(locale);
  if (found) return found;
  found = new Map();
  for (const language of new Set(['en-GB', 'ar', 'fr', 'de', locale])) {
    for (const month of ['long', 'short'] as const) {
      const format = new Intl.DateTimeFormat(`${language}-u-ca-islamic-umalqura`, { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' });
      // The first day of each month of 1447: Intl finds its names, in its own words.
      for (let m = 1; m <= 12; m++) {
        const at = firstOf(1447, m);
        const name = at === null ? '' : (format.formatToParts(at).find((part) => part.type === 'month')?.value ?? '');
        const key = foldForSearch(name).replace(/\.+$/, '').trim();
        if (key && !/\d/.test(key) && !found.has(key)) found.set(key, m);
      }
    }
  }
  monthNames.set(locale, found);
  return found;
}
/**
 * The era's marks a Hijri date may end with: AH and its Arabic mark, as Intl writes them, and "H" — the Arabic letters
 * made from their code points in a call the bundler leaves as it is: a part carries no Arabic letters
 * (tools/script-bundle.mjs checks it).
 */
const letters = (...codes: number[]) => String.fromCharCode(...codes);
const ERA = new RegExp(`\\s*(?:a\\.?\\s*h\\.?|h|${letters(0x647)}${letters(0x640)}?)\\s*$`, 'i');

/** A Hijri day as words point to one: this Hijri year's last month's 29th, in the page's order. */
export function hijriExample(order: DateOrder, locale: Locale): string {
  const year = hijriAt(Date.now()).year;
  const at = firstOf(year, 12);
  return at === null ? '' : hijriTyping(new Date(at + 28 * DAY).toISOString().slice(0, 10), order, locale);
}

/**
 * Typed text as a Hijri day: the Gregorian day the field keeps, or why not in the page's words. In the page's order
 * (the year first where its four digits come first), its month a number or a name as Intl writes it ("2 Jumada I 1448
 * AH", "2 جمادى الأولى 1448 هـ"), the era's mark after it or none; a day its month has not, said with the days it has.
 */
export function readHijriText(text: string, reader: DateReader): DateReading {
  const words = wordsFor(reader.labels, reader.locale);
  const { label, order, locale } = reader;
  const t = foldTyped(stripMarks(text)).replace(/\s*[,\u060c]\s*/g, ' ').replace(ERA, '').trim();
  if (!t) return { ok: true, value: null };
  const unfinished: DateReading = { ok: false, words: fillIn(words.hijriUnfinished, { label, text: quoted(text.trim()), example: hijriExample(order, locale) }), problem: 'unfinished' };
  const pieces = t.split(/\s*[/.\-\s]\s*/).filter(Boolean);
  // A month's name may be two words (Jumada I, ربيع الآخر): the words between the day and the year, put together.
  const named = pieces.findIndex((piece) => /\D/.test(piece));
  let year: string;
  let month: number | undefined;
  let day: string;
  if (named >= 0) {
    const digits = pieces.filter((piece) => /^\d+$/.test(piece));
    const name = pieces.filter((piece) => !/^\d+$/.test(piece)).join(' ');
    if (digits.length !== 2) return unfinished;
    month = hijriMonths(locale).get(foldForSearch(name).replace(/\.+$/, '').trim());
    [year, day] = digits[0].length === 4 ? [digits[0], digits[1]] : [digits[1], digits[0]];
    if (month === undefined) return unfinished;
  } else {
    if (pieces.length !== 3) return unfinished;
    const used: DateOrder = pieces[0].length === 4 ? 'ymd' : order;
    [year, day] = [pieces[used.indexOf('y')], pieces[used.indexOf('d')]];
    const monthText = pieces[used.indexOf('m')];
    month = monthText.length <= 2 ? Number(monthText) : 0;
  }
  if (year.length !== 4 || Number(year) < 1000) return { ok: false, words: fillIn(words.yearDigits, { label }), problem: 'yearDigits' };
  if (!month || month < 1 || month > 12) return { ok: false, words: fillIn(words.noSuchMonth, { label }), problem: 'noSuchMonth' };
  const found = day.length <= 2 ? gregorianOf(Number(year), month, Number(day)) : { ok: false as const, days: 0 };
  if (found.ok) return { ok: true, value: found.value };
  if (!found.days) return unfinished;
  // "Jumada I 1448 AH has 29 days": the month by its Hijri name, the year with its era, as Intl writes them.
  const first = firstOf(Number(year), month) ?? 0;
  const parts = new Intl.DateTimeFormat(`${locale === 'en' ? 'en-GB' : locale}-u-ca-islamic-umalqura`, { month: 'long', year: 'numeric', numberingSystem: 'latn', timeZone: 'UTC' }).formatToParts(first);
  const of = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return { ok: false, words: fillIn(words.noSuchDay, { label, month: of('month'), year: `${of('year')} ${of('era')}`.trim(), days: found.days }), problem: 'noSuchDay' };
}
