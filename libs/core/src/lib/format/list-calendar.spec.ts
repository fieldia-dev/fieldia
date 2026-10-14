import { pageWords, translatePage, validatePage, type ListNode, type Page } from '../../index';

/**
 * A list's records on a calendar (`calendar` on a list node, drawn by
 * @fieldia/calendar): when each one starts and ends, its words, its colour,
 * the person or room it is with, the views offered, the week's first day and
 * the hours shown. The page says it all by field names, so a missing field or
 * one of the wrong kind is refused here, before anything draws.
 */

const fields = {
  patient: { type: 'char', label: 'Patient' },
  start: { type: 'datetime', label: 'Starts' },
  stop: { type: 'datetime', label: 'Ends' },
  day: { type: 'date', label: 'Day' },
  last: { type: 'date', label: 'Last day' },
  doctor: { type: 'many2one', label: 'Doctor', relation: 'clinic.doctor' },
  room: { type: 'selection', label: 'Room', options: [{ value: 'a', label: 'Room A' }] },
  kind: { type: 'selection', label: 'Kind', options: [{ value: 'check', label: 'Check-up' }] },
  fee: { type: 'monetary', label: 'Fee', currency: 'EGP' },
  notes: { type: 'html', label: 'Notes' },
  spot: { type: 'json', label: 'Place' },
};

const page = (calendar: Record<string, unknown>, more: Record<string, unknown> = {}) => ({
  fieldia: '0.1',
  id: 'appointments',
  data: { kind: 'record', model: 'clinic.appointment' },
  fields,
  layout: { type: 'list', id: 'list', columns: ['patient', 'start'], calendar, ...more },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a list on a calendar', () => {
  it('takes a start, an end, its words, a colour, a column per person, the views, the first day and the hours', () => {
    expect(
      problems(
        page({
          start: 'start',
          end: 'stop',
          title: 'patient',
          colour: 'kind',
          resource: 'doctor',
          views: ['day', 'week', 'month', 'agenda'],
          view: 'day',
          opens: 'calendar',
          firstDay: 6,
          hours: { start: 8, end: 20 },
          slot: 15,
        })
      )
    ).toEqual([]);
    // The least it needs: when each record starts, and its words.
    expect(problems(page({ start: 'start', title: 'patient' }))).toEqual([]);
    // A day of its own, from one day to another: all day.
    expect(problems(page({ start: 'day', end: 'last', title: 'patient', resource: 'room', views: ['month', 'agenda'] }))).toEqual([]);
  });

  it('refuses what is not a calendar: a view it does not know, a day of the week past Saturday, hours out of the day', () => {
    expect(problems(page({ start: 'start', title: 'patient', views: ['year'] }))).not.toEqual([]);
    expect(problems(page({ start: 'start', title: 'patient', views: [] }))).not.toEqual([]);
    expect(problems(page({ start: 'start', title: 'patient', firstDay: 7 }))).not.toEqual([]);
    expect(problems(page({ start: 'start', title: 'patient', hours: { start: -1, end: 20 } }))).not.toEqual([]);
    expect(problems(page({ start: 'start', title: 'patient', hours: { start: 8, end: 25 } }))).not.toEqual([]);
    expect(problems(page({ start: 'start', title: 'patient', slot: 20 }))).not.toEqual([]);
    expect(problems(page({ start: 'start', title: 'patient', opens: 'map' }))).not.toEqual([]);
    // Its title is not left to chance.
    expect(problems(page({ start: 'start' }))).not.toEqual([]);
  });

  it('refuses a field the page lacks, and one of the wrong kind, saying which', () => {
    expect(problems(page({ start: 'begins', title: 'who' }))).toEqual(['layout.calendar.start: no field "begins"', 'layout.calendar.title: no field "who"']);
    expect(problems(page({ start: 'patient', title: 'patient' }))).toEqual(['layout.calendar.start: "patient" is a char; a calendar\'s start is a date, or a date and time']);
    expect(problems(page({ start: 'start', end: 'day', title: 'patient' }))).toEqual(['layout.calendar.end: "day" is a date; an end is the same kind of field as its start, a datetime']);
    expect(problems(page({ start: 'start', title: 'patient', resource: 'fee' }))).toEqual(['layout.calendar.resource: "fee" is a monetary; a column for each comes from a link, a choice, text or a whole number']);
    expect(problems(page({ start: 'start', title: 'patient', colour: 'notes' }))).toEqual(['layout.calendar.colour: "notes" is a html; a colour comes from a link, a choice, text, a whole number or a yes or no']);
    expect(problems(page({ start: 'start', title: 'spot' }))).toEqual(['layout.calendar.title: "spot" is a json; a record\'s words on a calendar are a field that can be said']);
    expect(problems(page({ start: 'start', title: 'patient', resource: 'nobody' }))).toEqual(['layout.calendar.resource: no field "nobody"']);
  });

  it('says what does not add up: a view opened on that is not offered, hours that end before they start, the same view twice', () => {
    expect(problems(page({ start: 'start', title: 'patient', views: ['week', 'month'], view: 'day' }))).toEqual(['layout.calendar.view: "day" is not one of its views (week, month)']);
    expect(problems(page({ start: 'start', title: 'patient', hours: { start: 18, end: 9 } }))).toEqual(['layout.calendar.hours: the hours end at 9, before they start at 18']);
    expect(problems(page({ start: 'start', title: 'patient', views: ['week', 'week'] }))).toEqual(['layout.calendar.views[1]: "week" is offered twice']);
  });

  it('names fields, never words: a translation leaves it as it is', () => {
    const named = page({ start: 'start', end: 'stop', title: 'patient', colour: 'kind', resource: 'doctor' }) as unknown as Page;
    const after = translatePage(named, (words) => `«${words}»`);
    expect((after.layout as ListNode).calendar).toEqual((named.layout as ListNode).calendar);
    expect(validatePage(after).ok).toBe(true);
    expect(pageWords(named)).not.toContain('patient');
  });

  it('opens one way: on its map or on its calendar, not both', () => {
    const both = page({ start: 'start', title: 'patient', opens: 'calendar' }, { map: { point: 'spot', view: 'map' } });
    expect(problems(both)).toEqual(['layout.calendar.opens: the list opens on its map (map.view) and on its calendar: say one']);
    // The table first, with the map beside it, and the calendar a press away: fine.
    expect(problems(page({ start: 'start', title: 'patient' }, { map: { point: 'spot', view: 'both' } }))).toEqual([]);
  });
});
