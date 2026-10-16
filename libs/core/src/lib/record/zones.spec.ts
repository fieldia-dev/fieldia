import { clocksSkip, dayIn, instantsAt, isOwnZone, isTimeZone, wallClock, wallOf, wallText, wallTime, zoneOffset } from './zones';

const at = (iso: string) => Date.parse(iso);
const wall = (text: string) => wallOf(text)!;
const iso = (ms: number) => new Date(ms).toISOString();

describe('time zones', () => {
  it('knows a zone by its IANA name, and nothing else', () => {
    for (const name of ['Africa/Cairo', 'Europe/Berlin', 'America/Argentina/Buenos_Aires', 'UTC', 'Etc/GMT-2', 'Asia/Calcutta']) expect(isTimeZone(name)).toBe(true);
    for (const name of ['Mars/Olympus', '+02:00', 'GMT+2 ', '', 'Europe/', null, 3]) expect(isTimeZone(name)).toBe(false);
  });

  it('reads the clock of a zone at an instant, and its offset', () => {
    expect(wallText(wallTime(at('2026-10-15T12:30:00Z'), 'Africa/Cairo'))).toBe('2026-10-15T15:30');
    expect(wallText(wallTime(at('2026-01-15T12:30:00Z'), 'Africa/Cairo'))).toBe('2026-01-15T14:30');
    expect(wallText(wallTime(at('2026-10-15T02:30:00Z'), 'America/New_York'))).toBe('2026-10-14T22:30');
    expect(zoneOffset(at('2026-07-01T00:00:00Z'), 'Europe/Berlin')).toBe(120);
    expect(zoneOffset(at('2026-12-01T00:00:00Z'), 'Europe/Berlin')).toBe(60);
    expect(zoneOffset(at('2026-12-01T00:00:00Z'), 'Asia/Kolkata')).toBe(330);
    expect(zoneOffset(at('2026-12-01T00:00:00Z'), 'America/St_Johns')).toBe(-210);
    // Midnight is 00, never 24.
    expect(wallClock(wallTime(at('2026-10-14T22:00:00Z'), 'Europe/Berlin'))).toBe('00:00');
  });

  it('counts the day an instant falls on in a zone', () => {
    // 23:30 in London on the 15th is already the 16th in Cairo, and still the 15th in New York.
    const late = at('2026-10-15T22:30:00Z');
    expect(dayIn(late, 'Africa/Cairo')).toBe('2026-10-16');
    expect(dayIn(late, 'Europe/London')).toBe('2026-10-15');
    expect(dayIn(late, 'America/New_York')).toBe('2026-10-15');
    expect(dayIn(new Date(late), 'Pacific/Kiritimati')).toBe('2026-10-16');
  });

  it('finds the one instant a time on the clock is, on an ordinary day', () => {
    expect(instantsAt(wall('2026-10-15T14:30'), 'Africa/Cairo').map(iso)).toEqual(['2026-10-15T11:30:00.000Z']);
    expect(instantsAt(wall('2026-01-15T09:00'), 'America/New_York').map(iso)).toEqual(['2026-01-15T14:00:00.000Z']);
    expect(instantsAt(wall('2026-06-01T00:00'), 'Asia/Kolkata').map(iso)).toEqual(['2026-05-31T18:30:00.000Z']);
  });

  it('finds no instant in the hour the clocks skip, and says from what to what', () => {
    // Berlin goes from 02:00 to 03:00 on 29 March 2026.
    expect(instantsAt(wall('2026-03-29T02:30'), 'Europe/Berlin')).toEqual([]);
    expect(instantsAt(wall('2026-03-29T03:00'), 'Europe/Berlin').map(iso)).toEqual(['2026-03-29T01:00:00.000Z']);
    expect(instantsAt(wall('2026-03-29T01:59'), 'Europe/Berlin').map(iso)).toEqual(['2026-03-29T00:59:00.000Z']);
    const skip = clocksSkip(wall('2026-03-29T02:30'), 'Europe/Berlin')!;
    expect([wallText(skip.from), wallText(skip.to)]).toEqual(['2026-03-29T02:00', '2026-03-29T03:00']);
    // Cairo goes from midnight to 01:00 on the last Friday of April: 00:00 itself is no time that day.
    expect(instantsAt(wall('2026-04-24T00:00'), 'Africa/Cairo')).toEqual([]);
    const cairo = clocksSkip(wall('2026-04-24T00:30'), 'Africa/Cairo')!;
    expect([wallText(cairo.from), wallText(cairo.to)]).toEqual(['2026-04-24T00:00', '2026-04-24T01:00']);
    // Half an hour on Lord Howe Island.
    expect(instantsAt(wall('2026-10-04T02:15'), 'Australia/Lord_Howe')).toEqual([]);
    const howe = clocksSkip(wall('2026-10-04T02:15'), 'Australia/Lord_Howe')!;
    expect([wallClock(howe.from), wallClock(howe.to)]).toEqual(['02:00', '02:30']);
    // A time that is there has no change that skips it.
    expect(clocksSkip(wall('2026-03-29T03:30'), 'Europe/Berlin')).toBeNull();
    expect(clocksSkip(wall('2026-10-25T02:30'), 'Europe/Berlin')).toBeNull();
  });

  it('finds both instants in the hour the clocks repeat, the earlier first', () => {
    // Berlin goes back from 03:00 to 02:00 on 25 October 2026: 02:30 comes in summer time, then in winter time.
    expect(instantsAt(wall('2026-10-25T02:30'), 'Europe/Berlin').map(iso)).toEqual(['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z']);
    // London goes back from 02:00 to 01:00 the same night.
    expect(instantsAt(wall('2026-10-25T01:30'), 'Europe/London').map(iso)).toEqual(['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z']);
    // Cairo goes back at midnight on the last Thursday of October: 23:30 that evening comes twice.
    expect(instantsAt(wall('2026-10-29T23:30'), 'Africa/Cairo')).toHaveLength(2);
    expect(instantsAt(wall('2026-10-25T03:00'), 'Europe/Berlin')).toHaveLength(1);
  });

  it('reads the browser’s own clock without a zone', () => {
    const now = at('2026-10-15T12:30:00Z');
    const d = new Date(now);
    expect(wallTime(now)).toEqual({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes() });
    expect(instantsAt(wallTime(now))).toEqual([now]);
    expect(isOwnZone(new Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(true);
  });
});
