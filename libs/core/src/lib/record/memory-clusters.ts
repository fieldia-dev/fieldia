import type { ClustersRequest, ClustersResult, GeoBox, ListedRecord, MapCluster } from './data-source';
import { matchesFilter, placeOf } from './filter';
import { structuredCopy, type RecordId, type Value, type Values } from './values';

/**
 * How a memory source answers `clusters` (its `clusters` option), for demos and tests: as a server gathers a map's
 * records by a grid. The records the search finds in the view, each put in a square of the world as the map draws it
 * at its zoom — `radius` pixels a side, the squares fixed to the world, so a record keeps its square as the map pans —
 * and each square holding two or more one bubble: their middle, their count, the box they lie in (and their `weight`,
 * added up, where asked). A square holding one is that record, standing alone, as a list's row gives it (the memory
 * source's `row`: the fields asked, as this person may read them). Those the search finds with no place are counted
 * (`unplaced`). `models` names the models it gathers; a map of any other is answered `false`, and loads its records as
 * without it. A map that moved on (`signal`) is refused with an AbortError. Outside the one-tag script, as
 * `alikeRecords` is.
 *
 *   createMemoryDataSource({ records, clusters: gridClusters({ models: ['home'] }) })
 */
export function gridClusters(
  how: { models?: string[] } = {}
): (request: ClustersRequest, records: Readonly<Record<string, Record<string, Values>>>, row?: (id: RecordId, values: Values) => ListedRecord) => ClustersResult | false {
  return (request, records, row = (id, values) => ({ id, values: Object.fromEntries(request.fields.map((field) => [field, structuredCopy(values[field] ?? null) as Value])) })) => {
    if (request.signal?.aborted) throw Object.assign(new Error('The map moved on'), { name: 'AbortError' });
    if (how.models && !how.models.includes(request.model)) return false;
    const world = 256 * 2 ** request.zoom;
    const side = Math.max(1, request.radius);
    const squares = new Map<string, Square>();
    let unplaced = 0;
    for (const [key, values] of Object.entries(records[request.model] ?? {})) {
      const id: RecordId = Number.isFinite(Number(key)) ? Number(key) : key;
      if (!matchesFilter({ id, ...values }, request.filter)) continue;
      const at = placeOf(values, values[request.field], request.longitude);
      if (!at || Math.abs(at.lat) > 90 || Math.abs(at.lng) > 180) {
        unplaced++;
        continue;
      }
      if (!inBox(at, request.bbox)) continue;
      // Where it is drawn at this zoom (Web Mercator), in the world's pixels, then its square.
      const sin = Math.min(0.9999, Math.max(-0.9999, Math.sin((at.lat * Math.PI) / 180)));
      const x = ((at.lng + 180) / 360) * world;
      const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world;
      const name = `${Math.floor(x / side)}:${Math.floor(y / side)}`;
      const square = squares.get(name);
      const weight = request.weight ? Number(values[request.weight]) : 0;
      const weighs = Number.isFinite(weight) ? weight : 0;
      if (!square) squares.set(name, { first: { id, values }, count: 1, lat: at.lat, lng: at.lng, box: { south: at.lat, west: at.lng, north: at.lat, east: at.lng }, weight: weighs });
      else {
        square.count++;
        square.lat += at.lat;
        square.lng += at.lng;
        square.weight += weighs;
        square.box = { south: Math.min(square.box.south, at.lat), west: Math.min(square.box.west, at.lng), north: Math.max(square.box.north, at.lat), east: Math.max(square.box.east, at.lng) };
      }
    }
    const clusters: MapCluster[] = [];
    const points: ListedRecord[] = [];
    for (const square of squares.values()) {
      if (square.count === 1) {
        points.push(row(square.first.id, square.first.values));
        continue;
      }
      const round = (n: number) => Math.round(n * 1e6) / 1e6;
      clusters.push({
        lat: round(square.lat / square.count),
        lng: round(square.lng / square.count),
        count: square.count,
        bbox: square.box,
        ...(request.weight ? { weight: square.weight } : {}),
      });
    }
    return { clusters, points, unplaced };
  };
}

interface Square {
  /** Its first record, which it is when it holds no other. */
  first: { id: RecordId; values: Values };
  count: number;
  /** Its records' latitudes and longitudes added up, for their middle. */
  lat: number;
  lng: number;
  box: GeoBox;
  weight: number;
}

/** Whether a place lies in a box, its edges included: west beyond east crossing the antimeridian. */
function inBox(at: { lat: number; lng: number }, box: GeoBox): boolean {
  if (at.lat < box.south || at.lat > box.north) return false;
  return box.west <= box.east ? at.lng >= box.west && at.lng <= box.east : at.lng >= box.west || at.lng <= box.east;
}
