import { matchesFilter, DATE_PERIODS } from '@fieldia/core';
import { daysFilter, periodDays, spanEnd } from './list-days';

/**
 * A list's days: where a span ends, a period's days counted from the day it
 * is looked at — a week from the language's first day, in the page's time
 * zone — and the plain conditions any data source reads for them.
 */

/** Wednesday 14 October 2026, 09:40 in Cairo (06:40 UTC). */
const NOW = new Date('2026-10-14T06:40:00Z');
const CAIRO = 'Africa/Cairo';

describe('the span a date falls in', () => {
  it('ends where the next one starts', () => {
    expect(spanEnd('2026-10-14', 'day')).toBe('2026-10-15');
    expect(spanEnd('2026-12-28', 'week')).toBe('2027-01-04');
    expect(spanEnd('2026-12-01', 'month')).toBe('2027-01-01');
    expect(spanEnd('2026-10-01', 'quarter')).toBe('2027-01-01');
    expect(spanEnd('2026-01-01', 'year')).toBe('2027-01-01');
  });
});

describe('the days of a period', () => {
  const days = (is: (typeof DATE_PERIODS)[number], weekStart = 1) => periodDays(is, NOW, { weekStart, timeZone: CAIRO });

  it('counts each period from today, the day after its last its end', () => {
    expect(days('today')).toEqual({ from: '2026-10-14', to: '2026-10-15' });
    expect(days('yesterday')).toEqual({ from: '2026-10-13', to: '2026-10-14' });
    expect(days('thisWeek')).toEqual({ from: '2026-10-12', to: '2026-10-19' });
    expect(days('lastWeek')).toEqual({ from: '2026-10-05', to: '2026-10-12' });
    expect(days('thisMonth')).toEqual({ from: '2026-10-01', to: '2026-11-01' });
    expect(days('lastMonth')).toEqual({ from: '2026-09-01', to: '2026-10-01' });
    expect(days('thisYear')).toEqual({ from: '2026-01-01', to: '2027-01-01' });
    expect(days('last7Days')).toEqual({ from: '2026-10-08', to: '2026-10-15' });
    expect(days('last30Days')).toEqual({ from: '2026-09-15', to: '2026-10-15' });
    expect(days('overdue')).toEqual({ from: null, to: '2026-10-14' });
  });

  it('starts this week and last on the language’s first day: Saturday in Arabic', () => {
    expect(days('thisWeek', 6)).toEqual({ from: '2026-10-10', to: '2026-10-17' });
    expect(days('lastWeek', 6)).toEqual({ from: '2026-10-03', to: '2026-10-10' });
  });

  it('is counted from today where the page is: late at night in Cairo it is already tomorrow', () => {
    const late = new Date('2026-10-14T22:30:00Z');
    expect(periodDays('today', late, { timeZone: CAIRO })).toEqual({ from: '2026-10-15', to: '2026-10-16' });
    expect(periodDays('today', late, { timeZone: 'UTC' })).toEqual({ from: '2026-10-14', to: '2026-10-15' });
    // January's last month is last December.
    expect(periodDays('lastMonth', new Date('2026-01-10T10:00:00Z'), { timeZone: CAIRO })).toEqual({ from: '2025-12-01', to: '2026-01-01' });
  });
});

describe('the conditions for some days', () => {
  it('are plain >= and < on a date’s days, and on a date and time’s first moments where the page is', () => {
    expect(daysFilter('due', '2026-10-01', '2026-11-01', 'date')).toEqual([
      { field: 'due', op: '>=', value: '2026-10-01' },
      { field: 'due', op: '<', value: '2026-11-01' },
    ]);
    expect(daysFilter('start', '2026-10-14', '2026-10-15', 'datetime', CAIRO)).toEqual([
      { field: 'start', op: '>=', value: '2026-10-13T21:00:00.000Z' },
      { field: 'start', op: '<', value: '2026-10-14T21:00:00.000Z' },
    ]);
    expect(daysFilter('due', null, '2026-10-14', 'date')).toEqual([{ field: 'due', op: '<', value: '2026-10-14' }]);
  });

  it('keep exactly the records of those days, as any source reads them', () => {
    const today = daysFilter('start', '2026-10-14', '2026-10-15', 'datetime', CAIRO);
    const at = (start: string | null) => matchesFilter({ start }, today);
    expect(at('2026-10-13T21:00:00.000Z')).toBe(true);
    expect(at('2026-10-13T21:00:00Z')).toBe(true);
    expect(at('2026-10-14T20:59:59.000Z')).toBe(true);
    expect(at('2026-10-13T20:59:00.000Z')).toBe(false);
    expect(at('2026-10-14T21:00:00.000Z')).toBe(false);
    expect(at('2026-10-14T21:00:00Z')).toBe(false);
    expect(at(null)).toBe(false);
    const overdue = daysFilter('due', null, '2026-10-14', 'date');
    expect(matchesFilter({ due: '2026-10-13' }, overdue)).toBe(true);
    expect(matchesFilter({ due: '2026-10-14' }, overdue)).toBe(false);
    expect(matchesFilter({ due: null }, overdue)).toBe(false);
  });
});
