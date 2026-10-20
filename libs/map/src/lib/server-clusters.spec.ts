import type * as Leaflet from 'leaflet';
import type { ClustersRequest, ClustersResult, DataSource, ListMap, ListRequest } from '@fieldia/core';
import { LISTED, serverClusters, type Served } from './server-clusters';
import { clusterPoints } from './cluster';

/**
 * A list's map whose data source gathers its records (`clusters`): what it asks and when — the view's bubbles a
 * moment after the map stops, the last ask winning, a late answer dropped; a new search's whole extent first, for the
 * map to fit; false, for a search the source leaves to the browser — and a bubble's records on one spot, a lit row's
 * place. The map itself is driven in the browser tests (e2e/map-clusters.spec.ts).
 */

const spec: ListMap = { latitude: 'lat', longitude: 'lng' };
const placeOf = (values: Record<string, unknown>) => (typeof values['lat'] === 'number' && typeof values['lng'] === 'number' ? { lat: values['lat'] as number, lng: values['lng'] as number } : null);
/** A map as the asks read it: where it stands, how close, and moved when told. */
interface FakeMap {
  view: { south: number; west: number; north: number; east: number };
  zoom: number;
  setView: jest.Mock;
}
function fakeMap(view = { south: 30, west: 31, north: 30.1, east: 31.2 }, zoom = 12): FakeMap & Leaflet.Map {
  const map: FakeMap = { view, zoom, setView: jest.fn((_at: [number, number], to: number) => (map.zoom = to)) };
  const read = {
    getBounds: () => ({ getSouth: () => map.view.south, getWest: () => map.view.west, getNorth: () => map.view.north, getEast: () => map.view.east }),
    getZoom: () => map.zoom,
    getMaxZoom: () => 19,
  };
  return Object.assign(map, read) as unknown as FakeMap & Leaflet.Map;
}
const answerOf = (count: number): ClustersResult => ({ clusters: [{ lat: 30.05, lng: 31.1, count, bbox: { south: 30.01, west: 31.05, north: 30.09, east: 31.15 } }], points: [{ id: 7, values: { name: 'Villa', lat: 30.08, lng: 31.18 } }], unplaced: 3 });

