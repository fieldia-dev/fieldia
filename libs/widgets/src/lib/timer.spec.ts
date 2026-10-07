import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { formatClock } from './timer';
import { createWidget } from './widgets';

/** The field, beside a date and time it may start from. */
function mountKind(field: Record<string, unknown>, node: Partial<FieldNode>) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'record', model: 'mrp.workorder' },
    fields: { x: { label: 'X', ...field } as Field, started: { type: 'datetime', label: 'Started' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] },
  } as Page;
  const form = createForm({ page });
  const widget = createWidget({ form, name: 'x', field: page.fields['x'], node: (page.layout as { children: FieldNode[] }).children[0], id: 'fd-x', document });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: true, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element };
}

/** A live timer, as Flectra's mrp_timer and the legal timer: the time logged, and the time running from a start. */
describe('a timer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-07T10:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('writes a time as hours, minutes and seconds', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(3725)).toBe('01:02:05');
    expect(formatClock(100 * 3600)).toBe('100:00:00');
  });

  it('shows the hours logged while it is stopped', () => {
    const { el } = mountKind({ type: 'float', label: 'Duration', default: 1.5 }, { widget: 'timer', options: { startField: 'started' } });
    const timer = el.closest('[role="timer"]') as HTMLElement;
    expect(timer.id).toBe('fd-x');
    expect(timer.textContent).toBe('01:30:00');
    expect(timer.dataset['running']).toBeUndefined();
  });

  it('runs from its start, on top of what was logged, and stops when the start goes', () => {
    const { el, form } = mountKind({ type: 'float', label: 'Duration', default: 0.5 }, { widget: 'timer', options: { startField: 'started' } });
    const timer = el.closest('[role="timer"]') as HTMLElement;
    form.setValues({ started: '2026-10-07T09:59:00Z' });
    expect(timer.textContent).toBe('00:31:00');
    expect(timer.dataset['running']).toBe('true');
    jest.advanceTimersByTime(5000);
    expect(timer.textContent).toBe('00:31:05');
    form.setValues({ started: null, x: 0.6 });
    jest.advanceTimersByTime(5000);
    expect(timer.textContent).toBe('00:36:00');
    expect(timer.dataset['running']).toBeUndefined();
  });

  it('takes minutes when the field keeps minutes', () => {
    const { el } = mountKind({ type: 'float', label: 'Duration', default: 90 }, { widget: 'timer', options: { unit: 'minutes' } });
    expect(el.textContent).toBe('01:30:00');
  });

  it('on a date and time, runs from it', () => {
    const { el, form } = mountKind({ type: 'datetime', label: 'Timer started' }, { widget: 'timer' });
    expect(el.textContent).toBe('00:00:00');
    form.setValue('x', '2026-10-07T08:45:00Z');
    expect(el.textContent).toBe('01:15:00');
    jest.advanceTimersByTime(60_000);
    expect(el.textContent).toBe('01:16:00');
  });
});
