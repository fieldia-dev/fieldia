import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { createWidget } from '@fieldia/widgets';
import { tiles, type SearchRequest } from './providers';
import { mapWidgets } from './widgets';

/**
 * The place widget's own parts, without a map on screen (the browser tests
 * drive the map): kept in two number fields, typed as coordinates, shown
 * read-only. Leaflet loads in jsdom but draws nothing there.
 */

const page = {
  fieldia: '0.1',
  id: 'site',
  data: { kind: 'responses' },
  fields: {
    lat: { type: 'float', label: 'Latitude of the site' },
    lng: { type: 'float', label: 'Longitude of the site' },
    note: { type: 'json', label: 'Elsewhere' },
  },
  layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'f-lat', field: 'lat', widget: 'place', options: { longitudeField: 'lng', search: false } }] },
} as unknown as Page;

const widgets = mapWidgets({ provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } }) });

function mount(node: FieldNode = (page.layout as { children: FieldNode[] }).children[0], field = 'lat') {
  const form = createForm({ page });
  const widget = createWidget({ form, name: field, field: page.fields[field] as Field, node, id: 'fd-site', document, labels: undefined }, widgets);
  document.body.replaceChildren(widget.element);
  const refresh = () => {
    const state = form.getState();
    widget.update({ value: state.values[field], values: state.values, readonly: form.page === page && readonly, required: false, invalid: false });
  };
  let readonly = false;
  form.subscribe(refresh);
  refresh();
  return { form, widget, setReadonly: (on: boolean) => ((readonly = on), refresh()) };
}

const input = (label: string) => [...document.querySelectorAll('label')].find((l) => l.textContent?.startsWith(label))!.querySelector('input')!;

describe('a place kept in two number fields', () => {
  it('writes its latitude and its longitude, each to its own field, as they are typed', () => {
    const { form } = mount();
    input('Latitude').value = '30.0444';
    input('Longitude').value = '31,2357';
    input('Longitude').dispatchEvent(new Event('change'));
    expect(form.getState().values).toMatchObject({ lat: 30.0444, lng: 31.2357 });
  });

  it('shows the coordinates it is given, and empties both when they are cleared', () => {
    const { form } = mount();
    form.setValues({ lat: 48.8566, lng: 2.3522 });
    expect(input('Latitude').value).toBe('48.8566');
    expect(input('Longitude').value).toBe('2.3522');
    input('Latitude').value = '';
    input('Longitude').value = '';
    input('Latitude').dispatchEvent(new Event('change'));
    expect(form.getState().values).toMatchObject({ lat: null, lng: null });
  });

  it('keeps out a coordinate past the poles, saying so', () => {
    const { form } = mount();
    input('Latitude').value = '95';
    input('Longitude').value = '31';
    input('Longitude').dispatchEvent(new Event('change'));
    expect(form.getState().values['lat']).toBeNull();
    expect(input('Latitude').getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelector('.fd-map-note')?.textContent).toBe('Not a coordinate');
  });

  it('reads Persian digits and direction marks, as every number box does', () => {
    const { form } = mount();
    input('Latitude').value = '۳۰٫۰۴۴۴';
    input('Longitude').value = '\u200f٣١٫٢٣\u200f';
    input('Longitude').dispatchEvent(new Event('change'));
    expect(form.getState().values).toMatchObject({ lat: 30.0444, lng: 31.23 });
    expect((document.querySelector('.fd-map-note') as HTMLElement).hidden).toBe(true);
  });

  it('refuses a letter as it is typed, said under the box, and holds the keys after it: never a place nobody typed', () => {
    const { form } = mount();
    const lat = input('Latitude');
    lat.focus();
    for (const key of '30.0a4') {
      const typing = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: key });
      lat.dispatchEvent(typing);
      if (typing.defaultPrevented) continue;
      lat.setRangeText(key, lat.selectionStart ?? lat.value.length, lat.selectionEnd ?? lat.value.length, 'end');
      lat.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: key }));
    }
    expect(lat.value).toBe('30.0');
    const hint = lat.closest('label')?.nextElementSibling as HTMLElement;
    expect(hint.classList.contains('fd-refusal-hint')).toBe(true);
    expect(hint.textContent).toBe('Latitude: numbers only');
    expect(lat.getAttribute('aria-describedby')).toContain(hint.id);
    input('Longitude').value = '31';
    lat.dispatchEvent(new Event('change'));
    expect(lat.value).toBe('30.0a4');
    expect(lat.getAttribute('aria-invalid')).toBe('true');
    expect(form.getState().values['lat']).toBeNull();
    expect(document.querySelector('.fd-map-note')?.textContent).toBe('Latitude: numbers only');
  });

  it('read-only: its tools go and its coordinates cannot be typed in', () => {
    const { setReadonly } = mount();
    setReadonly(true);
    expect((document.querySelector('.fd-map-tools') as HTMLElement).hidden).toBe(true);
    expect(input('Latitude').readOnly).toBe(true);
  });

  it('refuses a number field with no field named for its longitude, saying which', () => {
    const node = { type: 'field', id: 'f', field: 'lat', widget: 'place' } as FieldNode;
    expect(() => mount(node)).toThrow('The place on "lat" keeps its latitude there and needs options.longitudeField for its longitude');
  });
});

