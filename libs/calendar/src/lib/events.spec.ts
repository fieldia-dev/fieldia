import type { ListCalendar, Page } from '@fieldia/core';
import { dayOn } from './dates';
import { colourOf, eventsOf, moved, sideBySide, whereTo, type CalendarEvent } from './events';

/**
 * A list's records as a calendar's events: when each starts and ends (an
 * hour unless its end says, a whole day for a date), whether it takes the
 * whole day, its words, the person it is with and its colour; events that
 * meet side by side; and the values a move writes back.
 */

const page: Page = {
  fieldia: '0.1',
  id: 'appointments',
  data: { kind: 'record', model: 'clinic.appointment' },
  fields: {
    patient: { type: 'char', label: 'Patient' },
    start: { type: 'datetime', label: 'Starts' },
    stop: { type: 'datetime', label: 'Ends' },
    day: { type: 'date', label: 'Day' },
    last: { type: 'date', label: 'Last day' },
    doctor: { type: 'many2one', label: 'Doctor', relation: 'clinic.doctor' },
    kind: { type: 'selection', label: 'Kind', options: [{ value: 'check', label: 'Check-up' }, { value: 'surgery', label: 'Surgery' }, { value: 'call', label: 'Call' }] },
  },
  layout: { type: 'list', id: 'list', columns: ['patient'] },
};
const timed: ListCalendar = { start: 'start', end: 'stop', title: 'patient', resource: 'doctor', colour: 'kind' };
/** A time on the calendar's clock — the reader's own, as the page names no zone (dates.ts). */
const at = (h: number, m = 0, d = 14) => dayOn(2026, 9, d, h * 60 + m);
/** The instant that time is, as the date widgets write one. */
const iso = (h: number, m = 0, d = 14) => new Date(2026, 9, d, h, m).toISOString();
const hm = (date: Date) => `${date.getUTCDate()} ${date.getUTCHours()}:${String(date.getUTCMinutes()).padStart(2, '0')}`;

