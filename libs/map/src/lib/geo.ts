import { foldTyped, readNumber, stripMarks, type JsonValue } from '@fieldia/core';

/**
 * Places and areas as a form keeps them: GeoJSON (RFC 7946), longitude
 * first, so any backend or map library reads them as they are. A place is a
 * Point. An area is a Feature whose `properties.shape` says how it was drawn,
 * so it comes back as the same shape with the same grips: a polygon, a box
 * (a polygon of four corners), or a circle (its centre as a Point and its
 * `radius` in metres, since GeoJSON has no circle).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export type Shape = 'polygon' | 'box' | 'circle';

export type Area =
  | { shape: 'polygon' | 'box'; points: LatLng[] }
  | { shape: 'circle'; center: LatLng; radius: number };

export type PointsArea = Extract<Area, { points: LatLng[] }>;
export type CircleArea = Extract<Area, { shape: 'circle' }>;

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface PointGeometry {
  type: 'Point';
  coordinates: [number, number];
}

export interface AreaFeature {
  type: 'Feature';
  properties: { shape: Shape; radius?: number };
  geometry: PointGeometry | { type: 'Polygon'; coordinates: [number, number][][] };
}

/** The earth's mean radius, in metres: the one GeoJSON's distances are usually worked out with. */
const EARTH = 6371008.8;
const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;
/** Six decimals: about 11 cm on the ground, finer than any finger. */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export const isLatLng = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

type Json = { [key: string]: unknown };
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A place's value: a GeoJSON Point, to six decimals — or, `exact`, as its coordinates are (typed, they keep their places). */
export function writePoint(point: LatLng, exact = false): PointGeometry {
  return { type: 'Point', coordinates: exact ? [point.lng, point.lat] : [round6(point.lng), round6(point.lat)] };
}

function geometryOf(value: unknown): Json | null {
  if (!isObject(value)) return null;
  if (value['type'] === 'Feature') return isObject(value['geometry']) ? value['geometry'] : null;
  return value;
}

function latLngOf(position: unknown): LatLng | null {
  if (!Array.isArray(position)) return null;
  const [lng, lat] = position;
  return isLatLng(lat, lng) ? { lat: lat as number, lng: lng as number } : null;
}

/** The place a value holds: a Point, or a Feature holding one; anything else is no place. */
export function readPoint(value: unknown): LatLng | null {
  const geometry = geometryOf(value);
  return geometry?.['type'] === 'Point' ? latLngOf(geometry['coordinates']) : null;
}

/** The signed area of a ring in degrees: above zero when it runs counter-clockwise. */
function signedArea(points: LatLng[]): number {
  let sum = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    sum += p.lng * q.lat - q.lng * p.lat;
  });
  return sum / 2;
}

/** An area's value: a GeoJSON Feature, its ring closed and counter-clockwise as RFC 7946 asks. */
export function writeArea(area: Area): AreaFeature {
  if (area.shape === 'circle') {
    return { type: 'Feature', properties: { shape: 'circle', radius: Math.round(area.radius) }, geometry: writePoint(area.center) };
  }
  const [first, ...rest] = area.points;
  const ring = signedArea(area.points) < 0 ? [first, ...rest.reverse()] : area.points;
  const coordinates = [...ring, ring[0]].map((p) => [round6(p.lng), round6(p.lat)] as [number, number]);
  return { type: 'Feature', properties: { shape: area.shape }, geometry: { type: 'Polygon', coordinates: [coordinates] } };
}

/** The area a value holds, as it was drawn; a plain Polygon from elsewhere is read as a polygon. */
export function readArea(value: unknown): Area | null {
  const geometry = geometryOf(value);
  if (!geometry) return null;
  const properties = isObject(value) && value['type'] === 'Feature' && isObject(value['properties']) ? value['properties'] : {};
  if (geometry['type'] === 'Point') {
    const center = latLngOf(geometry['coordinates']);
    const radius = properties['radius'];
    return center && properties['shape'] === 'circle' && typeof radius === 'number' && radius > 0 ? { shape: 'circle', center, radius } : null;
  }
  if (geometry['type'] !== 'Polygon' || !Array.isArray(geometry['coordinates'])) return null;
  const ring = (geometry['coordinates'][0] ?? []) as unknown[];
  const points = ring.map(latLngOf);
  if (points.some((p) => p === null)) return null;
  const open = points as LatLng[];
  const last = open[open.length - 1];
  // The ring's closing point repeats its first: drawn once.
  if (open.length > 1 && last.lat === open[0].lat && last.lng === open[0].lng) open.pop();
  if (open.length < 3) return null;
  return { shape: properties['shape'] === 'box' && open.length === 4 ? 'box' : 'polygon', points: open };
}

