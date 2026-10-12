import type { ListMap, ResolvedFilter } from '@fieldia/core';
import { areaCounter, boxWithin, inBox, lastAsk, ownBox } from './area-count';
import { boxFilter, boxOf } from './view-box';

/**
 * The map's view as a search sees it: its edges, the conditions "Search this
 * area" asks with, the area a search already holds, and how many records
 * on hand lie in a view — the count "Search this area (24)" says.
 */

const LATLNG: ListMap = { latitude: 'lat', longitude: 'lng' };
const POINT: ListMap = { point: 'spot' };

describe('a view’s box', () => {
  it('is its edges, rounded to a millionth of a degree, the longitudes brought round into -180…180', () => {
    expect(boxOf(30.0123456789, 31.2, 30.1, 31.3)).toEqual({ south: 30.012346, west: 31.2, north: 30.1, east: 31.3 });
    // Panned a world to the east: the same places.
    expect(boxOf(30, 391.2, 30.1, 391.3)).toEqual({ south: 30, west: 31.2, north: 30.1, east: 31.3 });
    // Over the antimeridian: west is east of east.
    expect(boxOf(-20, 170, -10, 190)).toEqual({ south: -20, west: 170, north: -10, east: -170 });
    // Wider than the world, past the poles: all of it.
    expect(boxOf(-95, -300, 95, 300)).toEqual({ south: -90, west: -180, north: 90, east: 180 });
  });

  it('asks for its records by a latitude and a longitude, or within it on a point', () => {
    const box = { south: 30, west: 31.2, north: 30.1, east: 31.3 };
    expect(boxFilter(LATLNG, box)).toEqual([
      { field: 'lat', op: 'between', value: [30, 30.1] },
      { field: 'lng', op: 'between', value: [31.2, 31.3] },
    ]);
    expect(boxFilter(POINT, box)).toEqual([{ field: 'spot', op: 'within', value: box }]);
    // Over the antimeridian no one range holds the longitudes: either side of it.
    expect(boxFilter(LATLNG, { south: -20, west: 170, north: -10, east: -170 })).toEqual([
      { field: 'lat', op: 'between', value: [-20, -10] },
      { any: [{ field: 'lng', op: '>=', value: 170 }, { field: 'lng', op: '<=', value: -170 }] },
    ]);
    // The whole world round: the latitudes alone.
    expect(boxFilter(LATLNG, { south: -90, west: -180, north: 90, east: 180 })).toEqual([{ field: 'lat', op: 'between', value: [-90, 90] }]);
  });

  it('holds a place on its edges and inside them, over the antimeridian too', () => {
    const box = { south: 30, west: 31.2, north: 30.1, east: 31.3 };
    expect(inBox({ lat: 30.05, lng: 31.25 }, box)).toBe(true);
    expect(inBox({ lat: 30, lng: 31.3 }, box)).toBe(true);
    expect(inBox({ lat: 30.2, lng: 31.25 }, box)).toBe(false);
    expect(inBox({ lat: 30.05, lng: 31.31 }, box)).toBe(false);
    const fiji = { south: -20, west: 170, north: -10, east: -170 };
    expect(inBox({ lat: -18, lng: 178 }, fiji)).toBe(true);
    expect(inBox({ lat: -18, lng: -178 }, fiji)).toBe(true);
    expect(inBox({ lat: -18, lng: 0 }, fiji)).toBe(false);
  });

  it('lies within another, or not', () => {
    const city = { south: 29.9, west: 31, north: 30.2, east: 31.5 };
    expect(boxWithin({ south: 30, west: 31.2, north: 30.1, east: 31.3 }, city)).toBe(true);
    expect(boxWithin(city, city)).toBe(true);
    expect(boxWithin({ south: 30, west: 30.9, north: 30.1, east: 31.3 }, city)).toBe(false);
    expect(boxWithin({ south: 29.8, west: 31.2, north: 30.1, east: 31.3 }, city)).toBe(false);
    // Anything lies within the whole world; a box over the antimeridian within one that is too.
    expect(boxWithin(city, { south: -90, west: -180, north: 90, east: 180 })).toBe(true);
    expect(boxWithin({ south: -15, west: 175, north: -12, east: -175 }, { south: -20, west: 170, north: -10, east: -170 })).toBe(true);
    expect(boxWithin({ south: -15, west: 175, north: -12, east: -175 }, city)).toBe(false);
  });
});

describe('the area a search already holds', () => {
  const others: ResolvedFilter[] = [{ field: 'offer', op: '=', value: 'sale' }];

  it('is found among the search’s conditions, and the rest kept: "Search this area" takes its place', () => {
    const box = { south: 30, west: 31.2, north: 30.1, east: 31.3 };
    expect(ownBox(LATLNG, [...others, ...boxFilter(LATLNG, box)])).toEqual({ box, rest: others });
    expect(ownBox(POINT, [...boxFilter(POINT, box), ...others])).toEqual({ box, rest: others });
    const fiji = { south: -20, west: 170, north: -10, east: -170 };
    expect(ownBox(LATLNG, [...boxFilter(LATLNG, fiji), ...others])).toEqual({ box: fiji, rest: others });
    expect(ownBox(LATLNG, others)).toBeNull();
  });

  it('is only one the map makes: an area drawn, or a range of a person’s own on one field, is no view', () => {
    const drawn: ResolvedFilter = { field: 'lat', op: 'within', value: { polygon: [[31.2, 30], [31.3, 30], [31.25, 30.1]], longitude: 'lng' } };
    expect(ownBox(LATLNG, [drawn])).toBeNull();
    expect(ownBox(POINT, [{ field: 'spot', op: 'within', value: { center: [31.2, 30], radius: 500 } }])).toBeNull();
    // A longitude's range alone, or on another field, is not the map's.
    expect(ownBox(LATLNG, [{ field: 'lng', op: 'between', value: [31.2, 31.3] }])).toBeNull();
    expect(ownBox(LATLNG, [{ field: 'price', op: 'between', value: [1, 2] }, { field: 'lng', op: 'between', value: [31.2, 31.3] }])).toBeNull();
  });
});

