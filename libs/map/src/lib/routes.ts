import type { LatLng } from './geo';
import { getJson, pathOf, type Fetch } from './answers';
import type { RouteFound, RouteRequest } from './providers';

/**
 * The providers' routes along the roads, loaded the first time a map asks
 * for one: a form with only a place or an area never carries them. Each
 * reads its provider's answer into one line, its metres and its seconds.
 */

/** Google's encoded polyline, as its Routes API sends a line: five decimals, each number a run of five-bit groups. */
export function decodePolyline(encoded: string): LatLng[] {
  const line: LatLng[] = [];
  let at = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(at++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (at < encoded.length) {
    lat += next();
    lng += next();
    line.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return line;
}

/** A route's line from GeoJSON coordinates, longitude first: a LineString's, or a MultiLineString's joined. */
function lineOf(coordinates: unknown, multi = false): LatLng[] {
  const runs = multi ? coordinates : [coordinates];
  if (!Array.isArray(runs)) return [];
  return runs.flatMap((run) =>
    Array.isArray(run) ? run.flatMap((pair) => (Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number' ? [{ lat: pair[1] as number, lng: pair[0] as number }] : [])) : []
  );
}

/** A route that is no route: refused in words a developer can act on. */
function routed(found: RouteFound, provider: string): RouteFound {
  if (found.line.length < 2 || !Number.isFinite(found.metres) || !Number.isFinite(found.seconds)) throw new Error(`${provider} found no route`);
  return found;
}

const OSRM_PROFILE = { car: 'driving', bike: 'cycling', foot: 'walking' } as const;

/** OSRM's route: the points longitude first, by its profile. */
export async function osrmRoute(fetchWith: Fetch, osrm: string, { points, mode, signal }: RouteRequest): Promise<RouteFound> {
  const found = await getJson(fetchWith, `${osrm}/route/v1/${OSRM_PROFILE[mode]}/${points.map((p) => `${p.lng},${p.lat}`).join(';')}?overview=full&geometries=geojson`, { signal });
  const route = (pathOf(found, 'routes') as unknown[] | undefined)?.[0];
  return routed({ line: lineOf(pathOf(route, 'geometry', 'coordinates')), metres: Number(pathOf(route, 'distance')), seconds: Number(pathOf(route, 'duration')) }, 'OSRM');
}

/** Azure Maps' Route Directions of 2025: a GeoJSON of the points in order, its route path asked for; by car or on foot. */
export async function azureRoute(ask: { fetchWith: Fetch; auth: string; headers: () => Promise<Record<string, string>> }, { points, mode, signal }: RouteRequest): Promise<RouteFound> {
  // Its route service drives and walks; it has no bicycles.
  if (mode === 'bike') throw new Error('Azure Maps finds routes by car or on foot, not by bike');
  const found = await getJson(ask.fetchWith, `https://atlas.microsoft.com/route/directions?api-version=2025-01-01${ask.auth}`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/geo+json', ...(await ask.headers()) },
    body: JSON.stringify({
      type: 'FeatureCollection',
      features: points.map((p, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        // Its first and last are where it starts and ends; those between, passed through.
        properties: { pointIndex: i, pointType: i === 0 || i === points.length - 1 ? 'waypoint' : 'viaWaypoint' },
      })),
      travelMode: mode === 'foot' ? 'walking' : 'driving',
      routeOutputOptions: ['routePath'],
    }),
  });
  const features = pathOf(found, 'features');
  const path = Array.isArray(features) ? features.find((f) => pathOf(f, 'properties', 'type') === 'RoutePath') : undefined;
  // The time with traffic, when it gives one.
  const seconds = pathOf(path, 'properties', 'durationTrafficInSeconds') ?? pathOf(path, 'properties', 'durationInSeconds');
  return routed({ line: lineOf(pathOf(path, 'geometry', 'coordinates'), true), metres: Number(pathOf(path, 'properties', 'distanceInMeters')), seconds: Number(seconds) }, 'Azure Maps');
}

/** Google's Routes API: only the fields it reads, its line an encoded polyline, traffic for a car. */
export async function googleRoute(ask: { fetchWith: Fetch; key: string }, { points, mode, signal }: RouteRequest): Promise<RouteFound> {
  const place = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const answer = await getJson(ask.fetchWith, 'https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': ask.key, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline' },
    body: JSON.stringify({
      origin: place(points[0]),
      destination: place(points[points.length - 1]),
      ...(points.length > 2 ? { intermediates: points.slice(1, -1).map(place) } : {}),
      travelMode: mode === 'bike' ? 'BICYCLE' : mode === 'foot' ? 'WALK' : 'DRIVE',
      ...(mode === 'car' ? { routingPreference: 'TRAFFIC_AWARE' } : {}),
    }),
  });
  const route = (pathOf(answer, 'routes') as unknown[] | undefined)?.[0];
  const encoded = pathOf(route, 'polyline', 'encodedPolyline');
  // Its duration is words: "489s".
  return routed({ line: typeof encoded === 'string' ? decodePolyline(encoded) : [], metres: Number(pathOf(route, 'distanceMeters')), seconds: parseFloat(String(pathOf(route, 'duration'))) }, "Google's Routes API");
}

/** Mapbox Directions: by its profile, traffic for a car. */
export async function mapboxRoute(ask: { fetchWith: Fetch; token: string }, { points, mode, signal }: RouteRequest): Promise<RouteFound> {
  const profile = mode === 'bike' ? 'cycling' : mode === 'foot' ? 'walking' : 'driving-traffic';
  const found = await getJson(ask.fetchWith, `https://api.mapbox.com/directions/v5/mapbox/${profile}/${points.map((p) => `${p.lng},${p.lat}`).join(';')}?geometries=geojson&overview=full&access_token=${ask.token}`, { signal });
  const route = (pathOf(found, 'routes') as unknown[] | undefined)?.[0];
  return routed({ line: lineOf(pathOf(route, 'geometry', 'coordinates')), metres: Number(pathOf(route, 'distance')), seconds: Number(pathOf(route, 'duration')) }, 'Mapbox');
}