/** A source whose answers wait until the test gives them, each ask kept with its signal. */
function slowSource() {
  const asks: { request: ClustersRequest; answer: (result: ClustersResult | false) => void; fail: (error: Error) => void }[] = [];
  const source: DataSource = {
    clusters: (request) => new Promise((answer, fail) => asks.push({ request, answer, fail })),
    list: jest.fn(async (request: ListRequest) => ({ records: [{ id: 7, values: { name: 'Villa', lat: 30.08, lng: 31.18 } }], total: 72, request })),
  };
  return { source, asks };
}
const make = (source: DataSource) => serverClusters({ source, model: 'home', spec, fields: ['name', 'lat', 'lng'], radius: 48, placeOf });
/** Every answer on its way laid: a few turns of the promises' queue. */
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('the source’s bubbles for a list’s map', () => {
  it('asks a moment after the map stops, with the search, where its records are, the view and how near pins crowd', async () => {
    const { source, asks } = slowSource();
    const gathered = make(source);
    const answers: (Served | false)[] = [];
    const done = gathered.ask({ filter: [{ field: 'offer', op: '=', value: 'rent' }], map: fakeMap(), wait: 250 }, (served) => answers.push(served), () => answers.push(false));
    jest.advanceTimersByTime(249);
    expect(asks).toHaveLength(0);
    jest.advanceTimersByTime(1);
    expect(asks).toHaveLength(1);
    expect(asks[0].request).toMatchObject({ model: 'home', filter: [{ field: 'offer', op: '=', value: 'rent' }], field: 'lat', longitude: 'lng', bbox: { south: 30, west: 31, north: 30.1, east: 31.2 }, zoom: 12, radius: 48, fields: ['name', 'lat', 'lng'] });
    expect(asks[0].request.signal?.aborted).toBe(false);
    asks[0].answer(answerOf(40));
    await done;
    // The view it answers, and how many it finds there: a pin one, a bubble its count.
    expect(answers).toEqual([{ clusters: answerOf(40).clusters, points: answerOf(40).points, unplaced: 3, bbox: { south: 30, west: 31, north: 30.1, east: 31.2 }, count: 41 }]);
  });

  it('a run of moves asks once, the last; a late answer to an ask replaced is dropped, its question aborted', async () => {
    const { source, asks } = slowSource();
    const gathered = make(source);
    const map = fakeMap();
    const answers: number[] = [];
    const take = (served: Served | false) => served && answers.push(served.count);
    void gathered.ask({ filter: [], map, wait: 250 }, take, () => undefined);
    jest.advanceTimersByTime(100);
    void gathered.ask({ filter: [], map, wait: 250 }, take, () => undefined);
    jest.advanceTimersByTime(250);
    expect(asks).toHaveLength(1);
    // Moved again while the source is still working out the last view: that one aborted, its answer never drawn.
    void gathered.ask({ filter: [], map, wait: 250 }, take, () => undefined);
    expect(asks[0].request.signal?.aborted).toBe(true);
    jest.advanceTimersByTime(250);
    asks[0].answer(answerOf(5));
    asks[1].answer(answerOf(9));
    await flush();
    expect(answers).toEqual([10]);
  });

  it('a new search: its whole extent asked first (the world at zoom 0), the map fitted to it, then the view where the map stopped', async () => {
    const { source, asks } = slowSource();
    const gathered = make(source);
    const map = fakeMap();
    const fitted: unknown[] = [];
    const answers: (Served | false)[] = [];
    const done = gathered.ask(
      {
        filter: [],
        map,
        wait: 0,
        fit: (spots) => {
          fitted.push(spots);
          map.view = { south: 29.9, west: 30.9, north: 30.2, east: 31.3 };
          map.zoom = 10;
        },
      },
      (served) => answers.push(served),
      () => undefined
    );
    jest.advanceTimersByTime(0);
    expect(asks[0].request).toMatchObject({ bbox: { south: -90, west: -180, north: 90, east: 180 }, zoom: 0 });
    asks[0].answer(answerOf(400));
    await flush();
    // Where its records are: the bubble's box, the record standing alone.
    expect(fitted).toEqual([
      [
        { lat: 30.01, lng: 31.05 },
        { lat: 30.09, lng: 31.15 },
        { lat: 30.08, lng: 31.18 },
      ],
    ]);
    expect(asks[1].request).toMatchObject({ bbox: { south: 29.9, west: 30.9, north: 30.2, east: 31.3 }, zoom: 10 });
    asks[1].answer(answerOf(401));
    await done;
    expect(answers).toHaveLength(1);
    expect((answers[0] as Served).count).toBe(402);
  });

  it('a search that finds nothing is drawn as nothing, fitted nowhere; one bubble with no box leaves the map where it is', async () => {
    const { source, asks } = slowSource();
    const gathered = make(source);
    const fit = jest.fn();
    const answers: (Served | false)[] = [];
    let done = gathered.ask({ filter: [], map: fakeMap(), wait: 0, fit }, (served) => answers.push(served), () => undefined);
    jest.advanceTimersByTime(0);
    asks[0].answer({ clusters: [], points: [], unplaced: 2 });
    await done;
    expect(asks).toHaveLength(1);
    expect(fit).not.toHaveBeenCalled();
    expect(answers).toEqual([{ clusters: [], points: [], unplaced: 2, bbox: null, count: 0 }]);
    done = gathered.ask({ filter: [], map: fakeMap(), wait: 0, fit }, (served) => answers.push(served), () => undefined);
    jest.advanceTimersByTime(0);
    asks[1].answer({ clusters: [{ lat: 30, lng: 31, count: 12 }] });
    await flush();
    expect(fit).not.toHaveBeenCalled();
    asks[2].answer({ clusters: [{ lat: 30, lng: 31, count: 12 }] });
    await done;
    expect(answers).toHaveLength(2);
  });

  it('false: the source gathers none for this search, and nothing more is asked; a failure is said; an abort says nothing', async () => {
    const { source, asks } = slowSource();
    const gathered = make(source);
    const said: string[] = [];
    let done = gathered.ask({ filter: [], map: fakeMap(), wait: 0, fit: () => undefined }, (served) => said.push(served === false ? 'false' : 'served'), () => said.push('failed'));
    jest.advanceTimersByTime(0);
    asks[0].answer(false);
    await done;
    expect(asks).toHaveLength(1);
    done = gathered.ask({ filter: [], map: fakeMap(), wait: 0 }, () => said.push('served'), () => said.push('failed'));
    jest.advanceTimersByTime(0);
    asks[1].fail(new Error('The server is down'));
    await done;
    expect(said).toEqual(['false', 'failed']);
    done = gathered.ask({ filter: [], map: fakeMap(), wait: 0 }, () => said.push('served'), () => said.push('failed'));
    jest.advanceTimersByTime(0);
    gathered.stop();
    asks[2].fail(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await done;
    expect(said).toEqual(['false', 'failed']);
  });

  it('a bubble on one spot: the records within it listed, the first of them in the list’s order, with how many there are', async () => {
    const { source } = slowSource();
    const gathered = make(source);
    const shown = jest.fn();
    gathered.crowd([{ field: 'offer', op: '=', value: 'sale' }], [{ lat: 30.0155, lng: 31.7125 }, { lat: 30.0155, lng: 31.7125 }], [{ field: 'name' }], shown);
    await flush();
    expect(source.list).toHaveBeenCalledWith({
      model: 'home',
      fields: ['name', 'lat', 'lng'],
      filter: [
        { field: 'offer', op: '=', value: 'sale' },
        { field: 'lat', op: 'between', value: [30.0155, 30.0155] },
        { field: 'lng', op: 'between', value: [31.7125, 31.7125] },
      ],
      sort: [{ field: 'name' }],
      offset: 0,
      limit: LISTED,
    });
    expect(shown).toHaveBeenCalledWith([{ record: { id: 7, values: { name: 'Villa', lat: 30.08, lng: 31.18 } }, at: { lat: 30.08, lng: 31.18 } }], 72);
  });

  it('a lit row’s home, where the source has it in a bubble: asked once by its id, again once records may have changed', async () => {
    const { source } = slowSource();
    const gathered = make(source);
    expect(await gathered.place(7)).toEqual({ record: { id: 7, values: { name: 'Villa', lat: 30.08, lng: 31.18 } }, at: { lat: 30.08, lng: 31.18 } });
    await gathered.place(7);
    expect(source.list).toHaveBeenCalledTimes(1);
    expect((source.list as jest.Mock).mock.calls[0][0]).toMatchObject({ filter: [{ field: 'id', op: 'in', value: [7] }], limit: 1 });
    gathered.forget();
    await gathered.place(7);
    expect(source.list).toHaveBeenCalledTimes(2);
  });

  it('a bubble the source gave no box: two steps closer on it, while the map can come closer', () => {
    const { source } = slowSource();
    const gathered = make(source);
    const map = fakeMap(undefined, 12);
    expect(gathered.closer(map, [{ lat: 30, lng: 31, count: 4, bbox: { south: 30, west: 31, north: 30, east: 31 } }], { lat: 30, lng: 31 })).toBe(false);
    expect(gathered.closer(map, [{ lat: 30, lng: 31, count: 4 }], { lat: 30, lng: 31 })).toBe(true);
    expect(map.setView).toHaveBeenCalledWith([30, 31], 14);
    map.zoom = 19;
    expect(gathered.closer(map, [{ lat: 30, lng: 31, count: 4 }], { lat: 30, lng: 31 })).toBe(false);
    expect(gathered.corners([{ lat: 30, lng: 31, count: 4 }, { lat: 1, lng: 2, count: 2, bbox: { south: 0, west: 1, north: 2, east: 3 } }])).toEqual([
      { lat: 30, lng: 31 },
      { lat: 0, lng: 1 },
      { lat: 2, lng: 3 },
    ]);
  });
});

describe('the source’s bubbles gathered again with the records standing alone', () => {
  it('weighs a bubble by its count: their middle leans to the bigger one', () => {
    // A bubble of 9 at 0 and a record at 40: one group, its middle at 4 — so a record 50 further on stays apart.
    expect(clusterPoints([{ x: 0, y: 0, weighs: 9 }, { x: 40, y: 0 }, { x: 54, y: 0 }], 48)).toEqual([[0, 1], [2]]);
    // Unweighed, the middle is 20 and takes the last one in.
    expect(clusterPoints([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 54, y: 0 }], 48)).toEqual([[0, 1, 2]]);
  });
});
