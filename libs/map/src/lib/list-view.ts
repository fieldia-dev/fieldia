import type * as Leaflet from 'leaflet';
import { cardLineFields, recordSentence, type DataSource, type JsonValue, type ListMap, type ListRequest, type ListResult, type MapCluster, type RecordId, type ResolvedFilter, type Values, intlFormat } from '@fieldia/core';
import type { ListViewContext, ListViewPart } from '@fieldia/viewer';
import { startLoading, type Wait } from '@fieldia/widgets';
import { drawCard, drawCrowd, type Card } from './card';
import { clusterPoints } from './cluster';
import { SHAPE_ICONS, shapeDrawing } from './drawing';
import { readPoint, type Area, type LatLng, type Shape } from './geo';
import { fill, listMapLabels } from './labels';
import type { LeafletModule } from './leaflet';
import type { HeatLayer } from './heat';
import { createMapBox, type MapTool } from './map-core';
import { anchor, bubbleFace, byKeys, CROWD, MOVE_KEYS, onPress, popCard, SIZED_BY_FACE, zoomToPart } from './marks';
import { installListMapStyles } from './styles';
import { makePins, withCurrency, type MapRecord } from './pins';
import type { MapSettings } from './settings';
import { boxFilter, boxOf, type Box } from './view-box';

/** A search the map asks for: its view ("Search this area"), an area drawn, or a shaded area pressed. */
export interface MapSearch {
  label: string;
  filter: ResolvedFilter[];
  kind: 'view' | 'drawn' | 'region';
}

/**
 * Where a list's map stands once it stops moving, sent as the `fd-map-view`
 * event from its element (it bubbles): its centre and zoom, the edges of its
 * view (west east of east over the antimeridian), and whether the person
 * moved it (a drag, a zoom, the keys) or the map moved itself (to fit its
 * records, to show a card).
 */
export interface MapViewChange {
  center: LatLng;
  zoom: number;
  bounds: Box;
  byPerson: boolean;
}

/** What a list's map is given: the viewer's list's own, or a page's of its own (`mountListMap`), which may also say where it opens. */
export interface ListMapContext extends ListViewContext {
  addSearch(search: MapSearch): void;
  /** Where the map opens: there, it fits no records at first. */
  start?: { center: LatLng; zoom: number };
  /** The records come as they are, not from a source that can count a view's (`countArea: true` asks none). */
  given?: boolean;
  /** False when nothing takes a search the map asks for: no "Search this area", no tools to draw one. The viewer's list always takes them. */
  searches?: boolean;
}

/** Room kept around the records when the map fits them, in pixels. */
const ROOM = 40;
/** The zoom from which a heat map gives way to the records' pins: the streets. */
const PINS_FROM = 15;
/** A place as an arrow points it out: "Nearest first". */
const NEAREST_ICON = '<path d="M3 11l18-8-8 18-2-8z"/>';
/** How long after the map stops its source is asked for the view's bubbles: a run of moves asks once. */
const ASK_AFTER = 250;
/** How near, in pixels, the source's bubbles may come: they count hundreds and thousands, drawn large (48, 58 with their ring). */
const GATHERED = 60;
/** Moves the person makes; a fit, a card's own pan and a resize are not: MOVE_KEYS. */

interface Drawn {
  marker: Leaflet.Marker;
  face: HTMLElement;
  ids: RecordId[];
  /** Raised over the others, as its lit row's pin is: set on the marker only as it changes (each set moves the marker). */
  raised?: boolean;
}

/**
 * A list's records on a map (`mapListViews` in map-parts.ts, which fetches this code the first time one is shown).
 * `now`: its first wait drawn at once, going on from its place's own, already in sight.
 */
