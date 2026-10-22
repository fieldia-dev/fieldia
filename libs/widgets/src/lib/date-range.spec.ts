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
    // Fieldia's own boxes, each showing its date in words once left.
    expect([from.type, from.value, to.value]).toEqual(['text', '12 Oct 2026', '15 Oct 2026']);
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

/** Keys pressed one by one where the caret is, each a beforeinput the box may refuse. */
function keys(input: HTMLInputElement, text: string) {
  for (const char of [...text]) {
    if (!input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable: true, bubbles: true }))) continue;
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(char, start, input.selectionEnd ?? start, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}
const retype = (input: HTMLInputElement, text: string) => {
  input.focus();
  input.setSelectionRange(0, input.value.length);
  keys(input, text);
};

/** A stay from → to whose end has limits of its own: required, from 1 October, Sunday to Thursday. */
function stay(locale: 'en' | 'ar' = 'en') {
  const page = {
    fieldia: '0.1',
    id: 'stay',
    data: { kind: 'responses' },
    fields: { from_day: { type: 'date', label: 'From', min: '2026-10-01' }, to_day: { type: 'date', label: 'To', required: true, min: '2026-10-01', days: [7, 1, 2, 3, 4] } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-stay', field: 'from_day', widget: 'daterange', options: { endField: 'to_day' } }] },
  } as unknown as Page;
  const form = createForm({ page });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'from_day', field: page.fields['from_day'] as Field, node, id: 'fd-stay', document, labels: WIDGET_LABELS[locale], locale });
  const host = document.createElement('div');
  if (locale === 'ar') host.dir = 'rtl';
  host.append(widget.element);
  document.body.replaceChildren(host);
  const refresh = () => widget.update({ value: form.getState().values['from_day'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const [from, to] = [...widget.element.querySelectorAll('input')] as HTMLInputElement[];
  const endError = widget.element.querySelector('.fd-range-error') as HTMLElement;
  return { form, el: widget.element, from, to, endError, values: () => form.getState().values };
}

describe('a range’s end, a field of its own', () => {
  it('says “To can’t be before From” as either box is left, marks the end’s box and describes it', () => {
    const { from, to, endError, values } = stay();
    retype(from, '11/11/2026');
    from.blur();
    retype(to, '20/10/2026');
    to.blur();
    expect(values()).toMatchObject({ from_day: '2026-11-11', to_day: '2026-10-20' });
    expect([endError.hidden, endError.textContent]).toEqual([false, 'To can’t be before From']);
    expect(endError.getAttribute('aria-live')).toBe('polite');
    expect(to.getAttribute('aria-invalid')).toBe('true');
    expect(to.getAttribute('aria-describedby')).toContain(endError.id);
    // Put right from the other box: it goes.
    retype(from, '15/10/2026');
    from.blur();
    expect(endError.hidden).toBe(true);
    expect(to.getAttribute('aria-invalid')).toBe('false');
  });

  it('keeps its own earliest, latest and days on its box and in the calendar, which says why it picks nothing', () => {
    const { el, from, to, endError, values } = stay();
    expect([from.getAttribute('data-min'), to.getAttribute('data-min')]).toEqual(['2026-10-01', '2026-10-01']);
    retype(from, '12/10/2026');
    from.blur();
    retype(to, '17/10/2026');
    to.blur();
    expect(endError.textContent).toBe('To can’t be on a Friday or Saturday');
    (el.querySelector('.fd-range-button') as HTMLButtonElement).click();
    day(el, 13).click();
    expect(day(el, 16).classList.contains('fd-off')).toBe(true);
    day(el, 16).click();
    const note = el.querySelector('.fd-range-calendar .fd-calendar-note') as HTMLElement;
    expect([note.hidden, note.textContent]).toEqual([false, 'To can’t be on a Friday or Saturday']);
    day(el, 15).click();
    expect(values()).toMatchObject({ from_day: '2026-10-13', to_day: '2026-10-15' });
  });

  it('reads Arabic digits in either box, and keeps an impossible end’s text with why, the end keeping its day', () => {
    const { form, from, to, endError, values } = stay('ar');
    retype(from, '١٢/١٠/٢٠٢٦');
    from.blur();
    retype(to, '١٤/١٠/٢٠٢٦');
    to.blur();
    expect(values()).toMatchObject({ from_day: '2026-10-12', to_day: '2026-10-14' });
    retype(to, '٣١/٠٢/٢٠٢٦');
    to.blur();
    expect(values()['to_day']).toBe('2026-10-14');
    expect(to.value).toBe('٣١/٠٢/٢٠٢٦');
    expect(endError.textContent).toBe('To: في فبراير 2026 28 يومًا');
    expect(form.validate()).toBe(false);
  });

  it('is required at Save, never as its box is left', () => {
    const { form, from, to, endError } = stay();
    retype(from, '12/10/2026');
    from.blur();
    to.focus();
    to.blur();
    expect(endError.hidden).toBe(true);
    expect(form.validate()).toBe(false);
    expect(endError.textContent).toBe('To is required');
  });
});

describe('a range’s calendar open while a box is typed in', () => {
  it('closes as Tab leaves the box for the button, and opened again says why the text typed was not read', () => {
    const { el, to, form } = mount('date', { request_date_from: '2026-10-12', request_date_to: '2026-10-15' });
    const button = el.querySelector('.fd-range-button') as HTMLButtonElement;
    const calendar = el.querySelector('.fd-range-calendar') as HTMLElement;
    button.click();
    to.focus();
    expect(calendar.hidden).toBe(false);
    to.value = '31/02/2027';
    to.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: '7', bubbles: true }));
    to.dispatchEvent(new FocusEvent('blur', { relatedTarget: button }));
    button.focus();
    expect(calendar.hidden).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(form.getState().unread['request_date_to']?.message).toBe('To: February 2027 has 28 days');
    button.click();
    const note = calendar.querySelector('.fd-calendar-note') as HTMLElement;
    expect([note.hidden, note.textContent]).toEqual([false, 'To: February 2027 has 28 days']);
  });
});

describe('a range’s calendar: its week from the first day where the page is read', () => {
  afterEach(() => jest.restoreAllMocks());

  it('an English page read in Cairo from Saturday, in London from Monday, in New York from Sunday; Home and End the row’s ends', () => {
    for (const [languages, first, home] of [
      [['en-EG', 'en'], 'Saturday', '2026-10-10'],
      [['en-GB'], 'Monday', '2026-10-12'],
      [['en-US', 'en'], 'Sunday', '2026-10-11'],
    ] as const) {
      jest.spyOn(navigator, 'languages', 'get').mockReturnValue([...languages]);
      const { el } = mount('date', { request_date_from: '2026-10-14' });
      (el.querySelector('.fd-range-button') as HTMLButtonElement).click();
      const focused = day(el, 14);
      focused.focus();
      focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      const reached = (document.activeElement as HTMLElement).dataset['day'];
      expect({ languages, first: el.querySelector('.fd-range-calendar thead th')?.getAttribute('abbr'), reached }).toEqual({ languages, first, reached: home });
    }
  });
});

