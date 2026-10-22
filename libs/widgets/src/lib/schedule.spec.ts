import { createForm, scheduleSlots, createMemoryDataSource, type Field, type FieldNode, type Page, type Values } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { hoursWords, shiftProblem, weekHours } from './hours';
import { createWidget } from './widgets';

/**
 * A repeat field and a week's opening hours, drawn and changed as a person does: the rule kept as iCalendar's RRULE
 * and said in words; the hours as a booking schedule reads them, a day's shifts checked, copied to every day.
 */

const page = {
  fieldia: '0.9',
  id: 'course',
  data: { kind: 'record', model: 'course' },
  fields: {
    first_session: { type: 'date', label: 'First session' },
    sessions: { type: 'char', label: 'Sessions' },
    hours: { type: 'json', label: 'Opening hours' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-sessions', field: 'sessions', widget: 'repeat', options: { startField: 'first_session' } },
      { type: 'field', id: 'f-hours', field: 'hours', widget: 'hours' },
    ],
  },
} as unknown as Page;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(field: 'sessions' | 'hours', values: Values = {}) {
  const form = createForm({ page, values: { first_session: '2026-11-03', ...values } });
  const node = (page.layout as { children: FieldNode[] }).children.find((one) => one.field === field) as FieldNode;
  const widget = createWidget({ form, name: field, field: page.fields[field] as Field, node, id: `fd-${field}`, document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values[field], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  await settle();
  return { form, el: widget.element, value: () => form.getState().values[field] };
}

const pick = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};
const typeIn = (input: HTMLInputElement, text: string) => {
  input.focus();
  input.value = text;
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
};

describe('a repeat field', () => {
  it('starts weekly on the day its start falls on, and is said in words', async () => {
    const { el, value } = await mount('sessions');
    expect(el.querySelector('.fd-repeat-words')?.textContent).toBe('Does not repeat');
    pick(el.querySelector('select[aria-label="Repeats"]') as HTMLSelectElement, 'WEEKLY');
    // 3 November 2026 is a Tuesday.
    expect(value()).toBe('FREQ=WEEKLY;BYDAY=TU');
    expect(el.querySelector('.fd-repeat-words')?.textContent).toBe('Every week on Tuesday');
    expect(el.querySelector('[data-day="TU"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('takes days, every how many weeks and an end in times, all in the rule', async () => {
    const { el, value } = await mount('sessions', { sessions: 'FREQ=WEEKLY;BYDAY=TU' });
    (el.querySelector('[data-day="TH"]') as HTMLButtonElement).click();
    typeIn(el.querySelector('#fd-sessions-interval') as HTMLInputElement, '2');
    pick(el.querySelector('select[aria-label="Ends"]') as HTMLSelectElement, 'count');
    expect(value()).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=6');
    expect(el.querySelector('.fd-repeat-words')?.textContent).toBe('Every 2 weeks on Tuesday and Thursday, 6 times');
    // Every box named: how many times by the word after it, the last day by its own.
    expect(el.querySelector('label[for="fd-sessions-count"]')?.textContent).toBe('times');
    expect(el.querySelector('#fd-sessions-count')).not.toBeNull();
    expect(el.querySelector('.fd-repeat-end-part:not(.fd-repeat-count) input')?.getAttribute('aria-label')).toBe('Last day');
  });

  it('refuses an interval of none, kept as typed and said, the rule as it was', async () => {
    const { el, form, value } = await mount('sessions', { sessions: 'FREQ=DAILY' });
    typeIn(el.querySelector('#fd-sessions-interval') as HTMLInputElement, '0');
    expect(value()).toBe('FREQ=DAILY');
    expect(form.getState().unread['sessions.interval']?.message).toBe('A whole number, 1 or more');
    expect(form.problem('sessions')).toBe('A whole number, 1 or more');
    expect(form.validate()).toBe(false);
  });

  it('a month: by its day, its last, or the first weekday, from the start', async () => {
    const { el, value } = await mount('sessions');
    pick(el.querySelector('select[aria-label="Repeats"]') as HTMLSelectElement, 'MONTHLY');
    expect(value()).toBe('FREQ=MONTHLY;BYMONTHDAY=3');
    const way = el.querySelector('.fd-repeat-month select') as HTMLSelectElement;
    pick(way, 'nth');
    expect(value()).toBe('FREQ=MONTHLY;BYDAY=1TU');
    expect(el.querySelector('.fd-repeat-words')?.textContent).toBe('Every month on the first Tuesday');
    pick(way, 'last');
    expect(value()).toBe('FREQ=MONTHLY;BYMONTHDAY=-1');
  });

  it('keeps a rule it cannot change as it is, saying so', async () => {
    const { el, value } = await mount('sessions', { sessions: 'FREQ=WEEKLY;BYHOUR=9' });
    expect(el.querySelector('.fd-repeat-words')?.textContent).toBe('Kept as it is, which this box cannot change: FREQ=WEEKLY;BYHOUR=9');
    expect(value()).toBe('FREQ=WEEKLY;BYHOUR=9');
  });
});

describe("a week's opening hours", () => {
  const MONDAY = { '1': [['09:00', '13:00'], ['14:00', '18:00']] };

  it('says the week in words, days in a row with the same hours together', () => {
    const week = { '1': [['09:00', '17:00']], '2': [['09:00', '17:00']], '3': [['09:00', '17:00']], '6': [['10:00', '14:00']] };
    expect(hoursWords(week, 'en', WIDGET_LABELS.en)).toBe('Mon–Wed 09:00–17:00 · Thu–Fri closed · Sat 10:00–14:00 · Sun closed');
    expect(hoursWords({}, 'en', WIDGET_LABELS.en)).toBe('Closed every day');
    expect(hoursWords(week, 'en', WIDGET_LABELS.en, 6)).toBe('Sat 10:00–14:00 · Sun closed · Mon–Wed 09:00–17:00 · Thu–Fri closed');
  });

  it('finds a shift ending before it starts, and two that overlap', () => {
    expect(shiftProblem([['13:00', '09:00']], 'Monday', WIDGET_LABELS.en)).toBe('Monday: 13:00–09:00 ends before it starts');
    expect(shiftProblem([['09:00', '13:00'], ['12:00', '15:00']], 'Monday', WIDGET_LABELS.en)).toBe('Monday: 09:00–13:00 and 12:00–15:00 overlap');
    expect(shiftProblem([['09:00', '13:00'], ['14:00', '18:00']], 'Monday', WIDGET_LABELS.en)).toBeNull();
  });

  it('opens a day with the hours of the open day before it, closes it, and copies a day to every day', async () => {
    const { el, value } = await mount('hours', { hours: MONDAY });
    const tuesday = el.querySelector('[data-day="2"] input[type="checkbox"]') as HTMLInputElement;
    tuesday.click();
    expect(value()).toEqual({ ...MONDAY, '2': MONDAY['1'] });
    tuesday.click();
    expect(value()).toEqual(MONDAY);
    const copy = [...el.querySelectorAll<HTMLButtonElement>('[data-day="1"] button')].find((button) => button.textContent === 'Copy to all days') as HTMLButtonElement;
    copy.click();
    expect(Object.keys(weekHours(value()))).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });

  it('adds a break in the last shift, an hour at its middle', async () => {
    const { el, value } = await mount('hours', { hours: { '3': [['09:00', '17:00']] } });
    // Each box named by its day and end.
    expect([...el.querySelectorAll('[data-day="3"] .fd-hours-shift input')].map((box) => box.getAttribute('aria-label'))).toEqual(['Wednesday: opens', 'Wednesday: closes']);
    const add =[...el.querySelectorAll<HTMLButtonElement>('[data-day="3"] button')].find((button) => button.textContent === 'Add a break') as HTMLButtonElement;
    add.click();
    expect(value()).toEqual({ '3': [['09:00', '12:30'], ['13:30', '17:00']] });
  });

  it('a shift that ends before it starts is said under its day, and the form refuses to save', async () => {
    const { el, form } = await mount('hours', { hours: { '1': [['13:00', '09:00']] } });
    await settle();
    expect(el.querySelector('[data-day="1"] .fd-hours-error')?.textContent).toBe('Monday: 13:00–09:00 ends before it starts');
    expect(form.validate()).toBe(false);
  });

  it('is what a booking schedule reads: the slots offered are within its hours', () => {
    const slots = scheduleSlots({ branch: { timeZone: 'UTC', hours: { 1: [['09:00', '10:00']] } } }, { now: () => new Date('2026-11-01T00:00:00Z') });
    const source = createMemoryDataSource({ slots });
    return source.slots?.({ model: 'visit', field: 'at', recordId: null, schedule: 'branch', from: '2026-11-02', to: '2026-11-02', timeZone: 'UTC', length: 30, values: {} }).then((found) => {
      expect(found.days['2026-11-02'].free).toEqual(['2026-11-02T09:00:00.000Z', '2026-11-02T09:30:00.000Z']);
    });
  });
});
