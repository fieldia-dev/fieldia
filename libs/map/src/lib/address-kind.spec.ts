import type { FieldNode, Page } from '@fieldia/core';
import { mapKinds } from './kinds';
import { ADDRESS_LABELS } from './address-labels';

/** The address with suggestions in the designer: a char field drawn by `address-search`, its settings the fields a picked address fills and the country it keeps to. */

const page = {
  fieldia: '0.1',
  id: 'delivery',
  data: { kind: 'responses' },
  fields: {
    address: { type: 'char', label: 'Address' },
    spot: { type: 'json', label: 'Delivery to' },
    parts: { type: 'json', label: 'Address in parts' },
    notes: { type: 'text', label: 'Notes' },
  },
  layout: { type: 'sections', id: 's', children: [] },
} as unknown as Page;

const kind = (locale?: 'ar') => mapKinds({ locale }).find((k) => k.id === 'map-address')!;
const setting = (element: HTMLElement, words: string) => [...element.querySelectorAll('label')].find((l) => l.textContent?.startsWith(words))!.querySelector('select')!;
const choose = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event('change'));
};

describe('an address with suggestions, in the designer', () => {
  it('is a char field drawn by address-search, among the maps', () => {
    const address = kind();
    expect([address.label, address.group, address.widget, address.field('Address').type]).toEqual(['Address search', 'Maps', 'address-search', 'char']);
    expect([address.fits({ type: 'char', label: 'x' }), address.fits({ type: 'text', label: 'x' })]).toEqual([true, false]);
  });

  it('offers the page’s json fields for its place and its parts, and a country, keeping each on the field’s place', () => {
    const set = jest.fn(() => true);
    const settings = kind().settings({ document, set });
    document.body.replaceChildren(settings.element);
    const node: FieldNode = { type: 'field', id: 'address', field: 'address', widget: 'address-search' };
    settings.refresh(page, node);
    const place = setting(settings.element, 'Place goes into');
    expect([...place.options].map((o) => [o.value, o.textContent])).toEqual([['', 'Nowhere'], ['spot', 'Delivery to'], ['parts', 'Address in parts']]);
    choose(place, 'spot');
    expect(set).toHaveBeenLastCalledWith({ placeField: 'spot' });
    choose(setting(settings.element, 'Parts go into'), 'parts');
    expect(set).toHaveBeenLastCalledWith({ partsField: 'parts' });
    const country = setting(settings.element, 'Addresses in');
    expect(country.options[0].textContent).toBe('Any country');
    expect([...country.options].find((o) => o.value === 'EG')?.textContent).toBe('Egypt');
    choose(country, 'EG');
    expect(set).toHaveBeenLastCalledWith({ countries: 'EG' });
    choose(country, '');
    expect(set).toHaveBeenLastCalledWith({ countries: null });
    // Several countries written on the page are kept, shown as they are.
    settings.refresh(page, { ...node, options: { placeField: 'spot', countries: ['EG', 'SA'] } });
    expect([place.value, country.value, country.selectedOptions[0].textContent]).toEqual(['spot', 'EG,SA', 'EG,SA']);
  });

  it('is in the designer’s language', () => {
    const settings = kind('ar').settings({ document, set: () => true });
    settings.refresh(page, { type: 'field', id: 'address', field: 'address', widget: 'address-search' });
    expect(kind('ar').label).toBe('بحث عن عنوان');
    expect(settings.element.textContent).toContain('يُكتب المكان في');
    expect(setting(settings.element, 'العناوين في').options[0].textContent).toBe('أي بلد');
  });

  it('has its words in every language, with the same blanks', () => {
    const blanks = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const [locale, words] of Object.entries(ADDRESS_LABELS)) {
      expect([locale, Object.keys(words).sort()]).toEqual([locale, Object.keys(ADDRESS_LABELS.en).sort()]);
      for (const [key, text] of Object.entries(words)) expect([locale, key, text.trim().length > 0, blanks(text)]).toEqual([locale, key, true, blanks(ADDRESS_LABELS.en[key as keyof typeof words])]);
    }
  });
});
