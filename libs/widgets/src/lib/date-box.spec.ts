import { createForm, type Field, type FieldNode, type Locale, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { mountKind } from './test-kinds';
import { createWidget } from './widgets';

/**
 * Fieldia's own date, date-and-time and time box (date-box.ts), typed and
 * pasted as a person does: a key is a beforeinput the box may refuse, then
 * the character at the caret, then input; a paste is a paste event the box
 * may refuse or clean. In English, Arabic right to left with Arabic and
 * Persian digits, French and German, each in the page's order.
 */

/** Keys pressed one by one, where the caret is. */
function keys(input: HTMLInputElement, text: string) {
  for (const char of [...text]) {
    const before = new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable: true, bubbles: true });
    if (!input.dispatchEvent(before)) continue;
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(char, start, input.selectionEnd ?? start, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}

/** Backspace, as a keyboard says it: a key held after a refused one is taken back; else the character before the caret. */
function backspace(input: HTMLInputElement) {
  const before = new InputEvent('beforeinput', { inputType: 'deleteContentBackward', cancelable: true, bubbles: true });
  if (!input.dispatchEvent(before)) return;
  const at = input.selectionStart ?? input.value.length;
  input.setRangeText('', Math.max(0, at - 1), input.selectionEnd ?? at, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
}

/** Ctrl+V: refused, cleaned by the box, or pasted as it is by the browser. */
function paste(input: HTMLInputElement, text: string) {
  const event = new Event('paste', { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  if (!input.dispatchEvent(event)) return;
  const start = input.selectionStart ?? input.value.length;
  input.setRangeText(text, start, input.selectionEnd ?? start, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
}

const boxOf = (el: HTMLElement) => (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;
const hintSays = () => {
  const hint = [...document.querySelectorAll<HTMLElement>('.fd-refusal-hint')].find((h) => !h.hidden);
  return hint ? hint.textContent : null;
};
/** A box entered, its text all chosen so typing replaces it, as a Tab into it does. */
function enter(input: HTMLInputElement) {
  input.focus();
  input.setSelectionRange(0, input.value.length);
}

/** A date field (or a date and time, a time) on a page in `locale`, as the viewer keeps it. */
function mount(field: Record<string, unknown>, node: Partial<FieldNode> = {}, locale: Locale = 'en', look?: Record<string, unknown>) {
  if (!look) return mountKind({ label: 'Start date', ...field }, node, { locale, ...(locale === 'ar' ? { dir: 'rtl' as const } : {}) });
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    look,
    fields: { x: { label: 'Start date', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] },
  } as Page;
  const form = createForm({ page });
  const widget = createWidget({ form, name: 'x', field: page.fields['x'], node: (page.layout as { children: FieldNode[] }).children[0], id: 'fd-x', document, labels: WIDGET_LABELS[locale], locale });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, widget, el: widget.element, refresh, value: () => form.getState().values['x'] };
}

describe('a date typed in the page’s order', () => {
  it.each([
    ['en', 'dd/mm/yyyy', '13/10/2026', '13 Oct 2026'],
    ['fr', 'jj/mm/aaaa', '13/10/2026', '13 oct. 2026'],
    ['de', 'TT.MM.JJJJ', '13.10.2026', '13. Okt. 2026'],
    ['ar', 'يوم/شهر/سنة', '13/10/2026', '13 أكتوبر 2026'],
  ] as const)('%s: day first, as its placeholder says, and shown in words once left', (locale, shape, typed, words) => {
    const { el, value } = mount({ type: 'date' }, {}, locale);
    const input = boxOf(el);
    expect(input.type).toBe('text');
    expect(input.placeholder).toBe(shape);
    enter(input);
    keys(input, typed);
    expect(value()).toBe('2026-10-13');
    input.blur();
    expect(input.value).toBe(words);
    // Entered again, it is written as it is typed, all of it chosen.
    enter(input);
    expect(input.value).toBe(typed);
  });

  it('reads a date written year first whatever the order, and a page may type month first', () => {
    const { el, value } = mount({ type: 'date' });
    const input = boxOf(el);
    enter(input);
    keys(input, '2026-10-20');
    expect(value()).toBe('2026-10-20');
    const us = mount({ type: 'date' }, {}, 'en', { dateOrder: 'mdy' });
    const box = boxOf(us.el);
    expect(box.placeholder).toBe('mm/dd/yyyy');
    enter(box);
    keys(box, '10/13/2026');
    expect(us.value()).toBe('2026-10-13');
  });

  it('reads Arabic-Indic and Persian digits typed as they come, whatever language the browser speaks', () => {
    for (const typed of ['١٣/١٠/٢٠٢٦', '۱۳/۱۰/۲۰۲۶', '١٣.١٠.٢٠٢٦']) {
      const { el, value } = mount({ type: 'date' }, {}, 'ar');
      const input = boxOf(el);
      enter(input);
      keys(input, typed);
      expect({ typed, value: value() }).toEqual({ typed, value: '2026-10-13' });
      input.blur();
      expect(input.value).toBe('13 أكتوبر 2026');
    }
  });

  it('takes the date typed in full, its limits in the same year never holding its year (20/10/2026 is the 20th)', () => {
    const { el, value, form } = mount({ type: 'date', min: '2026-10-13', max: '2026-12-12' });
    const input = boxOf(el);
    expect([input.getAttribute('data-min'), input.getAttribute('data-max')]).toEqual(['2026-10-13', '2026-12-12']);
    enter(input);
    keys(input, '20/10/2026');
    input.blur();
    expect(value()).toBe('2026-10-20');
    // Past its latest: said as the box is left, in the before and after words.
    enter(input);
    keys(input, '20/12/2026');
    input.blur();
    form.leave('x');
    expect(form.getState().errors['x']).toBe('Start date can’t be after December 12, 2026');
  });

  it('never writes anything back while the box has focus, and waits for a year of four digits', () => {
    const { el, value } = mount({ type: 'date' }, {}, 'en');
    const { form } = { form: null };
    void form;
    const input = boxOf(el);
    input.focus();
    input.value = '';
    const seen: unknown[] = [];
    keys(input, '13/10/20');
    seen.push(value());
    keys(input, '26');
    expect(seen).toEqual([null]);
    expect(input.value).toBe('13/10/2026');
    expect(value()).toBe('2026-10-13');
  });
});

describe('a date that does not read', () => {
  it.each([
    ['en', '31/02/2026', 'Start date: February 2026 has 28 days'],
    ['ar', '٣١/٠٢/٢٠٢٦', 'Start date: في فبراير 2026 28 يومًا'],
    ['fr', '31/02/2026', 'Start date : février 2026 compte 28 jours'],
    ['de', '31.02.2026', 'Start date: Februar 2026 hat 28 Tage'],
  ] as const)('%s: is kept in the box, marked, with why; the field keeps its earlier day', (locale, typed, why) => {
    const { el, form, value } = mount({ type: 'date' }, {}, locale);
    form.setValue('x', '2026-10-11');
    const input = boxOf(el);
    enter(input);
    keys(input, typed);
    input.blur();
    expect(value()).toBe('2026-10-11');
    expect(input.value).toBe(typed);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(form.getState().unread['x']).toEqual({ text: typed, message: why });
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['x']).toBe(why);
    // Put right, it goes.
    enter(input);
    input.value = '';
    keys(input, '28/02/2026');
    input.blur();
    expect(value()).toBe('2026-02-28');
    expect(form.getState().unread['x']).toBeUndefined();
    expect(form.validate()).toBe(true);
  });

  it('says a month past 12, a year of five digits, and a date half typed', () => {
    const cases: [string, string][] = [
      ['13/13/2026', 'Start date: months go from 1 to 12'],
      ['13/10/20261', 'Start date: the year has 4 digits, like 2026'],
      ['13/10/0002', 'Start date: the year has 4 digits, like 2026'],
      ['13/10', `Start date: “⁨13/10⁩” is not a whole date yet; write it like 31/12/${new Date().getFullYear()}`],
    ];
    for (const [typed, why] of cases) {
      const { el, form } = mount({ type: 'date' });
      const input = boxOf(el);
      enter(input);
      keys(input, typed);
      input.blur();
      expect({ typed, said: form.getState().unread['x']?.message }).toEqual({ typed, said: why });
    }
  });

  it('refuses a letter at the keystroke, with words under the box; the keys after it wait with it, Backspace taking them back', () => {
    const { el, value } = mount({ type: 'date' });
    const input = boxOf(el);
    enter(input);
    keys(input, '13x');
    expect(input.value).toBe('13');
    const words = `Start date: “⁨13x⁩” is not a whole date yet; write it like 31/12/${new Date().getFullYear()}`;
    expect(hintSays()).toBe(words);
    // Never a date made of the keys around a refused one: they wait with it, its words said again.
    keys(input, '/10/2026');
    expect(input.value).toBe('13');
    expect(hintSays()).toBe(words);
    expect(value()).toBeNull();
    // Backspace takes them back one by one, the refused key last; the date typed again is taken.
    for (let i = 0; i < '/10/2026'.length; i++) backspace(input);
    expect(hintSays()).toBe(words);
    backspace(input);
    expect(hintSays()).toBeNull();
    expect(input.value).toBe('13');
    keys(input, '/10/2026');
    expect(value()).toBe('2026-10-13');
  });

  it.each([
    ['en', '1x5/10/2026', 'Start date: “⁨1x5/10/2026⁩” is not a whole date yet; write it like 31/12/YYYY'],
    ['ar', '١x٥/١٠/٢٠٢٦', 'Start date: «⁨١x٥/١٠/٢٠٢٦⁩» ليس تاريخًا كاملًا بعد؛ اكتبه مثل 31/12/YYYY'],
    ['fr', '1x5/10/2026', 'Start date : « ⁨1x5/10/2026⁩ » n’est pas encore une date complète ; écrivez-la comme 31/12/YYYY'],
  ] as const)('%s: a stray letter never makes 15 October of 1x5: left, all that was typed stays, marked, the field keeping its day', (locale, typed, why) => {
    const { el, form, value } = mount({ type: 'date' }, {}, locale);
    form.setValue('x', '2026-10-11');
    const input = boxOf(el);
    enter(input);
    keys(input, typed);
    expect(value()).toBe('2026-10-11');
    input.blur();
    const message = why.replace('YYYY', String(new Date().getFullYear()));
    expect(input.value).toBe(typed);
    expect(value()).toBe('2026-10-11');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(form.getState().unread['x']).toEqual({ text: typed, message });
    // The field's own words take over from the hint.
    expect(hintSays()).toBeNull();
    expect(form.validate()).toBe(false);
  });

  it('is read on Enter before a form is sent with it', () => {
    const { el, form } = mount({ type: 'date' });
    form.setValue('x', '2026-10-11');
    const input = boxOf(el);
    enter(input);
    keys(input, '30/02/2026');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(form.validate()).toBe(false);
    expect(form.getState().values['x']).toBe('2026-10-11');
  });
});

describe('a date as Fieldia writes it at rest', () => {
  it.each([
    ['en', '15 Oct 2026', '15 Oct 2026, 14:30'],
    ['ar', '15 أكتوبر 2026', '15 أكتوبر 2026، 14:30'],
    ['fr', '15 oct. 2026', '15 oct. 2026, 14:30'],
    ['de', '15. Okt. 2026', '15. Okt. 2026, 14:30'],
  ] as const)('%s: copied from a box left, a list or a read-only view, it pastes back as the same day and time', (locale, day, dayAndTime) => {
    // What the box shows at rest is what is copied.
    const shown = mount({ type: 'date' }, {}, locale);
    shown.form.setValue('x', '2026-10-15');
    expect(boxOf(shown.el).value).toBe(day);
    const { el, value } = mount({ type: 'date' }, {}, locale);
    const input = boxOf(el);
    enter(input);
    paste(input, day);
    expect(hintSays()).toBeNull();
    expect(value()).toBe('2026-10-15');
    const timed = mount({ type: 'datetime', label: 'Kick-off meeting' }, {}, locale);
    timed.form.setValue('x', new Date(2026, 9, 15, 14, 30).toISOString());
    expect(boxOf(timed.el).value).toBe(dayAndTime);
    const again = mount({ type: 'datetime', label: 'Kick-off meeting' }, {}, locale);
    const box = boxOf(again.el);
    enter(box);
    paste(box, dayAndTime);
    expect(hintSays()).toBeNull();
    expect(again.value()).toBe(new Date(2026, 9, 15, 14, 30).toISOString());
  });

  it.each([
    ['en', '15 Oct 2026'],
    ['en', 'Oct 15, 2026'],
    ['ar', '15 أكتوبر 2026'],
    ['fr', '15 oct. 2026'],
    ['de', '15. Okt. 2026'],
  ] as const)('%s: typed key by key, its month in words, “%s” is taken, nothing refused on the way', (locale, typed) => {
    const { el, value } = mount({ type: 'date' }, {}, locale);
    const input = boxOf(el);
    enter(input);
    keys(input, typed);
    expect(input.value).toBe(typed);
    expect(hintSays()).toBeNull();
    expect(value()).toBe('2026-10-15');
  });

  it('refuses a word on its way to no month at the keystroke', () => {
    const { el } = mount({ type: 'date' });
    const input = boxOf(el);
    enter(input);
    keys(input, '15 Ocx');
    expect(input.value).toBe('15 Oc');
    expect(hintSays()).toContain('is not a whole date yet');
  });

  it('takes an instant pasted as a server writes one: its day in a date, its local time in a date and time', () => {
    const at = new Date('2026-10-15T14:30:00Z');
    const day = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
    const { el, value } = mount({ type: 'date' });
    const input = boxOf(el);
    enter(input);
    paste(input, '2026-10-15T14:30:00Z');
    expect(value()).toBe(day);
    const timed = mount({ type: 'datetime' });
    const box = boxOf(timed.el);
    enter(box);
    paste(box, '2026-10-15T14:30:00Z');
    expect(timed.value()).toBe(at.toISOString());
    // A date's box takes the day of one with its seconds; a date and time's, kept to the minute, refuses it and says why.
    const seconds = mount({ type: 'date' });
    const dayBox = boxOf(seconds.el);
    enter(dayBox);
    paste(dayBox, '2026-10-15T14:30:45Z');
    expect(seconds.value()).toBe(day);
    const minute = mount({ type: 'datetime' });
    const minuteBox = boxOf(minute.el);
    minute.form.setValue('x', at.toISOString());
    enter(minuteBox);
    paste(minuteBox, '2026-10-15T09:15:45Z');
    expect(minute.value()).toBe(at.toISOString());
    expect(hintSays()).toBe('Start date: “⁨2026-10-15T09:15:45Z⁩” is not a time; write it like 14:30');
  });
});

describe('a year of two digits', () => {
  it.each([
    ['en', '15/3/85', 'Start date: “⁨85⁩” could be 1985 or 2085; write the year in full'],
    ['ar', '١٥/٣/٨٥', 'Start date: «⁨85⁩» قد تعني 1985 أو 2085؛ اكتب السنة كاملة'],
    ['fr', '15/3/85', 'Start date : « ⁨85⁩ » peut être 1985 ou 2085 ; écrivez l’année en entier'],
    ['de', '15.3.85', 'Start date: „⁨85⁩“ kann 1985 oder 2085 sein; schreiben Sie das Jahr vollständig'],
  ] as const)('%s: is never given a century in silence: kept, marked, naming both it could be', (locale, typed, why) => {
    const { el, form, value } = mount({ type: 'date' }, {}, locale);
    form.setValue('x', '2026-10-11');
    const input = boxOf(el);
    enter(input);
    keys(input, typed);
    input.blur();
    expect(value()).toBe('2026-10-11');
    expect(input.value).toBe(typed);
    expect(form.getState().unread['x']).toEqual({ text: typed, message: why });
    expect(form.validate()).toBe(false);
    // Pasted, it is refused with the same words.
    enter(input);
    paste(input, typed);
    expect(hintSays()).toBe(why);
  });
});

describe('a date pasted', () => {
  it('in ISO, the page’s order or Arabic digits takes the box’s place, written the page’s way', () => {
    for (const [locale, pasted, shown] of [
      ['en', '2026-10-20', '20/10/2026'],
      ['de', '20.10.2026', '20.10.2026'],
      ['ar', '٢٠/١٠/٢٠٢٦', '20/10/2026'],
      ['en', '‏2026-10-20T09:30', '20/10/2026'],
    ] as const) {
      const { el, value } = mount({ type: 'date' }, {}, locale);
      const input = boxOf(el);
      enter(input);
      paste(input, pasted);
      expect({ pasted, text: input.value, value: value() }).toEqual({ pasted, text: shown, value: '2026-10-20' });
    }
  });

  it('that is no date is refused whole, and the hint quotes it', () => {
    const { el, form, value } = mount({ type: 'date' });
    form.setValue('x', '2026-10-11');
    const input = boxOf(el);
    enter(input);
    paste(input, 'next Tuesday');
    expect(input.value).toBe('11/10/2026');
    expect(value()).toBe('2026-10-11');
    expect(hintSays()).toBe('“⁨next Tuesday⁩” is not a date, so it was not pasted');
    paste(input, '31/02/2026');
    expect(hintSays()).toBe('“⁨31/02/2026⁩” is not a date, so it was not pasted');
  });
});

describe('a date and time', () => {
  it('takes a time with its date only once both read whole, and never a year under 1000', () => {
    const { el, form, value } = mount({ type: 'datetime', label: 'Kick-off meeting' });
    form.setValue('x', new Date(2026, 9, 12, 10, 0).toISOString());
    const input = boxOf(el);
    enter(input);
    expect(input.value).toBe('12/10/2026 10:00');
    expect(input.placeholder).toBe('dd/mm/yyyy hh:mm');
    const seen = new Set<unknown>();
    form.subscribe(() => seen.add(form.getState().values['x']));
    keys(input, '13/10/2027 10:00');
    expect([...seen]).toEqual([new Date(2027, 9, 13, 10, 0).toISOString()]);
    input.blur();
    expect(input.value).toBe('13 Oct 2027, 10:00');
    expect(value()).toBe(new Date(2027, 9, 13, 10, 0).toISOString());
  });

  it('de: waits for the time, never taking “13.10.20” as a day of 2020 on the way to 13.10.2026 14:30', () => {
    const { el, form } = mount({ type: 'datetime' }, {}, 'de');
    const input = boxOf(el);
    enter(input);
    const seen = new Set<unknown>();
    form.subscribe(() => seen.add(form.getState().values['x']));
    keys(input, '13.10.2026 14:30');
    expect([...seen]).toEqual([new Date(2026, 9, 13, 14, 30).toISOString()]);
  });

  it('reads 12-hour times with am and pm, in English and Arabic', () => {
    for (const [typed, hours] of [['13/10/2026 2:30 pm', 14], ['١٣/١٠/٢٠٢٦ ٢:٣٠ م', 14], ['13/10/2026 9:15 AM', 9]] as const) {
      const { el, value } = mount({ type: 'datetime' }, {}, 'ar');
      const input = boxOf(el);
      enter(input);
      keys(input, typed);
      input.blur();
      expect({ typed, hours: new Date(value() as string).getHours() }).toEqual({ typed, hours });
    }
  });

  it('keeps a value from outside as it came when the box is entered and left untouched', () => {
    const { el, form, value } = mount({ type: 'datetime' });
    form.setValue('x', '2026-10-12T10:00:30Z');
    const input = boxOf(el);
    enter(input);
    input.blur();
    expect(value()).toBe('2026-10-12T10:00:30Z');
    expect(form.getState().dirty).toEqual(['x']);
  });
});

describe('a time of day', () => {
  it('is Fieldia’s own box, read in 24 hours or with am and pm, Arabic digits too', () => {
    const { el, value } = mount({ type: 'char', label: 'Arrival' }, { widget: 'time', options: { min: '07:00', max: '11:00', step: 15 } });
    const input = boxOf(el);
    expect([input.type, input.placeholder, input.getAttribute('data-step')]).toEqual(['text', 'hh:mm', '15']);
    for (const [typed, read] of [['09:30', '09:30'], ['٠٩:٤٥', '09:45'], ['8.15', '08:15'], ['10:00 am', '10:00'], ['0730', '07:30']]) {
      enter(input);
      keys(input, typed);
      input.blur();
      expect({ typed, read: value() }).toEqual({ typed, read });
    }
  });

  it('keeps a time that does not read, marked, with why; a paste that is no time is refused', () => {
    const { el, form, value } = mount({ type: 'char', label: 'Arrival' }, { widget: 'time' });
    form.setValue('x', '08:00');
    const input = boxOf(el);
    enter(input);
    keys(input, '25:00');
    input.blur();
    expect(value()).toBe('08:00');
    expect(form.getState().unread['x']?.message).toBe('Arrival: “⁨25:00⁩” is not a time; write it like 14:30');
    enter(input);
    paste(input, 'noon');
    expect(hintSays()).toBe('“⁨noon⁩” is not a date, so it was not pasted');
    paste(input, '٠٩:٣٠');
    input.blur();
    expect(value()).toBe('09:30');
  });
});

describe('the calendar beside a date', () => {
  it('is there for every date, its days past the limits faint, and a pick of one says why and picks nothing', () => {
    const { el, value } = mount({ type: 'date', min: '2026-10-13', max: '2026-10-30', days: [1, 2, 3, 4, 7] });
    const button = el.querySelector('.fd-calendar-button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    // A month the limits name: October 2026.
    (boxOf(el)).focus();
    keys(boxOf(el), '2026-10-14');
    boxOf(el).blur();
    button.click();
    const day = (n: number) => [...el.querySelectorAll<HTMLButtonElement>('.fd-calendar tbody button')].find((b) => b.textContent === String(n) && !b.classList.contains('fd-outside')) as HTMLButtonElement;
    expect(el.querySelectorAll('.fd-calendar thead th')).toHaveLength(7);
    expect(day(12).classList.contains('fd-off')).toBe(true);
    expect(day(16).classList.contains('fd-off')).toBe(true);
    expect(day(15).classList.contains('fd-off')).toBe(false);
    day(12).click();
    expect(value()).toBe('2026-10-14');
    const note = el.querySelector('.fd-calendar-note') as HTMLElement;
    expect([note.hidden, note.textContent]).toEqual([false, 'Start date can’t be before October 13, 2026']);
    day(16).click();
    expect(note.textContent).toBe('Start date can’t be on a Friday or Saturday');
    day(15).click();
    expect(value()).toBe('2026-10-15');
    expect(boxOf(el).value).toBe('15 Oct 2026');
  });

  it('moves with the screen right to left', () => {
    const { el } = mount({ type: 'date' }, {}, 'ar');
    const input = boxOf(el);
    enter(input);
    keys(input, '14/10/2026');
    input.blur();
    (el.querySelector('.fd-calendar-button') as HTMLButtonElement).click();
    (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect((document.activeElement as HTMLElement).textContent).toBe('15');
  });
});

describe('a date in a table’s cell', () => {
  function table(locale: Locale = 'en') {
    const page = {
      fieldia: '0.1',
      id: 'plan',
      data: { kind: 'responses' },
      fields: { milestone_ids: { type: 'one2many', label: 'Milestones', relation: 'm', fields: { name: { type: 'char', label: 'Milestone' }, due: { type: 'date', label: 'Due', required: true } } } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-ms', field: 'milestone_ids', columns: ['name', 'due'] }] },
    } as unknown as Page;
    const form = createForm({ page, values: { milestone_ids: [{ key: 'a', values: { name: 'Kick-off', due: '2026-10-15' } }] } as never });
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'milestone_ids', field: page.fields['milestone_ids'] as Field, node, id: 'fd-ms', document, labels: WIDGET_LABELS[locale], locale });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['milestone_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    const due = () => (form.getState().values['milestone_ids'] as { values: Record<string, unknown> }[])[0].values['due'];
    return { form, el: widget.element, due, input: () => widget.element.querySelector('input.fd-date') as HTMLInputElement };
  }

  it('keeps its earlier date when an impossible one is typed, and says why: a required date never goes empty', () => {
    const { form, input, due } = table();
    enter(input());
    keys(input(), '30/02/2026');
    input().blur();
    expect(due()).toBe('2026-10-15');
    expect(input().value).toBe('30/02/2026');
    expect(form.getState().unread['milestone_ids.a.due']?.message).toBe('Due: February 2026 has 28 days');
    expect(form.validate()).toBe(false);
  });

  it('reads Arabic and Persian digits, and a pasted date', () => {
    const { input, due } = table('ar');
    enter(input());
    keys(input(), '٣١/١٢/٢٠٢٦');
    input().blur();
    expect(due()).toBe('2026-12-31');
    enter(input());
    paste(input(), '2026-11-03');
    input().blur();
    expect(due()).toBe('2026-11-03');
    enter(input());
    keys(input(), '۰۱/۱۲/۲۰۲۶');
    input().blur();
    expect(due()).toBe('2026-12-01');
  });
});
