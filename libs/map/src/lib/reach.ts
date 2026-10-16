import type * as Leaflet from 'leaflet';
import type { ActionStep, MapNode, Values } from '@fieldia/core';
import { metresBetween, readArea, type Area, type LatLng } from './geo';
import type { LeafletModule } from './leaflet';
import { warnOnce } from './map-core';
import type { ReachFinder, ReachFound } from './providers';

/**
 * A form's map's areas that follow its places: the area within some minutes
 * of a place, asked of the map's provider (or the app) and asked again once
 * the place has moved far enough; and its fences, the areas fields hold drawn
 * faintly, each fence's steps run when the place it watches goes into its
 * area or comes out of it — never at first sight, when it was there already.
 * Loaded with the first map that has either.
 */

/** A reachable area is asked for again once its place has moved this far, in metres, and at most this often. */
const REACH_MOVE_M = 250;
const REACH_EVERY_MS = 10_000;

interface ReachState {
  asking: number;
  at?: LatLng;
  askedAt: number;
  found?: ReachFound;
  drawn?: Leaflet.Polygon;
  abort?: AbortController;
}

/** Whether a place is inside a ring of places: a line from it crosses the ring's edges an odd number of times. */
export function insideRing(at: LatLng, ring: readonly LatLng[]): boolean {
  let odd = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[i], ring[j]];
    if (a.lat > at.lat !== b.lat > at.lat && at.lng < ((b.lng - a.lng) * (at.lat - a.lat)) / (b.lat - a.lat) + a.lng) odd = !odd;
  }
  return odd;
}

/** Whether a place is inside an area as an area field keeps it: within a circle's radius, or inside a polygon or a box. */
export function insideArea(at: LatLng, area: Area): boolean {
  return area.shape === 'circle' ? metresBetween(area.center, at) <= area.radius : insideRing(at, area.points);
}

export interface FormAreas {
  /** The record and its places as they are now: areas asked for and drawn, fences crossed. */
  update(values: Values, positionOf: (layerId: string) => LatLng | null, hidden: (layerId: string) => boolean): void;
  destroy(): void;
}

