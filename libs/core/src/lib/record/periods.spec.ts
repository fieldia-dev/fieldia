import { addDays, dayIn, dayStarts, spanStart } from './periods';

/**
 * Days as a list and a data source count them: the day an instant falls on
 * and a day's first moment in a time zone — where a day starts at its own
 * midnight, whatever the clocks do — and the span a date falls in.
 */

const CAIRO = 'Africa/Cairo';

describe('days', () => {
  it('counts on by the calendar, over a month’s end and a year’s', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('tells the day an instant falls on in a time zone, the next day east of midnight', () => {
    expect(dayIn(new Date('2026-10-14T22:30:00Z'), CAIRO)).toBe('2026-10-15');
    expect(dayIn(new Date('2026-10-14T22:30:00Z'), 'America/New_York')).toBe('2026-10-14');
    expect(dayIn(new Date('2026-10-14T22:30:00Z'), 'Asia/Tokyo')).toBe('2026-10-15');
    expect(dayIn(new Date('2026-10-14T22:30:00Z'), 'UTC')).toBe('2026-10-14');
  });

  it('finds a day’s first moment in a time zone, as the instant a date and time field keeps', () => {
    expect(dayStarts('2026-10-14', CAIRO)).toBe('2026-10-13T21:00:00.000Z');
    expect(dayStarts('2026-01-14', CAIRO)).toBe('2026-01-13T22:00:00.000Z');
    expect(dayStarts('2026-10-14', 'America/New_York')).toBe('2026-10-14T04:00:00.000Z');
    expect(dayStarts('2026-10-14', 'UTC')).toBe('2026-10-14T00:00:00.000Z');
  });

  it('starts a day the clocks go forward at midnight at its first moment, and one they go back on at its midnight', () => {
    // Cairo's summer time began at midnight on Friday 24 April 2026: that day began at 01:00, two hours ahead.
    expect(dayStarts('2026-04-24', CAIRO)).toBe('2026-04-23T22:00:00.000Z');
    expect(dayIn(new Date('2026-04-23T22:00:00Z'), CAIRO)).toBe('2026-04-24');
    // And ended at midnight on 29 October 2026, the clocks put back to 23:00: the 30th began at its own midnight, two ahead.
    expect(dayStarts('2026-10-30', CAIRO)).toBe('2026-10-29T22:00:00.000Z');
    // Where the clocks change at 02:00, midnight is midnight.
    expect(dayStarts('2026-03-29', 'Europe/Berlin')).toBe('2026-03-28T23:00:00.000Z');
    expect(dayStarts('2026-03-30', 'Europe/Berlin')).toBe('2026-03-29T22:00:00.000Z');
  });

  it('counts in the computer’s own time zone when none is given, or one no browser knows', () => {
    const local = new Date(2026, 9, 14, 23, 50);
    expect(dayIn(local)).toBe('2026-10-14');
    expect(dayStarts('2026-10-14')).toBe(new Date(2026, 9, 14).toISOString());
    expect(dayStarts('2026-10-14', 'Nowhere/Atlantis')).toBe(new Date(2026, 9, 14).toISOString());
    expect(dayIn(local, 'Nowhere/Atlantis')).toBe('2026-10-14');
  });
});

describe('the span a date falls in', () => {
  it('is its day, week, month, quarter or year, by its first day', () => {
    expect(spanStart('2026-10-14', 'day')).toBe('2026-10-14');
    expect(spanStart('2026-10-14', 'month')).toBe('2026-10-01');
    expect(spanStart('2026-10-14', 'quarter')).toBe('2026-10-01');
    expect(spanStart('2026-08-31', 'quarter')).toBe('2026-07-01');
    expect(spanStart('2026-03-31', 'quarter')).toBe('2026-01-01');
    expect(spanStart('2026-10-14', 'year')).toBe('2026-01-01');
  });

  it('starts a week on the day the page’s language starts one: Monday, or Saturday, or Sunday', () => {
    // Wednesday 14 October 2026.
    expect(spanStart('2026-10-14', 'week')).toBe('2026-10-12');
    expect(spanStart('2026-10-14', 'week', { weekStart: 1 })).toBe('2026-10-12');
    expect(spanStart('2026-10-14', 'week', { weekStart: 6 })).toBe('2026-10-10');
    expect(spanStart('2026-10-14', 'week', { weekStart: 0 })).toBe('2026-10-11');
    // A Saturday starts its own week, and is the last day of a week from Sunday.
    expect(spanStart('2026-10-10', 'week', { weekStart: 6 })).toBe('2026-10-10');
    expect(spanStart('2026-10-10', 'week', { weekStart: 0 })).toBe('2026-10-04');
    // Over a year's end.
    expect(spanStart('2027-01-01', 'week', { weekStart: 1 })).toBe('2026-12-28');
  });

  it('takes a date and time on the day it is where the page is', () => {
    expect(spanStart('2026-09-30T22:30:00.000Z', 'month', { timeZone: CAIRO })).toBe('2026-10-01');
    expect(spanStart('2026-09-30T22:30:00.000Z', 'month', { timeZone: 'UTC' })).toBe('2026-09-01');
    expect(spanStart('2026-09-30 22:30:00', 'day')).toBe('2026-09-30');
  });

  it('is none for what is no date', () => {
    for (const value of [null, undefined, '', 'soon', 20261014, '14/10/2026', '2026-10-14Tlate']) expect(spanStart(value, 'month')).toBeNull();
  });
});
