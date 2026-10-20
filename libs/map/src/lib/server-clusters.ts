import type * as Leaflet from 'leaflet';
import type { ClustersResult, DataSource, ListMap, MapCluster, RecordId, ResolvedFilter, SortOrder, Values } from '@fieldia/core';
import type { LatLng } from './geo';
import type { MapRecord } from './pins';
import { boxFilter, boxOf, type Box } from './view-box';

/**
 * A list's map whose data source gathers its records (`clusters`): the bubbles of the view asked for as a search
 * changes and a moment after the map stops, the last ask winning; a new search's whole extent first, for the map to
 * fit; a bubble pressed where no zoom parts it, its records listed; a record's place asked when its row is lit. Its
 * code comes with the first map whose source gathers.
 */

/** One view's answer, as the map draws it. */
export interface Served {
  clusters: MapCluster[];
  /** The records standing alone: each its own pin. */
  points: MapRecord[];
  unplaced: number;
  /** The view it answers, and how many records the search finds there: "Search this area (1,204)". Null for none. */
  bbox: Box | null;
  count: number;
}

/** A record and where it is. */
type Placed = { record: MapRecord; at: LatLng };

/** The world round, asked at zoom 0 by a new search the map fits to: a few bubbles, each with the box its records lie in. */
const WORLD: Box = { south: -90, west: -180, north: 90, east: 180 };
/** The most records a bubble on one spot lists; the rest are said as a number. */
export const LISTED = 50;

export interface ServerClusters {
  /**
   * The bubbles of the map's view for `filter`, `wait` milliseconds from now; with `fit`, the world's first, the
   * places they cover handed to `fit` (the map moving there), then those of the view where the map then stands.
   * `answer` is given the view's, or false: the source gathers none for this search. A failure is `failed`; an ask a
   * newer one replaced says nothing. Settled when it is answered, or replaced.
   */
  ask(request: { filter: ResolvedFilter[]; map: Leaflet.Map; wait: number; fit?: (spots: LatLng[]) => void }, answer: (served: Served | false) => void, failed: () => void): Promise<void>;
  /** Where bubbles' records are: the corners of each one's box, or its middle where it has none. */
  corners(clusters: readonly MapCluster[]): LatLng[];
  /** A bubble the source gave no box, pressed: two steps closer on it, while the map can come closer. False when it cannot. */
  closer(map: Leaflet.Map, clusters: readonly MapCluster[], centre: LatLng): boolean;
  /** The records where `spots` are (a bubble on one spot), at most LISTED in the list's order, shown with how many there are. */
  crowd(filter: ResolvedFilter[], spots: LatLng[], sort: SortOrder[], show: (found: Placed[], total: number) => void): void;
  /** A record, with its place, pin and card fields: asked once, for a row lit whose record is in a bubble. */
  place(id: RecordId): Promise<Placed | null>;
  /** Records may have changed: places are asked again. */
  forget(): void;
  stop(): void;
}

