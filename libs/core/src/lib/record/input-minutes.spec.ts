import { readDate, readDuration, readTime } from './input-rules';

/**
 * A time's minutes written with one digit, and a date and time read where a day
 * alone is kept: never a value made in silence. "14:3" could be 14:03 or 14:30,
 * so it is not read as either: it is said, naming each. A minute that can only be
 * one ("14:7", "14:0") reads as written. A time a date's box leaves out is named.
 */

const pad = (n: number) => String(n).padStart(2, '0');

describe('a time of day whose minutes have one digit', () => {
  it('is never read as :03 or :05 when it could be :30 or :50: both are named', () => {
    expect(readTime('14:3')).toEqual({ ok: false, problem: 'minuteDigits', times: ['14:03', '14:30'] });
    expect(readTime('9:3')).toEqual({ ok: false, problem: 'minuteDigits', times: ['09:03', '09:30'] });
    expect(readTime('14h5')).toEqual({ ok: false, problem: 'minuteDigits', times: ['14:05', '14:50'] });
    expect(readTime('٢:٣ م')).toEqual({ ok: false, problem: 'minuteDigits', times: ['14:03', '14:30'] });
  });

  it('is never read when a point could make it hours too: "14.5" may be half past two, and each is named', () => {
    expect(readTime('14.5')).toEqual({ ok: false, problem: 'minuteDigits', times: ['14:05', '14:30', '14:50'] });
    expect(readTime('9.3')).toEqual({ ok: false, problem: 'minuteDigits', times: ['09:03', '09:18', '09:30'] });
    expect(readTime('14.7')).toEqual({ ok: false, problem: 'minuteDigits', times: ['14:07', '14:42'] });
    expect(readTime('14.1')).toEqual({ ok: false, problem: 'minuteDigits', times: ['14:01', '14:06', '14:10'] });
  });

  it('reads as written when it can only be one time: :0, or a minute past :59 had it two digits', () => {
    expect(readTime('14:0')).toEqual({ ok: true, value: '14:00' });
    expect(readTime('14:7')).toEqual({ ok: true, value: '14:07' });
    expect(readTime('14.0')).toEqual({ ok: true, value: '14:00' });
    expect(readTime('14:30')).toEqual({ ok: true, value: '14:30' });
    expect(readTime('14.30')).toEqual({ ok: true, value: '14:30' });
  });

  it('is said the same way after a date', () => {
    expect(readDate('15/10/2026 14:3', { time: true })).toEqual({ ok: false, problem: 'minuteDigits', times: ['14:03', '14:30'] });
    expect(readDate('١٥/١٠/٢٠٢٦ ١٤:٣', { time: true })).toEqual({ ok: false, problem: 'minuteDigits', times: ['14:03', '14:30'] });
    expect(readDate('15/10/2026 14:7', { time: true })).toEqual({ ok: true, value: '2026-10-15T14:07' });
    expect(readDate('15/10/2026 14.5', { time: true })).toEqual({ ok: false, problem: 'minuteDigits', times: ['14:05', '14:30', '14:50'] });
  });
});

describe('hours whose minutes have one digit', () => {
  it('are never 6:03 for "6:3": both are named, and a point stays hours', () => {
    expect(readDuration('6:3', 'en')).toEqual({ ok: false, problem: 'minuteDigits', times: ['6:03', '6:30'] });
    expect(readDuration('1:5', 'en')).toEqual({ ok: false, problem: 'minuteDigits', times: ['1:05', '1:50'] });
    expect(readDuration('6h3', 'fr')).toEqual({ ok: false, problem: 'minuteDigits', times: ['6:03', '6:30'] });
    expect(readDuration('-6:3', 'en')).toEqual({ ok: false, problem: 'minuteDigits', times: ['-6:03', '-6:30'] });
    expect(readDuration('6.5', 'en')).toEqual({ ok: true, value: 6.5 });
    expect(readDuration('6:30', 'en')).toEqual({ ok: true, value: 6.5 });
  });

  it('read as written when they can only be one', () => {
    expect(readDuration('6:7', 'en')).toEqual({ ok: true, value: 6 + 7 / 60 });
    expect(readDuration('6:0', 'en')).toEqual({ ok: true, value: 6 });
  });
});

describe('a date and time read where a day alone is kept', () => {
  it('names the time it leaves out: an instant is the day it is here, its time said', () => {
    const at = new Date('2026-10-15T23:30:00Z');
    const day = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
    expect(readDate('2026-10-15T23:30:00Z')).toEqual({ ok: true, value: day, timeLeftOut: `${pad(at.getHours())}:${pad(at.getMinutes())}` });
    // A day alone leaves nothing out.
    expect(readDate('15/10/2026')).toEqual({ ok: true, value: '2026-10-15' });
  });
});