describe('the last ask', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('waits a moment, so a quick run of moves asks once', async () => {
    const asker = lastAsk<number>(400);
    const asked = jest.fn(() => Promise.resolve(7));
    const answered = jest.fn();
    asker.ask(asked, answered);
    jest.advanceTimersByTime(200);
    asker.ask(asked, answered);
    jest.advanceTimersByTime(399);
    expect(asked).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(asked).toHaveBeenCalledTimes(1);
    expect(answered).toHaveBeenCalledWith(7);
  });

  it('aborts the ask before it, and never lets an older answer, come late, over a newer one', async () => {
    const asker = lastAsk<number>(10);
    const pending: { signal: AbortSignal; resolve: (n: number) => void }[] = [];
    const question = (signal: AbortSignal) => new Promise<number>((resolve) => pending.push({ signal, resolve }));
    const answers: number[] = [];
    asker.ask(question, (n) => answers.push(n));
    jest.advanceTimersByTime(10);
    asker.ask(question, (n) => answers.push(n));
    jest.advanceTimersByTime(10);
    expect(pending).toHaveLength(2);
    expect(pending[0].signal.aborted).toBe(true);
    expect(pending[1].signal.aborted).toBe(false);
    // The newer answers first; the older, still answered by a source that ignores the abort, comes after.
    pending[1].resolve(24);
    await Promise.resolve();
    pending[0].resolve(99);
    await Promise.resolve();
    expect(answers).toEqual([24]);
  });

  it('stops: the ask waiting is never made, the one asked is aborted and its answer dropped', async () => {
    const asker = lastAsk<number>(10);
    let signal: AbortSignal | null = null;
    let resolve: (n: number) => void = () => undefined;
    const answered = jest.fn();
    asker.ask((s) => ((signal = s), new Promise<number>((r) => (resolve = r))), answered);
    jest.advanceTimersByTime(10);
    asker.stop();
    expect(signal!.aborted).toBe(true);
    resolve(3);
    await Promise.resolve();
    expect(answered).not.toHaveBeenCalled();
    const never = jest.fn(() => Promise.resolve(1));
    asker.ask(never, answered);
    asker.stop();
    jest.advanceTimersByTime(50);
    expect(never).not.toHaveBeenCalled();
  });

  it('says nothing of a refusal: the button reads as it did', async () => {
    const asker = lastAsk<number>(0);
    const answered = jest.fn();
    asker.ask(() => Promise.reject(new Error('offline')), answered);
    jest.advanceTimersByTime(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(answered).not.toHaveBeenCalled();
  });
});

describe('the count "Search this area" says', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const view = { south: 30, west: 31.2, north: 30.1, east: 31.3 };
  const inside = { lat: 30.05, lng: 31.25 };
  const outside = { lat: 29.96, lng: 31.26 };
  const sale: ResolvedFilter[] = [{ field: 'offer', op: '=', value: 'sale' }];
  const flush = async () => {
    for (let i = 0; i < 4; i++) await Promise.resolve();
  };

  it('is counted among the records on hand when they are all the search finds: at once, nothing asked', () => {
    const ask = jest.fn();
    const said: number[] = [];
    areaCounter(LATLNG, ask, (n) => said.push(n)).count(view, { filter: sale, all: true, places: [inside, outside, null, inside] });
    expect(said).toEqual([2]);
    expect(ask).not.toHaveBeenCalled();
  });

  it('is counted on hand within the area already searched; past its edge, asked for the search with the view in the area’s place', async () => {
    const searched = { south: 29.9, west: 31, north: 30.2, east: 31.5 };
    const ask = jest.fn((_filter: ResolvedFilter[], _signal: AbortSignal) => Promise.resolve(31));
    const said: number[] = [];
    const counter = areaCounter(LATLNG, ask, (n) => said.push(n));
    const filter = [...sale, ...boxFilter(LATLNG, searched)];
    counter.count(view, { filter, all: true, places: [inside, outside] });
    expect(said).toEqual([1]);
    const wider = { south: 29.8, west: 31.2, north: 30.1, east: 31.3 };
    counter.count(wider, { filter, all: true, places: [inside, outside] });
    jest.advanceTimersByTime(400);
    await flush();
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask.mock.calls[0][0]).toEqual([...sale, ...boxFilter(LATLNG, wider)]);
    expect(said).toEqual([1, 31]);
  });

  it('is asked when the map shows fewer than the search finds; with no way to ask, there is no number', async () => {
    const said: number[] = [];
    areaCounter(LATLNG, null, (n) => said.push(n)).count(view, { filter: sale, all: false, places: [inside] });
    jest.advanceTimersByTime(1000);
    await flush();
    expect(said).toEqual([]);
    const ask = jest.fn(() => Promise.resolve(240));
    areaCounter(POINT, ask, (n) => said.push(n)).count(view, { filter: sale, all: false, places: [inside] });
    jest.advanceTimersByTime(400);
    await flush();
    expect(said).toEqual([240]);
  });
});