describe('a place on a map that opened on the whole world (no centre given)', () => {
  // A map of 400 by 300 pixels: jsdom measures none, and a map with no size shows no part of the world.
  const sized = (['clientWidth', 'clientHeight'] as const).map((side) => [side, Object.getOwnPropertyDescriptor(HTMLElement.prototype, side)] as const);
  beforeAll(() => sized.forEach(([side]) => Object.defineProperty(HTMLElement.prototype, side, { configurable: true, get: () => (side === 'clientWidth' ? 400 : 300) })));
  afterAll(() => sized.forEach(([side, own]) => own && Object.defineProperty(HTMLElement.prototype, side, own)));
  /** The zooms of the map images asked for. */
  const zooms = () => [...document.querySelectorAll('.leaflet-tile')].map((tile) => Number(/\/(\d+)\/\d+\/\d+\.png/.exec(tile.getAttribute('src') ?? '')?.[1]));

  it('is brought into view as close as a place is shown, though the map opened on the whole world (no centre given): an address picked lands there', async () => {
    const node = { type: 'field', id: 'f-note', field: 'note', widget: 'place', options: { search: false, myLocation: false } } as FieldNode;
    const { form, widget } = mount(node, 'note');
    for (let i = 0; i < 100 && !zooms().length; i++) await new Promise((done) => setTimeout(done, 20));
    expect(Math.max(...zooms())).toBe(2);
    form.setValue('note', { type: 'Point', coordinates: [31.2357, 30.0444] });
    await new Promise((done) => setTimeout(done, 0));
    expect(Math.max(...zooms())).toBe(15);
    widget.destroy?.();
  });

  it('stays as close as it is when it writes its own place into two number fields: a press, or Enter, on a map of the whole world puts the pin there and does not fly', async () => {
    const { form, widget } = mount();
    for (let i = 0; i < 100 && !zooms().length; i++) await new Promise((done) => setTimeout(done, 20));
    const map = document.querySelector('.fd-map-box') as HTMLElement;
    map.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise((done) => setTimeout(done, 0));
    // The place at the map's centre, written: latitude, then longitude, each in its own field.
    expect(form.getState().values).toMatchObject({ lat: 20, lng: 0 });
    expect(Math.max(...zooms())).toBe(2);
    widget.destroy?.();
  });

  it('searches near where the map looks only once it looks somewhere: a map of the whole world (no centre given) is near nothing', async () => {
    const asked: SearchRequest[] = [];
    const searching = mapWidgets({ provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' }, search: async (request) => (asked.push(request), []) }) });
    const node = { type: 'field', id: 'f-note', field: 'note', widget: 'place', options: { myLocation: false } } as FieldNode;
    const form = createForm({ page });
    const widget = createWidget({ form, name: 'note', field: page.fields['note'] as Field, node, id: 'fd-note', document }, searching);
    document.body.replaceChildren(widget.element);
    form.subscribe(() => widget.update({ value: form.getState().values['note'], values: form.getState().values, readonly: false, required: false, invalid: false }));
    for (let i = 0; i < 100 && !zooms().length; i++) await new Promise((done) => setTimeout(done, 20));
    const box = document.querySelector('[role="combobox"]') as HTMLInputElement;
    const search = async (words: string) => {
      box.value = words;
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await new Promise((done) => setTimeout(done, 0));
      return asked[asked.length - 1];
    };
    // Not the Sahara, the world view's middle.
    expect((await search('tahrir')).near).toBeUndefined();
    // Brought to a place: near it.
    form.setValue('note', { type: 'Point', coordinates: [31.2357, 30.0444] });
    await new Promise((done) => setTimeout(done, 0));
    const near = (await search('zamalek')).near;
    expect([near?.lat.toFixed(3), near?.lng.toFixed(3)]).toEqual(['30.044', '31.236']);
    widget.destroy?.();
  });
});

describe('a provider that refuses', () => {
  it('tells the reader to try again, and the developer why, once, in the console', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const refusing = mapWidgets({
      provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } }),
      search: async () => {
        throw new Error('Places API (New) has not been used in project 1 before or it is disabled.');
      },
    });
    const node = { type: 'field', id: 'f-note', field: 'note', widget: 'place' } as FieldNode;
    const form = createForm({ page });
    const widget = createWidget({ form, name: 'note', field: page.fields['note'] as Field, node, id: 'fd-note', document }, refusing);
    document.body.replaceChildren(widget.element);
    widget.update({ value: null, values: form.getState().values, readonly: false, required: false, invalid: false });
    const search = document.querySelector('[role="combobox"]') as HTMLInputElement;
    for (let i = 0; i < 2; i++) {
      // Typed, as a person types it: Enter searches the words typed.
      search.value = 'tahrir';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((done) => setTimeout(done, 0));
    }
    expect(document.querySelector('.fd-map-note')?.textContent).toBe('The search did not answer. Try again.');
    const said = warn.mock.calls.map((call) => String(call[0])).filter((words) => words.includes('address search'));
    expect(said).toEqual(['[Fieldia] The address search failed: Places API (New) has not been used in project 1 before or it is disabled.']);
    warn.mockRestore();
  });
});
