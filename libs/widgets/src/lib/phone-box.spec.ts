import { createForm, type Field, type FieldNode, type Locale, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { phonePart } from './widget-parts';
import { createWidget, widgetPart } from './widgets';

/**
 * A phone number read the world over (phone-box.ts, in the phone part): where its page's `phone` or its own options
 * say so, a phone field picks or takes its country, checks the number by it, keeps it as E.164 and shows it at rest
 * as the page says, with a call and a WhatsApp link; elsewhere it is the text box it was.
 */

const FIELD: Field = { type: 'char', label: 'Mobile' };

function mount(node: Partial<FieldNode> = {}, options: { phone?: Page['phone']; locale?: Locale; value?: string | null } = {}) {
  const page = {
    fieldia: '0.3',
    id: 't',
    data: { kind: 'responses' },
    fields: { mobile: FIELD },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-mobile', field: 'mobile', widget: 'phone', ...node }] },
    ...(options.phone ? { phone: options.phone } : {}),
  } as Page;
  const form = createForm({ page, ...(options.value !== undefined ? { values: { mobile: options.value } } : {}) });
  const locale = options.locale ?? 'en';
  const widget = createWidget({ form, name: 'mobile', field: FIELD, node: (page.layout as { children: FieldNode[] }).children[0], id: 'fd-mobile', document, labels: WIDGET_LABELS[locale], locale });
  document.body.replaceChildren(widget.element);
  let readonly = false;
  const refresh = () => widget.update({ value: form.getState().values['mobile'], values: form.getState().values, readonly, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const el = widget.element;
  return {
    form,
    page,
    widget,
    el,
    input: el.querySelector('input') as HTMLInputElement,
    select: el.querySelector('select') as HTMLSelectElement,
    value: () => form.getState().values['mobile'],
    unread: () => form.getState().unread['mobile'],
    setReadonly(on: boolean) {
      readonly = on;
      refresh();
    },
  };
}

/** Typed as a person types: each key, then the box left (or a save reading it first: a change). */
function type(input: HTMLInputElement, text: string) {
  input.focus();
  for (const char of [...text]) {
    const before = new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable: true, bubbles: true });
    if (!input.dispatchEvent(before)) continue;
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(char, start, input.selectionEnd ?? start, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}
const clear = (input: HTMLInputElement) => {
  input.focus();
  input.value = '';
  input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
};
const leave = (input: HTMLInputElement) => input.blur();
const pick = (select: HTMLSelectElement, code: string) => {
  select.value = code;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};
const shownCountry = (el: HTMLElement) => [el.querySelector('.fd-phone-flag')?.textContent, el.querySelector('.fd-phone-dial')?.textContent];
const links = (el: HTMLElement) => [...el.querySelectorAll<HTMLAnchorElement>('.fd-phone-link')].filter((a) => !a.hidden).map((a) => [a.textContent, a.getAttribute('href')]);

afterEach(() => document.body.replaceChildren());

describe('a phone read the world over', () => {
  it('is the phone part’s where the page or the field says so, and the text box it was elsewhere', () => {
    const node: FieldNode = { type: 'field', id: 'f', field: 'mobile', widget: 'phone' };
    expect(widgetPart(FIELD, node)).toBeUndefined();
    expect(widgetPart(FIELD, node, {}, { phone: {} } as Page)).toBe(phonePart);
    expect(widgetPart(FIELD, { ...node, options: { country: 'EG' } })).toBe(phonePart);
    expect(widgetPart(FIELD, { ...node, options: { shown: 'national' } })).toBe(phonePart);
    const plain = mount();
    expect(plain.el.matches('input.fd-input[type="tel"]')).toBe(true);
    expect(plain.el.querySelector('.fd-phone-country')).toBeNull();
    const read = mount({}, { phone: { country: 'EG' } });
    expect(read.el.matches('.fd-phone')).toBe(true);
    expect(read.input.id).toBe('fd-mobile');
    expect(read.input.type).toBe('tel');
    expect(read.input.autocomplete).toBe('tel');
    // The page's own autofill purpose kept, as a plain phone box keeps it: a sign-up's "mobile tel".
    expect(mount({ autocomplete: 'mobile tel' }, { phone: { country: 'EG' } }).input.autocomplete).toBe('mobile tel');
  });

  it('starts on the country the page or the field says, and on none when neither does', () => {
    expect(shownCountry(mount({}, { phone: { country: 'EG' } }).el)).toEqual(['🇪🇬', '+20']);
    expect(shownCountry(mount({ options: { country: 'AE' } }, { phone: { country: 'EG' } }).el)).toEqual(['🇦🇪', '+971']);
    const none = mount({}, { phone: {} });
    expect(shownCountry(none.el)).toEqual(['', 'Country']);
    expect(none.select.value).toBe('');
    // Every country, by its name in the page's language, with its dialling code.
    expect(none.select.getAttribute('aria-label')).toBe('Country of Mobile');
    expect([...none.select.options].find((o) => o.value === 'EG')?.textContent).toBe('🇪🇬 Egypt ⁦+20⁩');
    expect(none.select.options.length).toBeGreaterThan(240);
  });

  it('keeps a number typed at home as E.164, and shows it as the page says, with its links', () => {
    const { input, value, el } = mount({}, { phone: { country: 'EG' } });
    expect(links(el)).toEqual([]);
    type(input, '010 1234 5678');
    // Typed: nothing taken, nothing offered, until it is read.
    expect(value()).toBeNull();
    leave(input);
    expect(value()).toBe('+201012345678');
    expect(input.value).toBe('+20 10 1234 5678');
    expect(links(el)).toEqual([
      ['Call', 'tel:+201012345678'],
      ['WhatsApp', 'https://wa.me/201012345678'],
    ]);
    expect(el.querySelector('.fd-phone-call')?.getAttribute('aria-label')).toBe('Call +20 10 1234 5678');
    expect(el.querySelector('.fd-phone-whatsapp')?.getAttribute('aria-label')).toBe('Message +20 10 1234 5678 on WhatsApp');
    expect(el.querySelector('.fd-phone-whatsapp')?.getAttribute('target')).toBe('_blank');
    const national = mount({}, { phone: { country: 'EG', shown: 'national' } });
    type(national.input, '+20 10 1234 5678');
    leave(national.input);
    expect([national.value(), national.input.value]).toEqual(['+201012345678', '010 1234 5678']);
  });

  it('takes a number typed with its + and code in that code’s country, the country following the keys', () => {
    const { input, value, el } = mount({}, { phone: { country: 'EG', shown: 'national' } });
    type(input, '+971 5');
    expect(shownCountry(el)).toEqual(['🇦🇪', '+971']);
    type(input, '0 123 4567');
    leave(input);
    expect(value()).toBe('+971501234567');
    // Another country's number is written abroad's way, whatever the page shows at home.
    expect(input.value).toBe('+971 50 123 4567');
    expect(shownCountry(el)).toEqual(['🇦🇪', '+971']);
  });

  it('refuses a letter, says why, and holds the keys after it: never a number of other digits', () => {
    const { input, value, unread } = mount({}, { phone: { country: 'EG' } });
    type(input, '010 1oo 5678');
    expect(input.value).toBe('010 1');
    const hint = document.querySelector('.fd-refusal-hint:not([hidden])');
    expect(hint?.textContent).toBe('A phone number takes digits, spaces and + ( ) . - only');
    leave(input);
    // All that was typed stays the box's, unread, with why: never +20101 5678.
    expect(input.value).toBe('010 1oo 5678');
    expect(value()).toBeNull();
    expect(unread()?.text).toBe('010 1oo 5678');
    // Why, in its words: letters, never "too short" for the digits left without them.
    expect(unread()?.message).toBe('Mobile: letters are not allowed in a phone number');
  });

  it('the owner’s walk: "0151 abc" in Germany is said to have letters, not to be too short', () => {
    const { input, unread } = mount({}, { phone: { country: 'DE' } });
    type(input, '0151 abc');
    leave(input);
    expect(unread()).toEqual({ text: '0151 abc', message: 'Mobile: letters are not allowed in a phone number' });
  });

  it('offers WhatsApp for a number that can be a mobile, never for a fixed line; a country whose kinds are unknown keeps it', () => {
    const cairo = mount({}, { phone: { country: 'EG' }, value: '+20225374100' });
    expect(links(cairo.el)).toEqual([['Call', 'tel:+20225374100']]);
    const mobile = mount({}, { phone: { country: 'EG' }, value: '+201005374100' });
    expect(links(mobile.el).map(([name]) => name)).toEqual(['Call', 'WhatsApp']);
    // A +1 number's kind cannot be told from its digits: it may be a mobile.
    const us = mount({}, { phone: { country: 'US' }, value: '+12125550100' });
    expect(links(us.el).map(([name]) => name)).toEqual(['Call', 'WhatsApp']);
  });

  it('keeps a number that does not read as it was typed, with why, and the value the field held', () => {
    const { input, value, unread, el, form } = mount({}, { phone: { country: 'EG' }, value: '+201012345678' });
    clear(input);
    type(input, '010 1234 567');
    leave(input);
    expect(input.value).toBe('010 1234 567');
    expect(value()).toBe('+201012345678');
    expect(unread()).toEqual({ text: '010 1234 567', message: 'Mobile: too short for a +20 number (Egypt)' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    // Hidden, never disabled: no links to a number that does not read.
    expect(links(el)).toEqual([]);
    // Save refuses it.
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['mobile']).toBe('Mobile: too short for a +20 number (Egypt)');
    // Put right, it reads, and its words go.
    type(input, '8');
    leave(input);
    expect([value(), unread()]).toEqual(['+201012345678', undefined]);
    expect(form.validate()).toBe(true);
  });

  it('says each reason a number does not read', () => {
    const cases: [Page['phone'], string, string][] = [
      [{}, '010 1234 5678', 'Mobile: choose its country, or write it with + and the country code'],
      [{ country: 'EG' }, '+999 123 4567', 'Mobile: “+999” is no country’s code'],
      [{ country: 'EG' }, '010 1234 56789', 'Mobile: too long for a +20 number (Egypt)'],
      [{ country: 'EG' }, '014 1234 5678', 'Mobile: no +20 number (Egypt) starts with 014'],
    ];
    for (const [phone, typed, said] of cases) {
      const { input, unread } = mount({}, { phone });
      type(input, typed);
      leave(input);
      expect(unread()?.message).toBe(said);
    }
  });

  it('reads a number typed before its country once the country is picked; a number with its + takes the code picked', () => {
    const { input, select, value, unread, el } = mount({}, { phone: {} });
    type(input, '050 123 4567');
    leave(input);
    expect(unread()?.message).toBe('Mobile: choose its country, or write it with + and the country code');
    pick(select, 'SA');
    expect([value(), unread()]).toEqual(['+966501234567', undefined]);
    expect(input.value).toBe('+966 50 123 4567');
    expect(shownCountry(el)).toEqual(['🇸🇦', '+966']);
    pick(select, 'AE');
    expect([value(), input.value]).toEqual(['+971501234567', '+971 50 123 4567']);
  });

  it('empties the field when the box is emptied', () => {
    const { input, value, el } = mount({}, { phone: { country: 'EG' }, value: '+201012345678' });
    clear(input);
    leave(input);
    expect(value()).toBeNull();
    expect(links(el)).toEqual([]);
  });

  it('shows a number the record holds at rest, one kept another way read in the home country, with its links', () => {
    const { input, form, el } = mount({}, { phone: { country: 'EG', shown: 'national' }, value: '+20223456789' });
    expect(input.value).toBe('02 2345 6789');
    form.setValue('mobile', '+20 10 1234 5678');
    expect(input.value).toBe('010 1234 5678');
    expect(links(el)[0]).toEqual(['Call', 'tel:+201012345678']);
    // Words that are no number are shown as they are, with no links.
    form.setValue('mobile', 'ext. 204');
    expect(input.value).toBe('ext. 204');
    expect(links(el)).toEqual([]);
  });

  it('read-only, is the number and its links alone', () => {
    const { input, el, setReadonly } = mount({}, { phone: { country: 'EG' }, value: '+201012345678' });
    setReadonly(true);
    expect(input.readOnly).toBe(true);
    expect(el.hasAttribute('data-readonly')).toBe(true);
    expect(links(el)).toHaveLength(2);
  });

  it('speaks the page’s language: the countries’ names, its words and why', () => {
    const { input, select, unread, el } = mount({ label: 'الجوال' }, { phone: { country: 'EG' }, locale: 'ar' });
    expect(select.getAttribute('aria-label')).toBe('بلد الجوال');
    expect([...select.options].find((o) => o.value === 'EG')?.textContent).toBe('🇪🇬 مصر ⁦+20⁩');
    type(input, '٠١٠١٢٣٤٥٦٧');
    leave(input);
    expect(unread()?.message).toBe('الجوال: أقصر من أرقام ⁦+20⁩ (مصر)');
    type(input, '٨');
    leave(input);
    expect(links(el).map(([words]) => words)).toEqual(['اتصال', 'واتساب']);
  });
});
