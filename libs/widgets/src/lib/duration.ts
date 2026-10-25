import { foldTyped, readDuration, readNumber, type Field, type Locale, type Value, intlFormat } from '@fieldia/core';

/**
 * Two numbers written as people read them rather than as they are kept: hours
 * as hours and minutes, "06:30" for 6.5 (Flectra's float_time, `duration`),
 * and a fraction as a per cent, "25 %" for 0.25 (Flectra's `percentage`).
 * How they are written and read — by a cell, a total, a read-only part, and
 * the plain box drawn until the business part comes (business-plain.ts) —
 * stays in the main script; Fieldia's own box for each comes in that part
 * (duration-box.ts), the first time a page shows one (widget-parts.ts).
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Hours as HH:MM: 6.5 → "06:30", -1.5 → "-01:30"; the minutes rounded. */
export function formatDuration(hours: number): string {
  const minutes = Math.round(Math.abs(hours) * 60);
  return `${hours < 0 && minutes ? '-' : ''}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * What was typed as hours: "6:30", "06:30", "6.5" (in the page's language,
 * "6,5"), "6h30", "6h" or "6:30:00", Arabic digits too (@fieldia/core's
 * readDuration). Null when emptied; undefined while it is still being typed
 * ("6:") or when it does not read ("6 30", "12:75"): a number field never
 * holds words.
 */
export function parseDuration(raw: string, locale: Locale = 'en'): number | null | undefined {
  const read = readDuration(raw, locale);
  return read.ok ? read.value : undefined;
}

/**
 * Hours typed, kept to the places the field keeps when it has them, as Flectra stores them: "6:20" in a field of two
 * places is 6.33 — still 06:20 to the minute — never refused for the places of a third of an hour. Only what is typed
 * is kept so; a value from outside is left as it came.
 */
export function hoursKept(hours: number | null | undefined, field: Field): number | null | undefined {
  if (typeof hours !== 'number' || field.type !== 'float' || !field.digits) return hours;
  const scale = 10 ** field.digits[1];
  return Math.round(hours * scale) / scale;
}

/**
 * Whether hours were typed with a decimal mark and two digits after it, which a clock's minutes could be: "6.45",
 * "6,30". They are hours with a decimal, as Flectra reads them (6.45 is 06:27), and the box says so.
 */
export function decimalHours(text: string): boolean {
  const m = /^[-\u2212]?\d+[.,\u066b](\d{2})$/.exec(foldTyped(text).trim());
  return !!m && m[1] !== '00' && Number(m[1]) <= 59;
}

/** A per cent, or its number alone, as the page's language writes it: at most `decimals` places. */
export function percentFormat(locale: Locale, decimals: number, style: 'percent' | 'decimal'): Intl.NumberFormat {
  return intlFormat('NumberFormat', locale, { style, numberingSystem: 'latn', minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

/** A fraction as a per cent, as the page's language writes one: 0.25 → "25%" ("25 %" in French); at most `decimals` places, none written that are zero. */
export function formatPercentage(fraction: number, locale: Locale = 'en', decimals = 2): string {
  return percentFormat(locale, decimals, 'percent').format(fraction);
}

/** A per cent typed: "25", "25%", "٢٥٪" (and the page's decimal mark); the fraction it is, 0.25. Null when emptied, undefined while it does not read. */
export function parsePercentage(raw: string, locale: Locale = 'en'): number | null | undefined {
  const read = readNumber(raw, locale, { percent: true });
  if (!read.ok) return undefined;
  return read.value === null ? null : Math.round((read.value / 100) * 1e10) / 1e10;
}

/** The places a percentage shows: the field's own, else two. */
export const percentPlaces = (field: Field) => (field.type === 'float' ? (field.digits?.[1] ?? 2) : 2);

/** A duration's or a percentage's value as words, where it is not edited: a cell, a total, a read-only part. Null for any other widget. */
export function shownNumber(widget: string | undefined, field: Field, value: Value | undefined, locale: Locale, options: Record<string, unknown> = {}): string | null {
  if (typeof value !== 'number' || (widget !== 'duration' && widget !== 'percentage')) return null;
  const suffix = typeof options['suffix'] === 'string' && options['suffix'] ? ` ${options['suffix']}` : '';
  return widget === 'duration' ? formatDuration(value) + suffix : formatPercentage(value, locale, percentPlaces(field));
}
