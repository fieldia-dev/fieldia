import { metresBetween } from './geo';
import { nearestOnLine, pointAlong, routeLine, splitLine } from './route-line';

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
