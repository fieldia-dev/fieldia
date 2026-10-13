import { metresBetween, type LatLng } from './geo';

/**
 * A route's line as a traveller moves along it: how far along each of its
 * points lies, where on it a place is nearest (and how far off it), the part
 * travelled and the part left, and the point a distance along — for the
 * faded part behind a courier, the time and distance left, a pin gliding
 * along the road, and a new route once the courier leaves this one.
 */

export interface RouteLine {
  line: LatLng[];
  /** How far along each point lies, in metres from the start. */
  along: number[];
  metres: number;
}

export interface OnLine {
  /** The segment it falls on: from `line[index]` to `line[index + 1]`. */
  index: number;
  /** The point on the line nearest the place. */
  at: LatLng;
  /** How far along the line that is, in metres. */
  along: number;
  /** How far the place is from the line, in metres. */
  off: number;
}

export function routeLine(line: LatLng[]): RouteLine {
  const along = [0];
  for (let i = 1; i < line.length; i++) along.push(along[i - 1] + metresBetween(line[i - 1], line[i]));
  return { line, along, metres: along[along.length - 1] ?? 0 };
}

/** The nearest point of the line to a place: each segment measured flat around the place, as a few hundred metres are. */
export function nearestOnLine(route: RouteLine, place: LatLng): OnLine {
  const { line, along } = route;
  if (line.length === 1) return { index: 0, at: line[0], along: 0, off: metresBetween(line[0], place) };
  const scale = Math.cos((place.lat * Math.PI) / 180);
  let best: OnLine = { index: 0, at: line[0], along: 0, off: Infinity };
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = (b.lng - a.lng) * scale;
    const dy = b.lat - a.lat;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, (((place.lng - a.lng) * scale) * dx + (place.lat - a.lat) * dy) / length)) : 0;
    const at = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
    const off = metresBetween(at, place);
    if (off < best.off) best = { index: i, at, along: along[i] + (along[i + 1] - along[i]) * t, off };
  }
  return best;
}

/** The line in two at a point on it: the part travelled, and the part left, each starting or ending there. */
export function splitLine(route: RouteLine, on: OnLine): { done: LatLng[]; left: LatLng[] } {
  const { line } = route;
  return { done: [...line.slice(0, on.index + 1), on.at], left: [on.at, ...line.slice(on.index + 1)] };
}

/** The point `metres` along the line, the ends where it runs past them. */
export function pointAlong(route: RouteLine, metres: number): LatLng {
  const { line, along } = route;
  if (metres <= 0) return line[0];
  if (metres >= route.metres) return line[line.length - 1];
  let i = 1;
  while (along[i] < metres) i++;
  const t = (metres - along[i - 1]) / (along[i] - along[i - 1] || 1);
  return { lat: line[i - 1].lat + (line[i].lat - line[i - 1].lat) * t, lng: line[i - 1].lng + (line[i].lng - line[i - 1].lng) * t };
}

/** A traveller this far from their route, in metres, has left it. */
export const OFF_ROUTE_M = 60;

/**
 * Whether a traveller has left their route: away from its line, and away
 * from where it was asked from. A route starts on the road, tens of metres
 * from a traveller beside it (81 m from a point at Cairo airport, in
 * Google's), so one standing where it was asked has not left it.
 */
export function leftRoute(route: RouteLine, at: LatLng, askedFrom: LatLng | undefined): boolean {
  return nearestOnLine(route, at).off > OFF_ROUTE_M && (!askedFrom || metresBetween(at, askedFrom) > OFF_ROUTE_M);
}
