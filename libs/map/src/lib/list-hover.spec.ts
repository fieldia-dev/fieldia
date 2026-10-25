import { createMemoryDataSource, type Page, type RecordId } from '@fieldia/core';
import type { ListViewContext } from '@fieldia/viewer';
import { loadLeaflet } from './leaflet';
import { mapListViews } from './map-parts';
import { tiles } from './providers';

/**
 * A row pointed at lights its home on the list's map, and only the pins whose light changes are moved (the performance
 * audit's L5): 0.34 raised or lowered every pin for each row pointed at — 500 marker moves a hover with the map's most
 * — so a hover cost as much as the pins on the map. Counted here as Leaflet's own z-index moves, in jsdom (Leaflet
 * draws its marks there; the browser's side of a hover is driven in e2e/map-list.spec.ts).
 */

const page = (n: number) =>
  ({
    fieldia: '0.13',
    id: 'homes',
    title: 'Homes',
    data: { kind: 'record', model: 'home' },
    fields: { name: { type: 'char', label: 'Home' }, price: { type: 'monetary', label: 'Price', currency: 'EGP' }, lat: { type: 'float', label: 'Latitude' }, lng: { type: 'float', label: 'Longitude' } },
    layout: { type: 'list', id: 'homes', columns: ['name', 'price'], pageSize: n, map: { latitude: 'lat', longitude: 'lng', pin: { label: 'price' }, cluster: false, limit: n } },
  }) as unknown as Page;

const homes = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { name: `Home ${i + 1}`, price: 1_000_000 + i * 1000, lat: 30 + (i % 25) * 0.01, lng: 31 + Math.floor(i / 25) * 0.01 }]));
const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

afterEach(() => document.body.replaceChildren());

describe('a row pointed at, lighting its home on the map', () => {
  it.each([50, 500])('moves the pins whose light changes alone, whatever the number of pins: %d pins', async (n) => {
    const { L } = await loadLeaflet();
    const chosen = new Set<RecordId>();
    const context = {
      page: page(n),
      node: page(n).layout,
      dataSource: createMemoryDataSource({ records: { home: homes(n) } }),
      document,
      locale: 'en',
      filter: () => [],
      isChosen: (id: RecordId) => chosen.has(id),
      choose: () => undefined,
      highlight: () => undefined,
      addSearch: () => undefined,
      sort: () => [],
      sortBy: () => undefined,
      actions: [],
      act: async () => undefined,
    } as unknown as ListViewContext;
    const part = mapListViews({ provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } }) })['map'](context);
    document.body.append(part.element);
    await part.reload();
    await settle();
    const marks = () => [...part.element.querySelectorAll('.fd-map-mark[data-id]')];
    expect(marks()).toHaveLength(n);
    const moves = jest.spyOn(L.Marker.prototype, 'setZIndexOffset');
    // Rows pointed at one after the other, and away.
    for (const id of [3, 7, 7, 12]) {
      part.highlight(id);
      part.highlight(null);
    }
    part.highlight(5);
    // Each change of light moved one pin, up or back: 9 here, whether the map has 50 pins or 500.
    expect(moves).toHaveBeenCalledTimes(9);
    const lit = marks().filter((mark) => mark.querySelector('[data-hot]'));
    expect(lit.map((mark) => mark.getAttribute('data-id'))).toEqual(['5']);
    // A record ticked: every pin says so, none of them moved.
    moves.mockClear();
    chosen.add(9);
    part.chosenChanged();
    expect(moves).not.toHaveBeenCalled();
    expect(marks().filter((mark) => mark.querySelector('[data-chosen]')).map((mark) => mark.getAttribute('data-id'))).toEqual(['9']);
    moves.mockRestore();
    part.destroy();
  });
});
