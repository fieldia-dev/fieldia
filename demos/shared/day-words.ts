import type { Locale } from '@fieldia/core';
import { restingText } from '@fieldia/widgets';

/**
 * A day as the demos' pages write it — "25 Oct 2026", the words a date box shows once left — for the words a demo's
 * server writes about a record: a time off's summary, a plan's due days, a payment's cheque. Never the browser's own
 * order ("10/25/2026") nor the stored form ("2026-10-25"), which a reader would see beside the page's boxes. A date
 * and time's day, on the reader's clock, likewise. Nothing for no day.
 */
export function dayWords(value: unknown, locale: Locale = 'en'): string {
  if (typeof value !== 'string' || !value) return '';
  return restingText(value.slice(0, 10), 'date', locale);
}
