import { validatePage } from '../../index';
import { checkPage } from './check-page';

/**
 * An address with suggestions (`"widget": "address-search"` on a char field,
 * drawn by @fieldia/map): its options are known to the format, and the
 * fields they name are checked by kind, before anything draws.
 */

const fields = {
  address: { type: 'char', label: 'Address' },
  spot: { type: 'json', label: 'Delivery to' },
  lat: { type: 'float', label: 'Latitude' },
  lng: { type: 'float', label: 'Longitude' },
  parts: { type: 'json', label: 'Address in parts' },
  notes: { type: 'text', label: 'Notes' },
};

const page = (options?: Record<string, unknown>, field = 'address') => ({
  fieldia: '0.1',
  id: 'delivery',
  data: { kind: 'responses' },
  fields,
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'a', field, widget: 'address-search', ...(options ? { options } : {}) }] },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const at = 'layout.children[0]';

describe('an address with suggestions in the page format', () => {
  it('takes a place field, an address’s parts, countries and a point to be near', () => {
    expect(problems(page())).toEqual([]);
    expect(problems(page({ placeField: 'spot', partsField: 'parts', countries: ['EG', 'SA'], near: { lat: 30.04, lng: 31.23 } }))).toEqual([]);
    // A place in two float fields, as a place widget keeps one; countries as the designer writes them.
    expect(problems(page({ placeField: 'lat', longitudeField: 'lng', countries: 'EG,SA' }))).toEqual([]);
  });

  it('refuses options it does not know, and countries and points written wrong', () => {
    expect(problems(page({ placefield: 'spot' }))).toEqual([`${at}.options: Unrecognized key: "placefield"`]);
    expect(problems(page({ countries: ['eg'] }))).toEqual([`${at}.options.countries[0]: a country is its ISO code in capitals, such as "EG"`]);
    expect(problems(page({ countries: 'Egypt' }))).toEqual([`${at}.options.countries: countries are ISO codes in capitals, such as ["EG", "SA"] or "EG,SA"`]);
    expect(problems(page({ near: { lat: 120, lng: 31 } }))).toHaveLength(1);
    expect(problems(page({ near: [30, 31] }))[0]).toMatch(/^layout\.children\[0\]\.options\.near: /);
  });

  it('names fields that are there, of the kinds that keep a place and an address’s parts', () => {
    expect(problems(page({ placeField: 'nowhere' }))).toEqual([`${at}.options.placeField: no field "nowhere"`]);
    expect(problems(page({ placeField: 'notes' }))).toEqual([`${at}.options.placeField: "notes" is a text; a place is kept in a json field, or in a float field (its latitude) with longitudeField`]);
    expect(problems(page({ placeField: 'lat' }))).toEqual([`${at}.options.placeField: "lat" keeps a latitude: name the float field for its longitude in longitudeField`]);
    expect(problems(page({ placeField: 'spot', longitudeField: 'lng' }))).toEqual([`${at}.options.longitudeField: longitudeField goes with a placeField that is a float field, its latitude`]);
    expect(problems(page({ placeField: 'lat', longitudeField: 'parts' }))).toEqual([`${at}.options.longitudeField: "parts" is a json; a longitude is kept in a float field`]);
    expect(problems(page({ partsField: 'address' }))).toEqual([`${at}.options.partsField: "address" is a char; an address's parts are kept in a json field`]);
  });

  it('is for a char field', () => {
    expect(problems(page(undefined, 'notes'))).toEqual([`${at}.widget: address-search is for a char field; "notes" is a text`]);
  });

  it('is checked by kind as a page is shown too, without the format’s own check', () => {
    const shown = checkPage(page({ partsField: 'address' }));
    expect(shown.ok ? [] : shown.issues.map((i) => i.message)).toEqual([`"address" is a char; an address's parts are kept in a json field`]);
  });
});
