import type { DateOrder } from './input-rules';
import type { Messages } from './messages';
import { intlFormat } from '../intl-format';

/** How much of a date a field keeps: a day, unless its `precision` says a month or a year alone (field.ts). */
export type DatePrecision = 'day' | 'month' | 'year';
/** How much of a date a field keeps: its `precision`, else a day. */
export const precisionOf = (field: { type: string; precision?: unknown } | undefined): DatePrecision =>
  field?.type === 'date' && (field.precision === 'month' || field.precision === 'year') ? field.precision : 'day';

/**
 * A day ("2026-10-13") in the Hijri calendar, by Umm al-Qura's reckoning as Intl's `islamic-umalqura` keeps it, written
 * in words in the page's language — "2 Jumada I 1448 AH", "2 جمادى الأولى 1448 هـ" — as a date with `hijri` shows it
 * beside its Gregorian day; empty for what is no day.
 */
export function hijriWords(day: string, locale: string): string {
  const at = Date.parse(`${day.slice(0, 10)}T00:00Z`);
  return Number.isNaN(at) ? '' : intlFormat('DateTimeFormat', `${locale === 'en' ? 'en-GB' : locale}-u-ca-islamic-umalqura`, { day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn', timeZone: 'UTC' }).format(at);
}

/**
 * The tag Intl writes a day in for a page's language: English as en-GB writes it (the day first), and every language on
 * the Gregorian calendar a date's value is kept in — Intl's own for Persian is the Solar Hijri, which would write
 * 2026-10-15 as 23 Mehr 1405. A tag with Unicode extensions of its own (`-u-…`) is as given.
 */
export const dayTag = (locale: string): string => (locale === 'en' ? 'en-GB' : locale.includes('-u-') ? locale : `${locale}-u-ca-gregory`);

/** A month and its year in words, as a month's box writes it at rest: "Oct 2026", "أكتوبر 2026", "oct. 2026". */
export const monthWords = (at: number, locale: string): string =>
  intlFormat('DateTimeFormat', dayTag(locale), { month: 'short', year: 'numeric', numberingSystem: 'latn', timeZone: 'UTC' }).format(at);

/**
 * A day a message names, written as the page's date boxes write one: in the page's order (`messages.dateOrder`, set on
 * a form's own messages from its page's `look.dateOrder`: day first unless it says) and its language — "20 Oct 2026",
 * "Oct 20, 2026", "2026-10-20". One rule for every message that names a day: a day's earliest and latest (limits.ts),
 * the days a form opens and closes (form-limits.ts, which writes a time after it on the page's clock). As written
 * where it reads as no day.
 */
export function dayWords(day: string, messages: Pick<Messages, 'locale' | 'dateOrder'>, order: DateOrder = messages.dateOrder ?? 'dmy', precision: DatePrecision = 'day'): string {
  const at = Date.parse(`${day}T00:00Z`);
  // A month alone, or a year alone, as its box writes it: "Oct 2026", "2026-10"; "2026".
  if (precision !== 'day' && !Number.isNaN(at)) return precision === 'year' ? day.slice(0, 4) : order === 'ymd' ? day.slice(0, 7) : monthWords(at, messages.locale);
  if (order === 'ymd' || Number.isNaN(at)) return day;
  // English as the boxes write it, the day first.
  const format = intlFormat('DateTimeFormat', dayTag(messages.locale), { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn', timeZone: 'UTC' });
  if (order === 'dmy') return format.format(at);
  const parts = format.formatToParts(at);
  const part = (type: string) => parts.find((one) => one.type === type)?.value ?? '';
  return `${part('month')} ${part('day')}, ${part('year')}`;
}
