import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';
import { isoWeek } from './calendar';

function mountDate(type: 'date' | 'datetime', value: string | null, locale: 'en' | 'de' = 'en') {
  const page = {
    fieldia: '0.1',
    id: 'cal',
    data: { kind: 'responses' },
    fields: { when: { type, label: 'Start' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-when', field: 'when', options: { weekNumbers: true } }] },
  } as unknown as Page;
  const form = createForm({ page });
  if (value) form.setValue('when', value);
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'when', field: page.fields['when'] as Field, node, id: 'fd-when', document, labels: WIDGET_LABELS[locale], locale });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['when'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const button = widget.element.querySelector('button[aria-label="Choose a date"], button.fd-calendar-button') as HTMLButtonElement;
  const dialog = () => widget.element.querySelector('[role="dialog"]') as HTMLElement;
  const weeks = () => [...dialog().querySelectorAll('tbody th')].map((th) => th.textContent);
  const day = (n: number) => [...dialog().querySelectorAll('tbody button')].find((b) => b.textContent === String(n) && !b.classList.contains('fd-outside')) as HTMLButtonElement;
  const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  return { form, el: widget.element, button, dialog, weeks, day, key, value: () => form.getState().values['when'] };
}

describe('ISO week numbers', () => {
  it.each([
    ['2026-01-01', 1],
    ['2026-10-01', 40],
    ['2026-12-31', 53],
    ['2027-01-03', 53],
    ['2027-01-04', 1],
  ])('%s is in week %i', (iso, week) => {
    const [y, m, d] = iso.split('-').map(Number);
    expect(isoWeek(new Date(y, m - 1, d))).toBe(week);
  });
});

describe('a date with week numbers', () => {
  it('opens a calendar of the month beside the date, with the week numbers down its side', () => {
    const { button, dialog, weeks } = mountDate('date', '2026-10-11');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(dialog().hidden).toBe(false);
    expect(dialog().getAttribute('aria-label')).toBe('October 2026');
    expect(weeks()).toEqual(['40', '41', '42', '43', '44']);
    expect([...dialog().querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Wk', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    const chosen = dialog().querySelector('[aria-selected="true"]') as HTMLButtonElement;
    expect(chosen.textContent).toBe('11');
    expect(document.activeElement).toBe(chosen);
  });

  it('picks a day with the mouse, and closes', () => {
    const { button, dialog, day, value } = mountDate('date', '2026-10-11');
    button.click();
    day(15).click();
    expect(value()).toBe('2026-10-15');
    expect(dialog().hidden).toBe(true);
    expect(document.activeElement).toBe(button);
  });

  it('moves by day, week and month with the keyboard, and picks with Enter', () => {
    const { button, dialog, key, value } = mountDate('date', '2026-10-11');
    button.click();
    key(document.activeElement as Element, 'ArrowRight');
    key(document.activeElement as Element, 'ArrowDown');
    expect((document.activeElement as HTMLElement).textContent).toBe('19');
    key(document.activeElement as Element, 'PageDown');
    expect(dialog().getAttribute('aria-label')).toBe('November 2026');
    expect((document.activeElement as HTMLElement).textContent).toBe('19');
    key(document.activeElement as Element, 'Enter');
    expect(value()).toBe('2026-11-19');
  });

  it('turns the month with its buttons, and Escape closes it without a change', () => {
    const { button, dialog, key, value } = mountDate('date', '2026-10-11');
    button.click();
    (dialog().querySelector('button[aria-label="Next month"]') as HTMLButtonElement).click();
    expect(dialog().getAttribute('aria-label')).toBe('November 2026');
    (dialog().querySelector('button[aria-label="Previous month"]') as HTMLButtonElement).click();
    (dialog().querySelector('button[aria-label="Previous month"]') as HTMLButtonElement).click();
    expect(dialog().getAttribute('aria-label')).toBe('September 2026');
    key(dialog(), 'Escape');
    expect(dialog().hidden).toBe(true);
    expect(value()).toBe('2026-10-11');
    expect(document.activeElement).toBe(button);
  });

  it('names its month and days in the page’s language', () => {
    const { button, dialog } = mountDate('date', '2026-10-11', 'de');
    (button as HTMLButtonElement).click();
    expect(dialog().getAttribute('aria-label')).toBe('Oktober 2026');
    expect([...dialog().querySelectorAll('thead th')].map((th) => th.textContent)[1]).toBe('Mo');
  });

  it('keeps the time of a date and time when another day is picked', () => {
    const { button, day, value } = mountDate('datetime', new Date(2026, 9, 12, 10, 30).toISOString());
    button.click();
    day(14).click();
    const picked = new Date(value() as string);
    expect([picked.getDate(), picked.getHours(), picked.getMinutes()]).toEqual([14, 10, 30]);
  });
});
