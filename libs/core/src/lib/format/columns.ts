import type { ColumnCount, ColumnsByWidth } from './layout';

/** A section's columns at full width, whichever way they are written. */
export function wideColumns(columns: ColumnCount | ColumnsByWidth | undefined): ColumnCount {
  return typeof columns === 'object' ? columns.wide : columns ?? 1;
}
