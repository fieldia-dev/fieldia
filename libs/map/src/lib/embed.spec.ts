import { createMemoryDataSource, type ListRequest, type Page, type ResolvedFilter } from '@fieldia/core';
import type { ListViewContext } from '@fieldia/viewer';
import { mountListMap } from './embed';
import { fill, LIST_MAP_LABELS, MAP_LABELS } from './labels';
import { mapListViews } from './map-parts';
import { tiles } from './providers';
import { EMBED_CSS } from './styles';

/**
 * A list's map in a page of the app's own (`mountListMap`): the app gives
 * the page, the records or their source, the search, and what to do when the
 * map asks; it gets the map back. Its base comes with it, on its own element
 * alone. The map itself is driven in the browser tests (e2e/map-embed.spec.ts):
 * Leaflet loads in jsdom but draws nothing.
 */

const page = {
  fieldia: '0.1',
  id: 'homes',
  title: 'Homes',
  data: { kind: 'record', model: 'home' },
  fields: {
    name: { type: 'char', label: 'Home' },
    price: { type: 'monetary', label: 'Price', currency: 'EGP' },
    lat: { type: 'float', label: 'Latitude' },
    lng: { type: 'float', label: 'Longitude' },
  },
  layout: { type: 'list', id: 'homes', columns: ['name', 'price'], map: { latitude: 'lat', longitude: 'lng', pin: { label: 'price' }, height: 'fill', gestures: 'all', fitZoom: 14 } },
  translations: { ar: { Homes: 'منازل', Home: 'المنزل' } },
} as unknown as Page;

const provider = tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } });
const homes = {
  1: { name: 'Flat in Zamalek', price: 4_000_000, lat: 30.062, lng: 31.219 },
  2: { name: 'Villa in Maadi', price: 9_000_000, lat: 29.96, lng: 31.257 },
};
const host = () => {
  const element = document.createElement('div');
  document.body.replaceChildren(element);
  return element;
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.head.querySelectorAll('style').forEach((style) => style.remove());
  document.documentElement.lang = '';
});

describe('a list’s map in a page of its own', () => {
  it('goes into the element given, asks its source with the search and the order, and comes back to reload and destroy', async () => {
    const dataSource = createMemoryDataSource({ records: { home: homes } });
    const filter: ResolvedFilter[] = [{ field: 'price', op: '<', value: 5_000_000 }];
    const element = host();
    const map = mountListMap(element, { page, provider, dataSource, filter: () => filter, sort: [{ field: 'price', desc: true }] });
    expect(element.firstElementChild).toBe(map.element);
    expect(map.element.classList.contains('fd-map-embed')).toBe(true);
    expect(map.element.classList.contains('fd-map-list')).toBe(true);
    await settle();
    const asked = dataSource.calls.filter((call) => call.method === 'list').map((call) => call.request as ListRequest);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ model: 'home', filter, sort: [{ field: 'price', desc: true }], offset: 0, limit: 500 });
    expect(asked[0].fields).toEqual(expect.arrayContaining(['lat', 'lng', 'price', 'name']));
    await map.reload();
    expect(dataSource.calls.filter((call) => call.method === 'list')).toHaveLength(2);
    map.destroy();
    expect(element.children).toHaveLength(0);
  });

  it('takes the records themselves instead, asked again at each reload', async () => {
    let given = [{ id: 1, values: homes[1] }];
    const records = jest.fn(() => given);
    const map = mountListMap(host(), { page, provider, records });
    await settle();
    expect(records).toHaveBeenCalled();
    given = [...given, { id: 2, values: homes[2] }];
    const before = records.mock.calls.length;
    await map.reload();
    expect(records.mock.calls.length).toBeGreaterThan(before);
    map.destroy();
  });

  it('is as tall as the page says: the room it is put in', () => {
    const map = mountListMap(host(), { page, provider, records: [] });
    expect(map.element.dataset['height']).toBe('fill');
    expect((map.element.querySelector('.fd-map-box') as HTMLElement).style.getPropertyValue('--fd-map-height')).toBe('100%');
    // It takes every gesture, as the page says.
    expect((map.element.querySelector('.fd-map-box') as HTMLElement).dataset['gestures']).toBe('all');
    map.destroy();
  });

  it('speaks the document’s language, with the page’s own words in it, unless told another', () => {
    const named = (map: { element: HTMLElement }) => map.element.querySelector('.fd-map-box')?.getAttribute('aria-label');
    const keys = (map: { element: HTMLElement }) => map.element.querySelector('.fd-map-box > .fd-sr-only')?.textContent;
    document.documentElement.lang = 'ar-EG';
    const arabic = mountListMap(host(), { page, provider, records: [] });
    // Named by the page's title in the page's own Arabic, and Fieldia's words in Arabic.
    expect(named(arabic)).toBe(fill(MAP_LABELS.ar.mapOf, { label: 'منازل' }));
    expect(keys(arabic)).toContain(LIST_MAP_LABELS.ar.pinKeys);
    arabic.destroy();
    const french = mountListMap(host(), { page, provider, records: [], locale: 'fr-CA' });
    expect(keys(french)).toContain(LIST_MAP_LABELS.fr.pinKeys);
    french.destroy();
    // A language Fieldia has no words in: English, the page as written.
    const other = mountListMap(host(), { page, provider, records: [], locale: 'it' });
    expect(named(other)).toBe('Homes, map');
    other.destroy();
  });

  it('offers to search only when the page says what to do with a search: no tools to draw an area, no "Search this area", otherwise', async () => {
    const ready = async (map: { element: HTMLElement }) => {
      for (let i = 0; i < 100 && !map.element.querySelector('.fd-map-zoom'); i++) await new Promise((resolve) => setTimeout(resolve, 20));
      expect(map.element.querySelector('.fd-map-zoom')).not.toBeNull();
    };
    const looking = mountListMap(host(), { page, provider, records: [] });
    await ready(looking);
    expect(looking.element.querySelector('.fd-map-draw')).toBeNull();
    expect(looking.element.querySelector('.fd-map-here')).toBeNull();
    looking.destroy();
    const searching = mountListMap(host(), { page, provider, records: [], onSearch: () => undefined });
    await ready(searching);
    expect(searching.element.querySelector('.fd-map-draw')).not.toBeNull();
    expect(searching.element.querySelector('.fd-map-here')).not.toBeNull();
    searching.destroy();
  });

  it('refuses a page it cannot show, saying why', () => {
    expect(() => mountListMap(host(), { page: { ...page, fields: {} } as unknown as Page, provider })).toThrow(/This page cannot be shown:\n {2}layout/);
    const form = { ...page, layout: { type: 'sections', id: 's', children: [] } } as unknown as Page;
    expect(() => mountListMap(host(), { page: form, provider })).toThrow('mountListMap shows a list page with "map"');
    const noMap = { ...page, layout: { type: 'list', id: 'homes', columns: ['name'] } } as unknown as Page;
    expect(() => mountListMap(host(), { page: noMap, provider })).toThrow('mountListMap shows a list page with "map"');
  });
});

