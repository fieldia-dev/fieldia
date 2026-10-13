import type { Locale } from '@fieldia/core';
import type { CalendarLabels } from './labels';

/** How an app's calendars behave, for `calendarListViews`. */
export interface CalendarSettings {
  /** Words over the calendar's own, by language: `{ ar: { today: 'النهارده' } }`. */
  labels?: Partial<Record<Locale, Partial<CalendarLabels>>>;
  /** The moment it is now: the clock unless given, as a demo or a test pinned to a day gives it. */
  now?: () => Date;
  /** How many records a span asks for at most: 500 unless said. Past it, the calendar says how many it leaves out. */
  limit?: number;
}
