import type { FilterItem } from '../format/field';
import type { JsonValue } from '../format/json';
import type { ResolvedFilter, ResolvedFilterCondition } from './data-source';
import type { RelatedRecord, Values } from './values';

/**
 * Whether a record passes a filter, the way a search should judge it: every
 * item of the list holds, an `any` group when one of its items holds, an `all`
 * group when each does. The memory data source searches with it; an app may too.
 */
export function matchesFilter(values: Values, filter: readonly ResolvedFilter[]): boolean {
  return filter.every((item) => holds(values, item));
}

function holds(values: Values, item: ResolvedFilter): boolean {
  if ('any' in item) return item.any.some((inner) => holds(values, inner));
  if ('all' in item) return item.all.every((inner) => holds(values, inner));
  return meets(values, item);
}

/** Empty is not set: no value, empty text, an empty list. */
function isSet(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '' && value !== false && !(Array.isArray(value) && !value.length);
}

/** The ids a list of links holds: records by their id, ids as they are. */
function idsIn(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (item !== null && typeof item === 'object' && 'id' in item ? (item as RelatedRecord).id : item));
}

function meets(values: Values, condition: ResolvedFilterCondition): boolean {
  const raw = values[condition.field];
  // A link compares by its id.
  const actual = raw !== null && typeof raw === 'object' && !Array.isArray(raw) && 'id' in raw ? (raw as RelatedRecord).id : (raw as JsonValue | undefined);
  const expected = condition.value;
  // Text is looked for in a link's name, as a search by name does.
  const text = raw !== null && typeof raw === 'object' && !Array.isArray(raw) && 'label' in raw ? String((raw as RelatedRecord).label) : String(actual ?? '');
  switch (condition.op) {
    case '=':
      return actual === expected;
    case '=?':
      return !isSet(expected) || actual === expected;
    case 'contains':
    case 'not contains': {
      const held = idsIn(raw);
      const wanted = Array.isArray(expected) ? expected : [expected];
      const found = wanted.some((value) => held.includes(value));
      return condition.op === 'contains' ? found : !found;
    }
    case '!=':
      return actual !== expected;
    case '<':
      return isSet(actual) && (actual as number) < (expected as number);
    case '>':
      return isSet(actual) && (actual as number) > (expected as number);
    case '<=':
      return isSet(actual) && (actual as number) <= (expected as number);
    case '>=':
      return isSet(actual) && (actual as number) >= (expected as number);
    case 'in':
      return Array.isArray(expected) && expected.includes(actual as JsonValue);
    case 'not in':
      return Array.isArray(expected) && !expected.includes(actual as JsonValue);
    case 'like':
      return text.includes(String(expected));
    case 'ilike':
      return text.toLowerCase().includes(String(expected).toLowerCase());
    case 'startswith':
      return text.toLowerCase().startsWith(String(expected).toLowerCase());
    case 'endswith':
      return text.toLowerCase().endsWith(String(expected).toLowerCase());
    case 'set':
      return isSet(raw);
    case 'notset':
      return !isSet(raw);
    case 'between': {
      if (!isSet(actual) || !Array.isArray(expected)) return false;
      const [low, high] = expected as (number | string)[];
      return (actual as number | string) >= low && (actual as number | string) <= high;
    }
    case 'within':
      return within(values, raw, expected);
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Whether a place is inside an area, as a map's "In this area" and an area
 * drawn on it ask: a box ({ south, west, north, east }, a west beyond its east
 * crossing the antimeridian, as a map over the Pacific does), a polygon
 * ({ polygon: [[longitude, latitude], …] }) or a circle ({ center: [longitude,
 * latitude], radius } in metres). The place is the condition's field: a
 * GeoJSON point (or a Feature holding one); or, when `longitude` names another
 * field, a latitude and that field's longitude.
 */
function within(values: Values, raw: unknown, area: JsonValue): boolean {
  if (!isObject(area)) return false;
  const place = placeOf(values, raw, area['longitude']);
  if (!place) return false;
  const { lat, lng } = place;
  if (Array.isArray(area['polygon'])) return insideRing(lng, lat, area['polygon'] as number[][]);
  if (Array.isArray(area['center'])) {
    const [centreLng, centreLat] = area['center'] as number[];
    return metresApart(lat, lng, centreLat, centreLng) <= (area['radius'] as number);
  }
  const { south, west, north, east } = area as Record<string, number>;
  if (lat < south || lat > north) return false;
  return west <= east ? lng >= west && lng <= east : lng >= west || lng <= east;
}

/** A record's place: a GeoJSON point (or a Feature holding one) in `raw`, or `raw` a latitude and `longitude` the field of its pair. */
function placeOf(values: Values, raw: unknown, longitude: unknown): { lat: number; lng: number } | null {
  let lat: unknown;
  let lng: unknown;
  if (typeof longitude === 'string') {
    lat = raw;
    lng = values[longitude];
  } else {
    const geometry = isObject(raw) && raw['type'] === 'Feature' ? raw['geometry'] : raw;
    const coordinates = isObject(geometry) && geometry['type'] === 'Point' ? geometry['coordinates'] : null;
    if (!Array.isArray(coordinates)) return null;
    [lng, lat] = coordinates;
  }
  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
}

/** How far a record's place in `field` is from `near`, in metres, for "Nearest first"; null when it has none. */
export function distanceFrom(values: Values, field: string, near: { lat: number; lng: number; longitude?: string }): number | null {
  const place = placeOf(values, values[field], near.longitude);
  return place ? metresApart(place.lat, place.lng, near.lat, near.lng) : null;
}

/** Inside a ring when a line from the point crosses its edges an odd number of times. */
function insideRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** How far apart two places are on the earth, in metres. */
function metresApart(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** What a condition left out stands for: it always holds. */
const ALWAYS = null;

/**
 * A filter as a search or a list receives it: each `valueFrom` — a field, or a
 * path such as `parent.company_id` or `user.id` — replaced by its value in
 * `context`. A `=?` whose value is empty is left out, and so is a group it
 * makes always hold: an `any` group with one item always holding, an `all`
 * group left with none. A `=?` with a value goes as `=`, so a data source
 * never sees `=?`.
 */
export function resolveFilter(items: readonly FilterItem[], context: Readonly<Record<string, unknown>>): ResolvedFilter[] {
  const resolve = (item: FilterItem): ResolvedFilter | typeof ALWAYS => {
    if ('any' in item) {
      const inner = item.any.map(resolve);
      return inner.includes(ALWAYS) ? ALWAYS : { any: inner as ResolvedFilter[] };
    }
    if ('all' in item) {
      const inner = item.all.map(resolve).filter((r): r is ResolvedFilter => r !== ALWAYS);
      return inner.length ? { all: inner } : ALWAYS;
    }
    const value = (item.valueFrom !== undefined ? valueAt(context, item.valueFrom) : (item.value ?? null)) as JsonValue;
    if (item.op === '=?') return isSet(value) ? { field: item.field, op: '=', value } : ALWAYS;
    return { field: item.field, op: item.op, value };
  };
  return items.map(resolve).filter((r): r is ResolvedFilter => r !== ALWAYS);
}

function valueAt(context: Readonly<Record<string, unknown>>, path: string): unknown {
  let at: unknown = context;
  for (const part of path.split('.')) at = at === null || typeof at !== 'object' ? undefined : (at as Record<string, unknown>)[part];
  return at ?? null;
}
