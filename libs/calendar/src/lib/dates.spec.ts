import { addDays, dayKey, firstDayOf, readDay, readWhen, rangeOf, stepFrom, writeWhen } from './dates';

/**
 * A calendar's days, in the reader's own time: the span a view shows from a
 * day in it, the week's first day by language or page, a step back or on,
 * and a field's value read and written as its kind keeps it.
 */

const day = (text: string) => readWhen(text, 'date') as Date;
const keys = (days: Date[]) => days.map(dayKey);

describe("a calendar's days", () => {
  it('reads a date as that day, and a date and time as the moment it holds, and writes each back as its kind keeps it', () => {
    expect(dayKey(day('2026-10-14'))).toBe('2026-10-14');
    expect(day('2026-10-14').getHours()).toBe(0);
    const at = readWhen('2026-10-14T09:30:00', 'datetime') as Date;
    expect([at.getHours(), at.getMinutes()]).toEqual([9, 30]);
    expect(readWhen('2026-10-14T07:30:00.000Z', 'datetime')?.toISOString()).toBe('2026-10-14T07:30:00.000Z');
    expect(readWhen('', 'datetime')).toBeNull();
    expect(readWhen(null, 'date')).toBeNull();
    expect(readWhen('soon', 'datetime')).toBeNull();
    expect(writeWhen(new Date(2026, 9, 14, 9, 30), 'date')).toBe('2026-10-14');
    expect(writeWhen(new Date(Date.UTC(2026, 9, 14, 7, 30)), 'datetime')).toBe('2026-10-14T07:30:00.000Z');
  });

  it('reads a day as a date input writes it, its year as written, and no day as none', () => {
    expect(dayKey(readDay('2026-10-14') as Date)).toBe('2026-10-14');
    // The year 26, never 1926: a year typed short stays short, for a check to catch.
    expect(readDay('0026-10-14')?.getFullYear()).toBe(26);
    expect(readDay('2026-02-30')).toBeNull();
    expect(readDay('2026-13-01')).toBeNull();
    expect(readDay('')).toBeNull();
    expect(readDay('14/10/2026')).toBeNull();
    expect(readDay('20260-10-14')).toBeNull();
  });

  it('starts the week on the language’s own day unless the page says: Saturday in Arabic, Monday in English, French and German', () => {
    expect(firstDayOf('ar')).toBe(6);
    expect(firstDayOf('en')).toBe(1);
    expect(firstDayOf('fr')).toBe(1);
    expect(firstDayOf('de')).toBe(1);
    expect(firstDayOf('ar', 0)).toBe(0);
  });

  it('shows a day, a week from its first day, a month in whole weeks, and an agenda of the week to come', () => {
    // Wednesday 14 October 2026.
    const wednesday = day('2026-10-14');
    expect(keys(rangeOf('day', wednesday, 1).days)).toEqual(['2026-10-14']);
    expect(keys(rangeOf('week', wednesday, 1).days)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    expect(keys(rangeOf('week', wednesday, 6).days)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']);
    const month = rangeOf('month', wednesday, 1);
    expect(dayKey(month.days[0])).toBe('2026-09-28');
    expect(month.days).toHaveLength(35);
    expect(dayKey(month.days[34])).toBe('2026-11-01');
    expect(dayKey(month.to)).toBe('2026-11-02');
    // The agenda: what comes, from the day it shows.
    expect(keys(rangeOf('agenda', wednesday, 6).days)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
    // From the first moment of its first day to the first of the day after its last.
    const week = rangeOf('week', wednesday, 1);
    expect([dayKey(week.from), dayKey(week.to)]).toEqual(['2026-10-12', '2026-10-19']);
  });

  it('steps a day, a week or a month at a time, keeping to a month’s last day where the next is shorter', () => {
    const wednesday = day('2026-10-14');
    expect(dayKey(stepFrom('day', wednesday, 1))).toBe('2026-10-15');
    expect(dayKey(stepFrom('week', wednesday, -1))).toBe('2026-10-07');
    expect(dayKey(stepFrom('agenda', wednesday, 1))).toBe('2026-10-21');
    expect(dayKey(stepFrom('month', wednesday, 1))).toBe('2026-11-14');
    expect(dayKey(stepFrom('month', day('2026-01-31'), 1))).toBe('2026-02-28');
  });

  it('keeps whole days across a change of the clocks', () => {
    // Europe's clocks go back on 25 October 2026: the next day is still the next day.
    expect(dayKey(addDays(day('2026-10-25'), 1))).toBe('2026-10-26');
    expect(keys(rangeOf('week', day('2026-10-28'), 1).days)[0]).toBe('2026-10-26');
  });
});
