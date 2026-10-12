/**
 * Pins that crowd, gathered: each point in turn takes every point not yet
 * gathered within `radius` pixels of it. A bubble stands in the middle of
 * its points, so two bubbles' middles can fall near each other: those are
 * gathered again, until no two lie nearer than `radius`. Points are looked
 * up in a grid of `radius` squares, nine squares around each: thousands in a
 * few milliseconds. A point that `leads` (a place that moves, on a form's
 * map) keeps its own spot: a group with one stands where it stands, not in
 * the middle, and is gathered again from there; put it first, so the points
 * round it gather to it. Returns the groups as indexes into `points`, each in
 * order.
 */
export function clusterPoints(points: readonly { x: number; y: number; leads?: boolean }[], radius: number): number[][] {
  let groups = gather(points, radius);
  for (;;) {
    const middles = groups.map((group) => {
      const lead = group.find((i) => points[i].leads);
      return lead === undefined
        ? { x: group.reduce((sum, i) => sum + points[i].x, 0) / group.length, y: group.reduce((sum, i) => sum + points[i].y, 0) / group.length }
        : points[lead];
    });
    const merged = gather(middles, radius);
    if (merged.length === groups.length) return groups;
    groups = merged.map((parts) => parts.flatMap((part) => groups[part]).sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);
  }
}

/** One pass: each point in turn takes every point not yet taken within `radius` of it. */
function gather(points: readonly { x: number; y: number }[], radius: number): number[][] {
  const cell = (n: number) => Math.floor(n / radius);
  const grid = new Map<string, number[]>();
  points.forEach((p, i) => {
    const key = `${cell(p.x)}:${cell(p.y)}`;
    const list = grid.get(key);
    if (list) list.push(i);
    else grid.set(key, [i]);
  });
  const taken = new Uint8Array(points.length);
  const groups: number[][] = [];
  points.forEach((p, i) => {
    if (taken[i]) return;
    taken[i] = 1;
    const group = [i];
    const cx = cell(p.x);
    const cy = cell(p.y);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (taken[j] || Math.hypot(points[j].x - p.x, points[j].y - p.y) > radius) continue;
          taken[j] = 1;
          group.push(j);
        }
      }
    }
    groups.push(group.sort((a, b) => a - b));
  });
  return groups;
}
