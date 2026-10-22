import type { Locale } from '@fieldia/core';
import type { GanttLabels } from './labels';

/** How an app's Gantt timelines behave, for `ganttListViews`. */
export interface GanttSettings {
  /** Words over the timeline's own, by language: `{ ar: { today: 'النهارده' } }`. */
  labels?: Partial<Record<Locale, Partial<GanttLabels>>>;
  /** The moment it is now: the clock unless given, as a demo or a test pinned to a day gives it. */
  now?: () => Date;
  /** How many records a timeline asks for at most: 500 unless said. Past it, the timeline says how many it leaves out. */
  limit?: number;
}
