import { createForm, type Field, type FieldNode, type LineField, type Locale, type Page } from '@fieldia/core';
import { readGrainText } from './date-grain';
import { gregorianOf, hijriOf, readHijriText } from './hijri';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';
import { displayValue } from './display';

/**
 * A month alone and a year alone (a date with `precision`), and a date shown and typed in the Hijri calendar beside
 * its Gregorian day (`hijri`): read as people write them, kept as their first day or the Gregorian day, said at rest
 * in the page's language — and refused with why, the field holding what it held.
 */

function keys(input: HTMLInputElement, text: string) {
  for (const char of [...text]) {
    const before = new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable: true, bubbles: true });
    if (!input.dispatchEvent(before)) continue;
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(char, start, input.selectionEnd ?? start, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}
function paste(input: HTMLInputElement, text: string) {
  const event = new Event('paste', { cancelable: true, bubbles: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  if (!input.dispatchEvent(event)) return;
  const start = input.selectionStart ?? input.value.length;
  input.setRangeText(text, start, input.selectionEnd ?? start, 'end');
  input.dispatchEvent(new InputEvent('input', { inputType: 'insertFromPaste', bubbles: true }));
}
const enter = (input: HTMLInputElement) => {
  input.focus();
  input.setSelectionRange(0, input.value.length);
};
const hintSays = () => [...document.querySelectorAll<HTMLElement>('.fd-refusal-hint')].find((h) => !h.hidden)?.textContent ?? null;

function mount(field: Record<string, unknown>, locale: Locale = 'en', look?: Record<string, unknown>) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    ...(look ? { look } : {}),
    fields: { x: { type: 'date', label: 'Billing month', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x' }] },
  } as Page;
  const form = createForm({ page });
  const widget = createWidget({ form, name: 'x', field: page.fields['x'], node: (page.layout as { children: FieldNode[] }).children[0], id: 'fd-x', document, labels: WIDGET_LABELS[locale], locale });
  const host = document.createElement('div');
  if (locale === 'ar') host.setAttribute('dir', 'rtl');
  host.append(widget.element);
  document.body.replaceChildren(host);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const boxes = [...widget.element.querySelectorAll('input')] as HTMLInputElement[];
  return { form, widget, box: boxes[0], hijri: boxes.find((one) => one.dataset['kind'] === 'hijri'), value: () => form.getState().values['x'], unread: () => form.getState().unread['x'] };
}

describe('a month alone', () => {
  const reader = { kind: 'date' as const, order: 'dmy' as const, locale: 'en' as Locale, label: 'Billing month' };
  it.each([
    ['10/2026', '2026-10-01'],
    ['1-2026', '2026-01-01'],
    ['2026-10', '2026-10-01'],
    ['Oct 2026', '2026-10-01'],
    ['October, 2026', '2026-10-01'],
    ['2026 Oct', '2026-10-01'],
    ['أكتوبر ٢٠٢٦', '2026-10-01'],
    ['okt. 2026', '2026-10-01'],
    ['١٠/٢٠٢٦', '2026-10-01'],
  ])('reads %s as the month it names, kept as its first day', (typed, kept) => {
    expect(readGrainText(typed, reader, 'month')).toEqual({ ok: true, value: kept });
  });

  it('says why a month does not read, in words', () => {
    expect(readGrainText('13/2026', reader, 'month')).toMatchObject({ ok: false, words: 'Billing month: months go from 1 to 12' });
    expect(readGrainText('10/26', reader, 'month')).toMatchObject({ ok: false, problem: 'shortYear' });
    const unfinished = readGrainText('10', reader, 'month');
    expect(!unfinished.ok && unfinished.words.replace(/[\u2066-\u2069]/g, '')).toBe(`Billing month: “10” is not a month yet; write it like 12/${new Date().getFullYear()}`);
  });

  it('takes a whole day’s month, and says the day it leaves out', () => {
    expect(readGrainText('15/10/2026', reader, 'month')).toEqual({ ok: true, value: '2026-10-01', leftOut: 'Billing month takes a month only: the day 15 was left out' });
    expect(readGrainText('2026-10-01', reader, 'month')).toEqual({ ok: true, value: '2026-10-01' });
  });

  it('is typed, kept as its first day and shown in words at rest', () => {
    const { box, value } = mount({ precision: 'month' });
    expect(box.placeholder).toBe('mm/yyyy');
    enter(box);
    keys(box, '10/2026');
    expect(value()).toBe('2026-10-01');
    box.blur();
    expect(box.value).toBe('Oct 2026');
    box.focus();
    expect(box.value).toBe('10/2026');
  });

  it('refuses a key no month is written with, and keeps what does not read unread with why', () => {
    const { box, value, unread } = mount({ precision: 'month' });
    enter(box);
    keys(box, '1x');
    expect(hintSays()).toContain('is not a month yet');
    box.blur();
    enter(box);
    keys(box, '14/2026');
    box.blur();
    expect(value() ?? null).toBeNull();
    expect(unread()).toEqual({ text: '14/2026', message: 'Billing month: months go from 1 to 12' });
    expect(box.value).toBe('14/2026');
  });

  it('pastes a whole day as its month, saying the day left out', () => {
    const { box, value } = mount({ precision: 'month' });
    enter(box);
    paste(box, '15/10/2026');
    expect(box.value).toBe('10/2026');
    expect(value()).toBe('2026-10-01');
    expect(hintSays()).toBe('Billing month takes a month only: the day 15 was left out');
  });

  it('is written the page’s way: in Arabic, and year first', () => {
    const ar = mount({ precision: 'month' }, 'ar');
    enter(ar.box);
    keys(ar.box, '١٠/٢٠٢٦');
    ar.box.blur();
    expect(ar.value()).toBe('2026-10-01');
    expect(ar.box.value).toBe('أكتوبر 2026');
    const ymd = mount({ precision: 'month' }, 'en', { dateOrder: 'ymd' });
    expect(ymd.box.placeholder).toBe('yyyy-mm');
    enter(ymd.box);
    keys(ymd.box, '2026-10');
    expect(ymd.value()).toBe('2026-10-01');
  });

  it('keeps its limits by the month: this month is within "today"', () => {
    const { form } = mount({ precision: 'month', min: 'today' });
    const now = new Date();
    const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    form.setValue('x', first);
    form.validate();
    expect(form.getState().errors['x']).toBeUndefined();
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    form.setValue('x', `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-01`);
    form.validate();
    expect(form.getState().errors['x']).toMatch(/^Billing month can’t be before [A-Z][a-z]{2} \d{4}$/);
  });

  it('opens a year’s months to pick from, Enter picking the one reached', () => {
    const { el, box, value } = { ...mount({ precision: 'month' }), el: document.body };
    box.focus();
    (el.querySelector('.fd-calendar-button') as HTMLButtonElement).click();
    const months = [...el.querySelectorAll<HTMLButtonElement>('.fd-calendar-periods button')];
    expect(months.map((m) => m.textContent)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']);
    expect(el.querySelector('.fd-calendar-button')?.getAttribute('aria-label')).toBe('Choose a month');
    months[2].click();
    expect(value()).toBe(`${new Date().getFullYear()}-03-01`);
  });
});

describe('a year alone', () => {
  it('reads four digits, keeps the year’s first day, and shows the year', () => {
    const { box, value } = mount({ precision: 'year', label: 'Year built' });
    expect(box.placeholder).toBe('yyyy');
    enter(box);
    keys(box, '1998');
    expect(value()).toBe('1998-01-01');
    box.blur();
    expect(box.value).toBe('1998');
  });

  it('opens twelve years to pick from', () => {
    const { box, value } = mount({ precision: 'year', label: 'Year built' });
    box.focus();
    (document.querySelector('.fd-calendar-button') as HTMLButtonElement).click();
    const years = [...document.querySelectorAll<HTMLButtonElement>('.fd-calendar-periods button')].map((b) => Number(b.textContent));
    expect(years).toHaveLength(12);
    expect(years[0] % 12).toBe(0);
    (document.querySelector('.fd-calendar-head button') as HTMLButtonElement).click();
    const earlier = Number(document.querySelector('.fd-calendar-periods button')?.textContent);
    expect(earlier).toBe(years[0] - 12);
    (document.querySelectorAll<HTMLButtonElement>('.fd-calendar-periods button')[1]).click();
    expect(value()).toBe(`${earlier + 1}-01-01`);
  });

  it('is written alone where it is read: a list’s cell, a value in words', () => {
    expect(displayValue({ type: 'date', label: 'Year', precision: 'year' } as LineField, '1998-01-01')).toBe('1998');
    expect(displayValue({ type: 'date', label: 'Month', precision: 'month' } as LineField, '2026-10-01')).toBe('Oct 2026');
    expect(displayValue({ type: 'date', label: 'Month', precision: 'month' } as LineField, '2026-10-01', {}, 'ar')).toBe('أكتوبر 2026');
  });
});

describe('a Hijri date beside its Gregorian day', () => {
  it('turns a Gregorian day into its Hijri day and back, by Umm al-Qura', () => {
    expect(hijriOf('2026-10-13')).toEqual({ year: 1448, month: 5, day: 2 });
    expect(gregorianOf(1448, 5, 2)).toEqual({ ok: true, value: '2026-10-13' });
    // Every day of a hundred years, there and back.
    for (let at = Date.UTC(1950, 0, 1); at < Date.UTC(2050, 0, 1); at += 86_400_000 * 7) {
      const day = new Date(at).toISOString().slice(0, 10);
      const h = hijriOf(day);
      expect(h && gregorianOf(h.year, h.month, h.day)).toEqual({ ok: true, value: day });
    }
  });

  it('says how many days a Hijri month has, where a day past them is typed', () => {
    const reader = { kind: 'date' as const, order: 'dmy' as const, locale: 'en' as Locale, label: 'Start' };
    // A month of 29 days by Umm al-Qura: its 30th is no day.
    let short = 1;
    while (gregorianOf(1448, short, 30).ok) short++;
    const read = readHijriText(`30/${short}/1448`, reader);
    expect(read).toMatchObject({ ok: false, problem: 'noSuchDay' });
    expect(!read.ok && read.words).toMatch(/^Start: .+ 1448 AH has 29 days$/);
    expect(readHijriText('2 Jumada I 1448 AH', reader)).toEqual({ ok: true, value: '2026-10-13' });
    expect(readHijriText('٢/٥/١٤٤٨', reader)).toEqual({ ok: true, value: '2026-10-13' });
    expect(readHijriText('1448-05-02', reader)).toEqual({ ok: true, value: '2026-10-13' });
  });

  it('shows the Hijri day beside the Gregorian, each typed in writing the other', () => {
    const { box, hijri, value } = mount({ hijri: true, label: 'Contract start' });
    expect(hijri).toBeDefined();
    const second = hijri as HTMLInputElement;
    expect(second.getAttribute('aria-label')).toBe('Contract start (Hijri)');
    expect(second.placeholder).toBe('dd/mm/yyyy AH');
    enter(box);
    keys(box, '13/10/2026');
    box.blur();
    expect(value()).toBe('2026-10-13');
    expect(second.value).toBe('2 Jumada I 1448 AH');
    enter(second);
    expect(second.value).toBe('02/05/1448');
    keys(second, '01/06/1448');
    second.blur();
    expect(value()).toBe(gregorianOf(1448, 6, 1).ok ? (gregorianOf(1448, 6, 1) as { value: string }).value : null);
    expect(box.value).not.toBe('13 Oct 2026');
  });

  it('keeps a Hijri day that does not read in its own box, the Gregorian holding what it held', () => {
    const { box, hijri, value, unread } = mount({ hijri: true, label: 'Contract start' });
    const second = hijri as HTMLInputElement;
    enter(box);
    keys(box, '13/10/2026');
    box.blur();
    enter(second);
    keys(second, '31/05/1448');
    second.blur();
    expect(value()).toBe('2026-10-13');
    expect(unread()?.text).toBe('31/05/1448');
    expect(second.value).toBe('31/05/1448');
    expect(second.getAttribute('aria-invalid')).toBe('true');
    // The Gregorian box shows its day, never the Hijri box's words.
    expect(box.value).toBe('13 Oct 2026');
    // Put right in the Gregorian box: the Hijri box's text goes.
    enter(box);
    keys(box, '14/10/2026');
    box.blur();
    expect(unread()).toBeUndefined();
    expect(second.value).toBe('3 Jumada I 1448 AH');
  });

  it('writes a Hijri date in Arabic at rest, and beside the day in a list', () => {
    const { box, hijri } = mount({ hijri: true, label: 'Contract start' }, 'ar');
    enter(box);
    keys(box, '13/10/2026');
    box.blur();
    expect((hijri as HTMLInputElement).value).toBe('2 جمادى الأولى 1448 هـ');
    expect(displayValue({ type: 'date', label: 'Start', hijri: true } as LineField, '2026-10-13')).toBe('13 Oct 2026 · 2 Jumada I 1448 AH');
  });

  it('marks each day of its calendar with its Hijri day', () => {
    const { box } = mount({ hijri: true, label: 'Contract start' });
    enter(box);
    keys(box, '13/10/2026');
    (document.querySelector('.fd-calendar-button') as HTMLButtonElement).click();
    const day = document.querySelector('.fd-calendar-grid button[aria-selected="true"]') as HTMLButtonElement;
    expect(day.querySelector('.fd-calendar-hijri')?.textContent).toBe('2');
    expect(day.getAttribute('aria-label')).toBe('Tuesday, 13 October 2026, 2 Jumada I 1448 AH');
    expect(document.querySelector('.fd-calendar-title')?.textContent).toMatch(/^October 2026 · .+1448 AH$/);
  });
});
