import type * as Leaflet from 'leaflet';
import type { Locale, MapLayer, MapRegions, ResolvedFilter } from '@fieldia/core';
import { fill, type MapLabels } from './labels';
import type { LeafletModule } from './leaflet';
import { warnOnce, type MapBox } from './map-core';

/**
 * Areas shaded by colour on a map: districts, zones, municipalities. Their
 * borders are the app's (a GeoJSON FeatureCollection of polygons), each known
 * by one of its properties and named by another. An area's number shades it
 * in up to five steps of the page's accent, from light to strong, with a
 * legend; an area with none is outlined only. The pointer over one lights it
 * and says its name and number; a press does what the map says (search for its
 * records, or choose it). On the keyboard the areas are one stop: Tab reaches
 * the first (or the one chosen), the arrow keys go from area to area in
 * reading order, Enter or Space presses one. Loaded with the first map that
 * has them.
 */

export interface Border {
  /** Its key as text, and as the border holds it: what a record's field holds. */
  key: string;
  value: string | number;
  name: string;
  properties: Record<string, unknown>;
  /** Its polygons, each as rings of [longitude, latitude]: the outer ring, then its holes. */
  polygons: [number, number][][][];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The borders a set holds: Polygon and MultiPolygon features with a key; anything else is passed over. */
export function readBorders(collection: unknown, spec: { key: string; name?: string }): Border[] {
  const features = isObject(collection) && Array.isArray(collection['features']) ? (collection['features'] as unknown[]) : [];
  return features.flatMap((feature) => {
    if (!isObject(feature) || !isObject(feature['geometry'])) return [];
    const properties = isObject(feature['properties']) ? feature['properties'] : {};
    const key = properties[spec.key];
    if (typeof key !== 'string' && typeof key !== 'number') return [];
    if (key === '') return [];
    const geometry = feature['geometry'];
    const coordinates = geometry['coordinates'] as [number, number][][][] | [number, number][][];
    const polygons = geometry['type'] === 'Polygon' ? [coordinates as [number, number][][]] : geometry['type'] === 'MultiPolygon' ? (coordinates as [number, number][][][]) : [];
    if (!polygons.length) return [];
    const name = properties[spec.name ?? spec.key];
    return [{ key: String(key), value: key, name: String(name ?? key), properties, polygons }];
  });
}

const loaded = new WeakMap<object, Map<string, Promise<unknown>>>();
/** A set of borders the app's maps give, by name: asked for once for all the maps sharing the settings; undefined when there is no such set. */
export function loadBorders(sets: Record<string, unknown> | undefined, name: string): Promise<unknown> {
  if (!sets || !(name in sets)) return Promise.resolve(undefined);
  const mine = loaded.get(sets) ?? new Map<string, Promise<unknown>>();
  loaded.set(sets, mine);
  let found = mine.get(name);
  if (!found) {
    const given = sets[name];
    found = Promise.resolve(typeof given === 'function' ? (given as () => unknown)() : given);
    // A set that failed to load is asked for again next time.
    found.catch(() => mine.delete(name));
    mine.set(name, found);
  }
  return found;
}

/**
 * The shades' steps: up to five, each ending on a round number, so the legend
 * reads "11–20, 21–30…" rather than "9.6–19.2". They start from nothing, or
 * from a round number under the least when every number is well above
 * nothing (fees of 15 to 40 start at 10). Whole numbers (counts) step by whole
 * numbers.
 */
export function shadeSteps(values: readonly number[]): { from: number; ends: number[] } {
  const shown = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!shown.length) return { from: 0, ends: [] };
  const most = Math.max(...shown);
  const least = Math.min(...shown);
  const whole = shown.every((v) => Number.isInteger(v));
  if (whole && most <= 5) return { from: 0, ends: Array.from({ length: most }, (_, i) => i + 1) };
  const nice = (raw: number) => {
    const power = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((m) => m * power).find((m) => m >= raw) as number;
  };
  // Whole numbers' steps read "11–20": the start is under the least, so the least is in the first.
  const unit = nice((most - least) / 5 || most / 5);
  const from = least > most / 5 ? Math.floor((least - (whole ? 1 : 0)) / unit) * unit : 0;
  const step = whole ? Math.max(1, Math.ceil(nice((most - from) / 5))) : nice((most - from) / 5);
  const ends: number[] = [];
  for (let end = from + step; ends.length < 5; end += step) {
    ends.push(Number(end.toPrecision(12)));
    if (end >= most) break;
  }
  return { from: Number(from.toPrecision(12)), ends };
}

