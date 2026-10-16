import { checkPage } from '../format/check-page';
import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import type { SlotsRequest } from './data-source';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { scheduleSlots, type MemorySchedule } from './memory-schedules';

/**
 * Booking slots: the data source's `slots` (optional, as every member is),
 * the form's `findSlots` that fills in the record, its values and the zone,
 * the memory source answering from a schedule, and the page's settings for a
 * field drawn as slots.
 */

/** A showroom in Berlin: test drives of 45 minutes, 15 kept free after each, Monday to Saturday. */
const SHOWROOM: MemorySchedule = {
  timeZone: 'Europe/Berlin',
  hours: { 1: [['09:00', '12:00'], ['13:00', '17:00']], 2: [['09:00', '17:00']], 3: [['09:00', '17:00']], 4: [['09:00', '17:00']], 5: [['09:00', '17:00']], 6: [['10:00', '14:00']] },
  length: 45,
  between: 15,
  holidays: { '2026-10-03': 'German Unity Day' },
  bookings: { model: 'drive', field: 'start', endField: 'stop', same: ['car'] },
};

const ask = (more: Partial<SlotsRequest> = {}): SlotsRequest => ({
  model: 'drive',
  field: 'start',
  recordId: null,
  schedule: 'showroom',
  from: '2026-10-19',
  to: '2026-10-25',
  timeZone: 'Europe/Berlin',
  values: { car: { id: 1, label: 'Model 3' } },
  ...more,
});

