import { createForm, isOwnZone, type Field, type FieldNode, type Locale, type Page } from '@fieldia/core';
import { readDateText, restingText, typingText, type DateReader } from './date-text';
import { displayValue } from './display';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/**
 * Dates and times on a page's time zone's clock (`timeZone`), typed and read
 * as a person does in a browser on another clock — the page's a Berlin
 * showroom's. Shown and typed on Berlin's clock, its short name beside the box
 * and after the time in words; a time the clocks skip, or repeat, on a change
 * day is said, never moved; today is Berlin's day. (The tests' own clock is
 * the machine's, UTC on CI: never Berlin's.)
 */

/** The browser's own zone, as the tests run: a page in it is drawn as one naming none. */
const OWN = new Intl.DateTimeFormat().resolvedOptions().timeZone;
if (isOwnZone('Europe/Berlin')) throw new Error('these tests read Berlin as another zone than the machine’s: run them on another clock (TZ=UTC)');
/** A time on the browser's own clock, in words, as a box wrote it before zones: 15 Oct 2026, 08:30. */
const ownWords = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', numberingSystem: 'latn' }).format(new Date(iso));

const reader = (more: Partial<DateReader> = {}): DateReader => ({ kind: 'datetime', order: 'dmy', locale: 'en', label: 'Test drive', labels: WIDGET_LABELS.en, zone: 'Europe/Berlin', ...more });
const read = (text: string, more: Partial<DateReader> = {}) => readDateText(text, reader(more));

describe('a date and time read on a zone’s clock', () => {
  it('reads what is typed as the time it is there, and keeps the instant', () => {
    expect(read('15/10/2026 14:30')).toEqual({ ok: true, value: '2026-10-15T12:30:00.000Z' });
    expect(read('15/12/2026 14:30')).toEqual({ ok: true, value: '2026-12-15T13:30:00.000Z' });
    // Cairo's clock is an hour ahead of Berlin's in October.
    expect(read('15/10/2026 14:30', { zone: 'Africa/Cairo' })).toEqual({ ok: true, value: '2026-10-15T11:30:00.000Z' });
    // An instant as a server writes one is that instant.
    expect(read('2026-10-25T01:30:00Z')).toEqual({ ok: true, value: '2026-10-25T01:30:00.000Z' });
  });

  it('says a time the clocks skip, never moving it', () => {
    expect(read('29/03/2026 02:30')).toEqual({ ok: false, problem: 'skippedTime', words: 'Test drive: there is no 02:30 on 29 Mar 2026 in Central European Time: the clocks go from 02:00 to 03:00' });
    expect(read('29/03/2026 03:00')).toEqual({ ok: true, value: '2026-03-29T01:00:00.000Z' });
  });

  it('says a time the clocks repeat, naming both offsets, and reads either once an offset or its zone’s name says which', () => {
    expect(read('25/10/2026 02:30')).toEqual({ ok: false, problem: 'repeatedTime', words: 'Test drive: 02:30 comes twice on 25 Oct 2026 in Central European Time, as the clocks go back; write 02:30 +02:00 or 02:30 +01:00' });
    expect(read('25/10/2026 02:30 CEST')).toEqual({ ok: true, value: '2026-10-25T00:30:00.000Z' });
    expect(read('25/10/2026 02:30 cet')).toEqual({ ok: true, value: '2026-10-25T01:30:00.000Z' });
    // An offset is the instant as written.
    expect(read('25/10/2026 02:30 +01:00')).toEqual({ ok: true, value: '2026-10-25T01:30:00.000Z' });
    expect(read('25/10/2026 02:30 GMT+2')).toEqual({ ok: true, value: '2026-10-25T00:30:00.000Z' });
  });

  it('reads back what its box writes at rest, the zone’s name after it, in each language', () => {
    for (const locale of ['en', 'ar', 'de', 'fr'] as Locale[]) {
      for (const value of ['2026-10-15T12:30:00.000Z', '2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z']) {
        const words = restingText(value, 'datetime', locale, 'Europe/Berlin');
        expect({ locale, words, read: read(words, { locale, labels: WIDGET_LABELS[locale] }) }).toEqual({ locale, words, read: { ok: true, value } });
      }
    }
  });

  it('says a name the zone does not have that day: another zone’s, or its own from another season', () => {
    expect(read('15/12/2026 14:30 CEST')).toEqual({ ok: false, problem: 'notThisZone', words: 'Test drive: on 15 Dec 2026, Central European Time is CET, not CEST' });
    expect(read('15/10/2026 14:30 EST')).toEqual({ ok: false, problem: 'notThisZone', words: 'Test drive: on 15 Oct 2026, Central European Time is CEST, not EST' });
    expect(read('15/12/2026 14:30 CET')).toEqual({ ok: true, value: '2026-12-15T13:30:00.000Z' });
  });

  it('writes a time on the zone’s clock to type, its name where it comes twice, and in words with its name', () => {
    expect(typingText('2026-10-15T12:30:00.000Z', 'datetime', 'dmy', 'en', 'Europe/Berlin')).toBe('15/10/2026 14:30');
    expect(typingText('2026-10-25T00:30:00.000Z', 'datetime', 'dmy', 'en', 'Europe/Berlin')).toBe('25/10/2026 02:30 CEST');
    expect(typingText('2026-10-25T01:30:00.000Z', 'datetime', 'dmy', 'en', 'Europe/Berlin')).toBe('25/10/2026 02:30 CET');
    expect(restingText('2026-10-15T12:30:00.000Z', 'datetime', 'en', 'Europe/Berlin')).toBe('15 Oct 2026, 14:30 CEST');
    expect(restingText('2026-10-15T12:30:00.000Z', 'datetime', 'en', 'Europe/Berlin', false)).toBe('15 Oct 2026, 14:30');
    expect(restingText('2026-10-15T12:30:00.000Z', 'datetime', 'de', 'Europe/Berlin')).toBe('15. Okt. 2026, 14:30 MESZ');
    // In the browser's own zone a time is written as it always was; without a zone, on the browser's own clock.
    expect(restingText('2026-10-15T12:30:00.000Z', 'datetime', 'en', OWN)).toBe(ownWords('2026-10-15T12:30:00.000Z'));
    expect(restingText('2026-10-15T12:30:00.000Z', 'datetime', 'en')).toBe(ownWords('2026-10-15T12:30:00.000Z'));
    // New York's 01:30 on 1 November comes twice: summer time's first (GMT-4, as British English names it), then winter's.
    expect(restingText('2026-11-01T05:30:00.000Z', 'datetime', 'en', 'America/New_York')).toBe('1 Nov 2026, 01:30 GMT-4');
    expect(restingText('2026-11-01T06:30:00.000Z', 'datetime', 'en', 'America/New_York')).toBe('1 Nov 2026, 01:30 GMT-5');
  });

  it('shows a cell’s date and time on its field’s zone’s clock', () => {
    const zoned = { type: 'datetime', label: 'Starts', timeZone: 'Europe/Berlin' } as const;
    expect(displayValue(zoned, '2026-10-15T12:30:00.000Z')).toBe('15 Oct 2026, 14:30 CEST');
  });

  it('shows a cell’s date and time on the browser’s clock where nothing names a zone, as its box does — never the clock it was written with', () => {
    const plain = { type: 'datetime', label: 'Starts' } as const;
    // An instant written with its offset, 14:30 in Berlin's summer: 12:30 UTC, whatever clock the browser keeps.
    for (const value of ['2026-10-15T14:30:00+02:00', '2026-10-15T12:30:00.000Z']) expect(displayValue(plain, value)).toBe(ownWords('2026-10-15T12:30:00.000Z'));
    expect(displayValue(plain, 'soon')).toBe('soon');
  });
});

