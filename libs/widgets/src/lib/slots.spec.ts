import { createForm, createMemoryDataSource, scheduleSlots, type DataSource, type FieldNode, type MemorySchedule, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { press } from './test-kinds';
import { createWidget } from './widgets';

/**
 * Booking slots (slots.ts), as a person books a test drive at a showroom in
 * Berlin from a browser on another clock (the machine's: UTC on CI): the
 * month's days shaded by how they are booked, a day's free times as chips,
 * the arrows across both, a time picked checked with the source once more —
 * and a time someone else took meanwhile said, never booked.
 */

const NOW = () => new Date('2026-10-16T08:00:00Z');
const SHOWROOM: MemorySchedule = {
  timeZone: 'Europe/Berlin',
  hours: { 1: [['09:00', '12:00']], 2: [['09:00', '12:00']], 3: [['09:00', '12:00']], 4: [['09:00', '12:00']], 5: [['09:00', '12:00']], 6: [['10:00', '12:00']] },
  length: 45,
  between: 15,
  holidays: { '2026-10-30': 'Staff training' },
  bookings: { model: 'drive', field: 'start', endField: 'stop', same: ['car'] },
};

const PAGE: Page = {
  fieldia: '0.6',
  id: 'drive',
  timeZone: 'Europe/Berlin',
  data: { kind: 'record', model: 'drive' },
  fields: {
    car: { type: 'many2one', label: 'Car', relation: 'car' },
    start: { type: 'datetime', label: 'Test drive' },
    stop: { type: 'datetime', label: 'Ends' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [{ type: 'field', id: 'f-start', field: 'start', widget: 'slots', options: { schedule: 'showroom', endField: 'stop', dependsOn: ['car'] } }],
  },
};

const settle = () => new Promise((done) => setTimeout(done, 0));
/** A day as the page's English names it, as Intl writes it where the tests run ("Thursday 15 October 2026", or with a comma). */
const named = (year: number, month: number, day: number) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' }).format(new Date(year, month - 1, day));
const said = (el: HTMLElement) => el.querySelector('.fd-slots-said')?.textContent;

async function mount(more: { dataSource?: DataSource; values?: Record<string, unknown>; readonly?: boolean; page?: Page } = {}) {
  const dataSource = more.dataSource ?? createMemoryDataSource({ slots: scheduleSlots({ showroom: SHOWROOM }, { now: NOW }) });
  const page = more.page ?? PAGE;
  const form = createForm({ page, dataSource, now: NOW, values: { car: { id: 1, label: 'Model 3' }, ...more.values } as never });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'start', field: form.page.fields['start'], node, id: 'fd-start', document, labels: WIDGET_LABELS.en, locale: 'en' });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['start'], values: form.getState().values, readonly: more.readonly ?? false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  await settle();
  const el = widget.element;
  const day = (n: number) => [...el.querySelectorAll<HTMLButtonElement>('.fd-slots-days button')].find((b) => b.textContent === String(n) && !b.classList.contains('fd-outside')) as HTMLButtonElement;
  const chips = () => [...el.querySelectorAll<HTMLButtonElement>('.fd-slots-chip')];
  return { form, widget, el, day, chips, dataSource, times: () => chips().map((chip) => chip.textContent) };
}

