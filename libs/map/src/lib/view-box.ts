import type { ListMap, ResolvedFilter } from '@fieldia/core';

/**
 * A map's view as a search sees it: its edges in degrees, and the
 * conditions "Search this area" asks for its records with.
 */

/** A view's edges: west east of east when it spans the antimeridian, -180 and 180 when it is the whole world round. */
export interface Box {
  south: number;
  west: number;
  north: number;
  east: number;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const wrap = (lng: number) => round(((((lng + 180) % 360) + 360) % 360) - 180);
/** Whether a box is the whole world round. */
export const whole = (box: Box) => box.east - box.west >= 360;

/** A view's box from its edges as the map has them: rounded to a millionth, its longitudes brought round into -180…180. */
export function boxOf(south: number, west: number, north: number, east: number): Box {
  const all = east - west >= 360;
  return { south: round(Math.max(-90, south)), west: all ? -180 : wrap(west), north: round(Math.min(90, north)), east: all ? 180 : wrap(east) };
}

/** The conditions that keep a box's records: between a latitude's and a longitude's edges, or within it on a point. */
export function boxFilter(spec: ListMap, box: Box): ResolvedFilter[] {
  if (spec.point) return [{ field: spec.point, op: 'within', value: { ...box } }];
  const lng = spec.longitude as string;
  return [
    { field: spec.latitude as string, op: 'between', value: [box.south, box.north] },
    // Over the antimeridian no one range holds the longitudes: either side of it, then.
    ...(whole(box)
      ? []
      : box.west <= box.east
        ? [{ field: lng, op: 'between' as const, value: [box.west, box.east] }]
        : [{ any: [{ field: lng, op: '>=' as const, value: box.west }, { field: lng, op: '<=' as const, value: box.east }] }]),
  ];
}
