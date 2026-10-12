import { clusterPoints } from './cluster';

describe('pins that crowd become one bubble', () => {
  it('gathers points nearer than the radius, and leaves the rest alone', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 30, y: 0 },
      { x: 200, y: 200 },
    ];
    expect(clusterPoints(points, 40)).toEqual([[0, 1, 2], [3]]);
    expect(clusterPoints(points, 8)).toEqual([[0], [1], [2], [3]]);
  });

  it('gathers across the lines of its own grid: two points a pixel apart are one bubble wherever they fall', () => {
    expect(clusterPoints([{ x: 39.5, y: 39.5 }, { x: 40.5, y: 40.5 }], 40)).toEqual([[0, 1]]);
    expect(clusterPoints([{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }], 40)).toEqual([[0, 1]]);
  });

  it('merges bubbles whose middles fall nearer than the radius: no bubble lies on another', () => {
    // 0 takes 47; 49 is out of 0's reach and starts its own; their middles, 23.5 and 49, would overlap.
    expect(clusterPoints([{ x: 0, y: 0 }, { x: 47, y: 0 }, { x: 49, y: 0 }], 48)).toEqual([[0, 1, 2]]);
    const points = Array.from({ length: 3000 }, (_, i) => ({ x: (i * 7919) % 900, y: (i * 104729) % 600 }));
    const groups = clusterPoints(points, 48);
    const middles = groups.map((g) => ({ x: g.reduce((s, i) => s + points[i].x, 0) / g.length, y: g.reduce((s, i) => s + points[i].y, 0) / g.length }));
    for (let a = 0; a < middles.length; a++) for (let b = a + 1; b < middles.length; b++) expect(Math.hypot(middles[a].x - middles[b].x, middles[a].y - middles[b].y)).toBeGreaterThan(48);
  });

  it('stands a group with a leading point where that point is: the points round it gather to it, and other groups keep clear of it', () => {
    // A courier first, a kitchen a few pixels off, a door further on.
    expect(clusterPoints([{ x: 100, y: 100, leads: true }, { x: 110, y: 104 }, { x: 300, y: 300 }], 48)).toEqual([[0, 1], [2]]);
    // A kitchen 40 pixels from the courier, a stop 60: the courier's group stands on the courier, 60 from the stop, so the stop stays its own.
    // Stood in the middle, 20 off, it would have taken the stop too.
    const points = [{ x: 0, y: 0, leads: true }, { x: 40, y: 0 }, { x: 60, y: 0 }];
    expect(clusterPoints(points, 48)).toEqual([[0, 1], [2]]);
    expect(clusterPoints(points.map(({ x, y }) => ({ x, y })), 48)).toEqual([[0, 1, 2]]);
    // Apart, a leading point is a group of its own.
    expect(clusterPoints([{ x: 0, y: 0, leads: true }, { x: 100, y: 0 }], 48)).toEqual([[0], [1]]);
  });

  it('keeps every point exactly once, and the same points give the same bubbles', () => {
    const points = Array.from({ length: 2000 }, (_, i) => ({ x: (i * 7919) % 1000, y: (i * 104729) % 700 }));
    const groups = clusterPoints(points, 50);
    const seen = groups.flat().sort((a, b) => a - b);
    expect(seen).toEqual(points.map((_, i) => i));
    expect(clusterPoints(points, 50)).toEqual(groups);
    expect(groups.length).toBeLessThan(points.length / 4);
  });

  it('does a city’s worth quickly', () => {
    const points = Array.from({ length: 5000 }, (_, i) => ({ x: (i * 7919) % 4000, y: (i * 104729) % 3000 }));
    const started = performance.now();
    clusterPoints(points, 44);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