/** The shade a number falls in: 0 for the lightest, null for none. */
export function shadeOf(value: number | null | undefined, steps: readonly number[]): number | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0 || !steps.length) return null;
  const i = steps.findIndex((end) => value <= end);
  return i === -1 ? steps.length - 1 : i;
}

/** How much of the accent each shade takes, against the page's surface; spread over five steps however many there are. */
const MIX = [22, 40, 58, 76, 94];
const mixOf = (step: number, count: number) => MIX[count <= 1 ? 4 : Math.round((step * 4) / (count - 1))];

export const REGIONS_CSS = `
path.fd-map-region { stroke: var(--fd-surface); stroke-width: 1.4; stroke-opacity: 0.95; fill: var(--fd-accent); fill-opacity: 0.06; cursor: pointer; transition: fill-opacity 0.12s; }
path.fd-map-region[data-shade] { fill: var(--fd-region); fill-opacity: 0.5; }
path.fd-map-region:hover, path.fd-map-region[data-lit] { fill-opacity: 0.8; stroke: var(--fd-text); stroke-width: 2; }
path.fd-map-region[data-chosen] { stroke: var(--fd-accent); stroke-width: 3.5; stroke-opacity: 1; }
path.fd-map-region:focus { outline: none; }
/* While a way is measured or an area drawn, every press is the map's. */
.fd-map-box[data-measuring] path.fd-map-region, .fd-map-box[data-drawing] path.fd-map-region { pointer-events: none; }
path.fd-map-region:focus-visible { stroke: var(--fd-focus); stroke-width: 4; stroke-opacity: 1; }
.fd-map-box[data-plain] path.fd-map-region { cursor: default; }
.fd-map-legend {
  position: absolute; right: 8px; bottom: 26px; z-index: 1000; display: grid; gap: 3px; max-width: min(240px, 60%); padding: 6px 9px; border-radius: 6px;
  font-size: 12px; line-height: 1.35; background: color-mix(in srgb, var(--fd-surface) 94%, transparent); color: var(--fd-text); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}
.fd-map-legend[hidden] { display: none; }
.fd-map-legend-title { font-weight: 700; overflow-wrap: anywhere; }
.fd-map-legend ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.fd-map-legend li { display: flex; align-items: center; gap: 7px; font-variant-numeric: tabular-nums; }
.fd-map-legend i { width: 18px; height: 11px; flex: none; border-radius: 2px; background: var(--fd-region, transparent); border: 1px solid color-mix(in srgb, var(--fd-text) 35%, transparent); }
.fd-map-legend i[data-shade] { background: color-mix(in srgb, var(--fd-region) 50%, var(--fd-surface)); }
.fd-map-legend-bubble { margin-block-start: 4px; padding-block-start: 5px; border-block-start: 1px solid color-mix(in srgb, var(--fd-text) 15%, transparent); align-items: flex-start !important; max-width: 220px; line-height: 1.3; }
.fd-map-legend-bubble b { display: grid; place-items: center; flex: none; width: 18px; height: 18px; border-radius: 50%; background: var(--fd-accent); color: var(--fd-accent-text); font-size: 9.5px; font-weight: 700; }
.leaflet-tooltip.fd-map-tip {
  padding: 3px 8px; border: 0; border-radius: 6px; font: inherit; font-size: 12.5px; font-weight: 600; white-space: nowrap;
  background: var(--fd-surface); color: var(--fd-text); box-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
}
.leaflet-tooltip.fd-map-tip::before { display: none; }
`;