export function formAreas(options: {
  node: MapNode;
  map: Leaflet.Map;
  L: LeafletModule;
  finder: ReachFinder | undefined;
  /** Who works the areas out, for the developer's words when nothing does. */
  provider: string;
  run(steps: ActionStep[]): void;
  /** An area was found: its places, for the map to fit them the first time. */
  found(first: boolean, places: LatLng[]): void;
  /** The record shown now, as the form tells it (`form.recordShown`): an area found for another is laid on none, and fences start again on each. */
  shown?(): () => boolean;
}): FormAreas {
  const { node, map, L } = options;
  const reaches = new Map<string, ReachState>();
  /** Whether each fence's place was inside its area when last seen. */
  const insideNow = new Map<number, boolean>();
  const fenceShapes = new Map<string, { drawn: string; path: Leaflet.Path }>();
  let gone = false;
  let last: Parameters<FormAreas['update']> | null = null;
  /** The record the fences watch: another shown, nothing seen on the last one is in or out on it. */
  let record = options.shown?.();
  // Their own pane: over areas by colour, under routes and pins.
  if (!map.getPane('fd-reach')) map.createPane('fd-reach').style.zIndex = '390';

  function drawReaches(positionOf: (id: string) => LatLng | null, hidden: (id: string) => boolean) {
    for (const layer of node.layers) {
      const spec = layer.reachable;
      if (!spec) continue;
      let state = reaches.get(layer.id);
      if (!state) reaches.set(layer.id, (state = { asking: 0, askedAt: 0 }));
      const from = positionOf(spec.from);
      if (!from || hidden(layer.id)) {
        state.drawn?.remove();
        state.drawn = undefined;
        continue;
      }
      const moved = !state.at || (metresBetween(state.at, from) > REACH_MOVE_M && Date.now() - state.askedAt > REACH_EVERY_MS);
      if (moved) ask(layer.id, state, from, spec.minutes, spec.mode ?? 'car');
      if (state.found && !state.drawn) {
        state.drawn = L.polygon(state.found.rings.map((ring) => ring.map((p) => [p.lat, p.lng] as [number, number])), { className: 'fd-map-reach', pane: 'fd-reach', interactive: false }).addTo(map);
      }
    }
  }

  function ask(id: string, state: ReachState, at: LatLng, minutes: number, mode: 'car' | 'bike' | 'foot') {
    state.at = at;
    state.askedAt = Date.now();
    if (!options.finder) {
      warnOnce(`The map's provider (${options.provider}) works out no reachable areas: give the maps a reach function of the app's own, or use Azure Maps or Mapbox.`);
      return;
    }
    state.abort?.abort();
    const abort = new AbortController();
    state.abort = abort;
    const asked = ++state.asking;
    const shown = options.shown?.();
    options.finder({ at, minutes, mode, signal: abort.signal }).then(
      (found) => {
        if (gone || asked !== state.asking) return;
        // Found round a record no longer shown: asked again for the one shown, at its next look.
        if (shown && !shown()) {
          state.at = undefined;
          return;
        }
        const first = !state.found;
        state.found = found;
        state.drawn?.remove();
        state.drawn = undefined;
        if (last) areas.update(...last);
        options.found(first, found.rings.flat());
      },
      (error) => {
        if (gone || abort.signal.aborted) return;
        warnOnce(`The reachable area "${id}" was not found: ${error instanceof Error ? error.message : String(error)}`);
      }
    );
  }

  /** The areas fields hold that fences watch, drawn faintly so the person sees where steps will run. */
  function drawFenceAreas(values: Values) {
    for (const name of new Set((node.fences ?? []).flatMap((fence) => (fence.area !== undefined ? [fence.area] : [])))) {
      const area = readArea(values[name]);
      const drawn = JSON.stringify(area);
      const had = fenceShapes.get(name);
      if (had?.drawn === drawn) continue;
      had?.path.remove();
      fenceShapes.delete(name);
      if (!area) continue;
      const style = { className: 'fd-map-fence', pane: 'fd-reach', interactive: false };
      const path = area.shape === 'circle' ? L.circle([area.center.lat, area.center.lng], { ...style, radius: area.radius }) : L.polygon(area.points.map((p) => [p.lat, p.lng] as [number, number]), style);
      fenceShapes.set(name, { drawn, path: path.addTo(map) });
    }
  }

  function checkFences(values: Values, positionOf: (id: string) => LatLng | null) {
    node.fences?.forEach((fence, i) => {
      // Where the place is going, not where its pin is gliding.
      const at = positionOf(fence.layer);
      if (!at) return;
      let inside: boolean;
      if (fence.area !== undefined) {
        const area = readArea(values[fence.area]);
        if (!area) return;
        inside = insideArea(at, area);
      } else {
        const found = reaches.get(fence.within as string)?.found;
        if (!found) return;
        inside = found.rings.some((ring) => insideRing(at, ring));
      }
      const was = insideNow.get(i);
      insideNow.set(i, inside);
      if (was === undefined || was === inside) return;
      if (inside === (fence.when === 'enter')) options.run(fence.steps);
    });
  }

  const areas: FormAreas = {
    update(values, positionOf, hidden) {
      if (gone) return;
      if (record && !record()) {
        record = options.shown?.();
        insideNow.clear();
      }
      last = [values, positionOf, hidden];
      drawReaches(positionOf, hidden);
      drawFenceAreas(values);
      checkFences(values, positionOf);
    },
    destroy() {
      gone = true;
      for (const state of reaches.values()) {
        state.abort?.abort();
        state.drawn?.remove();
      }
      for (const shape of fenceShapes.values()) shape.path.remove();
    },
  };
  return areas;
}
