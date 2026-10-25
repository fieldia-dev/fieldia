import type { Page } from '@fieldia/core';
import { addDays, dayKey, dayOn, firstDayOf, fromWall, readDay, readWhen, rangeOf, stepFrom, toWall, writeWhen, zoneOfCalendar } from './dates';

/**
 * A calendar's days, on its zone's clock — a time on it a Date whose UTC
 * fields are that clock's day and time: the span a view shows from a day in
 * it, the week's first day by language or page, a step back or on, and a
 * field's value read and written as its kind keeps it, the instant it is in
 * that zone.
 */

const day = (text: string) => readWhen(text, 'date') as Date;
const keys = (days: Date[]) => days.map(dayKey);

describe("a calendar's days", () => {
  it('reads a date as that day, and a date and time as the moment it holds, and writes each back as its kind keeps it', () => {
    expect(dayKey(day('2026-10-14'))).toBe('2026-10-14');
    expect(day('2026-10-14').getUTCHours()).toBe(0);
    // A date and time written without its zone is the reader's: 09:30 on the reader's clock.
    const at = readWhen('2026-10-14T09:30:00', 'datetime') as Date;
    expect([at.getUTCHours(), at.getUTCMinutes()]).toEqual([9, 30]);
    // An instant, on a zone's clock: 07:30 UTC is 16:30 in Tokyo.
    expect(readWhen('2026-10-14T07:30:00.000Z', 'datetime', 'Asia/Tokyo')?.toISOString()).toBe('2026-10-14T16:30:00.000Z');
    expect(readWhen('', 'datetime')).toBeNull();
    expect(readWhen(null, 'date')).toBeNull();
    expect(readWhen('soon', 'datetime')).toBeNull();
    expect(writeWhen(dayOn(2026, 9, 14, 9 * 60 + 30), 'date')).toBe('2026-10-14');
    expect(writeWhen(dayOn(2026, 9, 14, 7 * 60 + 30), 'datetime', 'UTC')).toBe('2026-10-14T07:30:00.000Z');
    expect(writeWhen(dayOn(2026, 9, 14, 16 * 60 + 30), 'datetime', 'Asia/Tokyo')).toBe('2026-10-14T07:30:00.000Z');
    // The reader's own zone where none is named.
    expect(writeWhen(dayOn(2026, 9, 14, 9 * 60 + 30), 'datetime')).toBe(new Date(2026, 9, 14, 9, 30).toISOString());
  });

  it('reads a day as a date input writes it, its year as written, and no day as none', () => {
    expect(dayKey(readDay('2026-10-14') as Date)).toBe('2026-10-14');
    // The year 26, never 1926: a year typed short stays short, for a check to catch.
    expect(readDay('0026-10-14')?.getUTCFullYear()).toBe(26);
    expect(readDay('2026-02-30')).toBeNull();
    expect(readDay('2026-13-01')).toBeNull();
    expect(readDay('')).toBeNull();
    expect(readDay('14/10/2026')).toBeNull();
    expect(readDay('20260-10-14')).toBeNull();
  });

  it('starts the week where CLDR has it unless the page says: the page’s region, else the reader’s, else where the language is most spoken', () => {
    // jsdom's reader asks for en-US: an English page starts on Sunday, the others where their language is most spoken.
    expect(['ar', 'en', 'fr', 'de', 'tr', 'fa', 'ur', 'es'].map((locale) => firstDayOf(locale, {}))).toEqual([6, 0, 1, 1, 1, 6, 0, 1]);
    expect(['en-GB', 'ar-SA', 'es-MX', 'fr-CA'].map((language) => firstDayOf(language.slice(0, 2), { language }))).toEqual([1, 0, 0, 0]);
    expect(firstDayOf('ar', { language: 'ar-EG' }, 0)).toBe(0);
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

  it('is on the zone its start names, else its page’s, else the reader’s own', () => {
    const page = { fieldia: '0.13', id: 'p', timeZone: 'Africa/Cairo', data: { kind: 'record', model: 'm' }, fields: { at: { type: 'datetime', label: 'At', timeZone: 'Asia/Tokyo' }, plain: { type: 'datetime', label: 'Plain' }, day: { type: 'date', label: 'Day' } }, layout: { type: 'list', id: 'l', columns: [] } } as unknown as Page;
    expect(zoneOfCalendar(page, { start: 'at' })).toBe('Asia/Tokyo');
    expect(zoneOfCalendar(page, { start: 'plain' })).toBe('Africa/Cairo');
    expect(zoneOfCalendar(page, { start: 'day' })).toBe('Africa/Cairo');
    expect(zoneOfCalendar({ ...page, timeZone: undefined }, { start: 'plain' })).toBeUndefined();
  });

  it('turns an instant into its zone’s clock and back, its seconds kept, the hours the clocks skip and repeat as a clock reads them', () => {
    const at = Date.UTC(2026, 9, 14, 7, 30, 15);
    const wall = toWall(at, 'Asia/Tokyo');
    expect(wall.toISOString()).toBe('2026-10-14T16:30:15.000Z');
    expect(fromWall(wall, 'Asia/Tokyo')).toBe(at);
    // Berlin's clocks go from 02:00 to 03:00 on 29 March 2026: 02:30 is half past the change, 03:30 (01:30 UTC).
    expect(new Date(fromWall(dayOn(2026, 2, 29, 150), 'Europe/Berlin')).toISOString()).toBe('2026-03-29T01:30:00.000Z');
    // And back from 03:00 to 02:00 on 25 October: 02:30 comes twice, the first (00:30 UTC) taken.
    expect(new Date(fromWall(dayOn(2026, 9, 25, 150), 'Europe/Berlin')).toISOString()).toBe('2026-10-25T00:30:00.000Z');
    // Either 02:30 read back is 02:30 on the clock.
    expect([Date.UTC(2026, 9, 25, 0, 30), Date.UTC(2026, 9, 25, 1, 30)].map((one) => toWall(one, 'Europe/Berlin').toISOString())).toEqual(['2026-10-25T02:30:00.000Z', '2026-10-25T02:30:00.000Z']);
  });
});
