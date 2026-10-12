import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { createWidget } from '@fieldia/widgets';
import { openStreetMap, tiles, type AddressSearch, type PlaceFound, type SearchRequest } from './providers';
import type { MapSettings } from './settings';
import { mapWidgets } from './widgets';

/**
 * An address typed on one line with the provider's suggestions under it
 * (`char.address-search`), without a map: typed as a person types, picked
 * with the keys, filling a place and an address's parts where the page says.
 * The browser tests look at it; these drive it.
 */

const page = {
  fieldia: '0.1',
  id: 'delivery',
  data: { kind: 'responses' },
  fields: {
    address: { type: 'char', label: 'Address' },
    spot: { type: 'json', label: 'Where' },
    lat: { type: 'float', label: 'Latitude' },
    lng: { type: 'float', label: 'Longitude' },
    parts: { type: 'json', label: 'Address in parts' },
  },
  layout: { type: 'sections', id: 'r', children: [] },
} as unknown as Page;

const TAHRIR: PlaceFound = { label: 'Tahrir Street 12', detail: 'Downtown, Cairo, Egypt', lat: 30.0487, lng: 31.2391, parts: { street: 'Tahrir Street 12', city: 'Cairo', country: 'EG' } };
const ZAMALEK: PlaceFound = { label: '26 July Street', detail: 'Zamalek, Cairo, Egypt', lat: 30.0626, lng: 31.2197 };

const pause = (ms = 300) => new Promise((done) => setTimeout(done, ms));