export function listMap(settings: MapSettings, context: ListMapContext, now = false): ListViewPart {
  const { page, node, document: doc, locale } = context;
  // The viewer asks for a map only for a list with `map`.
  const spec = node.map as ListMap;
  const labels = listMapLabels(locale, settings.labels?.[locale]);
  const model = page.data.kind === 'record' ? page.data.model : '';
  const title = spec.card?.title ?? node.columns[0];
  const cardFields = spec.card?.fields ?? node.columns.filter((name) => name !== title).slice(0, 4);
  const pins = makePins({ document: doc, page, locale, pin: spec.pin ?? {}, title, icons: context.icons, drawers: settings.pins, homeCurrency: settings.homeCurrency });
  // A map people only look at, a buyer's: no box on its cards, and a Ctrl-click opens a card as a click does.
  const chooses = spec.card?.choose !== false;
  const where = spec.point ? [spec.point] : [spec.latitude as string, spec.longitude as string];
  const heatSpec = spec.heat ? (spec.heat === true ? {} : spec.heat) : null;
  const areaSpec = spec.regions;
  const fields = [
    ...new Set([
      ...where,
      ...pins.fields,
      ...(spec.card?.image ? [spec.card.image] : []),
      ...(spec.card?.href ? [spec.card.href] : []),
      ...cardLineFields({ fields: cardFields }).flatMap((name) => withCurrency(page, name)),
      ...(heatSpec?.weight ? [heatSpec.weight] : []),
      ...(areaSpec ? [areaSpec.field] : []),
    ]),
  ];
  const count = (n: number) => intlFormat('NumberFormat', locale, { numberingSystem: 'latn' }).format(n);

  installListMapStyles(doc);
  const element = doc.createElement('div');
  element.className = 'fd-map-list';
  // As tall as the page says: pixels, or the room it is put in; as the window allows unless said.
  const height = spec.height === 'fill' ? '100%' : typeof spec.height === 'number' ? spec.height : 'clamp(320px, 64vh, 640px)';
  let first = now;
  if (height !== 'clamp(320px, 64vh, 640px)') element.dataset['height'] = String(spec.height);
  const takesAll = spec.gestures === 'all';
  const { start } = context;
  // Its images asked for once its records first place it (`imagesAfter`), never at the starting view first: its code a
  // part of its own since 0.35, the map was drawn before its records came and asked for a screenful at the starting view
  // its records then moved it away from (nine images of a tile server's, thrown away, at every list's map opened).
  let placedFirst: (() => void) | null = null;
  const placed = start ? undefined : new Promise<void>((resolve) => (placedFirst = resolve));
  const box = createMapBox({
    document: doc,
    provider: settings.provider,
    locale,
    labels,
    name: page.title ?? model,
    keys: labels.pinKeys,
    center: start?.center ?? settings.center,
    zoom: start?.zoom ?? settings.zoom,
    height,
    tools: (spec.tools ?? []).filter((tool): tool is MapTool => tool !== 'nearest'),
    gestures: takesAll ? 'all' : 'shared',
    ...(placed ? { imagesAfter: placed } : {}),
  });
  element.append(box.element);
  const here = doc.createElement('button');
  here.type = 'button';
  here.className = 'fd-map-here';
  here.textContent = labels.searchThisArea;
  here.hidden = true;
  const note = doc.createElement('p');
  note.className = 'fd-map-list-note';
  note.setAttribute('role', 'status');
  note.hidden = true;

  // ---- an area drawn, to search in -----------------------------------------------------
  const live = doc.createElement('div');
  live.className = 'fd-sr-only';
  live.setAttribute('aria-live', 'polite');
  element.append(live);
  const announce = (words: string) => {
    live.textContent = '';
    // A new node each time, so the same words are said again.
    setTimeout(() => (live.textContent = words), 30);
  };
  const tools = doc.createElement('div');
  tools.className = 'fd-map-draw';
  tools.setAttribute('role', 'group');
  tools.setAttribute('aria-label', labels.drawArea);
  const toolButtons = new Map<Shape, HTMLButtonElement>();
  for (const shape of ['polygon', 'box', 'circle'] as const) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.innerHTML = SHAPE_ICONS[shape];
    button.setAttribute('aria-label', labels[shape]);
    button.title = `${labels.drawArea}: ${labels[shape]}`;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => drawing.arm(drawing.mode === shape ? null : shape));
    toolButtons.set(shape, button);
    tools.append(button);
  }
  const drawing = shapeDrawing({
    box,
    labels,
    keys: element,
    announce,
    armed: (mode) => {
      for (const [shape, button] of toolButtons) button.setAttribute('aria-pressed', String(shape === mode));
    },
    done: (area) => searchIn(area),
    escaped: () => toolButtons.get('polygon')?.focus(),
    finishesOn: (target) => target === toolButtons.get('polygon'),
    over: '.fd-map-here, .fd-map-draw, .fd-map-list-note',
  });
  /** The areas drawn that the search holds, on the map under the pins. */
  const searched: Leaflet.Path[] = [];

  // ---- nearest first ---------------------------------------------------------------
  const nearest = spec.tools?.includes('nearest') ? box.tool(labels.nearestFirst, NEAREST_ICON) : null;
  const isNearest = () => !!context.sort()[0]?.near;
  nearest?.addEventListener('click', () => {
    nearestWords = '';
    if (isNearest()) return context.sortBy(null);
    const from = (at: LatLng) => context.sortBy([{ field: where[0], near: { lat: at.lat, lng: at.lng, ...(spec.point ? {} : { longitude: where[1] }) } }]);
    const middle = () =>
      box.ready((map) => {
        const c = map.getCenter();
        // Said, and kept under the map for as long as the order is from there.
        nearestWords = labels.nearestFromMiddle;
        announce(nearestWords);
        from({ lat: c.lat, lng: c.lng });
      });
    const geolocation = doc.defaultView?.navigator.geolocation;
    if (!geolocation) return middle();
    nearest.setAttribute('aria-busy', 'true');
    geolocation.getCurrentPosition(
      (found) => {
        nearest.removeAttribute('aria-busy');
        from({ lat: found.coords.latitude, lng: found.coords.longitude });
      },
      () => {
        nearest.removeAttribute('aria-busy');
        middle();
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  });

  // ---- areas shaded by their records: their code comes with the first map that has them ----
  type Regions = ReturnType<typeof import('./regions').listRegions>;
  let regions: Promise<Regions | null> | null = null;
  function shadeRegions(filter: readonly ResolvedFilter[], asked: number) {
    if (!areaSpec) return;
    regions ??= import('./regions').then(
      ({ listRegions }) =>
        new Promise<Regions | null>((resolve) =>
          box.ready((map, L) =>
            resolve(
              destroyed
                ? null
                : listRegions({
                    sets: settings.regions,
                    spec: areaSpec,
                    box,
                    map,
                    L,
                    document: doc,
                    locale,
                    labels,
                    title: page.title ?? model,
                    model,
                    dataSource: context.dataSource,
                    addSearch: (search) => {
                      ownSearch = false;
                      context.addSearch({ ...search, kind: 'region' });
                    },
                    records: () => records,
                    // Crowded pins drawn as one round mark with their count: the legend says what it means.
                    ...(spec.cluster !== false ? { bubbles: labels.legendBubble } : {}),
                  })
            )
          )
        )
    );
    void regions.then((made) => made?.shade(filter, () => asked === asking && !destroyed));
  }

  // ---- a heat map, from afar ---------------------------------------------------------
  let heat: Promise<HeatLayer> | null = null;
  const heatShown = (map: Leaflet.Map) => !!heatSpec && map.getZoom() < PINS_FROM;
  function drawHeat(map: Leaflet.Map, L: LeafletModule) {
    if (!heatSpec) return;
    const shown = heatShown(map);
    if (!shown && !heat) return;
    heat ??= import('./heat').then(({ drawHeat: make }) =>
      make({
        map,
        L,
        document: doc,
        colours: () => {
          const style = doc.defaultView?.getComputedStyle(box.element);
          return ['--fd-accent', '--fd-warning', '--fd-error'].map((name) => style?.getPropertyValue(name).trim() || '#2563eb');
        },
      })
    );
    const points = [
      ...records.flatMap((record, i) => {
        const at = places[i];
        return at ? [{ lat: at.lat, lng: at.lng, weight: heatSpec.weight ? Number(record.values[heatSpec.weight]) : 1 }] : [];
      }),
      // The source's bubbles, each weighing its records: their count, or its weight field added up.
      ...(served?.clusters ?? []).map((cluster) => ({ lat: cluster.lat, lng: cluster.lng, weight: heatSpec.weight ? Number(cluster.weight) : cluster.count })),
    ].filter((point) => Number.isFinite(point.weight) && point.weight > 0);
    void heat.then((layer) => !destroyed && layer.draw(points, heatShown(map)));
  }

  let records: MapRecord[] = [];
  let places: (LatLng | null)[] = [];
  let drawn: Drawn[] = [];
  const drawnOf = new Map<RecordId, Drawn>();
  let hot: RecordId | null = null;
  let open: { id: RecordId | null; card: Card; popup: Leaflet.Popup; back: HTMLElement | null } | null = null;
  let layer: Leaflet.LayerGroup | null = null;
  /** A record lit inside a bubble: its own pin over the bubble, for as long as its row is lit. */
  let ghost: Leaflet.Marker | null = null;
  let asking = 0;
  let destroyed = false;
  /** Opened where the app said: no fit until the search changes. */
  let fitted = !!start;
  let lastFilter: string | null = null;
  /** The search the records on hand were found by, and whether they are all it finds. */
  let shownFilter: ResolvedFilter[] = [];
  let allShown = false;
  /** The search changed by the map's own "Search this area": the view stays where the person put it. */
  let ownSearch = false;
  let moving = false;

  // ---- records gathered by the source: its bubbles for each view, their code with the first map whose source gathers ----
  /** Whether the source is asked for the view's bubbles: it gathers (`clusters`), and the page gathers crowded pins. */
  const gathers = spec.cluster !== false && !context.given && typeof context.dataSource?.clusters === 'function';
  let gatherer: Promise<import('./server-clusters').ServerClusters> | null = null;
  /** The same, once its code has come. */
  let made: import('./server-clusters').ServerClusters | null = null;
  /** The source's answer for the view, while it gathers this search's records: its bubbles, and `records` those standing alone. */
  let served: import('./server-clusters').Served | null = null;
  /** The search the source gathers none for (it answered false): its records loaded and gathered here, as without `clusters`. */
  let gatheredHere: string | null = null;

  const dir = (): 'ltr' | 'rtl' => (doc.defaultView?.getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr');
  const placeOf = (values: Values): LatLng | null => {
    if (spec.point) return readPoint(values[spec.point]);
    const lat = values[spec.latitude as string];
    const lng = values[spec.longitude as string];
    return typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  };

  // ---- the person's own moves, after which "Search this area" is offered ----------

  const pressed = (event: PointerEvent) => {
    const target = event.target as Element | null;
    if (!target?.closest('.leaflet-marker-icon, .leaflet-popup, .fd-map-here, .fd-map-credits, .fd-map-logo')) moving = true;
  };
  const keyed = (event: KeyboardEvent) => {
    if (event.target === box.element && MOVE_KEYS.has(event.key)) moving = true;
  };
  const wheeled = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey || takesAll) moving = true;
  };
  box.element.addEventListener('pointerdown', pressed, { capture: true });
  box.element.addEventListener('keydown', keyed, { capture: true });
  box.element.addEventListener('wheel', wheeled, { capture: true, passive: true });

  const viewOf = (map: Leaflet.Map) => {
    const b = map.getBounds();
    return boxOf(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
  };

  function searchHere(map: Leaflet.Map) {
    ownSearch = true;
    here.hidden = true;
    stopCount();
    context.addSearch({ label: labels.inThisArea, filter: boxFilter(spec, viewOf(map)), kind: 'view' });
  }

  // ---- how many the view holds, said on "Search this area": its code comes the first time the button shows ----
  type Counter = ReturnType<typeof import('./area-count').areaCounter>;
  let counter: Promise<Counter> | null = null;
  const sayHere = (n: number | null) => {
    here.textContent = n === null ? labels.searchThisArea : fill(labels.searchThisAreaCount, { label: labels.searchThisArea, n: count(n) });
  };
  const stopCount = () => void counter?.then((made) => made.stop());
  function countHere(map: Leaflet.Map) {
    sayHere(null);
    const view = viewOf(map);
    const source = context.dataSource;
    // The app's count, or its source's: one record asked for, its `total` the count, `signal` (an AbortSignal) aborted when the map moves on.
    const ask =
      typeof settings.countArea === 'function'
        ? settings.countArea
        : settings.countArea && source?.list && !context.given
          ? (filter: ResolvedFilter[], signal: AbortSignal) => (source as Required<typeof source>).list({ model, fields: [], filter, sort: [], offset: 0, limit: 1, signal } as ListRequest).then((r) => r.total)
          : null;
    counter ??= import('./area-count').then(({ areaCounter }) => areaCounter(spec, ask, (n) => !here.hidden && !destroyed && sayHere(n)));
    // The source's bubbles for this very view say how many it holds, with no question of their own.
    const inView = served?.bbox && JSON.stringify(served.bbox) === JSON.stringify(view) ? { inView: served.count } : {};
    void counter.then((made) => !destroyed && !here.hidden && made.count(view, { filter: shownFilter, all: allShown, places, ...inView }));
  }

  /** Where the map stands, once it stops: said to the app, once for each new view. */
  let lastView = '';
  function tellView(map: Leaflet.Map, byPerson: boolean) {
    const c = map.wrapLatLng(map.getCenter());
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    const detail: MapViewChange = { center: { lat: round(c.lat), lng: round(c.lng) }, zoom: map.getZoom(), bounds: viewOf(map), byPerson };
    const key = JSON.stringify([detail.center, detail.zoom, detail.bounds]);
    if (key === lastView) return;
    lastView = key;
    element.dispatchEvent(new CustomEvent('fd-map-view', { detail, bubbles: true }));
  }

  /** An area drawn becomes a search of its own, "In the area drawn": the places inside it, in the table and on the map. */
  function searchIn(area: Area) {
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    const shape: Record<string, JsonValue> =
      area.shape === 'circle'
        ? { center: [round(area.center.lng), round(area.center.lat)], radius: Math.round(area.radius) }
        : { polygon: area.points.map((p) => [round(p.lng), round(p.lat)]) };
    const condition: ResolvedFilter = spec.point
      ? { field: spec.point, op: 'within', value: shape }
      : { field: spec.latitude as string, op: 'within', value: { ...shape, longitude: spec.longitude as string } };
    ownSearch = true;
    here.hidden = true;
    announce(labels.shapeDrawn);
    context.addSearch({ label: labels.inDrawnArea, filter: [condition], kind: 'drawn' });
  }

  /**
   * The areas drawn that the search holds, drawn on the map: one drawn here,
   * or one a favourite brings back; gone when their search leaves the bar.
   */
  function drawSearched(map: Leaflet.Map, L: LeafletModule, filter: readonly ResolvedFilter[]) {
    for (const path of searched.splice(0)) path.remove();
    const own = new Set([spec.point, spec.latitude].filter((name): name is string => !!name));
    const style = { className: 'fd-map-shape fd-map-searched', interactive: false };
    const walk = (items: readonly ResolvedFilter[]): void =>
      items.forEach((item) => {
        if ('any' in item) return walk(item.any);
        if ('all' in item) return walk(item.all);
        if (item.op !== 'within' || !own.has(item.field)) return;
        const area = item.value as Record<string, unknown>;
        if (Array.isArray(area['polygon'])) searched.push(L.polygon((area['polygon'] as number[][]).map(([lng, lat]) => [lat, lng] as [number, number]), style).addTo(map));
        else if (Array.isArray(area['center'])) {
          const [lng, lat] = area['center'] as number[];
          searched.push(L.circle([lat, lng], { ...style, radius: Number(area['radius']) }).addTo(map));
        }
      });
    walk(filter);
  }

  // ---- the card -------------------------------------------------------------------

  function closeCard(map: Leaflet.Map, back: boolean) {
    if (!open) return;
    const { popup, back: to, id } = open;
    open = null;
    map.closePopup(popup);
    if (!back) return;
    // Its mark drawn again meanwhile, with the source's bubbles for a view the card panned to: the record's new one, or the map.
    if (served && !to?.isConnected) ((id !== null && drawnOf.get(id)?.marker.getElement()) || box.element).focus();
    else to?.focus();
  }

  function showCard(map: Leaflet.Map, L: LeafletModule, at: LatLng, height: number, card: Card, id: RecordId | null, back: HTMLElement | null, keys: boolean) {
    closeCard(map, false);
    const popup = popCard(map, L, { at, height, card, focus: keys, escape: () => closeCard(map, true) });
    open = { id, card, popup, back };
  }

  function openCard(map: Leaflet.Map, L: LeafletModule, record: MapRecord, at: LatLng, height: number, back: HTMLElement | null, keys: boolean) {
    const card = drawCard({
      document: doc,
      page,
      locale,
      labels,
      dir: dir(),
      card: spec.card ?? {},
      title,
      fields: cardFields,
      record,
      chosen: context.isChosen(record.id),
      ...(chooses ? { choose: (on: boolean) => context.choose(record.id, on) } : {}),
      ...(context.open ? { open: () => context.open?.(record.id) } : {}),
      actions: context.actions,
      act: (id, button) => void context.act(id, [record.id], button),
      close: () => closeCard(map, true),
    });
    showCard(map, L, at, height, card, record.id, back, keys);
  }

  // ---- the pins -------------------------------------------------------------------

  function draw(map: Leaflet.Map, L: LeafletModule) {
    const marks = (layer ??= L.layerGroup().addTo(map));
    drawHeat(map, L);
    drawNote(map);
    // From afar, the heat map in place of the pins.
    if (heatShown(map)) {
      marks.clearLayers();
      drawn = [];
      drawnOf.clear();
      ghost?.remove();
      ghost = null;
      return;
    }
    const placed = records.flatMap((record, i) => (places[i] ? [{ record, at: places[i] as LatLng }] : []));
    // The source's bubbles, gathered again here with the records standing alone where they come too close.
    const theirs = served?.clusters ?? [];
    const zoom = map.getZoom();
    const spots = [
      ...placed.map(({ at }) => map.project([at.lat, at.lng], zoom)),
      ...theirs.map((cluster) => ({ ...map.project([cluster.lat, cluster.lng], zoom), weighs: cluster.count })),
    ];
    const groups = spec.cluster === false ? spots.map((_, i) => [i]) : clusterPoints(spots, served ? GATHERED : CROWD);
    // A mark the keys were on, drawn again with the source's next answer: the keys stay on its record.
    const kept = served ? drawn.find((entry) => entry.marker.getElement()?.contains(doc.activeElement))?.ids[0] : undefined;
    marks.clearLayers();
    drawn = [];
    drawnOf.clear();
    for (const group of groups) {
      const mine = group.filter((i) => i < placed.length).map((i) => placed[i]);
      const gathered = group.filter((i) => i >= placed.length).map((i) => theirs[i - placed.length]);
      // The record whose card is open keeps its own pin while it is read, the source's next bubbles beside it.
      const reading = served && open && mine.length + gathered.length > 1 ? mine.findIndex((p) => p.record.id === open?.id) : -1;
      if (reading >= 0) {
        const [own] = mine.splice(reading, 1);
        single(map, L, own.record, own.at);
      }
      if (mine.length === 1 && !gathered.length) single(map, L, mine[0].record, mine[0].at);
      else if (mine.length || gathered.length) bubble(map, L, mine, gathered);
    }
    if (kept !== undefined) drawnOf.get(kept)?.marker.getElement()?.focus({ preventScroll: true });
    restyle();
    light(map, L);
  }

  function mark(entry: Drawn, name: string) {
    const element = entry.marker.getElement();
    element?.setAttribute('aria-label', name);
    drawn.push(entry);
    for (const id of entry.ids) drawnOf.set(id, entry);
    return element;
  }

  function single(map: Leaflet.Map, L: LeafletModule, record: MapRecord, at: LatLng) {
    const face = pins.face(record);
    const icon = L.divIcon({ className: `fd-map-mark ${anchor(face)}`, html: face.element, iconSize: SIZED_BY_FACE });
    const marker = L.marker([at.lat, at.lng], { icon, keyboard: true, riseOnHover: true, riseOffset: 500 }).addTo(layer as Leaflet.LayerGroup);
    const element = mark({ marker, face: face.element, ids: [record.id] }, pins.name(record));
    if (element) element.dataset['id'] = String(record.id);
    const height = face.stands === 'foot' ? face.height : face.height / 2;
    onPress(marker, (event) => {
      // Ctrl (⌘) and a click chooses the record, as in a list of files.
      if (chooses && event && (event.ctrlKey || event.metaKey)) context.choose(record.id, !context.isChosen(record.id));
      else openCard(map, L, record, at, height, element ?? null, byKeys(event));
    });
    marker.on('mouseover', () => context.highlight(record.id));
    marker.on('mouseout', () => context.highlight(null));
    element?.addEventListener('focus', () => context.highlight(record.id));
    element?.addEventListener('blur', () => context.highlight(null));
  }

  /** A bubble: records close together — those on hand, and those of the source's bubbles (`gathered`), counted where they stand. */
  function bubble(map: Leaflet.Map, L: LeafletModule, members: { record: MapRecord; at: LatLng }[], gathered: MapCluster[] = []) {
    const n = members.length + gathered.reduce((sum, cluster) => sum + cluster.count, 0);
    const face = bubbleFace(doc, n, locale);
    // Their middle, a bubble of the source's weighing as many as it holds.
    const middle = (of: 'lat' | 'lng') => (members.reduce((sum, p) => sum + p.at[of], 0) + gathered.reduce((sum, cluster) => sum + cluster[of] * cluster.count, 0)) / n;
    const centre: LatLng = { lat: middle('lat'), lng: middle('lng') };
    const icon = L.divIcon({ className: 'fd-map-mark fd-map-middle', html: face, iconSize: SIZED_BY_FACE });
    const marker = L.marker([centre.lat, centre.lng], { icon, keyboard: true, riseOnHover: true }).addTo(layer as Leaflet.LayerGroup);
    const element = mark({ marker, face, ids: members.map((p) => p.record.id) }, fill(labels.cluster, { n: count(n) }));
    // Where its records are: each on hand, and where the source's bubbles say theirs are (the chunk is in: they came through it).
    const theirs = gathered.length ? made : null;
    const spots = [...members.map((p) => p.at), ...(theirs?.corners(gathered) ?? [])];
    onPress(marker, (event) => {
      const fromKeys = byKeys(event);
      // Closer, until they part (the person's own move); on one spot (a tower's flats), a list of them.
      moving = true;
      if (zoomToPart(map, L, spots, ROOM, centre) || theirs?.closer(map, gathered, centre)) {
        if (fromKeys) box.element.focus();
        return;
      }
      moving = false;
      const crowd = (listed: { record: MapRecord; at: LatLng }[], total: number) =>
        showCard(
          map,
          L,
          centre,
          20,
          drawCrowd({
            document: doc,
            labels,
            dir: dir(),
            count: total,
            records: [
              ...listed.map((p) => ({ record: p.record, name: pins.name(p.record) })),
              // More on the spot than a card lists: how many, said.
              ...(total > listed.length ? [{ record: { id: '', values: {} }, name: fill(labels.crowdMore, { n: count(total - listed.length) }), plain: true }] : []),
            ],
            pick: (record) => {
              const at = listed.find((p) => p.record.id === record.id)?.at ?? centre;
              openCard(map, L, record, at, 20, element ?? null, true);
            },
            close: () => closeCard(map, true),
          }),
          null,
          element ?? null,
          fromKeys
        );
      // The source's records on that spot, asked for: the first of them listed.
      if (theirs) theirs.crowd(shownFilter, spots, context.sort(), (found, total) => !destroyed && crowd(found, total));
      else crowd(members, members.length);
    });
  }

  /** A lit record that is in a bubble shows where it is: its own pin, over the bubble. */
  function light(map: Leaflet.Map, L: LeafletModule) {
    ghost?.remove();
    ghost = null;
    const lit = hot;
    const entry = lit === null ? undefined : drawnOf.get(lit);
    if (entry?.ids.length === 1 || lit === null) return;
    const i = records.findIndex((record) => record.id === lit);
    if (entry) return ghostOf(map, L, records[i], places[i]);
    // In one of the source's bubbles: where it is, asked once.
    if (served && made && !heatShown(map)) void made.place(lit).then((found) => found && hot === lit && !ghost && !destroyed && served && ghostOf(map, L, found.record, found.at));
  }

  function ghostOf(map: Leaflet.Map, L: LeafletModule, record: MapRecord, at: LatLng | null) {
    if (!at) return;
    const face = pins.face(record);
    face.element.toggleAttribute('data-hot', true);
    face.element.toggleAttribute('data-chosen', context.isChosen(record.id));
    const icon = L.divIcon({ className: `fd-map-mark fd-map-ghost ${anchor(face)}`, html: face.element, iconSize: SIZED_BY_FACE });
    ghost = L.marker([at.lat, at.lng], { icon, interactive: false, keyboard: false, zIndexOffset: 2000 }).addTo(map);
    ghost.getElement()?.setAttribute('aria-hidden', 'true');
  }

  /** Each pin as it stands: lit when its row is, ticked when its record is chosen. */
  function restyle() {
    for (const entry of drawn) {
      lightUp(entry);
      entry.face.toggleAttribute(
        'data-chosen',
        entry.ids.some((id) => context.isChosen(id))
      );
    }
  }
  /** A pin lit when its row is, and raised over the others: its marker moved only where that changed. */
  function lightUp(entry: Drawn) {
    const lit = hot !== null && entry.ids.includes(hot);
    entry.face.toggleAttribute('data-hot', lit);
    if ((entry.raised ?? false) === lit) return;
    entry.raised = lit;
    entry.marker.setZIndexOffset(lit ? 1000 : 0);
  }

  /** What the map says under its pins: how many it shows of how many, those with no place, and a heat map's way in. */
  let noteWords: string[] = [];
  let nearestWords = '';
  function drawNote(map: Leaflet.Map) {
    const words = [...noteWords, ...(nearestWords && isNearest() ? [nearestWords] : []), ...(heatShown(map) && records.length ? [labels.heatNote] : [])];
    note.textContent = words.join(' ');
    note.hidden = !words.length;
  }

  /** The map moved to show the records — those on hand, or where the source's are (`at`). */
  function fit(map: Leaflet.Map, at = places.filter((p): p is LatLng => !!p)) {
    if (!at.length) return;
    fitted = true;
    // No closer than the page says (a neighbourhood, say), so a lone record is not shown on a road with nothing round it.
    const closest = typeof spec.fitZoom === 'number' ? spec.fitZoom : null;
    if (at.length === 1) map.setView([at[0].lat, at[0].lng], Math.min(Math.max(map.getZoom(), 15), closest ?? Infinity), { animate: false });
    else map.fitBounds(at.map((p) => [p.lat, p.lng] as [number, number]), { padding: [ROOM, ROOM], maxZoom: closest ?? 16, animate: false });
  }

  // A search nothing would take is not offered.
  const searches = context.searches !== false;
  box.ready((map, L) => {
    box.element.append(...(searches ? [tools, here] : []), note);
    box.shield(tools);
    box.shield(here);
    box.follow(note);
    box.follow(here);
    here.addEventListener('click', () => searchHere(map));
    map.on('zoomend', () => draw(map, L));
    // The count said is for where the map was: gone as it moves, said again for where it stops.
    map.on('movestart', () => {
      stopCount();
      sayHere(null);
    });
    map.on('moveend', () => {
      // A quick second press of + or −, made when this zoom ends: the map has not stopped.
      if (box.stepping()) return;
      const byPerson = moving;
      if (moving && searches) here.hidden = false;
      moving = false;
      if (!here.hidden) countHere(map);
      tellView(map, byPerson);
      // The source's bubbles for where it stopped.
      if (served && !fitting) void askView(ASK_AFTER, false);
    });
    // An open card is what the person is reading: Search this area steps out of its way (on a phone the card
    // fills the map's height, and the button sat over its picture) and is back when the card closes.
    map.on('popupopen', () => (box.element.dataset['card'] = ''));
    map.on('popupclose', (event: Leaflet.PopupEvent) => {
      if (open?.popup === event.popup) open = null;
      // Leaflet closes the last card before it opens the next, so the next one's open sets this again.
      delete box.element.dataset['card'];
    });
  });

  const mapFailed = () => {
    note.textContent = recordSentence(page.records, labels.mapFailedNoun, labels.mapFailed, locale);
    note.hidden = false;
  };

  /** The map moving itself to show a new search's records, as the source says where they are: no ask of its own as it stops. */
  let fitting = false;

  /**
   * The source's bubbles for the search and the view, `wait` milliseconds from now, the last ask winning: for a
   * search (`search`), its areas drawn and a card whose record it no longer finds closed, and first the map fitted to
   * where its records are (`refit`). True once answered or replaced; false when the source gathers none for this search.
   */
  function askView(wait: number, search: boolean, refit = false): Promise<boolean> {
    gatherer ??= import('./server-clusters').then(
      ({ serverClusters }) => (made = serverClusters({ source: context.dataSource as DataSource, model, spec, fields, radius: GATHERED, ...(heatSpec?.weight ? { weight: heatSpec.weight } : {}), placeOf }))
    );
    const filter = shownFilter;
    let none = false;
    return gatherer
      .then(
        (gathering) =>
          new Promise<void>((done) =>
            box.ready((map, L) => {
              if (destroyed) return done();
              const fitTo = (spots: LatLng[]) => {
                fitting = true;
                fit(map, spots);
                fitting = false;
                here.hidden = true;
              };
              void gathering
                .ask(
                  { filter, map, wait, ...(refit ? { fit: fitTo } : {}) },
                  (answer) => (answer === false ? (none = true) : lay(answer, map, L, search)),
                  () => !destroyed && mapFailed()
                )
                .then(done);
            })
          )
      )
      .then(() => !none);
  }

  /** The source's answer for the view, drawn: its bubbles, the records standing alone, those it says have no place. */
  function lay(answer: import('./server-clusters').Served, map: Leaflet.Map, L: LeafletModule, search: boolean) {
    if (destroyed) return;
    served = answer;
    records = answer.points;
    places = records.map((record) => placeOf(record.values));
    allShown = false;
    noteWords = answer.unplaced ? [fill(labels.notOnMap, { n: count(answer.unplaced) })] : [];
    draw(map, L);
    if (search) drawSearched(map, L, shownFilter);
    if (search && open?.id !== null && open && !records.some((r) => r.id === open?.id)) closeCard(map, false);
    else open?.card.setChosen(open.id !== null && context.isChosen(open.id));
    if (!here.hidden) countHere(map);
  }

  async function reload() {
    try {
      await reloadNow();
    } finally {
      // Placed where its records are, or none came to place it: its images now (each fit is made before they are asked).
      placedFirst?.();
    }
  }
  async function reloadNow() {
    const source = context.dataSource;
    if (!source?.list && !gathers) return;
    const asked = ++asking;
    const filter = context.filter();
    const key = JSON.stringify(filter);
    // Its wait, as the list's: a skeleton as big as the map the first time, what it shows kept with a bar over it after.
    const wait = waitFor();
    if (gathers && gatheredHere !== key) {
      // Gathered by the source: its bubbles for the view, the map first fitted to a new search's records.
      const before = { lastFilter, ownSearch };
      const refit = !fitted || (lastFilter !== null && key !== lastFilter && !ownSearch);
      lastFilter = key;
      ownSearch = false;
      shownFilter = filter;
      nearest?.setAttribute('aria-pressed', String(isNearest()));
      void shadeRegions(filter, asked);
      made?.forget();
      if (await askView(0, true, refit)) return void wait.done(() => (drew = true));
      if (asked !== asking || destroyed) return wait.stop();
      // It gathers none for this search: its records loaded and gathered here, as without `clusters`.
      gatheredHere = key;
      ({ lastFilter, ownSearch } = before);
    }
    if (!source?.list) return wait.stop();
    // The records on hand from here on: no bubble of the source's drawn with them, none asked for.
    served = null;
    made?.stop();
    let result: ListResult;
    try {
      // The list's order, so the map shows the same first records: nearest first, when asked.
      result = await source.list({ model, fields, filter, sort: context.sort(), offset: 0, limit: spec.limit ?? 500, ...(context.loading?.settings.timeout ? { signal: wait.signal } : {}) });
    } catch (error) {
      if (asked !== asking || destroyed) return wait.stop();
      return wait.fail(error);
    }
    if (asked !== asking || destroyed) return wait.stop();
    records = result.records;
    places = records.map((record) => placeOf(record.values));
    shownFilter = filter;
    allShown = result.total <= records.length;
    const refit = !fitted || (lastFilter !== null && key !== lastFilter && !ownSearch);
    lastFilter = key;
    ownSearch = false;
    const missing = places.filter((p) => !p).length;
    noteWords = [
      result.total > records.length ? fill(labels.mapShowsFirst, { n: count(records.length), total: count(result.total) }) : '',
      missing ? fill(labels.notOnMap, { n: count(missing) }) : '',
    ].filter(Boolean);
    nearest?.setAttribute('aria-pressed', String(isNearest()));
    void shadeRegions(filter, asked);
    box.ready((map, L) => {
      if (destroyed) return;
      if (refit) {
        fit(map);
        here.hidden = true;
      }
      draw(map, L);
      drawSearched(map, L, filter);
      if (open?.id !== null && open && !records.some((r) => r.id === open?.id)) closeCard(map, false);
      else open?.card.setChosen(open.id !== null && context.isChosen(open.id));
      // Records changed under the button: its count again.
      if (!here.hidden) countHere(map);
      // Its map and its places drawn: its wait goes, once seen its minimum.
      void wait.done(() => (drew = true));
    });
  }
  /** Whether its records were drawn once: a wait after that asks again (`refresh`). */
  let drew = false;
  /**
   * Its wait (loading.ts): the first a skeleton as big as the map, over its panes, until its map and its places are in;
   * after, what it shows kept, a bar over it; a failure said where its note is, as before.
   */
  const waitFor = (): Wait =>
    startLoading(box.element, drew ? 'refresh' : 'first', context.loading, {
      part: `${node.id}-map`,
      // The first going on from its place's own, in sight already: drawn at once.
      now: !drew && first && !(first = false),
      shape: {
        show: () => box.element.append(Object.assign(doc.createElement('span'), { className: 'fd-sk fd-sk-block' })),
        hide: () => box.element.querySelector(':scope > .fd-sk-block')?.remove(),
      },
      failed: () => {
        mapFailed();
        return true;
      },
      retry: () => void reload(),
    });

  return {
    element,
    reload,
    highlight(id) {
      // The pins of the record lit before and of the one lit now, alone: 0.34 drew every pin again for each row pointed
      // at (500 marker moves a hover at the map's most).
      const before = hot;
      hot = id;
      for (const one of new Set([before, id])) {
        const entry = one === null ? undefined : drawnOf.get(one);
        if (entry) lightUp(entry);
      }
      box.ready((map, L) => light(map, L));
    },
    chosenChanged() {
      restyle();
      if (open?.id !== null && open) open.card.setChosen(context.isChosen(open.id as RecordId));
    },
    shown() {
      box.refresh();
      box.ready((map) => {
        map.invalidateSize({ pan: false });
        // The source's records: asked again, to fit to where they are.
        if (!fitted && served) void reload();
        else if (!fitted) fit(map);
      });
    },
    destroy() {
      destroyed = true;
      placedFirst?.();
      stopCount();
      made?.stop();
      void regions?.then((made) => made?.destroy());
      void heat?.then((layer) => layer.destroy());
      box.element.removeEventListener('pointerdown', pressed, { capture: true });
      box.element.removeEventListener('keydown', keyed, { capture: true });
      box.element.removeEventListener('wheel', wheeled, { capture: true });
      box.destroy();
    },
  };
}
