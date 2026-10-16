import { readDate } from './input-rules';

/**
 * Found by the 0.23 input-rules check (dates). An instant with its zone ("2026-02-31T10:00:00Z") is read by
 * `new Date(…)`, and V8 (Chromium, Node) and SpiderMonkey (Firefox) roll a day the month does not have into the next
 * month: 31 February is taken as 3 March, 31 April as 1 May. Typed as 31/02/2026 the same day is refused with
 * "February 2026 has 28 days"; pasted as an instant it is saved as another day, and nothing says so. WebKit refuses it.
 */
describe('an instant whose day its month does not have', () => {
  it.each([
    ['2026-02-31T10:00:00Z', 2, 28],
    ['2026-02-30T10:00:00Z', 2, 28],
    ['2026-04-31T10:00:00+02:00', 4, 30],
  ])('%s is refused as 31/02 is, in a date and in a date and time — never rolled into the next month', (text, month, days) => {
    expect(readDate(text)).toEqual({ ok: false, problem: 'noSuchDay', year: 2026, month, days });
    expect(readDate(text, { time: true })).toEqual({ ok: false, problem: 'noSuchDay', year: 2026, month, days });
  });

  it('typed in the page order, the same day is refused (the rule the instant should keep)', () => {
    expect(readDate('31/02/2026')).toEqual({ ok: false, problem: 'noSuchDay', year: 2026, month: 2, days: 28 });
  });
});
