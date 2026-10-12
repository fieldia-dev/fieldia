import type { ListMap, ResolvedFilter } from '@fieldia/core';
import type { LatLng } from './geo';
import { boxFilter, whole, type Box } from './view-box';

/**
 * How many records a list map's view holds, said on "Search this area"
 * before it is pressed: counted among the records on hand when they can
 * tell, asked otherwise. Its code comes the first time the button shows.
 */

/** Whether a place lies in a box, its edges included, as `between` takes them. */
export function inBox(at: LatLng, box: Box): boolean {
  if (at.lat < box.south || at.lat > box.north) return false;
  return box.west <= box.east ? at.lng >= box.west && at.lng <= box.east : at.lng >= box.west || at.lng <= box.east;
}

/** Whether one box lies within another. */
export function boxWithin(inner: Box, outer: Box): boolean {
  if (inner.south < outer.south || inner.north > outer.north) return false;
  if (whole(outer)) return true;
  // Each as a stretch eastwards from its west edge; the inner one a world further round, if that is where it fits.
  const span = (box: Box) => [box.west, box.east < box.west ? box.east + 360 : box.east];
  const [w, e] = span(outer);
  const [iw, ie] = span(inner);
  return [0, 360].some((by) => iw + by >= w && ie + by <= e);
}

/**
 * The view a search already holds, as the map's "Search this area" puts it
 * (its very conditions, found among the search's), and the search's other
 * conditions: a new view takes its place, as a search bar keeps one.
 */
export function ownBox(spec: ListMap, filter: readonly ResolvedFilter[]): { box: Box; rest: ResolvedFilter[] } | null {
  const said = filter.map((item) => JSON.stringify(item));
  const numbers = (value: unknown) => (Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === 'number') ? (value as [number, number]) : null);
  const boxes: Box[] = [];
  for (const item of filter) {
    if ('any' in item || 'all' in item) continue;
    const v = item.value as Record<string, unknown> | null;
    if (spec.point) {
      if (item.field === spec.point && item.op === 'within' && v && ['south', 'west', 'north', 'east'].every((k) => typeof v[k] === 'number')) boxes.push(v as unknown as Box);
      continue;
    }
    const lat = item.field === spec.latitude && item.op === 'between' ? numbers(v) : null;
    if (!lat) continue;
    // Its longitudes: a range, either side of the antimeridian, or (tried last) the world round.
    const sides: [number, number][] = [];
    for (const other of filter) {
      if ('any' in other && other.any.length === 2) {
        const [a, b] = other.any as { field?: string; op?: string; value?: unknown }[];
        if (a.field === spec.longitude && b.field === spec.longitude && typeof a.value === 'number' && typeof b.value === 'number') sides.push([a.value, b.value]);
      } else if (!('all' in other) && !('any' in other) && other.field === spec.longitude && other.op === 'between' && numbers(other.value)) sides.push(numbers(other.value) as [number, number]);
    }
    for (const [west, east] of [...sides, [-180, 180]]) boxes.push({ south: lat[0], west, north: lat[1], east });
  }
  for (const box of boxes) {
    const own = boxFilter(spec, box).map((item) => JSON.stringify(item));
    if (!own.every((item) => said.includes(item))) continue;
    return { box: { ...box }, rest: filter.filter((_, i) => !own.includes(said[i])) };
  }
  return null;
}

/**
 * One question at a time, the last one winning: each ask waits `wait`
 * milliseconds (a run of moves asks once), aborts the one before it, and an
 * answer that comes after a newer ask is dropped. A refusal says nothing.
 */
export function lastAsk<T>(wait: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let asking: AbortController | null = null;
  let asked = 0;
  const stop = () => {
    clearTimeout(timer);
    asking?.abort();
    asking = null;
    asked++;
  };
  return {
    ask(question: (signal: AbortSignal) => Promise<T>, answer: (value: T) => void) {
      stop();
      const mine = asked;
      timer = setTimeout(() => {
        const controller = (asking = new AbortController());
        question(controller.signal).then(
          (value) => mine === asked && !controller.signal.aborted && answer(value),
          () => undefined
        );
      }, wait);
    },
    stop,
  };
}

/** What the map has on hand: the search its records were found by, whether they are all it finds, and where each is. */
export interface OnHand {
  filter: readonly ResolvedFilter[];
  all: boolean;
  places: readonly (LatLng | null)[];
}

/**
 * The count for a view: the records on hand say it when they are all the
 * search finds and the view lies within any area it already holds;
 * otherwise `ask` (the app's count, or its source's) is asked, for the
 * search with the view in the area's place, a moment after the map stops;
 * otherwise there is no number.
 */
export function areaCounter(spec: ListMap, ask: ((filter: ResolvedFilter[], signal: AbortSignal) => Promise<number>) | null, say: (n: number) => void) {
  const asker = lastAsk<number>(400);
  return {
    count(view: Box, shown: OnHand) {
      asker.stop();
      const own = ownBox(spec, shown.filter);
      if (shown.all && (!own || boxWithin(view, own.box))) return say(shown.places.filter((at) => at && inBox(at, view)).length);
      if (ask) asker.ask((signal) => ask([...(own ? own.rest : shown.filter), ...boxFilter(spec, view)], signal), say);
    },
    stop: asker.stop,
  };
}
