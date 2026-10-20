import type { Locale } from '@fieldia/core';
// The core's own module, by its path: the real pages' lanes that use this are read by a browser test in Node too
// (e2e/real-pages.spec.ts), where no '@fieldia/…' package resolves — only their types may come by that name.
import { dayWords as written } from '../../libs/core/src/lib/record/day-words';

/**
 * A day as the demos' pages write it — "25 Oct 2026", the words a date box shows once left — for the words a demo's
 * server writes about a record: a time off's summary, a plan's due days, a payment's cheque. Never the browser's own
 * order ("10/25/2026") nor the stored form ("2026-10-25"), which a reader would see beside the page's boxes. A date
 * and time's day, on the reader's clock, likewise. Nothing for no day. One way to write a day: the core's `dayWords`,
 * which the form's own messages use (a form's opening day, a date's earliest and latest).
 */
export function dayWords(value: unknown, locale: Locale = 'en'): string {
  if (typeof value !== 'string' || !value) return '';
  return written(value.slice(0, 10), { locale });
}