function installRegionStyles(doc: Document) {
  if (doc.getElementById('fieldia-map-region-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fieldia-map-region-styles';
  style.textContent = REGIONS_CSS;
  (doc.getElementById('fieldia-map-styles') ?? doc.head.lastElementChild)?.after(style);
  if (!style.isConnected) doc.head.append(style);
}

export interface RegionsLayer {
  /** Each area's number, by its key (null: none shaded), and the area chosen. */
  shade(values: ReadonlyMap<string, number> | null, chosen: string | null): void;
  /** The area under a place, if any: for a fence, or a record's own area. */
  at(lat: number, lng: number): Border | null;
  /** On the map or off it, as its layer's `invisible` says. */
  show(on: boolean): void;
  destroy(): void;
}

export function drawRegions(options: {
  box: MapBox;
  map: Leaflet.Map;
  L: LeafletModule;
  document: Document;
  locale: Locale;
  labels: MapLabels;
  borders: Border[];
  /** The legend's title, and the areas' name as a group: "Orders", "Districts". */
  title: string;
  legend: boolean;
  /** What a press on an area does; without it, the areas are only shown. */
  press?: (border: Border) => void;
  /** Where the map draws crowded pins as one round mark with their count: the legend's words for it, under the shades. */
  bubbles?: string;
}): RegionsLayer {
  const { box, map, L, document: doc, locale, labels, borders } = options;
  installRegionStyles(doc);
  const number = (n: number) => new Intl.NumberFormat(locale, { numberingSystem: 'latn', maximumFractionDigits: 2 }).format(n);
  // Their own pane: under a reachable area, routes and pins, over a heat map.
  const pane = map.getPane('fd-regions') ?? map.createPane('fd-regions');
  pane.style.zIndex = '370';
  // Before the pins in the page, so Tab reaches the areas first.
  map.getPane('markerPane')?.before(pane);
  const group = L.featureGroup().addTo(map);
  // Reading order: top to bottom, then from the start of the line.
  const centre = (border: Border) => {
    const ring = border.polygons[0][0];
    return { lat: ring.reduce((s, p) => s + p[1], 0) / ring.length, lng: ring.reduce((s, p) => s + p[0], 0) / ring.length };
  };
  const ordered = [...borders].sort((a, b) => {
    const [x, y] = [centre(a), centre(b)];
    return Math.abs(x.lat - y.lat) > 0.01 ? y.lat - x.lat : x.lng - y.lng;
  });
  let values: ReadonlyMap<string, number> | null = null;
  let chosen: string | null = null;
  let visible = true;
  const paths = new Map<string, Leaflet.Polygon>();
  const words = (border: Border) => {
    const value = values?.get(border.key);
    return value === undefined ? border.name : fill(labels.areaValue, { name: border.name, value: number(value) });
  };
  /** An area's words over the map: in the page's direction, its name in its own ("Zamalek" on an Arabic page), and only ever as text. */
  const tip = (border: Border) => {
    const element = doc.createElement('span');
    const page = box.element.parentElement && doc.defaultView?.getComputedStyle(box.element.parentElement).direction;
    element.dir = page === 'rtl' ? 'rtl' : 'ltr';
    const value = values?.get(border.key);
    for (const piece of (value === undefined ? '{name}' : labels.areaValue).split(/(\{name\})/)) {
      if (piece !== '{name}') element.append(fill(piece, { value: value === undefined ? '' : number(value) }));
      else {
        const name = doc.createElement('bdi');
        name.textContent = border.name;
        element.append(name);
      }
    }
    return element;
  };
  for (const border of ordered) {
    const latLngs = border.polygons.map((rings) => rings.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])));
    const path = L.polygon(latLngs, { className: 'fd-map-region', pane: 'fd-regions', interactive: true, bubblingMouseEvents: false }).addTo(group);
    path.bindTooltip(() => tip(border), { sticky: true, direction: 'top', offset: [0, -8], className: 'fd-map-tip', opacity: 1 });
    if (options.press) path.on('click', () => options.press?.(border));
    paths.set(border.key, path);
  }
  if (!options.press) box.element.toggleAttribute('data-plain', true);

  // ---- the keyboard: one stop, the arrows from area to area -----------------------------
  const elementOf = (border: Border) => paths.get(border.key)?.getElement() as SVGElement | undefined;
  let current = 0;
  function roving() {
    ordered.forEach((border, i) => {
      const element = elementOf(border);
      if (!element) return;
      element.setAttribute('tabindex', i === current ? '0' : '-1');
      element.setAttribute('role', options.press ? 'button' : 'img');
      element.setAttribute('aria-label', `${words(border)} · ${options.title}`);
      if (chosen !== null) element.setAttribute('aria-pressed', String(border.key === chosen));
    });
  }
  const keyed = (event: KeyboardEvent) => {
    const at = ordered.findIndex((border) => elementOf(border) === event.target);
    if (at === -1) return;
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (step || event.key === 'Home' || event.key === 'End') {
      // The page does not scroll; the map pans by its arrows only while it has the keys itself.
      event.preventDefault();
      current = event.key === 'Home' ? 0 : event.key === 'End' ? ordered.length - 1 : (at + step + ordered.length) % ordered.length;
      roving();
      const element = elementOf(ordered[current]);
      const path = paths.get(ordered[current].key);
      if (path && !map.getBounds().contains(path.getBounds())) map.panInside(path.getCenter(), { padding: [40, 40] });
      element?.focus({ preventScroll: true });
    } else if ((event.key === 'Enter' || event.key === ' ') && options.press) {
      event.preventDefault();
      event.stopPropagation();
      options.press(ordered[at]);
    }
  };
  const focused = (event: FocusEvent) => {
    const border = ordered.find((b) => elementOf(b) === event.target);
    if (!border) return;
    paths.get(border.key)?.getElement()?.toggleAttribute('data-lit', event.type === 'focusin');
    if (event.type === 'focusin') paths.get(border.key)?.openTooltip(paths.get(border.key)?.getCenter());
    else paths.get(border.key)?.closeTooltip();
  };
  box.element.addEventListener('keydown', keyed, true);
  box.element.addEventListener('focusin', focused);
  box.element.addEventListener('focusout', focused);

  // ---- the legend --------------------------------------------------------------------
  const legend = doc.createElement('div');
  legend.className = 'fd-map-legend';
  legend.hidden = true;
  box.element.append(legend);
  box.follow(legend);

  function drawLegend({ from: start, ends: steps }: { from: number; ends: number[] }, none: boolean) {
    legend.replaceChildren();
    if (!options.legend || !steps.length) {
      legend.hidden = true;
      return;
    }
    const title = doc.createElement('div');
    title.className = 'fd-map-legend-title';
    title.textContent = options.title;
    const list = doc.createElement('ol');
    const whole = steps.every((end) => Number.isInteger(end));
    // Areas with nothing to shade them, when there are some.
    if (none) {
      const empty = doc.createElement('li');
      empty.append(doc.createElement('i'), labels.areasNone);
      list.append(empty);
    }
    steps.forEach((end, i) => {
      const item = doc.createElement('li');
      const swatch = doc.createElement('i');
      swatch.setAttribute('data-shade', String(i));
      swatch.style.setProperty('--fd-region', `color-mix(in srgb, var(--fd-accent) ${mixOf(i, steps.length)}%, var(--fd-surface))`);
      const below = i === 0 ? start : steps[i - 1];
      const from = whole ? below + 1 : below;
      // A range reads from its least, in a right-to-left page too: its numbers kept left to right.
      const range = doc.createElement('bdi');
      range.dir = 'ltr';
      range.textContent = from >= end ? number(end) : `${number(from)}–${number(end)}`;
      item.append(swatch, range);
      list.append(item);
    });
    // A round mark with a number, as the map draws crowded pins, and what it counts: never read as a shade.
    if (options.bubbles) {
      const item = doc.createElement('li');
      item.className = 'fd-map-legend-bubble';
      const mark = doc.createElement('b');
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = number(12);
      item.append(mark, options.bubbles);
      list.append(item);
    }
    legend.append(title, list);
    legend.hidden = !visible;
  }

  const layer: RegionsLayer = {
    shade(next, nowChosen) {
      values = next;
      chosen = nowChosen;
      const steps = values ? shadeSteps([...values.values()]) : { from: 0, ends: [] };
      let none = false;
      for (const border of ordered) {
        const element = elementOf(border);
        if (!element) continue;
        const shade = values ? shadeOf(values.get(border.key), steps.ends) : null;
        none ||= shade === null;
        if (shade === null) {
          element.removeAttribute('data-shade');
          element.style.removeProperty('--fd-region');
        } else {
          element.setAttribute('data-shade', String(shade));
          element.style.setProperty('--fd-region', `color-mix(in srgb, var(--fd-accent) ${mixOf(shade, steps.ends.length)}%, var(--fd-surface))`);
        }
        element.toggleAttribute('data-chosen', border.key === chosen);
      }
      const at = ordered.findIndex((border) => border.key === chosen);
      if (at !== -1 && !box.element.contains(doc.activeElement)) current = at;
      roving();
      // Under every pin and route by their pane; never moved in the page, which would take the keys from a focused area.
      drawLegend(steps, none);
    },
    at(lat, lng) {
      return borders.find((border) => border.polygons.some((rings) => insideRings(lng, lat, rings))) ?? null;
    },
    show(on) {
      if (on === map.hasLayer(group)) return;
      if (on) group.addTo(map);
      else group.remove();
      visible = on;
      legend.hidden = !on || !legend.childElementCount;
    },
    destroy() {
      box.element.removeEventListener('keydown', keyed, true);
      box.element.removeEventListener('focusin', focused);
      box.element.removeEventListener('focusout', focused);
      group.remove();
      legend.remove();
    },
  };
  layer.shade(null, null);
  return layer;
}

