import { createForm, type Field, type FieldNode, type Page, type Values } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/**
 * A repeat field, drawn and changed as a person does: the rule kept as iCalendar's RRULE and said in words.
 */

const page = {
  fieldia: '0.7',
  id: 'course',
  data: { kind: 'record', model: 'course' },
  fields: {
    first_session: { type: 'date', label: 'First session' },
    sessions: { type: 'char', label: 'Sessions' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-sessions', field: 'sessions', widget: 'repeat', options: { startField: 'first_session' } },
    ],
  },
} as unknown as Page;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(field: 'sessions', values: Values = {}) {
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

