import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';
import { isoWeek } from './date-text';

function mountDate(type: 'date' | 'datetime', value: string | null, locale: 'en' | 'de' | 'ar' = 'en', weekNumbers = true, language?: string) {
  const page = {
    fieldia: '0.1',
    id: 'cal',
    ...(language ? { language } : {}),
    data: { kind: 'responses' },
    fields: { when: { type, label: 'Start' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-when', field: 'when', options: { weekNumbers } }] },
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

describe('a calendar open while its box is typed in', () => {
  /** Focus moved from `from` to `to`, as Tab moves it: blur and focusout on the one, focus and focusin on the other. */
  function tab(from: HTMLElement, to: HTMLElement) {
    from.dispatchEvent(new FocusEvent('blur', { relatedTarget: to }));
    from.dispatchEvent(new FocusEvent('focusout', { relatedTarget: to, bubbles: true }));
    to.focus();
  }
  const typeIn = (input: HTMLInputElement, text: string) => {
    input.value = text;
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }));
  };

  it('closes as Tab leaves the box for the calendar’s button, never covering why the date was not read', () => {
    const { el, button, dialog, form } = mountDate('date', '2026-10-11');
    const input = el.querySelector('input') as HTMLInputElement;
    button.click();
    input.focus();
    expect(dialog().hidden).toBe(false);
    typeIn(input, '31/02/2026');
    tab(input, button);
    expect(dialog().hidden).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    // Left on the button, not taken back to it: the person's Tab is where the focus is.
    expect(document.activeElement).toBe(button);
    expect(form.getState().unread['when']?.message).toBe('Start: February 2026 has 28 days');
  });

  it('closes as the focus leaves the field from inside it, and stays open while it moves within the month', () => {
    const { el, button, dialog, day } = mountDate('date', '2026-10-11');
    const input = el.querySelector('input') as HTMLInputElement;
    button.click();
    const eleven = day(11);
    tab(input, eleven);
    expect(dialog().hidden).toBe(false);
    const after = document.createElement('input');
    document.body.append(after);
    tab(eleven, after);
    expect(dialog().hidden).toBe(true);
  });

  it('opened on text that did not read, says why under its month', () => {
    const { el, button, dialog, form } = mountDate('date', '2026-10-11');
    const input = el.querySelector('input') as HTMLInputElement;
    input.focus();
    typeIn(input, '31/02/2026');
    tab(input, button);
    expect(form.getState().unread['when']).toBeDefined();
    button.click();
    const note = dialog().querySelector('.fd-calendar-note') as HTMLElement;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe('Start: February 2026 has 28 days');
  });
});

describe('a pick from the calendar, announced', () => {
  it('tells what is round it that a day was picked (fd-picked), by the mouse and by Enter, the value already set', () => {
    const { el, button, day, key, value } = mountDate('date', '2026-10-11');
    const heard: unknown[] = [];
    document.body.addEventListener('fd-picked', (event) => heard.push([(event as CustomEvent).detail, value()]));
    button.click();
    day(14).click();
    expect(heard).toEqual([[{ value: '2026-10-14' }, '2026-10-14']]);
    button.click();
    key(day(20), 'Enter');
    expect(heard).toHaveLength(2);
    // Moving round the month with the arrows is no pick.
    button.click();
    key(day(20), 'ArrowRight');
    expect(heard).toHaveLength(2);
    expect(el.isConnected).toBe(true);
  });
});

describe('a calendar’s days of the week', () => {
  it('head their columns by short names, or narrow ones where the short name is a whole word, as in Arabic', async () => {
    const { weekdayHead } = await import('./calendar');
    const monday = new Date(2024, 0, 1);
    const week = (lang: string) => Array.from({ length: 7 }, (_, i) => weekdayHead(lang)(new Date(2024, 0, 1 + i)));
    expect(week('en-GB')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(week('ar').every((name) => [...name].length <= 2)).toBe(true);
    expect(weekdayHead('de')(monday)).toBe('Mo');
  });
});

describe('a date without week numbers: its week from the first day where the page is read', () => {
  afterEach(() => jest.restoreAllMocks());
  const heads = (dialog: HTMLElement) => [...dialog.querySelectorAll('thead th')].map((th) => th.getAttribute('abbr'));

  it('an English page read in Cairo starts on Saturday, in London on Monday, in New York on Sunday', () => {
    for (const [languages, first] of [
      [['en-EG', 'en'], 'Saturday'],
      [['en-GB'], 'Monday'],
      [['en-US', 'en'], 'Sunday'],
    ] as const) {
      jest.spyOn(navigator, 'languages', 'get').mockReturnValue([...languages]);
      const { button, dialog } = mountDate('date', '2026-10-14', 'en', false);
      button.click();
      expect({ languages, first: heads(dialog())[0] }).toEqual({ languages, first });
    }
  });

  it('the page’s own region before the reader’s, and Arabic’s Saturday', () => {
    jest.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    const british = mountDate('date', '2026-10-14', 'en', false, 'en-GB');
    british.button.click();
    expect(heads(british.dialog())[0]).toBe('Monday');
    const arabic = mountDate('date', '2026-10-14', 'ar', false);
    arabic.button.click();
    expect(heads(arabic.dialog())[0]).toBe('السبت');
  });

  it('Home and End go to its row’s first and last day', () => {
    jest.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    const { button, dialog, key } = mountDate('date', '2026-10-14', 'en', false);
    button.click();
    // Wednesday the 14th: its row Sunday the 11th to Saturday the 17th, the month's first row from Sunday 27 September.
    expect((dialog().querySelector('tbody button') as HTMLElement).textContent).toBe('27');
    key(document.activeElement as Element, 'Home');
    expect((document.activeElement as HTMLElement).textContent).toBe('11');
    key(document.activeElement as Element, 'End');
    expect((document.activeElement as HTMLElement).textContent).toBe('17');
  });

  it('with week numbers, each row is an ISO week, Monday first, wherever it is read', () => {
    jest.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    const { button, dialog } = mountDate('date', '2026-10-14');
    button.click();
    expect(heads(dialog())).toEqual(['Week', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  });
});
