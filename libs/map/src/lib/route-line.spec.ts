import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { metresBetween } from './geo';
import { leftRoute, nearestOnLine, pointAlong, routeLine, splitLine } from './route-line';
import { decodePolyline } from './routes';

/** An L along Cairo's streets: east about 960 m, then north about 1.1 km. */
const L_SHAPE = [
  { lat: 30.04, lng: 31.23 },
  { lat: 30.04, lng: 31.24 },
  { lat: 30.05, lng: 31.24 },
];

describe('a route’s line as a traveller moves along it', () => {
  const route = routeLine(L_SHAPE);

  it('knows how far along each point lies', () => {
    expect(route.along[0]).toBe(0);
    expect(route.along[1]).toBeCloseTo(963, -1);
    expect(route.metres).toBeCloseTo(963 + 1112, -1);
  });

  it('finds the nearest point of the line, how far along it, and how far off it a place is', () => {
    // 50 m south of the first leg's middle.
    const on = nearestOnLine(route, { lat: 30.04 - 0.00045, lng: 31.235 });
    expect(on.index).toBe(0);
    expect(on.at.lat).toBeCloseTo(30.04, 6);
    expect(on.at.lng).toBeCloseTo(31.235, 6);
    expect(on.along).toBeCloseTo(963 / 2, -1);
    expect(on.off).toBeCloseTo(50, 0);
    // Up the second leg.
    const up = nearestOnLine(route, { lat: 30.045, lng: 31.2401 });
    expect(up.index).toBe(1);
    expect(up.along).toBeCloseTo(963 + 556, -1);
    expect(up.off).toBeLessThan(15);
    // Before the start: the start itself.
    expect(nearestOnLine(route, { lat: 30.04, lng: 31.22 }).along).toBe(0);
  });

  it('splits the line where the traveller is: the part behind and the part ahead meet there', () => {
    const on = nearestOnLine(route, { lat: 30.045, lng: 31.24 });
    const { done, left } = splitLine(route, on);
    expect(done).toEqual([L_SHAPE[0], L_SHAPE[1], on.at]);
    expect(left).toEqual([on.at, L_SHAPE[2]]);
  });

  it('gives the point a distance along the line, and its ends past them', () => {
    const middle = pointAlong(route, 963 / 2);
    expect(middle.lat).toBeCloseTo(30.04, 6);
    expect(middle.lng).toBeCloseTo(31.235, 4);
    expect(metresBetween(pointAlong(route, 963 + 556), { lat: 30.045, lng: 31.24 })).toBeLessThan(5);
    expect(pointAlong(route, -10)).toEqual(L_SHAPE[0]);
    expect(pointAlong(route, 1e6)).toEqual(L_SHAPE[2]);
  });
});

describe('a traveller off their route', () => {
  /** Google's route by car from Cairo airport to Tahrir, as it answered on 12 Oct 2026: it starts on the road, 81 m from the point asked from. */
  const answer = JSON.parse(readFileSync(join(__dirname, 'fixtures/google-routes-live.json'), 'utf8'))['car-airport-tahrir'];
  const asked = { lat: answer.request.origin.location.latLng.latitude, lng: answer.request.origin.location.latLng.longitude };
  const route = routeLine(decodePolyline(answer.body.routes[0].polyline.encodedPolyline));

  it('has not left a route asked from beside the road, standing there, or wandering a little', () => {
    expect(nearestOnLine(route, asked).off).toBeCloseTo(81, -1);
    expect(leftRoute(route, asked, asked)).toBe(false);
    // 30 m off, as a phone's fix wanders.
    expect(leftRoute(route, { lat: asked.lat + 0.00027, lng: asked.lng }, asked)).toBe(false);
  });

  it('has left it, away from its line and from where it was asked', () => {
    // 300 m east, further from the road.
    expect(leftRoute(route, { lat: asked.lat, lng: asked.lng + 0.003 }, asked)).toBe(true);
    // On the road, a kilometre on: still on it.
    expect(leftRoute(route, route.line[Math.floor(route.line.length / 10)], asked)).toBe(false);
    // With no point asked from, by its line alone.
    expect(leftRoute(route, asked, undefined)).toBe(true);
  });
});