/** Inside a polygon: inside its outer ring and none of its holes. */
export function insideRings(x: number, y: number, rings: [number, number][][]): boolean {
  const inside = (ring: [number, number][]) => {
    let odd = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
    }
    return odd;
  };
  return rings.length > 0 && inside(rings[0]) && !rings.slice(1).some(inside);
}

/** A set of borders, loaded and read; null (said once to the developer) when the app gives none by that name, or it failed. */
async function bordersOf(sets: Record<string, unknown> | undefined, spec: MapRegions): Promise<Border[] | null> {
  let set: unknown;
  try {
    set = await loadBorders(sets, spec.from);
  } catch (error) {
    warnOnce(`The borders "${spec.from}" did not load: ${String(error)}`);
    return null;
  }
  if (set === undefined) {
    warnOnce(`No borders "${spec.from}" in the maps' regions: give them as regions: { ${JSON.stringify(spec.from)}: () => fetch(…).then((r) => r.json()) }.`);
    return null;
  }
  return readBorders(set, spec);
}

/** Each border's number among its properties, by its key: what a layer's `shade` names. */
function ownNumbers(borders: readonly Border[], property: string): Map<string, number> {
  const values = new Map<string, number>();
  for (const border of borders) {
    const value = Number(border.properties[property]);
    if (Number.isFinite(value)) values.set(border.key, value);
  }
  return values;
}