async function mount(options: FieldNode['options'] = {}, settings: Partial<MapSettings> = {}, found: PlaceFound[] = [TAHRIR, ZAMALEK]) {
  const asked: SearchRequest[] = [];
  const search: AddressSearch = async (request) => (asked.push(request), found);
  const widgets = mapWidgets({ provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' }, search }), center: { lat: 30.04, lng: 31.23 }, ...settings });
  const form = createForm({ page });
  const node: FieldNode = { type: 'field', id: 'address', field: 'address', widget: 'address-search', options };
  const widget = createWidget({ form, name: 'address', field: page.fields['address'] as Field, node, id: 'fd-address', document, labels: undefined }, widgets);
  document.body.replaceChildren(widget.element);
  let readonly = false;
  const refresh = () => {
    const state = form.getState();
    widget.update({ value: state.values['address'], values: state.values, readonly, required: false, invalid: false });
  };
  form.subscribe(refresh);
  refresh();
  // The suggestions' code, loaded as the field is first shown.
  await pause(0);
  const box = document.getElementById('fd-address') as HTMLInputElement;
  return { form, widget, box, asked, values: () => form.getState().values, setReadonly: (on: boolean) => ((readonly = on), refresh()) };
}

/** Typed as a person types: a key at a time, each an input event. */
function type(box: HTMLInputElement, text: string) {
  box.focus();
  for (const letter of text) {
    box.value += letter;
    box.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
const press = (box: HTMLInputElement, key: string) => box.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
const options = () => [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent);
const list = () => document.querySelector('[role="listbox"]') as HTMLElement;

describe('an address with suggestions', () => {
  it('is the field’s own text box, a combobox over a list of the provider’s suggestions as the typing pauses', async () => {
    const { box, asked, values } = await mount();
    expect([box.tagName, box.className, box.getAttribute('role'), box.getAttribute('aria-expanded')]).toEqual(['INPUT', 'fd-input', 'combobox', 'false']);
    type(box, 'tahr');
    // What is typed is the answer as it is typed.
    expect(values()['address']).toBe('tahr');
    expect(asked).toHaveLength(0);
    await pause();
    expect(asked).toHaveLength(1);
    // Near where the app's maps open; nothing more asked of the provider than the page needs.
    expect(asked[0]).toMatchObject({ text: 'tahr', near: { lat: 30.04, lng: 31.23 }, locale: 'en' });
    expect(asked[0].parts).toBeUndefined();
    expect(asked[0].countries).toBeUndefined();
    expect(options()).toEqual(['Tahrir Street 12Downtown, Cairo, Egypt', '26 July StreetZamalek, Cairo, Egypt']);
    expect([box.getAttribute('aria-expanded'), box.getAttribute('aria-controls')]).toEqual(['true', list().id]);
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Suggestions: 2');
  });

  it('picks with the arrows and Enter: the whole address in the box, its place and its parts where the page says, the second line kept', async () => {
    const { form, box, values, asked } = await mount({ placeField: 'spot', partsField: 'parts' });
    form.setValue('parts', { street: 'Old Street 1', line2: 'Flat 4' });
    type(box, 'tahr');
    await pause();
    expect(asked[0].parts).toBe(true);
    press(box, 'ArrowDown');
    expect(box.getAttribute('aria-activedescendant')).toBe(list().children[0].id);
    press(box, 'Enter');
    await pause(0);
    expect(values()).toMatchObject({
      address: 'Tahrir Street 12, Downtown, Cairo, Egypt',
      spot: { type: 'Point', coordinates: [31.2391, 30.0487] },
      parts: { street: 'Tahrir Street 12', city: 'Cairo', country: 'EG', line2: 'Flat 4' },
    });
    expect(box.value).toBe('Tahrir Street 12, Downtown, Cairo, Egypt');
    expect(list().hidden).toBe(true);
  });

  it('keeps what is typed when nothing is picked: Escape closes the list and the words stay', async () => {
    const { box, values } = await mount({ placeField: 'spot' });
    type(box, '7 Nile Corniche, flat 3');
    await pause();
    expect(list().hidden).toBe(false);
    press(box, 'Escape');
    expect(list().hidden).toBe(true);
    press(box, 'Escape');
    expect(box.value).toBe('7 Nile Corniche, flat 3');
    expect(values()).toMatchObject({ address: '7 Nile Corniche, flat 3', spot: null });
  });

  it('finds a picked suggestion’s place and parts when they come later, as Google’s and Azure’s do, in the provider’s own words', async () => {
    const locate = jest.fn(async () => ({ lat: 30.0436, lng: 31.2371, address: '1 Mohamed Mahmoud, Qasr El Nil, Cairo, Egypt', parts: { street: 'Mohamed Mahmoud 1', city: 'Cairo', country: 'EG' } }));
    const { box, values } = await mount({ placeField: 'lat', longitudeField: 'lng', partsField: 'parts' }, {}, [{ label: '1 Mohamed Mahmoud', detail: 'Cairo, Egypt', locate }]);
    type(box, 'moh');
    await pause();
    press(box, 'Enter');
    expect(box.value).toBe('1 Mohamed Mahmoud, Cairo, Egypt');
    await pause(0);
    expect(locate).toHaveBeenCalledTimes(1);
    expect(values()).toMatchObject({ address: '1 Mohamed Mahmoud, Qasr El Nil, Cairo, Egypt', lat: 30.0436, lng: 31.2371, parts: { street: 'Mohamed Mahmoud 1', city: 'Cairo', country: 'EG' } });
  });

  it('asks for nothing it does not write: a suggestion picked with no place or parts to fill is not looked up', async () => {
    const locate = jest.fn(async () => ({ lat: 1, lng: 2 }));
    const { box, values } = await mount({}, {}, [{ label: 'Tahrir Square', detail: 'Cairo, Egypt', locate }]);
    type(box, 'tah');
    await pause();
    press(box, 'Enter');
    await pause(0);
    expect(locate).not.toHaveBeenCalled();
    expect(values()['address']).toBe('Tahrir Square, Cairo, Egypt');
  });

  it('keeps to the countries the page names, near the point it names', async () => {
    const { box, asked } = await mount({ countries: ['eg', 'SA'], near: { lat: 21.42, lng: 39.82 } });
    type(box, 'tahr');
    await pause();
    expect(asked[0]).toMatchObject({ countries: ['EG', 'SA'], near: { lat: 21.42, lng: 39.82 } });
  });

  it('searches nothing read-only: the words are only shown', async () => {
    const { form, box, asked, setReadonly } = await mount();
    form.setValue('address', '12 Tahrir Street');
    setReadonly(true);
    expect([box.value, box.readOnly]).toEqual(['12 Tahrir Street', true]);
    press(box, 'Enter');
    await pause();
    expect(asked).toHaveLength(0);
  });

  it('says the provider’s credit under its suggestions, and none under the app’s own search', async () => {
    const own = await mount();
    type(own.box, 'tahr');
    await pause();
    expect(document.querySelector('.fd-address-credit')).toBeNull();

    const fetch = (async () => new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }))) as typeof globalThis.fetch;
    await mount({}, { provider: openStreetMap({ fetch }) });
    const credit = document.querySelector('.fd-address-popup .fd-address-credit') as HTMLAnchorElement;
    expect([credit.textContent, credit.href, credit.target]).toEqual(['© OpenStreetMap contributors', 'https://www.openstreetmap.org/copyright', '_blank']);
    // Under the list, not in it: a listbox holds its options alone.
    expect(credit.closest('[role="listbox"]')).toBeNull();
  });

  it('is a plain text box where there is no address search', async () => {
    const widgets = mapWidgets({ provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } }) });
    const form = createForm({ page });
    const widget = createWidget({ form, name: 'address', field: page.fields['address'] as Field, node: { type: 'field', id: 'address', field: 'address', widget: 'address-search', options: { placeField: 'spot' } }, id: 'fd-address', document }, widgets);
    document.body.replaceChildren(widget.element);
    await pause(0);
    expect([widget.element.tagName, widget.element.getAttribute('role'), document.querySelector('[role="listbox"]')]).toEqual(['INPUT', null, null]);
    type(widget.element as HTMLInputElement, '12 Tahrir Street');
    expect(form.getState().values['address']).toBe('12 Tahrir Street');
  });
});
