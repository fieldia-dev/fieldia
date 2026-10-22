import type { ListedRecord, Page, Values } from '@fieldia/core';
import { dayKey, dayOn } from './dates';
import { spanOf, ticksOf } from './scale';
import { clampBy, groupsOf, linksOf, movedBy, shifted, tasksOf } from './tasks';
import { fitoutPage, fitoutRecords } from './test-gantt';

/**
 * A timeline's records as bars: from their start to their end, or for their
 * duration, or a day; a milestone where they last none; in groups, a
 * choice's in its options' order; each joined to the records it waits for,
 * late where it starts too soon; and a move by whole days writing only what
 * it changes. Its days: whole units of its scale round every bar and today.
 */

const listed = (records: Record<string, Values>): ListedRecord[] => Object.entries(records).map(([id, values]) => ({ id: Number(id), values }));
const page = fitoutPage();
const spec = (p: Page = page) => (p.layout as { gantt: NonNullable<Parameters<typeof tasksOf>[1]> }).gantt;

describe('a record as a bar', () => {
  it('runs from its start to the end of its last day, groups by its phase, colours by its trade, waits for what it names', () => {
    const tasks = tasksOf(listed(fitoutRecords()), spec(), page, 'en');
    const wiring = tasks.find((t) => t.title === 'Wiring');
    expect(wiring && [dayKey(wiring.start as Date), dayKey(wiring.end as Date)]).toEqual(['2026-10-14', '2026-10-17']);
    expect(wiring).toMatchObject({ group: 'first', groupLabel: 'First fix', colour: '2', waitsFor: ['1'], milestone: false });
    // No start yet: a row, and no bar.
    expect(tasks.find((t) => t.title === 'Snagging')).toMatchObject({ start: null, end: null, group: 'finish' });
  });

  it('lasts its duration in days, a day with neither, and none at all as a milestone; a date and time keeps its hours', () => {
    const byDays = fitoutPage({ end: undefined, duration: 'days' });
    const [three, none, missing] = tasksOf(
      listed({ 1: { name: 'Tiling', start: '2026-10-14', days: 3 }, 2: { name: 'Handover', start: '2026-10-30', days: 0 }, 3: { name: 'Clean', start: '2026-10-20' } }),
      spec(byDays),
      byDays,
      'en'
    );
    expect(dayKey(three.end as Date)).toBe('2026-10-17');
    expect(none).toMatchObject({ milestone: true });
    expect((none.end as Date).getTime()).toBe((none.start as Date).getTime());
    expect(dayKey(missing.end as Date)).toBe('2026-10-21');
    const timed: Page = { ...byDays, timeZone: 'Europe/Berlin', fields: { ...byDays.fields, start: { type: 'datetime', label: 'Starts' } } };
    const [half] = tasksOf(listed({ 1: { name: 'Pour', start: '2026-10-14T07:00:00.000Z', days: 1.5 } }), spec(timed), timed, 'en');
    // 09:00 in Berlin (summer time), a day and a half: Thursday 21:00 on Berlin's clock.
    expect((half.start as Date).toISOString()).toBe('2026-10-14T09:00:00.000Z');
    expect((half.end as Date).toISOString()).toBe('2026-10-15T21:00:00.000Z');
  });

  it('groups a choice in its options’ order, a link by its first start, the records with none last', () => {
    const tasks = tasksOf(listed(fitoutRecords()), spec(), page, 'en');
    expect(groupsOf(tasks, spec(), page, 'None').map((g) => [g.label, g.tasks.map((t) => t.title)])).toEqual([
      ['Strip-out', ['Strip the old shop']],
      ['First fix', ['Wiring']],
      ['Finishes', ['Painting', 'Plastering', 'Snagging']],
    ]);
    const byTrade = fitoutPage({ group: 'trade' });
    expect(groupsOf(tasksOf(listed(fitoutRecords()), spec(byTrade), byTrade, 'en'), spec(byTrade), byTrade, 'None').map((g) => g.label)).toEqual(['Nile Builders', 'Sparks Electric', 'None']);
    // No group: one, unnamed, of them all.
    const alone = fitoutPage({ group: undefined });
    expect(groupsOf(tasksOf(listed(fitoutRecords()), spec(alone), alone, 'en'), spec(alone), alone, 'None')).toHaveLength(1);
  });

  it('joins each to what it waits for, late where it starts before that one ends, never to itself or to one not shown', () => {
    const records = fitoutRecords();
    records[1] = { ...records[1], after: [{ id: 1, label: 'Strip the old shop' }, { id: 99, label: 'Gone' }] };
    const links = linksOf(tasksOf(listed(records), spec(), page, 'en'));
    expect(links.map((l) => `${l.from.title} → ${l.to.title}${l.late ? ' (late)' : ''}`)).toEqual(['Strip the old shop → Wiring', 'Wiring → Plastering', 'Wiring → Painting (late)']);
    // Plain ids are read too.
    records[3] = { ...records[3], after: [2] };
    expect(linksOf(tasksOf(listed(records), spec(), page, 'en')).some((l) => l.to.title === 'Plastering' && l.from.title === 'Wiring')).toBe(true);
  });
});

