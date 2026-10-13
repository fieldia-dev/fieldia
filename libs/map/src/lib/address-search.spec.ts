import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { createWidget } from '@fieldia/widgets';
import { googleMaps, openStreetMap, tiles, type AddressSearch, type PlaceFound, type SearchRequest } from './providers';
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
/** Until something is so, or two seconds have passed: a provider's code loads the first time it is asked. */
async function until(so: () => boolean) {
  for (let i = 0; i < 100 && !so(); i++) await pause(20);
}

async function mount(options: FieldNode['options'] = {}, settings: Partial<MapSettings> = {}, found: PlaceFound[] = [TAHRIR, ZAMALEK], locale?: 'ar') {
  const asked: SearchRequest[] = [];
  const search: AddressSearch = async (request) => (asked.push(request), found);
  const widgets = mapWidgets({ provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' }, search }), center: { lat: 30.04, lng: 31.23 }, ...settings });
  const form = createForm({ page });
  const node: FieldNode = { type: 'field', id: 'address', field: 'address', widget: 'address-search', options };
  const widget = createWidget({ form, name: 'address', field: page.fields['address'] as Field, node, id: 'fd-address', document, labels: undefined, locale }, widgets);
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
    // Addresses before shops and malls, where the provider says which are which.
    expect(asked[0].addresses).toBe(true);
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

  it('writes each piece of the address once, a governorate named after its city left out', async () => {
    const { box, values } = await mount({}, {}, [{ label: 'Pyramids Road 5', detail: 'Giza, Giza Governorate, Egypt', lat: 29.99, lng: 31.16 }]);
    type(box, 'pyr');
    await pause();
    press(box, 'Enter');
    expect(values()['address']).toBe('Pyramids Road 5, Giza, Egypt');
  });

  it('joins with the Arabic comma on an Arabic page, the provider’s own line too', async () => {
    const locate = jest.fn(async () => ({ lat: 30.05, lng: 31.24, address: 'شارع التحرير 12, وسط البلد, القاهرة, محافظة القاهرة, مصر' }));
    const { box, values } = await mount({ placeField: 'spot' }, {}, [{ label: 'شارع التحرير 12', detail: 'وسط البلد، القاهرة، محافظة القاهرة، مصر', locate }], 'ar');
    type(box, 'التحر');
    await pause();
    press(box, 'Enter');
    expect(box.value).toBe('شارع التحرير 12، وسط البلد، القاهرة، مصر');
    await pause(0);
    expect(values()['address']).toBe('شارع التحرير 12، وسط البلد، القاهرة، مصر');
  });

  it('keeps the place and parts a pick wrote as a person types on after it', async () => {
    const { box, values } = await mount({ placeField: 'spot', partsField: 'parts' });
    type(box, 'tahr');
    await pause();
    press(box, 'Enter');
    await pause(0);
    const { spot, parts } = values();
    type(box, ', flat 3');
    await pause();
    press(box, 'Escape');
    expect(values()).toMatchObject({ address: 'Tahrir Street 12, Downtown, Cairo, Egypt, flat 3', spot, parts });
    expect(spot).toMatchObject({ type: 'Point' });
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
    const { box, asked } = await mount({ countries: ['eg', 'SA', 'uk'], near: { lat: 21.42, lng: 39.82 } });
    type(box, 'tahr');
    await pause();
    // "UK" as every provider's parts name it.
    expect(asked[0]).toMatchObject({ countries: ['EG', 'SA', 'GB'], near: { lat: 21.42, lng: 39.82 } });
  });

  it('shows each suggestion in its own words’ direction, both lines at the page’s side: a Latin street on an Arabic page keeps its number before it', async () => {
    const { box } = await mount({}, {}, [{ label: '1 Mohammed Mahmoud', detail: 'ميدان التحرير، قسم قصر النيل', lat: 30.0436, lng: 31.2371 }], 'ar');
    type(box, '1 moh');
    await pause();
    const lines = [...document.querySelectorAll<HTMLElement>('.fd-map-result-name, .fd-map-result-detail')];
    // The lines themselves take the page's direction, so both start at its side; their words, set apart, their own.
    expect(lines.map((line) => line.getAttribute('dir'))).toEqual([null, null]);
    expect(lines.map((line) => [line.firstElementChild?.tagName, line.firstElementChild?.getAttribute('dir'), line.textContent])).toEqual([
      ['BDI', 'ltr', '1 Mohammed Mahmoud'],
      ['BDI', 'rtl', 'ميدان التحرير، قسم قصر النيل'],
    ]);
  });

  it('lists two suggestions that read alike once, from any provider', async () => {
    const twin: PlaceFound = { ...TAHRIR, lat: 30.05, lng: 31.24 };
    const { box } = await mount({}, {}, [TAHRIR, twin, ZAMALEK]);
    type(box, 'tahr');
    await pause();
    expect(options()).toEqual(['Tahrir Street 12Downtown, Cairo, Egypt', '26 July StreetZamalek, Cairo, Egypt']);
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Suggestions: 2');
  });

  it('reads the box in the direction most of its words are written in: an Arabic address that starts with a Latin street still starts at the right', async () => {
    const { form, box } = await mount({}, {}, [{ label: '1 Mohammed Mahmoud', lat: 30.0436, lng: 31.2371 }], 'ar');
    form.setValue('address', 'El Tahrir، الإسماعيلية، القاهرة، مصر');
    expect(box.dir).toBe('rtl');
    type(box, '');
    box.value = '1 Mohammed Mahmoud';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    expect(box.dir).toBe('ltr');
    // Empty, the page's.
    form.setValue('address', null);
    expect(box.hasAttribute('dir')).toBe(false);
  });

  it('opens no list after the box is left: a search waiting, or on its way, is dropped', async () => {
    const { box, asked } = await mount();
    type(box, 'tahr');
    box.blur();
    await pause();
    expect([asked.length, list().hidden]).toEqual([0, true]);
    // Asked, and left before the answer: the answer opens nothing over the next box.
    let answer: (found: PlaceFound[]) => void = () => undefined;
    const later: SearchRequest[] = [];
    const search: AddressSearch = (request) => (later.push(request), new Promise((done) => (answer = done)));
    const late = await mount({}, { search, searchAsYouType: true });
    type(late.box, 'tahr');
    await pause();
    expect(later).toHaveLength(1);
    late.box.blur();
    answer([TAHRIR]);
    await pause(0);
    expect([list().hidden, late.box.getAttribute('aria-expanded')]).toEqual([true, 'false']);
  });

  it('picks nothing on Enter from a list made for fewer words: the words in the box are asked for at once, once, and Enter picks from their list', async () => {
    const answers: ((found: PlaceFound[]) => void)[] = [];
    const later: SearchRequest[] = [];
    const search: AddressSearch = (request) => (later.push(request), new Promise((done) => answers.push(done)));
    const { box, values } = await mount({}, { search, searchAsYouType: true });
    type(box, 'tahr');
    await pause();
    answers[0]([TAHRIR, ZAMALEK]);
    await pause(0);
    expect(list().hidden).toBe(false);
    // The rest typed, and Enter at once: "tahr"'s first is not what "tahri" names.
    type(box, 'i');
    press(box, 'Enter');
    expect([values()['address'], later.map((request) => request.text)]).toEqual(['tahri', ['tahr', 'tahri']]);
    // Asked once: the pause after the letter asks nothing more.
    await pause();
    expect(later).toHaveLength(2);
    // Enter again while it is on its way: nothing picked, nothing asked.
    press(box, 'Enter');
    expect([values()['address'], later.length]).toEqual(['tahri', 2]);
    answers[1]([ZAMALEK]);
    await pause(0);
    expect(options()).toEqual(['26 July StreetZamalek, Cairo, Egypt']);
    press(box, 'Enter');
    expect([values()['address'], list().hidden]).toEqual(['26 July Street, Zamalek, Cairo, Egypt', true]);
  });

  it('picks nothing on Enter from a list made for fewer words while their own search is on its way, nor a row marked before more was typed', async () => {
    const answers: ((found: PlaceFound[]) => void)[] = [];
    const later: SearchRequest[] = [];
    const search: AddressSearch = (request) => (later.push(request), new Promise((done) => answers.push(done)));
    const { box, values } = await mount({}, { search, searchAsYouType: true });
    type(box, 'tahr');
    await pause();
    answers[0]([TAHRIR, ZAMALEK]);
    await pause(0);
    // A row marked, then more typed: the mark was for the words before.
    press(box, 'ArrowDown');
    type(box, 'i');
    expect([box.hasAttribute('aria-activedescendant'), list().querySelector('[aria-selected="true"]')]).toEqual([false, null]);
    await pause();
    expect(later.map((request) => request.text)).toEqual(['tahr', 'tahri']);
    press(box, 'Enter');
    expect([values()['address'], later.length]).toEqual(['tahri', 2]);
    answers[1]([ZAMALEK]);
    await pause(0);
    press(box, 'Enter');
    expect(values()['address']).toBe('26 July Street, Zamalek, Cairo, Egypt');
  });

  it('says no suggestions are shown once the list is closed, by Escape or by leaving the box', async () => {
    const { box } = await mount();
    const status = () => document.querySelector('[role="status"]')?.textContent;
    type(box, 'tahr');
    await pause();
    expect(status()).toBe('Suggestions: 2');
    press(box, 'Escape');
    expect([list().hidden, status()]).toEqual([true, '']);
    press(box, 'Enter');
    expect([list().hidden, status()]).toEqual([false, 'Suggestions: 2']);
    box.blur();
    expect([list().hidden, status()]).toEqual([true, '']);
  });

  it('opens no list for an answer that comes after a place is picked from the list before it', async () => {
    const answers: ((found: PlaceFound[]) => void)[] = [];
    const later: SearchRequest[] = [];
    const search: AddressSearch = (request) => (later.push(request), new Promise((done) => answers.push(done)));
    const { box, values } = await mount({}, { search, searchAsYouType: true });
    type(box, 'tahr');
    await pause();
    answers[0]([TAHRIR, ZAMALEK]);
    await pause(0);
    // A letter more: its search goes, slowly, as on a phone; the list shown is picked from meanwhile.
    type(box, 'i');
    await pause();
    expect([later.length, list().hidden]).toEqual([2, false]);
    press(box, 'ArrowDown');
    press(box, 'Enter');
    answers[1]([ZAMALEK]);
    await pause(0);
    expect([values()['address'], list().hidden, box.getAttribute('aria-expanded')]).toEqual(['Tahrir Street 12, Downtown, Cairo, Egypt', true, 'false']);
  });

  it('asks for the same words once: a space typed, or Enter after Escape, shows what came', async () => {
    const { box, asked } = await mount();
    type(box, '26');
    await pause();
    type(box, ' ');
    await pause();
    expect(asked.map((request) => request.text)).toEqual(['26']);
    press(box, 'Escape');
    expect(list().hidden).toBe(true);
    press(box, 'Enter');
    expect([asked.length, list().hidden]).toEqual([1, false]);
    // Other words are asked for.
    type(box, 'j');
    await pause();
    expect(asked.map((request) => request.text)).toEqual(['26', '26 j']);
  });

  it('drops the search on Escape, waiting or on its way: no list opens by itself after it, nothing is asked for the words dismissed, and no search is said to be going', async () => {
    const answers: ((found: PlaceFound[]) => void)[] = [];
    const later: SearchRequest[] = [];
    const search: AddressSearch = (request) => (later.push(request), new Promise((done) => answers.push(done)));
    const { box } = await mount({}, { search, searchAsYouType: true });
    const status = () => document.querySelector('[role="status"]')?.textContent;
    type(box, 'tahrir');
    await pause();
    answers[0]([TAHRIR, ZAMALEK]);
    await pause(0);
    expect(list().hidden).toBe(false);
    // The list open, more typed and Escape at once: the list closes, and the search that was to go never goes.
    type(box, ' sq');
    press(box, 'Escape');
    await pause();
    expect([later.length, list().hidden]).toEqual([1, true]);
    // On its way: dropped, and no longer said to be going; its answer opens nothing.
    type(box, 'u');
    await pause();
    expect([later.length, status()]).toEqual([2, 'Searching…']);
    press(box, 'Escape');
    expect([later[1].signal?.aborted, status()]).toEqual([true, '']);
    answers[1]([TAHRIR]);
    await pause(0);
    expect([list().hidden, box.getAttribute('aria-expanded')]).toEqual([true, 'false']);
    // The words stay, as an address field's do.
    expect(box.value).toBe('tahrir squ');
  });

  it('says no search is going once it is dropped by leaving the box: under a place’s map too', async () => {
    const later: SearchRequest[] = [];
    const search: AddressSearch = (request) => (later.push(request), new Promise(() => undefined));
    const { box } = await mount({}, { search, searchAsYouType: true });
    type(box, 'tahr');
    await pause();
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Searching…');
    box.blur();
    expect([later[0].signal?.aborted, document.querySelector('[role="status"]')?.textContent]).toEqual([true, '']);

    const widgets = mapWidgets({ provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } }), search, searchAsYouType: true });
    const form = createForm({ page });
    const node: FieldNode = { type: 'field', id: 'spot', field: 'spot', widget: 'place', options: { myLocation: false } };
    const widget = createWidget({ form, name: 'spot', field: page.fields['spot'] as Field, node, id: 'fd-spot', document }, widgets);
    document.body.replaceChildren(widget.element);
    const note = document.querySelector('.fd-map-note') as HTMLElement;
    const place = document.querySelector('[role="combobox"]') as HTMLInputElement;
    type(place, 'tahr');
    await pause();
    expect([note.textContent, note.hidden]).toEqual(['Searching…', false]);
    place.blur();
    expect([note.textContent, note.hidden]).toEqual(['', true]);
    widget.destroy?.();
  });

  it('asks nothing for Enter after a place is picked, until the words change: the address picked is not a search', async () => {
    const { box, asked } = await mount();
    type(box, 'tahr');
    await pause();
    press(box, 'Enter');
    expect(box.value).toBe('Tahrir Street 12, Downtown, Cairo, Egypt');
    await pause(0);
    press(box, 'Enter');
    await pause();
    // The whole address written is not asked for: each search may be paid for, and it is the place picked.
    expect([asked.length, list().hidden]).toEqual([1, true]);
    type(box, ' 2');
    press(box, 'Enter');
    expect(asked.map((request) => request.text)).toEqual(['tahr', 'Tahrir Street 12, Downtown, Cairo, Egypt 2']);
  });

  it('asks for the same words once while an address is typed: words typed again, after others, show what they brought; after a pick they are a new address', async () => {
    const later: SearchRequest[] = [];
    const search: AddressSearch = async (request) => (later.push(request), request.text === 'tahri' ? [ZAMALEK] : [TAHRIR, ZAMALEK]);
    const { box } = await mount({}, { search, searchAsYouType: true });
    type(box, 'tahr');
    await pause();
    type(box, 'i');
    await pause();
    expect(options()).toHaveLength(1);
    // A letter taken back, slowly.
    box.value = 'tahr';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await pause();
    expect(later.map((request) => request.text)).toEqual(['tahr', 'tahri']);
    expect([options().length, list().hidden]).toEqual([2, false]);
    press(box, 'Enter');
    await pause(0);
    box.value = '';
    type(box, 'tahr');
    await pause();
    expect(later.map((request) => request.text)).toEqual(['tahr', 'tahri', 'tahr']);
  });

  it('asks Google again for the same words after a place is picked, in a session of its own: no place is located with a session that has ended', async () => {
    const asked: { url: string; init?: RequestInit }[] = [];
    const suggestion = (placeId: string, name: string) => ({ placePrediction: { placeId, types: ['geocode'], structuredFormat: { mainText: { text: name }, secondaryText: { text: 'Cairo, Egypt' } } } });
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      asked.push({ url, init });
      const body = url.endsWith('places:autocomplete')
        ? { suggestions: [suggestion('Z1', 'Zamalek'), suggestion('Z2', 'Zamalek Cinema')] }
        : { location: { latitude: 30.06, longitude: 31.22 }, formattedAddress: 'Zamalek, Cairo, Egypt' };
      // jsdom has no Response: what Fieldia reads of one.
      return { ok: true, status: 200, json: async () => body } as Response;
    }) as typeof globalThis.fetch;
    const google = googleMaps({ key: 'G', fetch });
    const { box, values } = await mount({ placeField: 'spot' }, { search: google.search, searchAsYouType: true });
    type(box, 'zamal');
    await until(() => !list().hidden);
    press(box, 'Enter');
    await until(() => !!values()['spot']);
    // The whole box chosen and the same words typed again at once.
    box.value = '';
    type(box, 'zamal');
    await pause();
    await until(() => !list().hidden);
    press(box, 'ArrowDown');
    press(box, 'ArrowDown');
    press(box, 'Enter');
    await until(() => asked.length > 3);
    const said = asked.map(({ url, init }) => (url.endsWith('places:autocomplete') ? ['suggest', JSON.parse(String(init?.body)).sessionToken] : ['locate', new URL(url).searchParams.get('sessionToken')]));
    expect(said.map(([kind]) => kind)).toEqual(['suggest', 'locate', 'suggest', 'locate']);
    expect([said[1][1], said[3][1]]).toEqual([said[0][1], said[2][1]]);
    expect(said[2][1]).not.toBe(said[0][1]);
  });

  it('writes a picked suggestion’s parts though it is not found on the map, leaves the place as it was, and says so under the box', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const locate = jest.fn(async () => Promise.reject(new Error('Azure Maps found "El Tahrir, Tema, Suhaj, Egypt" nowhere in its own district and town')));
    const { form, box, values } = await mount({ placeField: 'spot', partsField: 'parts' }, {}, [{ label: 'El Tahrir', detail: 'Tema, Suhaj, Egypt', locate, parts: { city: 'Tema', region: 'Suhaj', country: 'EG' } }]);
    form.setValue('spot', { type: 'Point', coordinates: [31.42, 26.87] });
    type(box, 'el tah');
    await pause();
    press(box, 'Enter');
    await pause(0);
    expect(values()).toMatchObject({ address: 'El Tahrir, Tema, Suhaj, Egypt', spot: { type: 'Point', coordinates: [31.42, 26.87] }, parts: { city: 'Tema', region: 'Suhaj', country: 'EG' } });
    // Seen, read with the box, and said: never the console alone.
    const note = document.querySelector('.fd-address-note') as HTMLElement;
    expect([note.hidden, note.textContent]).toEqual([false, 'Not found on the map: no place was saved for this address.']);
    expect(box.getAttribute('aria-describedby')?.split(' ')).toContain(note.id);
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Not found on the map: no place was saved for this address.');
    // Typing on, it goes.
    type(box, ',');
    expect([note.hidden, box.hasAttribute('aria-describedby')]).toEqual([true, false]);
    warn.mockRestore();
  });

  it('takes back the place and parts its own pick before wrote when the next pick is not found: never one address with another’s place', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const olaya: PlaceFound = { label: 'Al Olaya', detail: 'Riyadh, Saudi Arabia', lat: 24.694242, lng: 46.687294, parts: { city: 'Riyadh', region: 'Riyadh', country: 'SA' } };
    // Google's way: no parts until it is found, and it is not.
    const rawdah: PlaceFound = { label: 'Al Rawdah', detail: 'Riyadh, Saudi Arabia', locate: async () => Promise.reject(new Error('Google gave no place')) };
    for (const fields of [{ placeField: 'spot' }, { placeField: 'lat', longitudeField: 'lng' }] as Record<string, string>[]) {
      const { form, box, values } = await mount({ ...fields, partsField: 'parts' }, {}, [olaya, rawdah]);
      form.setValue('parts', { line2: 'Villa 4' });
      type(box, 'al ol');
      await pause();
      press(box, 'Enter');
      await pause(0);
      expect(values()['parts']).toEqual({ city: 'Riyadh', region: 'Riyadh', country: 'SA', line2: 'Villa 4' });
      box.value = '';
      type(box, 'al raw');
      await pause();
      press(box, 'ArrowDown');
      press(box, 'ArrowDown');
      press(box, 'Enter');
      await pause(0);
      // Al Olaya's place and parts were Al Olaya's: not Al Rawdah's. The line typed by a person under the street stays.
      const { address, spot, lat, lng, parts } = values();
      expect({ address, spot, lat, lng, parts }).toEqual({ address: 'Al Rawdah, Riyadh, Saudi Arabia', spot: null, lat: null, lng: null, parts: { line2: 'Villa 4' } });
      expect((document.querySelector('.fd-address-note') as HTMLElement).hidden).toBe(false);
    }
    // A place set by hand since (a pin dragged) is not the pick's: it stays.
    const { form, box, values } = await mount({ placeField: 'spot' }, {}, [olaya, rawdah]);
    type(box, 'al ol');
    await pause();
    press(box, 'Enter');
    await pause(0);
    form.setValue('spot', { type: 'Point', coordinates: [46.69, 24.7] });
    box.value = '';
    type(box, 'al raw');
    await pause();
    press(box, 'ArrowDown');
    press(box, 'ArrowDown');
    press(box, 'Enter');
    await pause(0);
    expect(values()['spot']).toEqual({ type: 'Point', coordinates: [46.69, 24.7] });
    warn.mockRestore();
  });

  it('says a place found only near the address picked is only near it, under the box, until the person types on', async () => {
    const locate = jest.fn(async () => ({ lat: 25.3461, lng: 55.4211, address: '30 Street, Sharjah, United Arab Emirates', precise: false as const }));
    const { box, values } = await mount({ placeField: 'spot' }, {}, [{ label: '30 Street', detail: 'Sharjah, United Arab Emirates', locate }]);
    type(box, '30 st');
    await pause();
    press(box, 'Enter');
    await pause(0);
    // Written, as near is better than nothing; and said.
    expect(values()['spot']).toEqual({ type: 'Point', coordinates: [55.4211, 25.3461] });
    const note = document.querySelector('.fd-address-note') as HTMLElement;
    expect([note.hidden, note.textContent]).toEqual([false, 'Placed only near this address: its exact place was not found on the map.']);
    expect(box.getAttribute('aria-describedby')?.split(' ')).toContain(note.id);
    expect(document.querySelector('[role="status"]')?.textContent).toBe(note.textContent);
    type(box, ',');
    expect(note.hidden).toBe(true);
  });

  it('says a pick not found on the map in the page’s language, beside the help the box is described by', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const locate = jest.fn(async () => Promise.reject(new Error('nowhere')));
    const { box, widget, values } = await mount({ placeField: 'spot' }, {}, [{ label: 'الروضة', detail: 'الرياض، المملكة العربية السعودية', locate }], 'ar');
    // The field's help, as the form describes its box.
    const withHelp = () => widget.update({ value: values()['address'], values: values(), readonly: false, required: false, invalid: false, describedBy: 'fd-address-help' });
    type(box, 'الرو');
    await pause();
    press(box, 'Enter');
    await pause(0);
    withHelp();
    const note = document.querySelector('.fd-address-note') as HTMLElement;
    expect(note.textContent).toBe('لم يُعثر على هذا العنوان على الخريطة، فلم يُحفظ له مكان.');
    expect(box.getAttribute('aria-describedby')).toBe(`fd-address-help ${note.id}`);
    type(box, 'x');
    withHelp();
    expect(box.getAttribute('aria-describedby')).toBe('fd-address-help');
    warn.mockRestore();
  });

  it('says a suggestion is picked though nothing is looked up for it: a provider’s session ends there', async () => {
    const picked = jest.fn();
    const locate = jest.fn(async () => ({ lat: 1, lng: 2 }));
    const { box } = await mount({}, {}, [{ label: 'Tahrir Square', detail: 'Cairo, Egypt', locate, picked }]);
    type(box, 'tah');
    await pause();
    press(box, 'Enter');
    await pause(0);
    expect([picked.mock.calls.length, locate.mock.calls.length]).toEqual([1, 0]);
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

  it('gives a place’s Address the same line: each piece once, with the Arabic comma on an Arabic page', async () => {
    const found: PlaceFound[] = [{ label: 'ميدان التحرير', detail: 'القاهرة، محافظة القاهرة، مصر', lat: 30.0444, lng: 31.2357 }];
    const widgets = mapWidgets({ provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' }, search: async () => found }) });
    const form = createForm({ page });
    const node: FieldNode = { type: 'field', id: 'spot', field: 'spot', widget: 'place', options: { addressField: 'address', myLocation: false } };
    const widget = createWidget({ form, name: 'spot', field: page.fields['spot'] as Field, node, id: 'fd-spot', document, locale: 'ar' }, widgets);
    document.body.replaceChildren(widget.element);
    const search = document.querySelector('[role="combobox"]') as HTMLInputElement;
    type(search, 'التحر');
    await pause();
    press(search, 'Enter');
    await pause(0);
    expect(form.getState().values['address']).toBe('ميدان التحرير، القاهرة، مصر');
    widget.destroy?.();
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