/** A date and time on a page in Berlin's zone, as the viewer keeps it. */
function mount(field: Record<string, unknown> = {}, node: Partial<FieldNode> = {}, page: Partial<Page> = { timeZone: 'Europe/Berlin' }) {
  const made = {
    fieldia: '0.13',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { type: 'datetime', label: 'Test drive', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] },
    ...page,
  } as Page;
  const form = createForm({ page: made, now: () => new Date('2026-10-16T08:00:00Z') });
  const widget = createWidget({ form, name: 'x', field: form.page.fields['x'], node: (made.layout as { children: FieldNode[] }).children[0], id: 'fd-x', document, labels: WIDGET_LABELS.en, locale: 'en' });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element, input: widget.element.querySelector('input') as HTMLInputElement, value: () => form.getState().values['x'] };
}

/** Keys pressed one by one where the caret is: a beforeinput the box may refuse, then the character, then input. */
function keys(input: HTMLInputElement, text: string) {
  for (const char of [...text]) {
    const before = new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable: true, bubbles: true });
    if (!input.dispatchEvent(before)) continue;
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(char, start, input.selectionEnd ?? start, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}
function enter(input: HTMLInputElement) {
  input.focus();
  input.setSelectionRange(0, input.value.length);
}

describe('a date and time box on a zone’s clock', () => {
  it('is typed on the zone’s clock, its short name beside it, and shows it in words once left', () => {
    const { el, input, value } = mount();
    const zone = el.querySelector('.fd-zone') as HTMLElement;
    // Nothing held yet: the zone's name now.
    expect(zone.textContent).toBe('CEST');
    expect(zone.title).toBe('Central European Time');
    expect(input.getAttribute('aria-describedby')).toContain('fd-x-zone');
    enter(input);
    keys(input, '15/12/2026 09:15');
    expect(value()).toBe('2026-12-15T08:15:00.000Z');
    input.blur();
    // In words without the name, which stands beside the box: December is winter time.
    expect(input.value).toBe('15 Dec 2026, 09:15');
    expect(zone.textContent).toBe('CET');
  });

  it('keeps a time the clocks repeat as typed until an offset or its zone’s name says which, and says why', () => {
    const { input, value, form } = mount();
    enter(input);
    keys(input, '25/10/2026 02:30');
    expect(value()).toBeNull();
    input.blur();
    expect(form.getState().unread['x']?.message).toBe('Test drive: 02:30 comes twice on 25 Oct 2026 in Central European Time, as the clocks go back; write 02:30 +02:00 or 02:30 +01:00');
    expect(input.value).toBe('25/10/2026 02:30');
    enter(input);
    input.setSelectionRange(input.value.length, input.value.length);
    // The zone's name may be typed: its letters are no stranger to the box.
    keys(input, ' CET');
    expect(input.value).toBe('25/10/2026 02:30 CET');
    input.blur();
    expect(value()).toBe('2026-10-25T01:30:00.000Z');
    expect(form.getState().unread['x']).toBeUndefined();
    // Entered again, its name is written: it comes twice that day.
    enter(input);
    expect(input.value).toBe('25/10/2026 02:30 CET');
  });

  it('takes an offset typed after a time the clocks repeat, as the words say: its sign is no stranger to the box', () => {
    const { input, value } = mount();
    enter(input);
    keys(input, '25/10/2026 02:30 +02:00');
    expect(input.value).toBe('25/10/2026 02:30 +02:00');
    input.blur();
    expect(value()).toBe('2026-10-25T00:30:00.000Z');
  });

  it('refuses a letter no zone’s name begins with, as it refuses any', () => {
    const { input } = mount();
    enter(input);
    keys(input, '15/10/2026 14:30 X');
    expect(input.value).toBe('15/10/2026 14:30 ');
  });

  it('marks today on the zone’s calendar and keeps the time on its clock as a day is picked', () => {
    // 08:00 UTC on the 16th, the form's clock: the 16th in Berlin.
    const { el, value, form } = mount();
    form.setValue('x', '2026-10-15T12:30:00.000Z');
    (el.querySelector('.fd-calendar-button') as HTMLButtonElement).click();
    expect(el.querySelector('[aria-current="date"]')?.textContent).toBe('16');
    const day20 = [...el.querySelectorAll<HTMLButtonElement>('.fd-calendar-grid td button')].find((b) => b.textContent === '20' && !b.classList.contains('fd-outside'));
    day20?.click();
    // 14:30 on Berlin's clock, the 20th.
    expect(value()).toBe('2026-10-20T12:30:00.000Z');
  });

  it('says a day picked on the calendar whose time the clocks skip, and picks nothing', () => {
    const { el, value, form } = mount();
    form.setValue('x', '2026-03-28T01:30:00.000Z');
    (el.querySelector('.fd-calendar-button') as HTMLButtonElement).click();
    const day29 = [...el.querySelectorAll<HTMLButtonElement>('.fd-calendar-grid td button')].find((b) => b.textContent === '29' && !b.classList.contains('fd-outside'));
    day29?.click();
    expect(value()).toBe('2026-03-28T01:30:00.000Z');
    expect(el.querySelector('.fd-calendar-note')?.textContent).toBe('Test drive: there is no 02:30 on 29 Mar 2026 in Central European Time: the clocks go from 02:00 to 03:00');
  });

  it('draws no zone beside a box on the browser’s own clock, nor on a page that names none', () => {
    expect(mount({}, {}, { timeZone: OWN }).el.querySelector('.fd-zone')).toBeNull();
    const plain = mount({}, {}, {});
    expect(plain.el.querySelector('.fd-zone')).toBeNull();
    enter(plain.input);
    keys(plain.input, '15/10/2026 14:30');
    expect(plain.value()).toBe(new Date(2026, 9, 15, 14, 30).toISOString());
  });

  it('starts a date at today on the zone’s clock', () => {
    const page = { fieldia: '0.13', id: 't', timeZone: 'Asia/Tokyo', data: { kind: 'responses' }, fields: { d: { type: 'date', label: 'Day', default: 'today' } }, layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'n', field: 'd' }] } } as Page;
    // 20:00 UTC on the 15th: the 16th in Tokyo, the 15th in New York.
    expect(createForm({ page, now: () => new Date('2026-10-15T20:00:00Z') }).getState().values['d']).toBe('2026-10-16');
  });
});
