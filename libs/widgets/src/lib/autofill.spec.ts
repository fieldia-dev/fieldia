import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { mountKind } from './test-kinds';
import { createWidget } from './widgets';

/**
 * What the browser fills each box in with (`autocomplete`) and the keyboard a phone shows for it (`inputmode`), and a
 * value the browser fills in read as the person's own, typed: Chrome and Safari write the box whole with no key and no
 * beforeinput, then send input and change; Firefox sends a beforeinput that cannot be stopped first, replacing the text.
 */

type Box = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** Chrome's and Safari's autofill: the box written whole, no key pressed, then input and change. */
function chromeFills(box: Box, text: string) {
  box.value = text;
  box.dispatchEvent(new InputEvent('input', { bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Firefox's: a beforeinput that cannot be stopped, the text replaced, then input and change. */
function firefoxFills(box: Box, text: string) {
  box.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertReplacementText', data: text, cancelable: false, bubbles: true }));
  box.value = text;
  box.dispatchEvent(new InputEvent('input', { inputType: 'insertReplacementText', data: text, bubbles: true }));
  box.dispatchEvent(new Event('change', { bubbles: true }));
}

const boxOf = (el: HTMLElement) => (el.matches('input, textarea, select') ? el : el.querySelector('input, textarea, select')) as HTMLInputElement;
const attrs = (box: Element) => [box.getAttribute('autocomplete'), box.getAttribute('inputmode')];
const kind = (field: Record<string, unknown>, node: Partial<FieldNode> = {}) => boxOf(mountKind(field, node).el);
const hintSays = () => {
  const hint = document.querySelector('.fd-refusal-hint') as HTMLElement | null;
  return hint && !hint.hidden ? hint.textContent : null;
};

describe('every box names what the browser fills it in with, and the keyboard a phone shows', () => {
  it('a line of words: nothing unless the page names a purpose; its keyboard the purpose’s', () => {
    expect(attrs(kind({ type: 'char' }))).toEqual(['off', null]);
    expect(attrs(kind({ type: 'char' }, { autocomplete: 'given-name' }))).toEqual(['given-name', null]);
    expect(attrs(kind({ type: 'char' }, { autocomplete: 'one-time-code' }))).toEqual(['one-time-code', 'numeric']);
    expect(attrs(kind({ type: 'char' }, { autocomplete: 'billing mobile tel' }))).toEqual(['billing mobile tel', 'tel']);
    expect(attrs(kind({ type: 'char' }, { autocomplete: 'work email' }))).toEqual(['work email', 'email']);
    expect(attrs(kind({ type: 'char' }, { autocomplete: 'cc-number', inputmode: 'text' }))).toEqual(['cc-number', 'text']);
    expect(attrs(kind({ type: 'char' }, { inputmode: 'numeric' }))).toEqual(['off', 'numeric']);
  });

  it('an email, a phone, a web address and a password: their own, unless the page says', () => {
    expect(attrs(kind({ type: 'char' }, { widget: 'email' }))).toEqual(['email', 'email']);
    expect(attrs(kind({ type: 'char' }, { widget: 'email', autocomplete: 'work email' }))).toEqual(['work email', 'email']);
    expect(attrs(kind({ type: 'char' }, { widget: 'email', autocomplete: 'off' }))).toEqual(['off', 'email']);
    const phone = kind({ type: 'char' }, { widget: 'phone' });
    expect([phone.type, ...attrs(phone)]).toEqual(['tel', 'tel', null]);
    expect(attrs(kind({ type: 'char' }, { widget: 'phone', autocomplete: 'mobile tel' }))).toEqual(['mobile tel', 'tel']);
    expect(attrs(kind({ type: 'char' }, { widget: 'url' }))).toEqual(['url', 'url']);
    // A password being set, never the one the person signs in with filled into a record's field.
    expect(attrs(kind({ type: 'char' }, { widget: 'password' }))).toEqual(['new-password', null]);
    expect(attrs(kind({ type: 'char' }, { widget: 'password', autocomplete: 'current-password' }))).toEqual(['current-password', null]);
  });

  it('a paragraph, a number, a choice and a date: the page’s purpose, their own keyboard', () => {
    expect(attrs(kind({ type: 'text' }))).toEqual([null, null]);
    expect(attrs(kind({ type: 'text' }, { autocomplete: 'street-address' }))).toEqual(['street-address', null]);
    expect(attrs(kind({ type: 'integer', min: 0 }))).toEqual(['off', 'numeric']);
    expect(attrs(kind({ type: 'float', min: 0 }))).toEqual(['off', 'decimal']);
    expect(attrs(kind({ type: 'integer', min: 2000 }, { autocomplete: 'cc-exp-year' }))).toEqual(['cc-exp-year', 'numeric']);
    expect(attrs(kind({ type: 'integer', min: 0 }, { inputmode: 'text' }))).toEqual(['off', 'text']);
    const options = [{ value: 'eg', label: 'Egypt' }, { value: 'sa', label: 'Saudi Arabia' }];
    expect(attrs(kind({ type: 'selection', options }))).toEqual([null, null]);
    expect(attrs(kind({ type: 'selection', options }, { autocomplete: 'country' }))).toEqual(['country', null]);
    // A long list's box, typed in by name: the browser fills its one choice in where the page says.
    const many = Array.from({ length: 20 }, (_, i) => ({ value: `c${i}`, label: `Country ${i}` }));
    expect(attrs(kind({ type: 'selection', options: many }))).toEqual(['off', null]);
    expect(attrs(kind({ type: 'selection', options: many }, { autocomplete: 'country-name' }))).toEqual(['country-name', null]);
    expect(attrs(kind({ type: 'date' }))).toEqual(['off', null]);
    expect(attrs(kind({ type: 'date' }, { autocomplete: 'bday' }))).toEqual(['bday', null]);
  });

  it('an address in parts: each part’s own, after whose it is, or none', () => {
    const parts = (node: Partial<FieldNode>) => {
      const { el } = mountKind({ type: 'json' }, { widget: 'address', options: { parts: ['street', 'line2', 'city', 'postcode', 'country'] }, ...node });
      return [...el.querySelectorAll('[data-part]')].map((box) => box.getAttribute('autocomplete'));
    };
    expect(parts({})).toEqual(['address-line1', 'address-line2', 'address-level2', 'postal-code', 'country']);
    expect(parts({ autocomplete: 'shipping' })).toEqual(['shipping address-line1', 'shipping address-line2', 'shipping address-level2', 'shipping postal-code', 'shipping country']);
    expect(parts({ autocomplete: 'section-home billing' })[3]).toBe('section-home billing postal-code');
    expect(parts({ autocomplete: 'off' })).toEqual(['off', 'off', 'off', 'off', 'off']);
  });
});

describe('a value the browser fills in is read as the person’s own, typed', () => {
  it.each([
    ['Chrome and Safari', chromeFills],
    ['Firefox', firefoxFills],
  ])('%s: written into a box, it is the field’s value, the person’s change', (_, fills) => {
    const { form, el } = mountKind({ type: 'char', size: 40 }, { autocomplete: 'given-name' });
    const changes: unknown[] = [];
    form.on('change', (event) => changes.push([event.field, event.value, event.by]));
    fills(boxOf(el), 'Sara');
    expect(form.getState().values['x']).toBe('Sara');
    expect(form.getState().dirty).toEqual(['x']);
    expect(changes).toEqual([['x', 'Sara', 'person']]);
  });

  it.each([
    ['Chrome and Safari', chromeFills],
    ['Firefox', firefoxFills],
  ])('%s: what the rules would refuse lands all the same, never put back, and the field says why', (_, fills) => {
    const { form, el } = mountKind({ type: 'char' }, { widget: 'phone' });
    const box = boxOf(el);
    fills(box, '+1 555 CALL NOW');
    expect(box.value).toBe('+1 555 CALL NOW');
    expect(form.getState().values['x']).toBe('+1 555 CALL NOW');
    // Nobody is looking at a box filled from a pick in another: the field's own check says it, as the box is read.
    expect(hintSays()).toBeNull();
    expect(form.problem('x')).not.toBeNull();
  });

  it.each([
    ['Chrome and Safari', (box: HTMLInputElement, text: string) => {
      box.value = text;
      box.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }],
    ['Firefox', (box: HTMLInputElement, text: string) => {
      box.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertReplacementText', data: text, cancelable: false, bubbles: true }));
      box.value = text;
      box.dispatchEvent(new InputEvent('input', { inputType: 'insertReplacementText', data: text, bubbles: true }));
    }],
  ])('%s: in the box the person picked it in, what would be refused is held whole, said at once, and theirs as they leave', (_, fills) => {
    const { form, el } = mountKind({ type: 'char' }, { widget: 'phone' });
    const box = boxOf(el);
    box.focus();
    // Typed a little first, the caret after it: the pick replaces all of it, never only what follows the caret.
    box.value = '+1';
    box.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: '1', cancelable: true, bubbles: true }));
    box.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: '1', bubbles: true }));
    fills(box, '+1 555 CALL NOW');
    expect(hintSays()).toBe('A phone number takes digits, spaces and + ( ) . - only');
    box.blur();
    box.dispatchEvent(new Event('blur'));
    expect(box.value).toBe('+1 555 CALL NOW');
    expect(form.getState().values['x']).toBe('+1 555 CALL NOW');
  });

  it('is cleaned as a paste is: an address’s link, and kept whole past the most characters', () => {
    const email = mountKind({ type: 'char' }, { widget: 'email' });
    chromeFills(boxOf(email.el), 'mailto:sara@example.com');
    expect(email.form.getState().values['x']).toBe('sara@example.com');
    const name = mountKind({ type: 'char', size: 5 }, { autocomplete: 'name' });
    chromeFills(boxOf(name.el), 'Sara Hassan');
    expect(name.form.getState().values['x']).toBe('Sara Hassan');
    expect(name.form.problem('x')).toBe('X is 6 characters too long: shorten it to 5');
  });

  it('a number that reads is taken; one that does not stays in its box, said, the field keeping what it held', () => {
    const { form, el } = mountKind({ type: 'integer', default: 7 }, { autocomplete: 'cc-exp-year' });
    const box = boxOf(el);
    chromeFills(box, '2,031');
    expect(form.getState().values['x']).toBe(2031);
    chromeFills(box, '20x1');
    expect(form.getState().values['x']).toBe(2031);
    expect(form.getState().unread['x']).toEqual({ text: '20x1', message: expect.stringContaining('20x1') });
    expect(box.value).toBe('20x1');
  });

  it('a date that reads is taken; one that does not stays, said, the field keeping its day', () => {
    const { form, el } = mountKind({ type: 'date' }, { autocomplete: 'bday' });
    const box = boxOf(el);
    chromeFills(box, '14/03/1990');
    expect(form.getState().values['x']).toBe('1990-03-14');
    expect(box.value).toBe('14 Mar 1990');
    chromeFills(box, 'someday');
    expect(form.getState().values['x']).toBe('1990-03-14');
    expect(form.getState().unread['x']?.text).toBe('someday');
    expect(box.value).toBe('someday');
  });

  it('a long list’s one choice is picked by the name filled in', () => {
    const options = Array.from({ length: 20 }, (_, i) => ({ value: `c${i}`, label: i === 7 ? 'Egypt' : `Country ${i}` }));
    const { form, el } = mountKind({ type: 'selection', options }, { autocomplete: 'country-name' });
    chromeFills(boxOf(el), 'Egypt');
    expect(form.getState().values['x']).toBe('c7');
    expect(document.querySelector('.fd-listbox:not([hidden])')).toBeNull();
  });

  it('an address’s parts and its country, as the browser fills them from one pick', () => {
    const { form, el } = mountKind({ type: 'json' }, { widget: 'address', autocomplete: 'shipping' });
    const part = (name: string) => el.querySelector(`[data-part="${name}"]`) as HTMLInputElement;
    chromeFills(part('street'), '12 Nile St');
    chromeFills(part('city'), 'Cairo');
    chromeFills(part('postcode'), '11511');
    chromeFills(part('country'), 'EG');
    expect(form.getState().values['x']).toEqual({ street: '12 Nile St', city: 'Cairo', postcode: '11511', country: 'EG' });
  });

  it('is the person’s work no save took: at risk, asked about before it is left, and sent by the next save', async () => {
    const page: Page = {
      fieldia: '0.4',
      id: 'contact',
      data: { kind: 'record', model: 'contact' },
      fields: { name: { type: 'char', label: 'Name' }, email: { type: 'char', label: 'Email' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-email', field: 'email', widget: 'email' }] },
    };
    const dataSource = createMemoryDataSource({ records: { contact: { 1: { name: 'Sara', email: null } } } });
    const asked: string[] = [];
    const form = createForm({ page, dataSource, recordId: 1, confirm: (message) => (asked.push(message), false) });
    await form.load();
    const field = page.fields['email'] as Field;
    const widget = createWidget({ form, name: 'email', field, node: page.layout.type === 'sections' ? (page.layout.children[0] as FieldNode) : ({} as FieldNode), id: 'fd-email', document, labels: WIDGET_LABELS.en, locale: 'en' });
    document.body.replaceChildren(widget.element);
    form.subscribe((state) => widget.update({ value: state.values['email'], values: state.values, readonly: false, required: false, invalid: false }));
    form.setValue('name', 'Sara H.');
    expect(await form.save()).toBe(true);
    chromeFills(boxOf(widget.element), 'sara@example.com');
    expect(form.getState().unsent).toEqual(['email']);
    expect(await form.leave()).toBe(false);
    expect(asked).toHaveLength(1);
    expect(await form.save()).toBe(true);
    expect(dataSource.records['contact'][1]['email']).toBe('sara@example.com');
    expect(form.getState().unsent).toEqual([]);
  });
});
