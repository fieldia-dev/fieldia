import type * as Leaflet from 'leaflet';
import type { JsonValue, ListMap, ListResult, RecordId, ResolvedFilter, Values } from '@fieldia/core';
import type { ListViewContext, ListViewFactory, ListViewPart } from '@fieldia/viewer';
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

/**
 * A list's records on a map, for the viewer's `listViews`: the list's own
 * search and its chosen records, shared with the table. A pin lights its row
 * and a row its pin; a pin opens a card with the record's picture, a few of
 * its fields, a box to choose it and a button to open it. Pins that crowd
 * become a bubble with their count. After the map is moved, "Search this
 * area" puts the area into the search bar, as the person's own search.
 *
 *     mountViewer(host, { page, listViews: mapListViews({ provider }) })
 */
export function mapListViews(settings: MapSettings): Record<string, ListViewFactory> {
  return { map: (context) => listMap(settings, context) };
}

/** Room kept around the records when the map fits them, in pixels. */
const ROOM = 40;
/** The zoom from which a heat map gives way to the records' pins: the streets. */
const PINS_FROM = 15;
/** A place as an arrow points it out: "Nearest first". */
const NEAREST_ICON = '<path d="M3 11l18-8-8 18-2-8z"/>';
/** Moves the person makes; a fit, a card's own pan and a resize are not: MOVE_KEYS. */

interface Drawn {
  marker: Leaflet.Marker;
  face: HTMLElement;
  ids: RecordId[];
}