/**
 * A list's areas shaded by its records: drawn once their borders load, their
 * numbers asked for again with each search — each area's records under the
 * search but for an area searched itself, so the others keep their shades —
 * or a number of their own. A press searches for an area's records.
 */
export function listRegions(options: {
  sets: Record<string, unknown> | undefined;
  spec: MapRegions & { field: string };
  box: MapBox;
  map: Leaflet.Map;
  L: LeafletModule;
  document: Document;
  locale: Locale;
  labels: MapLabels & { inRegion: string };
  title: string;
  model: string;
  dataSource: { groups?(request: { model: string; field: string; filter: ResolvedFilter[] }): Promise<{ value: unknown; count: number }[]> } | undefined;
  addSearch(search: { label: string; filter: ResolvedFilter[] }): void;
  /** The records the map has, to count when the data source cannot. */
  records(): readonly { values: Record<string, unknown> }[];
  /** The legend's words for a round mark with a number, where the map draws crowded pins so. */
  bubbles?: string;
}): { shade(filter: readonly ResolvedFilter[], current: () => boolean): Promise<void>; destroy(): void } {
  const { spec } = options;
  let gone = false;
  const drawn = bordersOf(options.sets, spec).then((borders) =>
    !borders || gone
      ? null
      : {
          borders,
          layer: drawRegions({
            ...options,
            borders,
            legend: spec.legend !== false,
            bubbles: options.bubbles,
            press: (border) => options.addSearch({ label: fill(options.labels.inRegion, { name: border.name }), filter: [{ field: spec.field, op: '=', value: border.value }] }),
          }),
        }
  );
  const isArea = (item: ResolvedFilter) => 'field' in item && item.field === spec.field && item.op === '=';
  return {
    async shade(filter, current) {
      const made = await drawn;
      if (!made || !current()) return;
      const picked = filter.find(isArea);
      const chosen = picked && 'value' in picked ? String(picked.value) : null;
      const shade = spec.shade ?? 'count';
      let values = new Map<string, number>();
      if (shade !== 'count') values = ownNumbers(made.borders, shade);
      else if (options.dataSource?.groups) {
        try {
          const groups = await options.dataSource.groups({ model: options.model, field: spec.field, filter: filter.filter((item) => !isArea(item)) });
          for (const group of groups) if (group.value !== null) values.set(String(group.value), group.count);
        } catch {
          return;
        }
      } else {
        // Without a way to count, the records the map has.
        for (const record of options.records()) {
          const raw = record.values[spec.field];
          const key = raw !== null && typeof raw === 'object' && 'id' in raw ? (raw as { id: unknown }).id : raw;
          if (key !== null && key !== undefined && key !== false) values.set(String(key), (values.get(String(key)) ?? 0) + 1);
        }
      }
      if (current()) made.layer.shade(values, chosen);
    },
    destroy() {
      gone = true;
      void drawn.then((made) => made?.layer.destroy());
    },
  };
}

