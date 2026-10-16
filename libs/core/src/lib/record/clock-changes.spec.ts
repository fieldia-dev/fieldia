import { momentsOf, readDate, wallClock } from './input-rules';

/**
 * A date and time is one moment where it is read. The reader takes the time zone it is typed in (`zone`), so a page's
 * or a field's zone reads the same way the computer's own does: a wall clock time the clocks skip as summer time comes
 * is refused saying what the clocks do, one they pass twice as it goes is refused naming each offset, and either can be
 * written with its offset from UTC.
 */
describe('a date and time read in its time zone', () => {
  it.each([
    ['Africa/Cairo', '24/04/2026 00:30', '2026-04-24', '00:30', '00:00', '01:00'],
    ['Europe/Berlin', '29/03/2026 02:30', '2026-03-29', '02:30', '02:00', '03:00'],
    ['America/New_York', '08/03/2026 02:30', '2026-03-08', '02:30', '02:00', '03:00'],
  ])('in %s, "%s" is skipped by the clocks: refused, saying they go from %s… — never kept an hour later', (zone, typed, date, time, from, to) => {
    expect(readDate(typed, { time: true, zone })).toEqual({ ok: false, problem: 'skippedTime', date, time, from, to });
  });

  it('a time the clocks pass twice is refused naming each offset, earliest first', () => {
    expect(readDate('25/10/2026 02:30', { time: true, zone: 'Europe/Berlin' })).toEqual({ ok: false, problem: 'repeatedTime', date: '2026-10-25', time: '02:30', offsets: ['+02:00', '+01:00'] });
  });

  it('written with its offset, a time passed twice is the moment it names', () => {
    expect(readDate('25/10/2026 02:30 +01:00', { time: true, zone: 'Europe/Berlin' })).toEqual({ ok: true, value: '2026-10-25T02:30', at: Date.UTC(2026, 9, 25, 1, 30) });
    expect(readDate('25/10/2026 02:30 +02:00', { time: true, zone: 'Europe/Berlin' })).toEqual({ ok: true, value: '2026-10-25T02:30', at: Date.UTC(2026, 9, 25, 0, 30) });
    expect(readDate('25/10/2026 2:30 am UTC+1', { time: true, zone: 'Europe/Berlin' })).toMatchObject({ ok: true, at: Date.UTC(2026, 9, 25, 1, 30) });
  });

  it('a date without a time keeps its hyphens: never an offset', () => {
    expect(readDate('15-10-2026', { time: true, zone: 'Europe/Berlin' })).toEqual({ ok: true, value: '2026-10-15T00:00' });
  });

  it('an instant is the wall clock it is in the zone it is read in', () => {
    expect(readDate('2026-10-15T14:30:00Z', { time: true, zone: 'Europe/Berlin' })).toEqual({ ok: true, value: '2026-10-15T16:30', at: Date.UTC(2026, 9, 15, 14, 30) });
    expect(readDate('2026-10-15T23:30:00Z', { zone: 'Europe/Berlin' })).toEqual({ ok: true, value: '2026-10-16', timeLeftOut: '01:30' });
  });

  it('an ordinary time is one moment, and read as before', () => {
    expect(readDate('15/10/2026 14:30', { time: true, zone: 'Europe/Berlin' })).toEqual({ ok: true, value: '2026-10-15T14:30' });
    expect(momentsOf('2026-10-15T14:30', 'Europe/Berlin')).toEqual([Date.UTC(2026, 9, 15, 12, 30)]);
    expect(momentsOf('2026-03-29T02:30', 'Europe/Berlin')).toEqual([]);
    expect(momentsOf('2026-10-25T02:30', 'Europe/Berlin')).toEqual([Date.UTC(2026, 9, 25, 0, 30), Date.UTC(2026, 9, 25, 1, 30)]);
    expect(wallClock(Date.UTC(2026, 9, 25, 1, 30), 'Europe/Berlin')).toBe('2026-10-25T02:30');
  });
});

describe('a date written in another order than the page’s', () => {
  it('on a year-first page, a day-first date with its year in full is not in the page’s order — never year 15', () => {
    expect(readDate('15/10/2026', { order: 'ymd' })).toEqual({ ok: false, problem: 'order' });
    expect(readDate('2026/10/15', { order: 'ymd' })).toEqual({ ok: true, value: '2026-10-15' });
    expect(readDate('26/10/15', { order: 'ymd' })).toMatchObject({ ok: false, problem: 'shortYear' });
  });
});
