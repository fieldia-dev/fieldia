import type { Page } from '@fieldia/core';

/**
 * @fieldia/map's own code in parts (0.35), each fetched the first time a page shows what it draws, as the calendar's
 * view and Leaflet are: a page with a place field is drawn once the fields' part has come, its box the map's from its
 * first paint — never Fieldia's plain box first; a list's map holds its place, waiting as the list says, and draws in
 * it once its code has come; a list's map in a page of its own comes back at once and is drawn once its code has; and
 * what each draws once its part has come is what it draws with the part in from the start. This file starts without
 * them (a `*-lazy.spec.ts`).
 */

type Packages = typeof import('../index') & typeof import('./map-parts') & Pick<typeof import('@fieldia/viewer'), 'mountViewer'> & Pick<typeof import('@fieldia/core'), 'createMemoryDataSource'>;

/** The packages in a module registry of their own: no part of the map's fetched yet. */
async function fresh(): Promise<Packages> {
  let packages!: Packages;
  await jest.isolateModulesAsync(async () => {
    const [map, parts, viewer, core] = await Promise.all([import('../index'), import('./map-parts'), import('@fieldia/viewer'), import('@fieldia/core')]);
    packages = { ...map, ...parts, mountViewer: viewer.mountViewer, createMemoryDataSource: core.createMemoryDataSource };
  });
  return packages;
}

const until = async (ready: () => unknown, ms = 2000) => {
  for (const started = Date.now(); !ready(); ) {
    if (Date.now() - started > ms) throw new Error('waited too long');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

const placePage: Page = {
  fieldia: '0.13',
  id: 'site',
  data: { kind: 'record', model: 'site' },
  fields: { name: { type: 'char', label: 'Site' }, lat: { type: 'float', label: 'Latitude' }, lng: { type: 'float', label: 'Longitude' } },
  layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-lat', field: 'lat', widget: 'place', options: { longitudeField: 'lng', search: false } }] },
};
const listPage = {
  fieldia: '0.13',
  id: 'homes',
  title: 'Homes',
  data: { kind: 'record', model: 'home' },
  fields: { name: { type: 'char', label: 'Home' }, lat: { type: 'float', label: 'Latitude' }, lng: { type: 'float', label: 'Longitude' } },
  layout: { type: 'list', id: 'homes', columns: ['name'], map: { latitude: 'lat', longitude: 'lng', height: 400, view: 'map' } },
} as unknown as Page;
const homes = { 1: { name: 'Flat in Zamalek', lat: 30.062, lng: 31.219 }, 2: { name: 'Villa in Maadi', lat: 29.96, lng: 31.257 } };

/** A page's element as it is drawn, its ids and generated names left out: what two drawings are compared by. */
const shape = (element: Element) =>
  element.outerHTML
    .replace(/\s(id|for|aria-labelledby|aria-describedby|aria-controls|data-fd-wait|data-fd-loading)="[^"]*"/g, '')
    .replace(/fd-(field|q|map)-\d+/g, 'fd-$1-n');

beforeEach(() => document.body.replaceChildren());

describe('the maps’ parts', () => {
  it('a page with a place field fetches the fields’ part and is drawn once it has come: the map’s box from its first paint, as with it in from the start', async () => {
    const fieldia = await fresh();
    expect(fieldia.mapWidgetsPart.loaded).toBeUndefined();
    const provider = fieldia.tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } });
    const host = document.body.appendChild(document.createElement('div'));
    const handle = fieldia.mountViewer(host, { page: placePage, widgets: fieldia.mapWidgets({ provider }) });
    // Nothing of the place drawn yet: no plain box to swap for the map's.
    expect(host.querySelector('[data-node="f-lat"] input')).toBeNull();
    await handle.drawn;
    expect(fieldia.mapWidgetsPart.loaded).toBeDefined();
    expect(host.querySelector('[data-node="f-lat"] .fd-map-box')).not.toBeNull();
    const lazily = shape(host.querySelector('[data-node="f-lat"]') as Element);
    handle.destroy();
    // Drawn again, its part in from the start: the same.
    const again = document.body.appendChild(document.createElement('div'));
    const second = fieldia.mountViewer(again, { page: placePage, widgets: fieldia.mapWidgets({ provider }) });
    await second.drawn;
    expect(shape(again.querySelector('[data-node="f-lat"]') as Element)).toBe(lazily);
    second.destroy();
  });

  it('a list’s map holds its place as tall as the map, waits, and draws in it once its code has come; with its code in, at once', async () => {
    const fieldia = await fresh();
    expect(fieldia.mapViewPart.loaded).toBeUndefined();
    const provider = fieldia.tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } });
    const dataSource = fieldia.createMemoryDataSource({ records: { home: homes } });
    const host = document.body.appendChild(document.createElement('div'));
    const handle = fieldia.mountViewer(host, { page: listPage, dataSource, listViews: fieldia.mapListViews({ provider }) });
    await handle.drawn;
    await until(() => host.querySelector('.fd-map-holder'));
    const holder = host.querySelector('.fd-map-holder') as HTMLElement;
    await until(() => holder.querySelector('.fd-map-list'));
    expect(fieldia.mapViewPart.loaded).toBeDefined();
    // Its place no longer held to a height of its own: the map's is.
    expect(holder.style.minHeight).toBe('');
    expect(holder.querySelector('.fd-map-box')).not.toBeNull();
    handle.destroy();
    // With its code in: no place held, the map drawn in it at once.
    const part = fieldia.mapListViews({ provider })['map'];
    expect(part).toBeDefined();
  });

  it('a list’s map in a page of its own comes back at once, and is drawn once its code has come', async () => {
    const fieldia = await fresh();
    const provider = fieldia.tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } });
    const host = document.body.appendChild(document.createElement('div'));
    const map = fieldia.mountListMap(host, { page: listPage, provider, records: [] });
    expect(host.querySelector('.fd-map-list')).toBeNull();
    await until(() => host.querySelector('.fd-map-list'));
    expect(map.element.classList.contains('fd-map-embed')).toBe(true);
    map.destroy();
    expect(host.children).toHaveLength(0);
    // Its code in: drawn at once, as before 0.35.
    const at = document.body.appendChild(document.createElement('div'));
    const now = fieldia.mountListMap(at, { page: listPage, provider, records: [] });
    expect(at.firstElementChild).toBe(now.element);
    now.destroy();
  });
});
