import { createMemoryDataSource, type ListCalendar, type Page, type Values } from '@fieldia/core';

/** Wednesday 14 October 2026, 09:40 in the reader's own time: "now" in these tests. */
export const NOW = new Date(2026, 9, 14, 9, 40);
/** A moment on a day of that week, as the date widgets write one. */
export const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).toISOString();

/** A clinic's appointments, by doctor. */
export function clinicPage(calendar: Partial<ListCalendar> = {}): Page {
  return {
    fieldia: '0.1',
    id: 'appointments',
    title: 'Appointments',
    // British English: its week from Monday, as CLDR has the United Kingdom's (these tests' weeks run so).
    language: 'en-GB',
    data: { kind: 'record', model: 'clinic.appointment' },
    fields: {
      patient: { type: 'char', label: 'Patient' },
      start: { type: 'datetime', label: 'Starts' },
      stop: { type: 'datetime', label: 'Ends' },
      doctor: { type: 'many2one', label: 'Doctor', relation: 'clinic.doctor' },
      kind: { type: 'selection', label: 'Kind', options: [{ value: 'check', label: 'Check-up' }, { value: 'surgery', label: 'Surgery' }] },
      leave: { type: 'date', label: 'Leave from' },
      back: { type: 'date', label: 'Back on' },
    },
    layout: {
      type: 'list',
      id: 'list',
      columns: ['patient', 'start', 'doctor'],
      sort: [{ field: 'start' }],
      filters: [{ id: 'surgery', label: 'Surgery', filter: [{ field: 'kind', op: '=', value: 'surgery' }] }],
      calendar: { start: 'start', end: 'stop', title: 'patient', resource: 'doctor', colour: 'kind', opens: 'calendar', view: 'week', ...calendar },
    },
  };
}

export const KARIM = { id: 1, label: 'Dr Karim' };
export const SALMA = { id: 2, label: 'Dr Salma' };

export function clinicRecords(): Record<string, Values> {
  return {
    1: { patient: 'Mona Adel', start: at(14, 10), stop: at(14, 10, 30), doctor: KARIM, kind: 'check' },
    2: { patient: 'Omar Said', start: at(14, 10, 15), stop: at(14, 11), doctor: KARIM, kind: 'surgery' },
    3: { patient: 'Laila Hany', start: at(15, 13), stop: at(15, 14), doctor: SALMA, kind: 'check' },
    4: { patient: 'Walk-in', start: at(14, 12), stop: at(14, 12, 30), doctor: null, kind: 'check' },
    5: { patient: 'Next week', start: at(21, 9), stop: at(21, 10), doctor: SALMA, kind: 'check' },
  };
}

export function clinicSource(records: Record<string, Values> = clinicRecords()) {
  return createMemoryDataSource({
    records: {
      'clinic.appointment': records,
      'clinic.doctor': { 1: { name: 'Dr Karim' }, 2: { name: 'Dr Salma' }, 3: { name: 'Dr Nour' } },
    },
  });
}

/** Wait, up to two seconds, for something the calendar does once an answer comes back. */
export async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}

export const key = (target: Element, name: string, more: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...more }));
