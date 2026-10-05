import type { FieldNode } from '@fieldia/core';
import { mountKind, typeInto } from './test-kinds';

/** An address in its parts, each a box with its own label; the value an object of the parts filled in. */

const address = (options?: FieldNode['options'], locale?: 'ar') => mountKind({ type: 'json', label: 'Home address' }, { widget: 'address', ...(options ? { options } : {}) }, locale ? { locale } : {});
const box = (el: Element, part: string) => el.querySelector(`[data-part="${part}"]`) as HTMLInputElement;
const country = (el: Element) => box(el, 'country') as unknown as HTMLSelectElement;
const pick = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};
const names = (el: Element) => [...el.querySelectorAll('label')].map((l) => l.textContent);

describe('address', () => {
  it('asks for the street, city, postcode and country, each named, in a group the field’s label names', () => {
    const { el } = address();
    expect([el.id, el.getAttribute('role')]).toEqual(['fd-x', 'group']);
    expect(names(el)).toEqual(['Street address', 'City', 'Postcode', 'Country']);
    const street = box(el, 'street');
    expect((el.querySelector(`label[for="${street.id}"]`) as HTMLElement).textContent).toBe('Street address');
    // The browser can fill it in.
    expect(['street', 'city', 'postcode', 'country'].map((p) => box(el, p).getAttribute('autocomplete'))).toEqual(['street-address', 'address-level2', 'postal-code', 'country']);
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
    expect(country(el).disabled).toBe(true);
    expect(el.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('an address’s details', () => {
  it('asks for a second line and a region where the page chooses, the browser filling each', () => {
    const { el } = address({ parts: ['street', 'line2', 'city', 'region', 'postcode', 'country'] });
    expect(names(el)).toEqual(['Street address', 'Address line 2', 'City', 'State or region', 'Postcode', 'Country']);
    expect(['street', 'line2', 'region'].map((p) => box(el, p).autocomplete)).toEqual(['address-line1', 'address-line2', 'address-level1']);
  });

  it('offers the countries as a list in the page’s language, in its order, keeping each one’s code', () => {
    const { el, value } = address();
    const options = [...country(el).options];
    expect(options[0].value).toBe('');
    expect(options.length).toBeGreaterThan(240);
    expect(options.find((o) => o.value === 'EG')?.textContent).toBe('Egypt');
    // Only countries: no "European Union", no "United Nations".
    expect(options.some((o) => ['EU', 'UN', 'ZZ', 'UK'].includes(o.value))).toBe(false);
    const named = options.slice(1).map((o) => o.textContent ?? '');
    expect(named).toEqual([...named].sort((a, b) => a.localeCompare(b, 'en')));
    pick(country(el), 'EG');
    expect(value()).toEqual({ country: 'EG' });
    pick(country(el), '');
    expect(value()).toBeNull();
    expect([...country(address(undefined, 'ar').el).options].find((o) => o.value === 'EG')?.textContent).toBe('مصر');
  });

  it('starts on the page’s country, kept once anything else is typed', () => {
    const { el, value } = address({ country: 'EG' });
    expect(country(el).value).toBe('EG');
    expect(value()).toBeNull();
    typeInto(box(el, 'city'), 'Cairo');
    expect(value()).toEqual({ city: 'Cairo', country: 'EG' });
    pick(country(el), 'JO');
    expect(value()).toEqual({ city: 'Cairo', country: 'JO' });
  });

  it('shows a country it was given in words, as it was given', () => {
    const { el, form } = address();
    form.setValue('x', { city: 'Cairo', country: 'Egypt' });
    expect(country(el).value).toBe('Egypt');
    expect(country(el).selectedOptions[0].textContent).toBe('Egypt');
  });

  it('marks the parts that must be filled, and those missing when it is wrong', () => {
    const { el, refresh, form } = address({ requiredParts: ['street', 'city'] });
    expect(['street', 'city', 'postcode'].map((p) => box(el, p).getAttribute('aria-required'))).toEqual(['true', 'true', null]);
    expect(el.querySelectorAll('.fd-address-part.fd-required')).toHaveLength(2);
    form.setValue('x', { street: '12 Nile Street' });
    refresh({ invalid: true });
    expect(['street', 'city', 'postcode'].map((p) => box(el, p).getAttribute('aria-invalid'))).toEqual(['false', 'true', 'false']);
  });
});