describe("a calendar's events", () => {
  it('reads each record’s start, end, words, person and colour', () => {
    const [mona] = eventsOf([{ id: 7, values: { patient: 'Mona Adel', start: iso(10), stop: iso(10, 30), doctor: { id: 2, label: 'Dr Karim' }, kind: 'surgery' } }], timed, page, 'en');
    expect(mona).toMatchObject({ id: 7, title: 'Mona Adel', allDay: false, resource: '2', resourceLabel: 'Dr Karim', colour: 'surgery' });
    expect([hm(mona.start), hm(mona.end)]).toEqual(['14 10:00', '14 10:30']);
  });

  it('lasts an hour with no end, and with an end before its start', () => {
    const [alone, backwards] = eventsOf(
      [
        { id: 1, values: { patient: 'A', start: iso(9) } },
        { id: 2, values: { patient: 'B', start: iso(11), stop: iso(10) } },
      ],
      { start: 'start', title: 'patient' },
      page,
      'en'
    );
    expect([hm(alone.start), hm(alone.end)]).toEqual(['14 9:00', '14 10:00']);
    expect(hm(backwards.end)).toBe('14 12:00');
  });

  it('takes the whole day for a date, to the day after its last', () => {
    const [trip] = eventsOf([{ id: 3, values: { patient: 'Course', day: '2026-10-14', last: '2026-10-16' } }], { start: 'day', end: 'last', title: 'patient' }, page, 'en');
    expect(trip.allDay).toBe(true);
    expect([hm(trip.start), hm(trip.end)]).toEqual(['14 0:00', '17 0:00']);
    // A day and a time across whole days is drawn with the days.
    const [leave] = eventsOf([{ id: 4, values: { patient: 'Leave', start: iso(0, 0, 14), stop: iso(0, 0, 16) } }], timed, page, 'en');
    expect(leave.allDay).toBe(true);
  });

  it('leaves out a record with no start, and says a link’s, a choice’s or a date’s words for its title', () => {
    const events = eventsOf(
      [
        { id: 1, values: { patient: 'No day', start: null } },
        { id: 2, values: { patient: null, kind: 'call', start: iso(9) } },
      ],
      { start: 'start', title: 'kind' },
      page,
      'en'
    );
    expect(events.map((e) => [e.id, e.title])).toEqual([[2, 'Call']]);
  });

  it('colours the same value the same way, from a set that reads in light and dark, and takes a colour a value names', () => {
    expect(colourOf('surgery')).toBe(colourOf('surgery'));
    expect(colourOf('surgery')).not.toBe(colourOf('check'));
    expect(colourOf('#0f766e')).toBe('#0f766e');
    expect(colourOf(null)).toBeNull();
  });

  it('puts events that meet side by side, each as wide as its crowd allows, and one alone across its column', () => {
    const event = (id: number, from: Date, to: Date) => ({ id, start: from, end: to }) as CalendarEvent;
    const placed = sideBySide([event(1, at(9), at(10)), event(2, at(9, 30), at(11)), event(3, at(10), at(10, 30)), event(4, at(12), at(13))]);
    expect(placed.get(1)).toEqual({ column: 0, columns: 2 });
    expect(placed.get(2)).toEqual({ column: 1, columns: 2 });
    // It starts as the first ends: the first's place is free again.
    expect(placed.get(3)).toEqual({ column: 0, columns: 2 });
    expect(placed.get(4)).toEqual({ column: 0, columns: 1 });
  });

  it('writes back a move, keeping its length, and its person when it moves to another column', () => {
    const [mona] = eventsOf([{ id: 7, values: { patient: 'Mona Adel', start: iso(10), stop: iso(10, 30), doctor: { id: 2, label: 'Dr Karim' } } }], timed, page, 'en');
    const values = moved(mona, at(11, 15), timed, page, { value: { id: 3, label: 'Dr Salma' }, key: '3' });
    expect(values).toEqual({ start: iso(11, 15), stop: iso(11, 45), doctor: { id: 3, label: 'Dr Salma' } });
    // A stretch writes the end alone.
    expect(moved(mona, mona.start, timed, page, undefined, at(11))).toEqual({ stop: iso(11) });
    // A date moves by days, and keeps how many it takes.
    const [trip] = eventsOf([{ id: 3, values: { patient: 'Course', day: '2026-10-14', last: '2026-10-16' } }], { start: 'day', end: 'last', title: 'patient' }, page, 'en');
    expect(moved(trip, at(0, 0, 20), { start: 'day', end: 'last', title: 'patient' }, page)).toEqual({ day: '2026-10-20', last: '2026-10-22' });
  });

  it('says where a move lands for the words after it: the day and the time, or the day alone', () => {
    const [mona] = eventsOf([{ id: 7, values: { patient: 'Mona Adel', start: iso(10), stop: iso(10, 30) } }], timed, page, 'en');
    expect(whereTo(mona, at(11, 15), 'en')).toBe('Wed 14 Oct, 11:15');
    // In Arabic, the day and the time are joined with its own comma, as the day's own words are.
    expect(whereTo(mona, at(11, 15), 'ar')).toMatch(/، 11:15$/);
    expect(whereTo(mona, at(11, 15), 'ar')).not.toContain(',');
    // Another year than the record's own is named, so a year typed wrong is seen.
    expect(whereTo(mona, dayOn(2062, 9, 15, 15 * 60), 'en')).toMatch(/^Sun,? 15 Oct 2062, 15:00$/);
  });

  it('reads and writes on the zone its start or its page names, wherever the reader is', () => {
    // Tokyo, nine hours ahead of UTC all year: 01:00 UTC is 10:00 there.
    const tokyo = { ...page, timeZone: 'Asia/Tokyo' } as Page;
    const [mona] = eventsOf([{ id: 7, values: { patient: 'Mona Adel', start: '2026-10-14T01:00:00.000Z', stop: '2026-10-14T01:30:00.000Z' } }], timed, tokyo, 'en');
    expect([hm(mona.start), hm(mona.end)]).toEqual(['14 10:00', '14 10:30']);
    // Moved to 11:15 on Tokyo's clock: 02:15 UTC, half an hour on.
    expect(moved(mona, at(11, 15), timed, tokyo)).toEqual({ start: '2026-10-14T02:15:00.000Z', stop: '2026-10-14T02:45:00.000Z' });
    // The start field's own zone over the page's: New York, four hours behind UTC in October.
    const own = { ...tokyo, fields: { ...tokyo.fields, start: { type: 'datetime', label: 'Starts', timeZone: 'America/New_York' } } } as Page;
    expect(hm(eventsOf([{ id: 1, values: { patient: 'A', start: '2026-10-14T14:00:00.000Z' } }], { start: 'start', title: 'patient' }, own, 'en')[0].start)).toBe('14 10:00');
  });

  it('keeps the time a record really lasts when it moves across a change of the clocks', () => {
    // Berlin's clocks go back on 25 October 2026 at 03:00: a two-hour record from 01:00 that day ends at 02:00 on the
    // clock, and moved to the day before, it still lasts two hours — to 03:00.
    const berlin = { ...page, timeZone: 'Europe/Berlin' } as Page;
    const [night] = eventsOf([{ id: 9, values: { patient: 'Night shift', start: '2026-10-24T23:00:00.000Z', stop: '2026-10-25T01:00:00.000Z' } }], timed, berlin, 'en');
    expect([hm(night.start), hm(night.end)]).toEqual(['25 1:00', '25 2:00']);
    expect(moved(night, dayOn(2026, 9, 24, 60), timed, berlin)).toEqual({ start: '2026-10-23T23:00:00.000Z', stop: '2026-10-24T01:00:00.000Z' });
  });
});