function listMap(settings: MapSettings, context: ListViewContext): ListViewPart {
  const { page, node, document: doc, locale } = context;
  // The viewer asks for a map only for a list with `map`.
  const spec = node.map as ListMap;
  const labels = listMapLabels(locale, settings.labels?.[locale]);
  const model = page.data.kind === 'record' ? page.data.model : '';
  const title = spec.card?.title ?? node.columns[0];
  const cardFields = spec.card?.fields ?? node.columns.filter((name) => name !== title).slice(0, 4);
  const pins = makePins({ document: doc, page, locale, pin: spec.pin ?? {}, title, icons: context.icons, drawers: settings.pins });
  const where = spec.point ? [spec.point] : [spec.latitude as string, spec.longitude as string];
  const heatSpec = spec.heat ? (spec.heat === true ? {} : spec.heat) : null;
  const areaSpec = spec.regions;
  const fields = [
    ...new Set([
      ...where,
      ...pins.fields,
      ...(spec.card?.image ? [spec.card.image] : []),
      ...cardFields.flatMap((name) => withCurrency(page, name)),
      ...(heatSpec?.weight ? [heatSpec.weight] : []),
      ...(areaSpec ? [areaSpec.field] : []),
    ]),
  ];
  const count = (n: number) => new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).format(n);

  installListMapStyles(doc);
  const element = doc.createElement('div');
  element.className = 'fd-map-list';
  const box = createMapBox({
    document: doc,
    provider: settings.provider,
    locale,
    labels,
    name: page.title ?? model,
    keys: labels.pinKeys,
    center: settings.center,
    zoom: settings.zoom,
    height: 'clamp(320px, 64vh, 640px)',
    tools: (spec.tools ?? []).filter((tool): tool is MapTool => tool !== 'nearest'),
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
                      context.addSearch(search);
                    },
                    records: () => records,
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
    const points = records.flatMap((record, i) => {
      const at = places[i];
      if (!at) return [];
      const weight = heatSpec.weight ? Number(record.values[heatSpec.weight]) : 1;
      return Number.isFinite(weight) && weight > 0 ? [{ lat: at.lat, lng: at.lng, weight }] : [];
    });
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
  let fitted = false;
  let lastFilter = '';
  /** The search changed by the map's own "Search this area": the view stays where the person put it. */
  let ownSearch = false;
  let moving = false;

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
    if (event.ctrlKey || event.metaKey) moving = true;
  };
  box.element.addEventListener('pointerdown', pressed, { capture: true });
  box.element.addEventListener('keydown', keyed, { capture: true });
  box.element.addEventListener('wheel', wheeled, { capture: true, passive: true });

  function searchHere(map: Leaflet.Map) {
    const bounds = map.getBounds();
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
    const wrap = (lng: number) => round(((((lng + 180) % 360) + 360) % 360) - 180);
    const south = round(Math.max(-90, bounds.getSouth()));
    const north = round(Math.min(90, bounds.getNorth()));
    const whole = bounds.getEast() - bounds.getWest() >= 360;
    const west = whole ? -180 : wrap(bounds.getWest());
    const east = whole ? 180 : wrap(bounds.getEast());
    const filter: ResolvedFilter[] = spec.point
      ? [{ field: spec.point, op: 'within', value: { south, west, north, east } }]
      : [
          { field: spec.latitude as string, op: 'between', value: [south, north] },
          // Over the antimeridian no one range holds the longitudes: either side of it, then.
          ...(whole
            ? []
            : west <= east
              ? [{ field: spec.longitude as string, op: 'between' as const, value: [west, east] }]
              : [{ any: [{ field: spec.longitude as string, op: '>=' as const, value: west }, { field: spec.longitude as string, op: '<=' as const, value: east }] }]),
        ];
    ownSearch = true;
    here.hidden = true;
    context.addSearch({ label: labels.inThisArea, filter });
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
    context.addSearch({ label: labels.inDrawnArea, filter: [condition] });
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
    const { popup, back: to } = open;
    open = null;
    map.closePopup(popup);
    if (back) to?.focus();
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
      choose: (on) => context.choose(record.id, on),
      ...(context.open ? { open: () => context.open?.(record.id) } : {}),
      actions: context.actions,
      act: (id, button) => void context.act(id, [record.id], button),
      close: () => closeCard(map, true),
    });
    showCard(map, L, at, height, card, record.id, back, keys);
  }

  // ---- the pins -------------------------------------------------------------------

  function draw(map: Leaflet.Map, L: LeafletModule) {
    layer ??= L.layerGroup().addTo(map);
    layer.clearLayers();
    drawn = [];
    drawnOf.clear();
    drawHeat(map, L);
    drawNote(map);
    // From afar, the heat map in place of the pins.
    if (heatShown(map)) {
      ghost?.remove();
      ghost = null;
      return;
    }
    const placed = records.flatMap((record, i) => (places[i] ? [{ record, at: places[i] as LatLng }] : []));
    const zoom = map.getZoom();
    const groups =
      spec.cluster === false
        ? placed.map((_, i) => [i])
        : clusterPoints(
            placed.map(({ at }) => map.project([at.lat, at.lng], zoom)),
            CROWD
          );
    for (const group of groups) {
      if (group.length === 1) single(map, L, placed[group[0]].record, placed[group[0]].at);
      else bubble(map, L, group.map((i) => placed[i]));
    }
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
      if (event && (event.ctrlKey || event.metaKey)) context.choose(record.id, !context.isChosen(record.id));
      else openCard(map, L, record, at, height, element ?? null, byKeys(event));
    });
    marker.on('mouseover', () => context.highlight(record.id));
    marker.on('mouseout', () => context.highlight(null));
    element?.addEventListener('focus', () => context.highlight(record.id));
    element?.addEventListener('blur', () => context.highlight(null));
  }

  function bubble(map: Leaflet.Map, L: LeafletModule, members: { record: MapRecord; at: LatLng }[]) {
    const n = members.length;
    const face = bubbleFace(doc, n, locale);
    const centre: LatLng = { lat: members.reduce((sum, p) => sum + p.at.lat, 0) / n, lng: members.reduce((sum, p) => sum + p.at.lng, 0) / n };
    const icon = L.divIcon({ className: 'fd-map-mark fd-map-middle', html: face, iconSize: SIZED_BY_FACE });
    const marker = L.marker([centre.lat, centre.lng], { icon, keyboard: true, riseOnHover: true }).addTo(layer as Leaflet.LayerGroup);
    const element = mark({ marker, face, ids: members.map((p) => p.record.id) }, fill(labels.cluster, { n: count(n) }));
    onPress(marker, (event) => {
      const fromKeys = byKeys(event);
      // Closer, until they part (the person's own move); on one spot (a tower's flats), a list of them.
      moving = true;
      if (zoomToPart(map, L, members.map((p) => p.at), ROOM)) {
        if (fromKeys) box.element.focus();
        return;
      }
      moving = false;
      const crowd = drawCrowd({
        document: doc,
        labels,
        dir: dir(),
        records: members.map((p) => ({ record: p.record, name: pins.name(p.record) })),
        pick: (record) => {
          const at = members.find((p) => p.record.id === record.id)?.at ?? centre;
          openCard(map, L, record, at, 20, element ?? null, true);
        },
        close: () => closeCard(map, true),
      });
      showCard(map, L, centre, 20, crowd, null, element ?? null, fromKeys);
    });
  }

  /** A lit record that is in a bubble shows where it is: its own pin, over the bubble. */
  function light(map: Leaflet.Map, L: LeafletModule) {
    ghost?.remove();
    ghost = null;
    const entry = hot === null ? undefined : drawnOf.get(hot);
    if (!entry || entry.ids.length === 1) return;
    const i = records.findIndex((record) => record.id === hot);
    const at = places[i];
    if (!at) return;
    const face = pins.face(records[i]);
    face.element.toggleAttribute('data-hot', true);
    face.element.toggleAttribute('data-chosen', context.isChosen(records[i].id));
    const icon = L.divIcon({ className: `fd-map-mark fd-map-ghost ${anchor(face)}`, html: face.element, iconSize: SIZED_BY_FACE });
    ghost = L.marker([at.lat, at.lng], { icon, interactive: false, keyboard: false, zIndexOffset: 2000 }).addTo(map);
    ghost.getElement()?.setAttribute('aria-hidden', 'true');
  }

  /** Each pin as it stands: lit when its row is, ticked when its record is chosen. */
  function restyle() {
    for (const entry of drawn) {
      const lit = hot !== null && entry.ids.includes(hot);
      entry.face.toggleAttribute('data-hot', lit);
      entry.face.toggleAttribute(
        'data-chosen',
        entry.ids.some((id) => context.isChosen(id))
      );
      entry.marker.setZIndexOffset(lit ? 1000 : 0);
    }
  }

  /** What the map says under its pins: how many it shows of how many, those with no place, and a heat map's way in. */
  let noteWords: string[] = [];
  let nearestWords = '';
  function drawNote(map: Leaflet.Map) {
    const words = [...noteWords, ...(nearestWords && isNearest() ? [nearestWords] : []), ...(heatShown(map) && records.length ? [labels.heatNote] : [])];
    note.textContent = words.join(' ');
    note.hidden = !words.length;
  }

  function fit(map: Leaflet.Map) {
    const at = places.filter((p): p is LatLng => !!p);
    if (!at.length) return;
    fitted = true;
    if (at.length === 1) map.setView([at[0].lat, at[0].lng], Math.max(map.getZoom(), 15), { animate: false });
    else map.fitBounds(at.map((p) => [p.lat, p.lng] as [number, number]), { padding: [ROOM, ROOM], maxZoom: 16, animate: false });
  }

  box.ready((map, L) => {
    box.element.append(tools, here, note);
    box.shield(tools);
    box.shield(here);
    box.follow(note);
    box.follow(here);
    here.addEventListener('click', () => searchHere(map));
    map.on('zoomend', () => draw(map, L));
    map.on('moveend', () => {
      if (moving) here.hidden = false;
      moving = false;
    });
    map.on('popupclose', (event: Leaflet.PopupEvent) => {
      if (open?.popup === event.popup) open = null;
    });
  });

  async function reload() {
    const source = context.dataSource;
    if (!source?.list) return;
    const asked = ++asking;
    const filter = context.filter();
    const key = JSON.stringify(filter);
    let result: ListResult;
    try {
      // The list's order, so the map shows the same first records: nearest first, when asked.
      result = await source.list({ model, fields, filter, sort: context.sort(), offset: 0, limit: spec.limit ?? 500 });
    } catch {
      if (asked !== asking || destroyed) return;
      note.textContent = labels.mapFailed;
      note.hidden = false;
      return;
    }
    if (asked !== asking || destroyed) return;
    records = result.records;
    places = records.map((record) => placeOf(record.values));
    const refit = !fitted || (key !== lastFilter && !ownSearch);
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
    });
  }

  return {
    element,
    reload,
    highlight(id) {
      hot = id;
      restyle();
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
        if (!fitted) fit(map);
      });
    },
    destroy() {
      destroyed = true;
      void regions?.then((made) => made?.destroy());
      void heat?.then((layer) => layer.destroy());
      box.element.removeEventListener('pointerdown', pressed, { capture: true });
      box.element.removeEventListener('keydown', keyed, { capture: true });
      box.element.removeEventListener('wheel', wheeled, { capture: true });
      box.destroy();
    },
  };
}