describe('its own base', () => {
  it('comes once, after the maps’ own, and every rule of it is on the map’s element alone', () => {
    const one = mountListMap(host(), { page, provider, records: [] });
    const two = mountListMap(host(), { page, provider, records: [] });
    expect(document.querySelectorAll('#fieldia-map-embed-styles')).toHaveLength(1);
    const order = [...document.head.querySelectorAll('style')].map((style) => style.id);
    expect(order.indexOf('fieldia-map-embed-styles')).toBeGreaterThan(order.indexOf('fieldia-list-map-styles'));
    // Each rule's selectors, at-rules aside: every one starts at .fd-map-embed, so nothing reaches the page round it.
    const selectors = EMBED_CSS.replace(/@layer[^{]*\{/, '')
      .split('}')
      .map((rule) => rule.split('{')[0].trim())
      .filter(Boolean)
      .flatMap((list) => list.split(',').map((selector) => selector.trim()));
    expect(selectors.length).toBeGreaterThan(8);
    expect(selectors.filter((selector) => !selector.startsWith('.fd-map-embed'))).toEqual([]);
    // A part hidden stays hidden; words for a screen reader alone; buttons, plain and primary.
    for (const needed of ['.fd-map-embed [hidden]', '.fd-map-embed .fd-sr-only', '.fd-map-embed .fd-button', '.fd-map-embed .fd-button-primary']) expect(selectors).toContain(needed);
    // Its colours are Fieldia's tokens, in the tokens' layer: a page's own rule sets them.
    expect(EMBED_CSS).toMatch(/@layer fieldia-tokens \{\s*\.fd-map-embed \{[^}]*--fd-accent: light-dark\(/);
    one.destroy();
    two.destroy();
  });

  it('is never the viewer’s: a list’s map there is drawn as before, its base the viewer’s own', () => {
    const context = {
      page,
      node: page.layout,
      dataSource: undefined,
      document,
      locale: 'en',
      filter: () => [],
      isChosen: () => false,
      choose: () => undefined,
      highlight: () => undefined,
      addSearch: () => undefined,
      sort: () => [],
      sortBy: () => undefined,
      actions: [],
      act: async () => undefined,
    } as unknown as ListViewContext;
    const part = mapListViews({ provider })['map'](context);
    expect(part.element.classList.contains('fd-map-embed')).toBe(false);
    expect(document.getElementById('fieldia-map-embed-styles')).toBeNull();
    part.destroy();
  });
});
