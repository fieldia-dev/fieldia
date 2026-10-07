import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { press } from './test-kinds';
import { createWidget } from './widgets';

/** Flectra's daterange: one box from → to, a range picked on a calendar, two date fields written. */
function mount(kind: 'date' | 'datetime' = 'date', values: Record<string, unknown> = {}, dir?: 'rtl') {
  const page = {
    fieldia: '0.1',
    id: 'leave',
    data: { kind: 'record', model: 'hr.leave' },
    fields: { request_date_from: { type: kind, label: 'From' }, request_date_to: { type: kind, label: 'To' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-dates', field: 'request_date_from', widget: 'daterange', options: { endField: 'request_date_to' } }] },
  } as unknown as Page;
  const form = createForm({ page, values: values as never });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'request_date_from', field: page.fields['request_date_from'] as Field, node, id: 'fd-dates', document, labels: WIDGET_LABELS.en });
  const host = document.createElement('div');
  if (dir) host.dir = dir;
  host.append(widget.element);
  document.body.replaceChildren(host);
  const refresh = (readonly = false) => widget.update({ value: form.getState().values['request_date_from'], values: form.getState().values, readonly, required: false, invalid: false });
  form.subscribe(() => refresh());
  refresh();
  const [from, to] = [...widget.element.querySelectorAll('input')] as HTMLInputElement[];
  return { form, el: widget.element, from, to, refresh, values: () => form.getState().values };
}

const day = (el: HTMLElement, n: number) => [...el.querySelectorAll<HTMLButtonElement>('.fd-range-calendar button[data-day]')].find((b) => b.dataset['day']?.endsWith(`-${String(n).padStart(2, '0')}`) && !b.classList.contains('fd-outside')) as HTMLButtonElement;

describe('a range of dates', () => {
  it('is one box of two dates, from → to, each named by its field', () => {
    const { el, from, to } = mount('date', { request_date_from: '2026-10-12', request_date_to: '2026-10-15' });
    expect(el.getAttribute('role')).toBe('group');
    expect(from.id).toBe('fd-dates');
    expect([from.value, to.value]).toEqual(['2026-10-12', '2026-10-15']);
    expect([from.getAttribute('aria-label'), to.getAttribute('aria-label')]).toEqual(['From', 'To']);
    expect(el.querySelector('.fd-range-arrow')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('writes each date typed into its own field', () => {
    const { from, to, values } = mount();
    from.value = '2026-11-02';
    from.dispatchEvent(new Event('input', { bubbles: true }));
    to.value = '2026-11-06';
    to.dispatchEvent(new Event('input', { bubbles: true }));
    expect(values()).toMatchObject({ request_date_from: '2026-11-02', request_date_to: '2026-11-06' });
  });

  it('picks a range on its calendar: the first day, then the last, the other way round put right', () => {
    const { el, values } = mount('date', { request_date_from: '2026-10-12' });
    (el.querySelector('.fd-range-button') as HTMLButtonElement).click();
    expect((el.querySelector('.fd-range-calendar') as HTMLElement).hidden).toBe(false);
    day(el, 20).click();
    day(el, 16).click();
    expect(values()).toMatchObject({ request_date_from: '2026-10-16', request_date_to: '2026-10-20' });
    expect((el.querySelector('.fd-range-calendar') as HTMLElement).hidden).toBe(true);
  });

  it('marks the days of the range, and moves by day with the arrows, mirrored right to left', () => {
    const { el, values } = mount('date', { request_date_from: '2026-10-12', request_date_to: '2026-10-14' }, 'rtl');
    (el.querySelector('.fd-range-button') as HTMLButtonElement).click();
    expect(day(el, 13).classList.contains('fd-in-range')).toBe(true);
    expect(day(el, 12).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(day(el, 12));
    press(day(el, 12), 'ArrowLeft');
    expect(document.activeElement).toBe(day(el, 13));
    press(day(el, 13), 'Enter');
    press(document.activeElement as Element, 'ArrowDown');
    press(document.activeElement as Element, 'Enter');
    expect(values()).toMatchObject({ request_date_from: '2026-10-13', request_date_to: '2026-10-20' });
  });

  it('keeps a date and time’s hours when its day is picked', () => {
    const start = new Date(2026, 9, 12, 9, 30).toISOString();
    const end = new Date(2026, 9, 12, 17, 0).toISOString();
    const { el, values } = mount('datetime', { request_date_from: start, request_date_to: end });
    (el.querySelector('.fd-range-button') as HTMLButtonElement).click();
    day(el, 13).click();
    day(el, 14).click();
    expect(new Date(values()['request_date_from'] as string).getHours()).toBe(9);
    expect(new Date(values()['request_date_to'] as string).getDate()).toBe(14);
    expect(new Date(values()['request_date_to'] as string).getHours()).toBe(17);
  });

  it('is read-only as its field is: its boxes, and no calendar', () => {
    const { el, from, to, refresh } = mount();
    refresh(true);
    expect(from.readOnly && to.readOnly).toBe(true);
    expect((el.querySelector('.fd-range-button') as HTMLButtonElement).hidden).toBe(true);
  });
});
