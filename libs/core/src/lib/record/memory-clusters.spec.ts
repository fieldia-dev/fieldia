import type { ClustersRequest, ClustersResult } from './data-source';
import { gridClusters } from './memory-clusters';
import { createMemoryDataSource } from './memory-data-source';

/**
 * A list's map whose data source gathers its records where they crowd (`clusters`, the data source contract's §26):
 * the memory source answers it as a server does, by a grid of squares fixed to the world, for demos and tests
 * (`gridClusters`), and has no `clusters` at all unless asked to — a map then gathers in the browser, as ever.
 */

const homes = {
  // Two in Zamalek, a street apart: one square at a city's zoom, two at a street's.
  1: { name: 'Flat in Zamalek', offer: 'sale', price: 4_000_000, lat: 30.0626, lng: 31.2197 },
  2: { name: 'Duplex in Zamalek', offer: 'rent', price: 25_000, lat: 30.0631, lng: 31.2215 },
  // Maadi, far from them.
  3: { name: 'Villa in Maadi', offer: 'sale', price: 9_000_000, lat: 29.9602, lng: 31.2569 },
  // Not placed yet.
  4: { name: 'Flat in New Cairo', offer: 'sale', price: 3_000_000, lat: null, lng: null },
  // Alexandria: out of a Cairo view.
  5: { name: 'Flat in Alexandria', offer: 'sale', price: 2_500_000, lat: 31.215, lng: 29.955 },
};
const CAIRO = { south: 29.9, west: 31.1, north: 30.2, east: 31.4 };
const ask = (over: Partial<ClustersRequest> = {}): ClustersRequest => ({ model: 'home', filter: [], field: 'lat', longitude: 'lng', bbox: CAIRO, zoom: 12, radius: 48, fields: ['name', 'price', 'lat', 'lng'], ...over });
const gathered = (answer: ClustersResult | false | Promise<ClustersResult | false>) => answer as ClustersResult;

describe('a memory source gathering a map’s records as a server does (gridClusters)', () => {
  it('gathers the records in the view by squares of the zoom: a bubble with its count, middle and box; a record alone with the fields asked', () => {
    const answer = gathered(gridClusters()(ask(), { home: homes }));
    expect(answer.clusters).toEqual([{ lat: 30.06285, lng: 31.2206, count: 2, bbox: { south: 30.0626, west: 31.2197, north: 30.0631, east: 31.2215 } }]);
    expect(answer.points).toEqual([{ id: 3, values: { name: 'Villa in Maadi', price: 9_000_000, lat: 29.9602, lng: 31.2569 } }]);
    // Alexandria is out of the view; New Cairo's has no place, said as a count whatever the view.
    expect(answer.unplaced).toBe(1);
  });

  it('parts a bubble as the map comes closer, and gathers more as it goes further out', () => {
    expect(gathered(gridClusters()(ask({ zoom: 17 }), { home: homes })).clusters).toEqual([]);
    expect(gathered(gridClusters()(ask({ zoom: 17 }), { home: homes })).points?.map((point) => point.id)).toEqual([1, 2, 3]);
    const far = gathered(gridClusters()(ask({ zoom: 2, bbox: { south: 20, west: 25, north: 35, east: 36 } }), { home: homes }));
    expect(far.clusters.map((cluster) => cluster.count)).toEqual([4]);
    expect(far.points).toEqual([]);
  });

  it('keeps to the search, and counts as unplaced only what the search finds', () => {
    const forRent = gathered(gridClusters()(ask({ filter: [{ field: 'offer', op: '=', value: 'rent' }] }), { home: homes }));
    expect(forRent.clusters).toEqual([]);
    expect(forRent.points?.map((point) => point.id)).toEqual([2]);
    expect(forRent.unplaced).toBe(0);
    // By id, as a list's ticked rows are asked.
    expect(gathered(gridClusters()(ask({ filter: [{ field: 'id', op: 'in', value: [1, 3] }] }), { home: homes })).points?.map((point) => point.id)).toEqual([1, 3]);
  });

  it('keeps each record in its square as the view moves: the squares are the world’s, not the view’s', () => {
    const here = gathered(gridClusters()(ask(), { home: homes }));
    const moved = gathered(gridClusters()(ask({ bbox: { south: 30, west: 31.15, north: 30.3, east: 31.45 } }), { home: homes }));
    expect(moved.clusters).toEqual(here.clusters);
  });

  it('reads a place from a GeoJSON point, adds up a weight where asked, and takes a view across the antimeridian', () => {
    const places = {
      1: { name: 'Fiji', place: { type: 'Point', coordinates: [178.44, -18.14] }, total: 120 },
      2: { name: 'Fiji too', place: { type: 'Point', coordinates: [178.45, -18.13] }, total: 80 },
      3: { name: 'Samoa', place: { type: 'Point', coordinates: [-171.76, -13.83] }, total: 50 },
      4: { name: 'Lima', place: { type: 'Point', coordinates: [-77.04, -12.05] }, total: 10 },
    };
    const answer = gathered(gridClusters()({ model: 'shop', filter: [], field: 'place', bbox: { south: -30, west: 170, north: 0, east: -165 }, zoom: 8, radius: 48, fields: ['name'], weight: 'total' }, { shop: places }));
    expect(answer.clusters).toEqual([{ lat: -18.135, lng: 178.445, count: 2, bbox: { south: -18.14, west: 178.44, north: -18.13, east: 178.45 }, weight: 200 }]);
    expect(answer.points).toEqual([{ id: 3, values: { name: 'Samoa' } }]);
  });

  it('answers false for a model it does not gather: the map loads its records and gathers them itself', () => {
    expect(gridClusters({ models: ['home'] })(ask({ model: 'courier' }), { courier: {} })).toBe(false);
    expect(gridClusters({ models: ['home'] })(ask(), { home: homes })).not.toBe(false);
  });
});

describe('the memory source’s clusters', () => {
  it('is there only when its option says how it answers: without it, every map gathers in the browser', () => {
    expect(createMemoryDataSource({ records: { home: homes } }).clusters).toBeUndefined();
    expect(typeof createMemoryDataSource({ records: { home: homes }, clusters: gridClusters() }).clusters).toBe('function');
  });

  it('answers as its option does, each record alone as a list’s row: without the fields this person may not see, with its version', async () => {
    const source = createMemoryDataSource({ records: { home: homes }, clusters: gridClusters(), versions: true, can: { home: (values) => (values['offer'] === 'sale' ? { hiddenFields: ['price'] } : undefined) } });
    const answer = await source.clusters?.(ask({ zoom: 17 }));
    expect(answer && answer.points?.map((point) => [point.id, point.values['price'] ?? 'hidden', !!point.version])).toEqual([
      [1, 'hidden', true],
      [2, 25_000, true],
      [3, 'hidden', true],
    ]);
    expect(source.calls.map((call) => call.method)).toEqual(['clusters']);
    expect(await source.clusters?.(ask({ model: 'courier' }))).toEqual({ clusters: [], points: [], unplaced: 0 });
    expect(await createMemoryDataSource({ clusters: () => false }).clusters?.(ask())).toBe(false);
  });

  it('stops for a map that moved on before it answered', async () => {
    const source = createMemoryDataSource({ records: { home: homes }, clusters: gridClusters() });
    const controller = new AbortController();
    controller.abort();
    await expect(source.clusters?.(ask({ signal: controller.signal }))).rejects.toMatchObject({ name: 'AbortError' });
  });
});