export function serverClusters(options: {
  source: DataSource;
  model: string;
  spec: ListMap;
  /** The fields a record is asked with: its place, its pin's and its card's. */
  fields: string[];
  /** Pins nearer than this, in pixels, crowd. */
  radius: number;
  /** A heat map's weight field: added up in each bubble. */
  weight?: string;
  placeOf(values: Values): LatLng | null;
}): ServerClusters {
  const { source, model, spec, fields, radius, weight, placeOf } = options;
  const where = spec.point ? { field: spec.point } : { field: spec.latitude as string, longitude: spec.longitude as string };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let asking: AbortController | null = null;
  let asked = 0;
  let settle: (() => void) | null = null;
  const places = new Map<RecordId, Promise<Placed | null>>();

  const stop = () => {
    clearTimeout(timer);
    asking?.abort();
    asking = null;
    asked++;
    settle?.();
    settle = null;
  };
  const question = (filter: ResolvedFilter[], bbox: Box, zoom: number, signal: AbortSignal) =>
    (source.clusters as NonNullable<DataSource['clusters']>)({ model, filter, ...where, bbox, zoom, radius, fields, ...(weight ? { weight } : {}), signal });
  const served = (result: ClustersResult, bbox: Box | null): Served => {
    const clusters = result.clusters ?? [];
    const points = (result.points ?? []).map(({ id, values }) => ({ id, values }));
    return { clusters, points, unplaced: result.unplaced ?? 0, bbox, count: points.length + clusters.reduce((sum, cluster) => sum + cluster.count, 0) };
  };
  const corners = (clusters: readonly MapCluster[]): LatLng[] =>
    clusters.flatMap((cluster) =>
      cluster.bbox
        ? [
            { lat: cluster.bbox.south, lng: cluster.bbox.west },
            { lat: cluster.bbox.north, lng: cluster.bbox.east },
          ]
        : [{ lat: cluster.lat, lng: cluster.lng }]
    );
  const placed = (records: readonly { id: RecordId; values: Values }[]): Placed[] =>
    records.flatMap(({ id, values }) => {
      const at = placeOf(values);
      return at ? [{ record: { id, values }, at }] : [];
    });

  return {
    ask(request, answer, failed) {
      stop();
      const mine = asked;
      const current = () => mine === asked;
      const { map } = request;
      return new Promise<void>((done) => {
        settle = done;
        const finish = () => {
          if (current()) settle = null;
          done();
        };
        timer = setTimeout(async () => {
          const controller = (asking = new AbortController());
          try {
            if (request.fit) {
              const world = await question(request.filter, WORLD, 0, controller.signal);
              if (!current()) return finish();
              // None gathered for this search; or nothing found anywhere, nothing to fit and nothing to draw.
              if (!world || (!world.clusters?.length && !world.points?.length)) {
                answer(world ? served(world, null) : false);
                return finish();
              }
              const spots = [...corners(world.clusters ?? []), ...placed(world.points ?? []).map((one) => one.at)];
              // One bubble's middle alone says nothing of how far its records spread: the map stays where it is.
              if (spots.length > 1 || !world.clusters?.length) request.fit(spots);
              // The map moved, and asked for where it stopped itself.
              if (!current()) return finish();
            }
            const b = map.getBounds();
            const bbox = boxOf(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
            const result = await question(request.filter, bbox, map.getZoom(), controller.signal);
            if (current()) answer(result ? served(result, bbox) : false);
          } catch {
            if (current() && !controller.signal.aborted) failed();
          }
          finish();
        }, request.wait);
      });
    },

    corners,

    closer(map, clusters, centre) {
      if (clusters.every((cluster) => cluster.bbox) || map.getZoom() >= Math.min(map.getMaxZoom(), 19)) return false;
      map.setView([centre.lat, centre.lng], map.getZoom() + 2);
      return true;
    },

    crowd(filter, spots, sort, show) {
      const lats = spots.map((p) => p.lat);
      const lngs = spots.map((p) => p.lng);
      const spot = { south: Math.min(...lats), west: Math.min(...lngs), north: Math.max(...lats), east: Math.max(...lngs) };
      source.list?.({ model, fields, filter: [...filter, ...boxFilter(spec, spot)], sort, offset: 0, limit: LISTED }).then(
        (result) => show(placed(result.records), result.total),
        () => undefined
      );
    },

    place(id) {
      let found = places.get(id);
      if (!found) {
        found = (source.list?.({ model, fields, filter: [{ field: 'id', op: 'in', value: [id] }], sort: [], offset: 0, limit: 1 }) ?? Promise.resolve({ records: [], total: 0 })).then(
          (result) => placed(result.records)[0] ?? null,
          () => {
            places.delete(id);
            return null;
          }
        );
        places.set(id, found);
      }
      return found;
    },

    forget: () => places.clear(),
    stop,
  };
}