/**
 * A coordinate as a person types or pastes it, read by Fieldia's one number reader (FIELDIA INPUT RULES): Latin,
 * Arabic-Indic and Persian digits, no direction marks, a minus (or −, or an en dash as typeset text writes one).
 * A coordinate is never grouped, so its one mark — . , ، or ٫ — is its decimal mark whatever the page's
 * language: "31,235" is 31.235. Null for nothing, or what does not read.
 */
export function parseCoordinate(text: string, locale = 'en'): number | null {
  const read = readNumber(stripMarks(text).trim().replace(/^\u2013/, '-'), locale, { ungrouped: true });
  return read.ok ? read.value : null;
}

/**
 * A place written as its pair of coordinates, latitude first — as a map's "copy coordinates", a phone's share or a
 * spreadsheet writes it: "30.0444, 31.2357", "30.0444 31.2357", "30,0444; 31,2357" — or null for anything else. Each
 * is read as one box reads it, and kept to its range.
 */
export function parseCoordinatePair(text: string, locale = 'en'): { lat: string; lng: string } | null {
  const pair = /^\s*([-\u2212\u2013]?\d+(?:[.,\u066b]\d+)?)\s*(?:[,;\u060c\t]\s*|\s+)([-\u2212\u2013]?\d+(?:[.,\u066b]\d+)?)\s*$/.exec(foldTyped(text));
  if (!pair) return null;
  const [lat, lng] = [parseCoordinate(pair[1], locale), parseCoordinate(pair[2], locale)];
  return lat !== null && lng !== null && isLatLng(lat, lng) ? { lat: pair[1], lng: pair[2] } : null;
}

/** Metres between two places on the ground (the haversine formula). */
export function metresBetween(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The place `metres` due east: where a circle's edge grip sits. */
export function offsetEast(from: LatLng, metres: number): LatLng {
  return { lat: from.lat, lng: from.lng + deg(metres / (EARTH * Math.cos(rad(from.lat)))) };
}

/** A box's four corners from two dragged to, counter-clockwise from the south-west. */
export function boxFrom(a: LatLng, b: LatLng): LatLng[] {
  const south = Math.min(a.lat, b.lat);
  const north = Math.max(a.lat, b.lat);
  const west = Math.min(a.lng, b.lng);
  const east = Math.max(a.lng, b.lng);
  return [
    { lat: south, lng: west },
    { lat: south, lng: east },
    { lat: north, lng: east },
    { lat: north, lng: west },
  ];
}

/** The same area, carried by so many degrees. */
export function moveArea(area: Area, dLat: number, dLng: number): Area {
  const move = (p: LatLng) => ({ lat: p.lat + dLat, lng: p.lng + dLng });
  return area.shape === 'circle' ? { ...area, center: move(area.center) } : { ...area, points: area.points.map(move) };
}

/** The smallest box an area fits in. */
export function areaBounds(area: Area): Bounds {
  const points =
    area.shape === 'circle'
      ? [
          { lat: area.center.lat + deg(area.radius / EARTH), lng: offsetEast(area.center, area.radius).lng },
          { lat: area.center.lat - deg(area.radius / EARTH), lng: 2 * area.center.lng - offsetEast(area.center, area.radius).lng },
        ]
      : area.points;
  return {
    south: Math.min(...points.map((p) => p.lat)),
    west: Math.min(...points.map((p) => p.lng)),
    north: Math.max(...points.map((p) => p.lat)),
    east: Math.max(...points.map((p) => p.lng)),
  };
}

/** A value fit for a json field. */
export const asJson = (value: AreaFeature | PointGeometry): JsonValue => value as unknown as JsonValue;
