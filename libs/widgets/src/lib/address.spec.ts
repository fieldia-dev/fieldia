import type { FieldNode } from '@fieldia/core';
import { mountKind, typeInto } from './test-kinds';

/** An address in its parts, each a box with its own label; the value an object of the parts filled in. */

const address = (options?: FieldNode['options'], locale?: 'ar') => mountKind({ type: 'json', label: 'Home address' }, { widget: 'address', ...(options ? { options } : {}) }, locale ? { locale } : {});
const box = (el: Element, part: string) => el.querySelector(`input[data-part="${part}"]`) as HTMLInputElement;
const names = (el: Element) => [...el.querySelectorAll('label')].map((l) => l.textContent);

describe('address', () => {
  it('asks for the street, city, postcode and country, each named, in a group the field’s label names', () => {
    const { el } = address();
    expect([el.id, el.getAttribute('role')]).toEqual(['fd-x', 'group']);
    expect(names(el)).toEqual(['Street address', 'City', 'Postcode', 'Country']);
    const street = box(el, 'street');
    expect((el.querySelector(`label[for="${street.id}"]`) as HTMLElement).textContent).toBe('Street address');
    // The browser can fill it in.
    expect(['street', 'city', 'postcode', 'country'].map((p) => box(el, p).autocomplete)).toEqual(['street-address', 'address-level2', 'postal-code', 'country-name']);
  });

  it('asks only for the parts the page chooses, in its order', () => {
    const { el } = address({ parts: ['postcode', 'street', 'nonsense'] });
    expect(names(el)).toEqual(['Postcode', 'Street address']);
  });

  it('keeps the parts typed in, and nothing when every part is empty', () => {
    const { el, value } = address();
    typeInto(box(el, 'street'), '12 Nile Street');
    typeInto(box(el, 'city'), 'Cairo');
    expect(value()).toEqual({ street: '12 Nile Street', city: 'Cairo' });
    typeInto(box(el, 'street'), '  ');
    expect(value()).toEqual({ city: 'Cairo' });
    typeInto(box(el, 'city'), '');
    expect(value()).toBeNull();
  });

  it('shows an address set from outside, keeping parts it does not ask for', () => {
    const { el, form, value } = address({ parts: ['street', 'city'] });
    form.setValue('x', { street: '5 Tahrir Square', city: 'Cairo', region: 'Giza' });
    expect([box(el, 'street').value, box(el, 'city').value]).toEqual(['5 Tahrir Square', 'Cairo']);
    typeInto(box(el, 'city'), 'Giza');
    expect(value()).toEqual({ street: '5 Tahrir Square', city: 'Giza', region: 'Giza' });
  });

  it('names its parts in the page’s language', () => {
    expect(names(address(undefined, 'ar').el)).toEqual(['عنوان الشارع', 'المدينة', 'الرمز البريدي', 'الدولة']);
  });

  it('can only be read when read-only, and says when it is wrong', () => {
    const { el, refresh } = address();
    refresh({ readonly: true, invalid: true });
    expect([...el.querySelectorAll('input')].every((i) => (i as HTMLInputElement).readOnly)).toBe(true);
    expect(el.getAttribute('aria-invalid')).toBe('true');
  });
});