/**
 * A form's areas by colour, a layer each: shaded by a number of their own,
 * the one the record's field holds drawn strong, a press choosing one into
 * that field where the person may change it; on the map or off it as each
 * layer's `invisible` says.
 */
export function formRegions(options: {
  sets: Record<string, unknown> | undefined;
  layers: readonly MapLayer[];
  box: MapBox;
  map: Leaflet.Map;
  L: LeafletModule;
  document: Document;
  locale: Locale;
  labels: MapLabels;
  /** Whether a person may write a field now: a press chooses only where they may. */
  writable(field: string): boolean;
  choose(field: string, value: string | number): void;
}): { update(values: Record<string, unknown>, hidden: (layerId: string) => boolean): void; destroy(): void } {
  let gone = false;
  const made = options.layers.map((layer) => {
    const spec = layer.regions as MapRegions & { choose?: string };
    const choose = spec.choose;
    return bordersOf(options.sets, spec).then((borders) =>
      !borders || gone
        ? null
        : {
            layer,
            spec,
            borders,
            regions: drawRegions({
              ...options,
              borders,
              title: layer.label ?? spec.from,
              legend: spec.legend !== false && spec.shade !== undefined,
              ...(choose && options.writable(choose) ? { press: (border: Border) => options.choose(choose, border.value) } : {}),
            }),
          }
    );
  });
  return {
    update(values, hidden) {
      for (const one of made)
        void one.then((drawn) => {
          if (!drawn || gone) return;
          const chosen = drawn.spec.choose ? values[drawn.spec.choose] : null;
          drawn.regions.shade(drawn.spec.shade ? ownNumbers(drawn.borders, drawn.spec.shade) : null, chosen === null || chosen === undefined || chosen === false ? null : String(chosen));
          drawn.regions.show(!hidden(drawn.layer.id));
        });
    },
    destroy() {
      gone = true;
      for (const one of made) void one.then((drawn) => drawn?.regions.destroy());
    },
  };
}