describe('booking slots', () => {
  it('shades the month’s days by how they are booked, today on the zone’s clock', async () => {
    const { el, day } = await mount();
    expect(el.querySelector('.fd-calendar-title')?.textContent).toBe('October 2026');
    expect(day(16).getAttribute('aria-current')).toBe('date');
    expect(day(15).dataset['state']).toBe('past');
    expect(day(15).getAttribute('aria-label')).toBe(`${named(2026, 10, 15)}, Closed`);
    // Monday the 19th: 09:00, 10:00 and 11:00, 45 minutes each and 15 kept free after.
    expect(day(19).dataset['state']).toBe('open');
    expect(day(19).getAttribute('aria-label')).toBe(`${named(2026, 10, 19)}, 3 free times`);
    // Today, the 16th: 10:00 in Berlin, so 11:00 is left.
    expect(day(16).getAttribute('aria-label')).toBe(`${named(2026, 10, 16)}, 1 free time`);
    expect(day(18).dataset['state']).toBe('closed');
    expect(day(30).dataset['state']).toBe('holiday');
    expect(day(30).getAttribute('aria-label')).toBe(`${named(2026, 10, 30)}, Holiday: Staff training`);
    // The zone the times are on, said: not the machine's.
    // By its name all year: October holds both CEST and CET (the clocks go back on the 25th).
    expect(el.querySelector('.fd-slots-zone')?.textContent).toBe('Times are Central European Time');
    expect(el.querySelector('.fd-slots-heading')?.textContent).toBe('Pick a day to see its free times.');
  });

  it('shows a day’s free times as the arrows move across the month, and picks one from the keyboard', async () => {
    const { form, el, day, chips, times } = await mount();
    day(16).focus();
    press(day(16), 'ArrowRight');
    // Saturday the 17th, in focus: its times are shown.
    expect(document.activeElement?.textContent).toBe('17');
    expect(el.querySelector('.fd-slots-heading')?.textContent).toBe('Free times on Saturday 17 October');
    expect(times()).toEqual(['10:00', '11:00']);
    press(document.activeElement as Element, 'ArrowDown');
    expect(document.activeElement?.textContent).toBe('24');
    press(document.activeElement as Element, 'ArrowUp');
    // Sunday the 18th is closed; Monday the 19th has three.
    press(document.activeElement as Element, 'ArrowRight');
    expect(times()).toEqual([]);
    expect(el.querySelector('.fd-slots-heading')?.textContent).toBe('No free times on Sunday 18 October');
    press(document.activeElement as Element, 'ArrowRight');
    expect(times()).toEqual(['09:00', '10:00', '11:00']);
    // Into the times: one stop, the arrows among them, Enter picks.
    press(document.activeElement as Element, 'Enter');
    expect(document.activeElement).toBe(chips()[0]);
    expect(chips()[0].getAttribute('aria-label')).toBe('09:00 to 09:45');
    press(chips()[0], 'ArrowRight');
    expect(document.activeElement).toBe(chips()[1]);
    press(chips()[1], 'Enter');
    await settle();
    // 10:00 in Berlin on Monday the 19th is 08:00 UTC; the drive ends 45 minutes later.
    expect(form.getState().values['start']).toBe('2026-10-19T08:00:00.000Z');
    expect(form.getState().values['stop']).toBe('2026-10-19T08:45:00.000Z');
    expect(chips()[1].getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(chips()[1]);
    expect(el.querySelector('.fd-slots-chosen')?.textContent).toBe(`${named(2026, 10, 19)}, 10:00 to 10:45 CEST`);
    // Escape goes back to the day.
    press(chips()[1], 'Escape');
    expect(document.activeElement?.textContent).toBe('19');
  });

  it('says a time someone else booked meanwhile, books nothing, and draws the day’s times as they are now', async () => {
    const { form, el, day, chips, times, dataSource } = await mount();
    day(19).click();
    expect(times()).toEqual(['09:00', '10:00', '11:00']);
    // Someone else books 10:00 on another screen.
    (dataSource as ReturnType<typeof createMemoryDataSource>).records['drive'] = { 9: { car: { id: 1, label: 'Model 3' }, start: '2026-10-19T08:00:00.000Z', stop: '2026-10-19T08:45:00.000Z' } };
    chips()[1].click();
    expect(said(el)).toBe('Checking 10:00…');
    await settle();
    expect(form.getState().values['start']).toBeNull();
    expect(said(el)).toBe('10:00 was just booked by someone else. Pick another time.');
    expect(times()).toEqual(['09:00', '11:00']);
    expect(day(19).getAttribute('aria-label')).toBe(`${named(2026, 10, 19)}, 2 free times`);
    // The focus stays among the times, on the next one.
    expect(document.activeElement).toBe(chips()[1]);
  });

  it('asks again when a field it depends on changes: another car’s times are its own', async () => {
    const records = { drive: { 9: { car: { id: 2, label: 'Model Y' }, start: '2026-10-19T07:00:00.000Z', stop: '2026-10-19T07:45:00.000Z' } } };
    const { form, day, times, dataSource } = await mount({ dataSource: createMemoryDataSource({ records, slots: scheduleSlots({ showroom: SHOWROOM }, { now: NOW }) }) });
    day(19).click();
    expect(times()).toEqual(['09:00', '10:00', '11:00']);
    const asked = (dataSource as ReturnType<typeof createMemoryDataSource>).calls.filter((call) => call.method === 'slots').length;
    form.setValue('car', { id: 2, label: 'Model Y' });
    await settle();
    expect((dataSource as ReturnType<typeof createMemoryDataSource>).calls.filter((call) => call.method === 'slots').length).toBe(asked + 1);
    expect(times()).toEqual(['10:00', '11:00']);
  });

  it('asks again once a response is sent: the next one, started over, is never offered the time the last one booked', async () => {
    // A page of responses whose source keeps each booking sent, as a clinic's server does.
    const page: Page = { ...PAGE, id: 'book', data: { kind: 'responses' } };
    const memory = createMemoryDataSource({
      slots: scheduleSlots({ showroom: { ...SHOWROOM, bookings: { model: 'drive', field: 'start', endField: 'stop' } } }, { now: NOW }),
      submitted: (request, count) => {
        memory.records['drive'] = { ...memory.records['drive'], [count]: request.values };
        return { id: count };
      },
    });
    const { form, day, chips, times } = await mount({ dataSource: memory, page });
    day(19).click();
    expect(times()).toEqual(['09:00', '10:00', '11:00']);
    chips()[1].click();
    await settle();
    expect(form.getState().values['start']).toBe('2026-10-19T08:00:00.000Z');
    expect(await form.save()).toBe(true);
    // Booked; Book another: 10:00 is gone from the 19th's times, without anything pressed.
    form.reset();
    await settle();
    day(19).click();
    expect(times()).toEqual(['09:00', '11:00']);
  });

  it('opens on the day of a booking held, its time pressed though no longer free to others', async () => {
    const { el, chips } = await mount({ values: { start: '2026-11-03T09:00:00.000Z', stop: '2026-11-03T09:45:00.000Z' } });
    expect(el.querySelector('.fd-calendar-title')?.textContent).toBe('November 2026');
    expect(el.querySelector('.fd-slots-days [aria-pressed="true"]')?.textContent).toBe('3');
    expect(chips().find((chip) => chip.getAttribute('aria-pressed') === 'true')?.textContent).toBe('10:00');
    // November is winter time.
    expect(el.querySelector('.fd-slots-chosen')?.textContent).toBe(`${named(2026, 11, 3)}, 10:00 to 10:45 CET`);
  });

  it('says the free times could not be found, with Try again', async () => {
    let fail = true;
    const memory = createMemoryDataSource({ slots: scheduleSlots({ showroom: SHOWROOM }, { now: NOW }) });
    const dataSource: DataSource = { slots: (request) => (fail ? Promise.reject(new Error('offline')) : memory.slots(request)) };
    const { el, day, times } = await mount({ dataSource });
    day(19).click();
    expect(said(el)).toBe('The free times could not be found.');
    fail = false;
    (el.querySelector('.fd-slots-retry') as HTMLButtonElement).click();
    await settle();
    expect(times()).toEqual(['09:00', '10:00', '11:00']);
    expect((el.querySelector('.fd-slots-retry') as HTMLElement).hidden).toBe(true);
  });

  it('is the date and time box where the data source has no slots: hidden, never disabled', async () => {
    const { el } = await mount({ dataSource: {} });
    expect(el.querySelector('.fd-slots')).toBeNull();
    expect(el.querySelector('input.fd-datetime')).not.toBeNull();
  });

  it('read only, is the booking in words', async () => {
    const { el } = await mount({ values: { start: '2026-11-03T09:00:00.000Z' }, readonly: true });
    expect((el.querySelector('.fd-slots-picker') as HTMLElement).hidden).toBe(true);
    expect(el.querySelector('.fd-slots-resting')?.textContent).toBe('3 Nov 2026, 10:00 CET');
  });
});