describe('a move by whole days', () => {
  const tasks = tasksOf(listed(fitoutRecords()), spec(), page, 'en');
  const wiring = tasks.find((t) => t.title === 'Wiring') as (typeof tasks)[number];

  it('writes its start and its last day, moved together; its end alone, stretched; its start alone, keeping its end', () => {
    expect(movedBy(wiring, 2, 'both', spec(), page)).toEqual({ start: '2026-10-16', finish: '2026-10-18' });
    expect(movedBy(wiring, 1, 'end', spec(), page)).toEqual({ finish: '2026-10-17' });
    expect(movedBy(wiring, -1, 'start', spec(), page)).toEqual({ start: '2026-10-13' });
    expect(movedBy(wiring, 0, 'both', spec(), page)).toEqual({});
  });

  it('never shrinks a bar to nothing: its end no sooner than its first day, its start no later than its last', () => {
    expect(clampBy(wiring, -5, 'end')).toBe(-2);
    expect(clampBy(wiring, 5, 'start')).toBe(2);
    expect(clampBy(wiring, -40, 'both')).toBe(-40);
    expect(dayKey(shifted(wiring, -2, 'end')?.end as Date)).toBe('2026-10-15');
  });

  it('writes a duration where it lasts one, and an end the record lacked where its drawn end is moved', () => {
    const byDays = fitoutPage({ end: undefined, duration: 'days' });
    const [tiling] = tasksOf(listed({ 1: { name: 'Tiling', start: '2026-10-14', days: 3 } }), spec(byDays), byDays, 'en');
    expect(movedBy(tiling, 2, 'end', spec(byDays), byDays)).toEqual({ days: 5 });
    expect(movedBy(tiling, 1, 'start', spec(byDays), byDays)).toEqual({ start: '2026-10-15', days: 2 });
    expect(movedBy(tiling, 1, 'both', spec(byDays), byDays)).toEqual({ start: '2026-10-15' });
    const [open] = tasksOf(listed({ 1: { name: 'Clean', start: '2026-10-20', finish: null } }), spec(), page, 'en');
    expect(movedBy(open, 1, 'both', spec(), page)).toEqual({ start: '2026-10-21' });
    expect(movedBy(open, 2, 'end', spec(), page)).toEqual({ finish: '2026-10-22' });
  });

  it('keeps its time of day on the zone’s clock, across a change of the clocks', () => {
    const timed: Page = { ...page, timeZone: 'Europe/Berlin', fields: { ...page.fields, start: { type: 'datetime', label: 'Starts' }, finish: { type: 'datetime', label: 'Ends' } } };
    // Friday 23 October, 08:00 to 17:00 in Berlin (summer time, +2).
    const [pour] = tasksOf(listed({ 1: { name: 'Pour', start: '2026-10-23T06:00:00.000Z', finish: '2026-10-23T15:00:00.000Z' } }), spec(timed), timed, 'en');
    // Moved past the night the clocks go back (25 October): still 08:00 to 17:00 there, now an hour later in UTC.
    expect(movedBy(pour, 3, 'both', spec(timed), timed)).toEqual({ start: '2026-10-26T07:00:00.000Z', finish: '2026-10-26T16:00:00.000Z' });
  });
});

describe('the days a timeline shows', () => {
  const today = dayOn(2026, 9, 14);
  const bars = [{ start: dayOn(2026, 9, 12), end: dayOn(2026, 9, 22) }];

  it('holds every bar and today with room round them, in whole weeks from the week’s first day, or whole months', () => {
    const week = spanOf(bars, today, 'week', 1);
    expect(dayKey(week.from)).toBe('2026-10-05');
    expect(week.days % 7).toBe(0);
    const month = spanOf(bars, today, 'month', 1);
    expect(dayKey(month.from)).toBe('2026-09-01');
    expect(dayKey(new Date(month.from.getTime() + month.days * 86400000))).toBe('2026-12-01');
    // Today far after the bars: still in.
    const later = spanOf(bars, dayOn(2027, 0, 20), 'day', 1);
    expect(later.days).toBeGreaterThan(100);
    // At least as wide as asked.
    expect(spanOf(bars, today, 'day', 1, 4000).days * 40).toBeGreaterThanOrEqual(4000);
  });

  it('marks months over days, months over weeks, years over months, in the page’s language', () => {
    const span = { from: dayOn(2026, 9, 30), days: 3 };
    const days = ticksOf(span, 'day', 'en', 1);
    expect(days.upper.map((t) => [t.text, t.at, t.days])).toEqual([
      ['October 2026', 0, 2],
      ['November 2026', 2, 1],
    ]);
    expect(days.lower.map((t) => `${t.sub} ${t.text}`)).toEqual(['F 30', 'S 31', 'S 1']);
    expect(days.lower[0].full).toBe('Friday, 30 October 2026');
    expect(ticksOf({ from: dayOn(2026, 9, 5), days: 14 }, 'week', 'en', 1).lower.map((t) => t.text)).toEqual(['5 Oct', '12 Oct']);
    expect(ticksOf({ from: dayOn(2026, 10, 1), days: 61 }, 'month', 'en', 1)).toMatchObject({ upper: [{ text: '2026' }], lower: [{ text: 'Nov' }, { text: 'Dec' }] });
    expect(ticksOf(span, 'day', 'ar', 6).upper[0].text).toBe('أكتوبر 2026');
  });
});