const free = (iso: string[] | undefined) => (iso ?? []).map((at) => new Date(at).toLocaleTimeString('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }));

describe('the memory source’s free times, from a schedule', () => {
  const now = () => new Date('2026-10-16T08:00:00Z');

  it('answers each day asked: its times a booking apart, open, closed or a holiday', async () => {
    const ds = createMemoryDataSource({ slots: scheduleSlots({ showroom: SHOWROOM }, { now }) });
    const { days, length } = await ds.slots(ask({ from: '2026-10-03', to: '2026-10-05' }));
    expect(length).toBe(45);
    // 3 October is a holiday, by its name; Sunday the 4th has no hours.
    expect(days['2026-10-03']).toEqual({ state: 'holiday', note: 'German Unity Day' });
    expect(days['2026-10-04']).toEqual({ state: 'closed' });
    // Past days are closed: every time on them has gone by.
    expect(days['2026-10-05']).toEqual({ state: 'closed' });
    const week = await ds.slots(ask());
    // Monday: 09:00, 10:00, 11:00 before the break (45 minutes and 15 free each), then 13:00 to 16:00.
    expect(free(week.days['2026-10-19'].free)).toEqual(['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']);
    expect(week.days['2026-10-19'].state).toBe('open');
    expect(free(week.days['2026-10-24'].free)).toEqual(['10:00', '11:00', '12:00', '13:00']);
    expect(week.days['2026-10-25']).toEqual({ state: 'closed' });
    // In UTC, as a source writes instants: 09:00 in Berlin's summer is 07:00Z.
    expect(week.days['2026-10-19'].free?.[0]).toBe('2026-10-19T07:00:00.000Z');
  });

  it('keeps to the clock on the day the clocks go back, and after it', async () => {
    const ds = createMemoryDataSource({ slots: scheduleSlots({ showroom: { ...SHOWROOM, hours: { 1: [['09:00', '10:00']], 7: [['01:00', '04:00']] } } }, { now }) });
    const { days } = await ds.slots(ask({ from: '2026-10-25', to: '2026-10-26', length: 60, between: 0 }));
    // 02:00 comes twice on Sunday the 25th: taken the first time, in summer time.
    expect(days['2026-10-25'].free).toEqual(['2026-10-24T23:00:00.000Z', '2026-10-25T00:00:00.000Z', '2026-10-25T02:00:00.000Z']);
    // Monday 09:00 is 08:00Z, in winter time now.
    expect(days['2026-10-26'].free).toEqual(['2026-10-26T08:00:00.000Z']);
  });

  it('leaves out a time the clocks skip', async () => {
    const ds = createMemoryDataSource({ slots: scheduleSlots({ night: { timeZone: 'Europe/Berlin', hours: { 7: [['01:00', '04:00']] }, length: 60 } }, { now: () => new Date('2026-03-01T00:00:00Z') }) });
    const { days } = await ds.slots(ask({ schedule: 'night', from: '2026-03-29', to: '2026-03-29' }));
    expect(free(days['2026-03-29'].free)).toEqual(['01:00', '03:00']);
  });

  it('counts a booking against the times it meets, and the minutes kept free after it, for its own car alone', async () => {
    const records = {
      drive: {
        1: { car: { id: 1, label: 'Model 3' }, start: '2026-10-19T08:00:00.000Z', stop: '2026-10-19T08:45:00.000Z' },
        2: { car: { id: 2, label: 'Model Y' }, start: '2026-10-19T11:00:00.000Z', stop: '2026-10-19T11:45:00.000Z' },
        // An hour and a half: 14:30 to 16:00, which meets 14:00 (and its 15 minutes after), 15:00 and 16:00.
        3: { car: { id: 1, label: 'Model 3' }, start: '2026-10-19T12:30:00.000Z', stop: '2026-10-19T14:00:00.000Z' },
      },
    };
    const ds = createMemoryDataSource({ records, slots: scheduleSlots({ showroom: SHOWROOM }, { now }) });
    const { days } = await ds.slots(ask({ from: '2026-10-19', to: '2026-10-19' }));
    expect(free(days['2026-10-19'].free)).toEqual(['09:00', '11:00', '13:00']);
    // The other car's day is its own.
    const other = await ds.slots(ask({ from: '2026-10-19', to: '2026-10-19', values: { car: { id: 2, label: 'Model Y' } } }));
    expect(free(other.days['2026-10-19'].free)).toEqual(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']);
    // The record booked: its own time is free to it.
    const own = await ds.slots(ask({ from: '2026-10-19', to: '2026-10-19', recordId: 1 }));
    expect(free(own.days['2026-10-19'].free)).toEqual(['09:00', '10:00', '11:00', '13:00']);
  });

  it('says a day is full when every time is taken, and leaves out times gone by today', async () => {
    const records = { drive: { 1: { car: { id: 1 }, start: '2026-10-24T08:00:00.000Z', stop: '2026-10-24T12:00:00.000Z' } } };
    const ds = createMemoryDataSource({ records, slots: scheduleSlots({ showroom: SHOWROOM }, { now: () => new Date('2026-10-19T10:30:00Z') }) });
    const { days } = await ds.slots(ask());
    expect(days['2026-10-24']).toEqual({ state: 'full' });
    // 12:30 in Berlin on Monday: 13:00 onwards is left.
    expect(free(days['2026-10-19'].free)).toEqual(['13:00', '14:00', '15:00', '16:00']);
  });

  it('refuses a schedule it does not have, and has none without schedules', async () => {
    const ds = createMemoryDataSource({ slots: scheduleSlots({ showroom: SHOWROOM }) });
    await expect(ds.slots(ask({ schedule: 'garage' }))).rejects.toThrow('No schedule "garage"');
    await expect(createMemoryDataSource().slots(ask())).rejects.toThrow('No schedule "showroom"');
  });
});

const BOOKING: Page = {
  fieldia: '0.3',
  id: 'drive',
  timeZone: 'Europe/Berlin',
  data: { kind: 'record', model: 'drive' },
  fields: {
    car: { type: 'many2one', label: 'Car', relation: 'car' },
    start: { type: 'datetime', label: 'Starts' },
    stop: { type: 'datetime', label: 'Ends' },
    note: { type: 'char', label: 'Note' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      {
        type: 'section',
        id: 's',
        children: [
          { type: 'field', id: 'f-car', field: 'car' },
          { type: 'field', id: 'f-start', field: 'start', widget: 'slots', options: { schedule: 'showroom', endField: 'stop', dependsOn: ['car'], length: 45, between: 15 } },
          { type: 'field', id: 'f-note', field: 'note' },
        ],
      },
    ],
  },
};

describe('the form’s findSlots', () => {
  it('asks the source with the record, its values, the field’s zone and the page’s settings', async () => {
    const ds = createMemoryDataSource({ records: { drive: { 4: { car: { id: 1, label: 'Model 3' }, start: null, stop: null, note: 'Bring a licence' } } }, slots: scheduleSlots({ showroom: SHOWROOM }, { now: () => new Date('2026-10-16T08:00:00Z') }) });
    const form = createForm({ page: BOOKING, dataSource: ds, recordId: 4 });
    await form.load();
    expect(form.canFindSlots()).toBe(true);
    const found = await form.findSlots('start', { from: '2026-10-19', to: '2026-10-19', schedule: 'showroom', length: 45, between: 15 });
    expect(found.days['2026-10-19'].state).toBe('open');
    expect(ds.calls.at(-1)).toEqual({
      method: 'slots',
      request: { model: 'drive', field: 'start', recordId: 4, schedule: 'showroom', from: '2026-10-19', to: '2026-10-19', timeZone: 'Europe/Berlin', length: 45, between: 15, values: { car: { id: 1, label: 'Model 3' }, start: null, stop: null, note: 'Bring a licence' } },
    });
  });

  it('asks for the field’s name as its schedule, in the browser’s zone where nothing names one', async () => {
    const calls: SlotsRequest[] = [];
    const form = createForm({ page: { ...BOOKING, timeZone: undefined }, dataSource: { slots: async (request) => (calls.push(request), { days: {} }) } });
    await form.findSlots('start', { from: '2026-10-19', to: '2026-10-20' });
    expect(calls[0]).toMatchObject({ schedule: 'start', model: 'drive', recordId: null, timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone });
    expect(calls[0]).not.toHaveProperty('length');
  });

  it('has no free times to find from a source without slots', async () => {
    const form = createForm({ page: BOOKING, dataSource: {} });
    expect(form.canFindSlots()).toBe(false);
    await expect(form.findSlots('start', { from: '2026-10-19', to: '2026-10-20' })).rejects.toThrow('slots()');
  });
});

describe('a field drawn as booking slots, in the page format', () => {
  const issues = (page: Page) => {
    const full = validatePage(page);
    const quick = checkPage(page);
    return { full: full.ok ? [] : full.issues.map((i) => `${i.path}: ${i.message}`), quick: quick.ok ? [] : quick.issues.map((i) => `${i.path}: ${i.message}`) };
  };
  const withNode = (options: Record<string, unknown>, field = 'start') => {
    const page = structuredClone(BOOKING);
    const section = (page.layout as unknown as { children: { children: Record<string, unknown>[] }[] }).children[0];
    section.children[1] = { type: 'field', id: 'f-start', field, widget: 'slots', options };
    return page;
  };

  it('takes its schedule, a booking’s length, the minutes between, its end and what it depends on', () => {
    expect(issues(BOOKING)).toEqual({ full: [], quick: [] });
  });

  it('refuses settings written wrong, and fields it cannot use', () => {
    expect(issues(withNode({ length: 0, between: -5 })).full).toEqual([expect.stringMatching(/options\.length/), expect.stringMatching(/options\.between/)]);
    expect(issues(withNode({ endField: 'note' })).quick).toEqual(['layout.children[0].children[1].options.endField: "note" is a char; a booking\'s end is kept in a datetime field']);
    expect(issues(withNode({ endField: 'start' })).quick).toEqual(['layout.children[0].children[1].options.endField: a booking ends in another field than the one it starts in']);
    expect(issues(withNode({ dependsOn: ['colour'] })).quick).toEqual([expect.stringMatching(/options\.dependsOn\[0\]: .*colour/)]);
    expect(issues(withNode({}, 'note')).quick).toEqual(['layout.children[0].children[1].widget: slots is for a datetime field; "note" is a char']);
  });
});
