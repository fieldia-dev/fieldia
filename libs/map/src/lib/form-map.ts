import type * as Leaflet from 'leaflet';
import { compileModifier, expressionContext, type FormState, type Line, type MapLayer, type Page, type Value, type Values } from '@fieldia/core';
import type { MapPart, MapPartContext, MapPartFactory } from '@fieldia/viewer';
import { drawCard } from './card';
import { readPoint, type LatLng } from './geo';
import { fill, formMapLabels } from './labels';
import type { LeafletModule } from './leaflet';
import { createMapBox, warnOnce } from './map-core';
import { anchor, byKeys, MOVE_KEYS, onPress, popCard, SIZED_BY_FACE } from './marks';
import { comma, makePins, shown, type MapRecord, type Pins } from './pins';
import type { RouteFound } from './providers';
import { nearestOnLine, pointAlong, routeLine, splitLine, type RouteLine } from './route-line';
import type { MapSettings } from './settings';
import { installFormMapStyles } from './styles';

/**
 * A map on a form (`type: "map"`), for the viewer's `maps`: the record's
 * places as layers. A layer is the record's own place (a kitchen, a door, a
 * courier), a place for each of its lines (a round's stops), a route along
 * the roads between them, or the reader's own place. Pins are drawn as a
 * list's map draws them. A place that moves glides to each new position —
 * along its route when it is on one — says when it was last seen once its
 * news is old, and is followed until the person moves the map. A route's
 * part already travelled fades, and its time and distance left are written
 * into the record's fields the page names.
 *
 *     mountViewer(host, { page, maps: mapParts({ provider }) })
 */
export function mapParts(settings: MapSettings): MapPartFactory {
  return (context) => formMap(settings, context);
}

/** How long a pin takes to glide to its new place, in milliseconds. */
const GLIDE_MS = 900;
/** A traveller this far from their route, in metres, has left it: a new one is asked for. */
const OFF_ROUTE_M = 60;
/** A route is asked for again at most this often, in milliseconds, however its traveller wanders. */
const ROUTE_EVERY_MS = 10_000;
/** Room kept round the places when the map fits them, in pixels. */
const ROOM = 48;

interface Place {
  key: string;
  layer: MapLayer;
  record: MapRecord;
  at: LatLng;
}

interface Mark {
  marker: Leaflet.Marker;
  layer: MapLayer;
  /** Where the mark is going: its own place, though it may still be gliding there. */
  at: LatLng;
  html: string;
  name: string;
  movedAt: number;
  glide?: number;
}

interface RouteState {
  layer: MapLayer;
  asking: number;
  /** The far ends it was asked for: a route stays while they stay. */
  ends: string;
  askedAt: number;
  found?: RouteFound & { path: RouteLine };
  done?: Leaflet.Polyline;
  left?: Leaflet.Polyline;
  abort?: AbortController;
  /** The answer whose line has been written into the record. */
  written?: number;
}

function formMap(settings: MapSettings, context: MapPartContext): MapPart {
  const { node, page, form, document: doc, locale } = context;
  installFormMapStyles(doc);
  const labels = formMapLabels(locale, settings.labels?.[locale]);
  const element = doc.createElement('div');
  element.className = 'fd-map-form';
  if (node.label) {
    const heading = doc.createElement('p');
    heading.className = 'fd-map-form-label';
    heading.textContent = node.label;
    element.append(heading);
  }
  const box = createMapBox({
    document: doc,
    provider: settings.provider,
    locale,
    labels,
    name: node.label ?? labels.map,
    keys: labels.pinKeys,
    center: settings.center,
    zoom: settings.zoom,
    height: node.height ?? 360,
  });
  element.append(box.element);
  const note = doc.createElement('p');
  note.className = 'fd-map-list-note';
  note.setAttribute('role', 'status');
  note.hidden = true;
  const followButton = doc.createElement('button');
  followButton.type = 'button';
  followButton.className = 'fd-map-here fd-map-follow';
  followButton.textContent = labels.follow;
  followButton.hidden = true;
  const me = node.layers.find((layer) => layer.myLocation);
  const locate = doc.createElement('button');
  locate.type = 'button';
  locate.className = 'fd-map-locate';
  locate.setAttribute('aria-label', labels.myLocation);
  locate.title = labels.myLocation;
  locate.setAttribute('aria-pressed', 'false');
  locate.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
  const reduced = !!doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // ---- each layer's pins, from the record's fields or its lines' ---------------------

  const pinsOf = new Map<string, { pins: Pins; scope: Page }>();
  for (const layer of node.layers) {
    if (layer.point === undefined && layer.latitude === undefined) continue;
    const lineFields = layer.lines ? (page.fields[layer.lines] as { fields?: Page['fields'] }).fields : undefined;
    const scope = lineFields ? ({ ...page, fields: lineFields } as Page) : page;
    pinsOf.set(layer.id, { pins: makePins({ document: doc, page: scope, locale, pin: layer.pin ?? {}, title: layer.card?.title ?? '', icons: context.icons, drawers: settings.pins }), scope });
  }
  const hidden = new Map(node.layers.filter((layer) => typeof layer.invisible === 'string' || layer.invisible === true).map((layer) => [layer.id, compileModifier(layer.invisible)]));

  const placeOf = (layer: MapLayer, values: Values): LatLng | null => {
    if (layer.point) return readPoint(values[layer.point]);
    const lat = values[layer.latitude as string];
    const lng = values[layer.longitude as string];
    return typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  };

  /** Every place on the map now: each layer's own, or each of its lines'. */
  function placesNow(values: Values): Place[] {
    const context = expressionContext(values, page.fields);
    return node.layers.flatMap((layer) => {
      if (!pinsOf.has(layer.id) || hidden.get(layer.id)?.evaluate(context)) return [];
      if (!layer.lines) {
        const at = placeOf(layer, values);
        return at ? [{ key: layer.id, layer, record: { id: layer.id, values }, at }] : [];
      }
      const lines = (values[layer.lines] as Line[] | null | undefined) ?? [];
      return lines.flatMap((line) => {
        const at = placeOf(layer, line.values);
        return at ? [{ key: `${layer.id}:${line.key}`, layer, record: { id: line.id ?? line.key, values: line.values }, at }] : [];
      });
    });
  }

  /** A pin's name: its layer's words, then what the pin says ("Courier, 4 min"). */
  function nameOf(place: Place): string {
    const scope = pinsOf.get(place.layer.id)!.scope;
    const title = place.layer.card?.title ? shown(scope, place.layer.card.title, place.record.values, locale) : '';
    const said = place.layer.pin?.label ? shown(scope, place.layer.pin.label, place.record.values, locale) : '';
    return [place.layer.label, title, said].filter(Boolean).join(comma(locale)) || place.layer.id;
  }

  // ---- the person's own moves, after which a followed place is followed no more -------

  let moving = false;
  let userMoved = false;
  const pressed = (event: PointerEvent) => {
    if (!(event.target as Element | null)?.closest('.leaflet-marker-icon, .leaflet-popup, .fd-map-follow, .fd-map-locate, .fd-map-credits, .fd-map-logo')) moving = true;
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
  const following = node.layers.some((layer) => layer.live?.follow);

  // ---- drawing -----------------------------------------------------------------------

  const marks = new Map<string, Mark>();
  const routes = new Map<string, RouteState>();
  let values: Values = {};
  let fitted = false;
  let destroyed = false;
  let openCard: { popup: Leaflet.Popup; back: HTMLElement | null } | null = null;
  let mine: { at: LatLng; accuracy: number } | null = null;
  let meMark: Leaflet.Marker | null = null;
  let meCircle: Leaflet.Circle | null = null;
  let watching: number | null = null;

  function draw(map: Leaflet.Map, L: LeafletModule) {
    const now = placesNow(values);
    const seen = new Set<string>();
    for (const place of now) {
      seen.add(place.key);
      const face = pinsOf.get(place.layer.id)!.pins.face(place.record);
      const html = face.element.outerHTML;
      const name = nameOf(place);
      const mark = marks.get(place.key);
      if (!mark) {
        const marker = L.marker([place.at.lat, place.at.lng], { icon: L.divIcon({ className: `fd-map-mark ${anchor(face)}`, html: face.element, iconSize: SIZED_BY_FACE }), keyboard: true, riseOnHover: true }).addTo(map);
        const made: Mark = { marker, layer: place.layer, at: place.at, html, name, movedAt: Date.now() };
        marks.set(place.key, made);
        marker.getElement()?.setAttribute('aria-label', name);
        const height = face.stands === 'foot' ? face.height : face.height / 2;
        if (place.layer.card) onPress(marker, (event) => showCard(map, L, place.key, height, byKeys(event)));
        continue;
      }
      if (html !== mark.html) {
        mark.marker.setIcon(L.divIcon({ className: `fd-map-mark ${anchor(face)}`, html: face.element, iconSize: SIZED_BY_FACE }));
        mark.html = html;
      }
      mark.name = name;
      if (mark.at.lat !== place.at.lat || mark.at.lng !== place.at.lng) {
        mark.at = place.at;
        mark.movedAt = Date.now();
        if (place.layer.live && !reduced) glide(map, place.key, mark);
        else {
          mark.marker.setLatLng([place.at.lat, place.at.lng]);
          follow(map, mark);
        }
      }
    }
    for (const [key, mark] of marks) {
      if (seen.has(key)) continue;
      if (mark.glide) cancelAnimationFrame(mark.glide);
      mark.marker.remove();
      marks.delete(key);
    }
    restale();
    drawRoutes(map, L);
    if (!fitted) fit(map);
  }

  function fit(map: Leaflet.Map) {
    const points = [...[...marks.values()].map((m) => m.at), ...[...routes.values()].flatMap((r) => r.found?.line ?? []), ...(mine ? [mine.at] : [])];
    if (!points.length) return;
    fitted = true;
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 15), { animate: false });
    else map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), { padding: [ROOM, ROOM], maxZoom: 16, animate: false });
  }

  /** A moving place glides to its new spot: along its route when it is on it, else straight. */
  function glide(map: Leaflet.Map, key: string, mark: Mark) {
    if (mark.glide) cancelAnimationFrame(mark.glide);
    const from = mark.marker.getLatLng();
    const to = mark.at;
    const path = routes.get(routeLayerFrom(key) ?? '')?.found?.path;
    let at = (t: number): LatLng => ({ lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t });
    if (path) {
      const a = nearestOnLine(path, from);
      const b = nearestOnLine(path, to);
      if (a.off < OFF_ROUTE_M && b.off < OFF_ROUTE_M && b.along >= a.along) at = (t) => pointAlong(path, a.along + (b.along - a.along) * t);
    }
    const start = performance.now();
    const step = (time: number) => {
      const t = Math.min(1, (time - start) / GLIDE_MS);
      // Eased in and out, as a thing that moves does.
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const place = t < 1 ? at(eased) : to;
      mark.marker.setLatLng([place.lat, place.lng]);
      if (t < 1) mark.glide = requestAnimationFrame(step);
      else {
        mark.glide = undefined;
        follow(map, mark);
      }
    };
    mark.glide = requestAnimationFrame(step);
  }

  /** The route that starts at a layer's place: its traveller's. */
  const routeLayerFrom = (key: string) => node.layers.find((layer) => layer.route?.from === key)?.id;

  /** A followed place kept in view, until the person moves the map. */
  function follow(map: Leaflet.Map, mark: Mark) {
    if (!mark.layer.live?.follow || userMoved || destroyed) return;
    map.panInside(mark.marker.getLatLng(), { padding: [ROOM, ROOM] });
  }

  /** A place whose news is old says when it was last seen, in the page's language, and greys. */
  function restale() {
    const words = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
    for (const mark of marks.values()) {
      const after = mark.layer.live?.staleAfter;
      const icon = mark.marker.getElement();
      const face = icon?.querySelector<HTMLElement>('.fd-map-face');
      if (!after || !icon || !face) continue;
      const seconds = (Date.now() - mark.movedAt) / 1000;
      const stale = seconds > after;
      face.toggleAttribute('data-stale', stale);
      let badge = face.querySelector<HTMLElement>('.fd-map-face-stale');
      if (!stale) {
        badge?.remove();
        icon.setAttribute('aria-label', mark.name);
        continue;
      }
      const minutes = Math.max(1, Math.round(seconds / 60));
      const time = minutes < 90 ? words.format(-minutes, 'minute') : words.format(-Math.round(minutes / 60), 'hour');
      if (!badge) {
        badge = doc.createElement('span');
        badge.className = 'fd-map-face-stale';
        face.append(badge);
      }
      badge.textContent = fill(labels.lastSeen, { time });
      icon.setAttribute('aria-label', `${mark.name}${comma(locale)}${badge.textContent}`);
    }
  }
  const staleTimer = setInterval(restale, 15_000);

  // ---- routes ------------------------------------------------------------------------

  /** Where a layer is now: one place's spot, or the reader's own. */
  const positionOf = (id: string): LatLng | null => (me?.id === id ? (mine?.at ?? null) : (marks.get(id)?.at ?? null));

  function drawRoutes(map: Leaflet.Map, L: LeafletModule) {
    const shownNow = expressionContext(values, page.fields);
    for (const layer of node.layers) {
      const route = layer.route;
      if (!route) continue;
      const off = hidden.get(layer.id)?.evaluate(shownNow);
      const from = positionOf(route.from);
      const to = route.to ? positionOf(route.to) : null;
      const via = route.through ? [...marks.entries()].filter(([key]) => key.startsWith(`${route.through}:`)).map(([, mark]) => mark.at) : [];
      let state = routes.get(layer.id);
      if (!state) routes.set(layer.id, (state = { layer, asking: 0, ends: '', askedAt: 0 }));
      // Hidden, or with an end missing: off the map, though what was found is kept for when it shows again.
      if (off || !from || (route.to && !to) || via.length + (to ? 1 : 0) < 1) {
        state.done?.remove();
        state.left?.remove();
        state.done = state.left = undefined;
        continue;
      }
      const ends = JSON.stringify([...via, ...(to ? [to] : [])].map((p) => [p.lat.toFixed(5), p.lng.toFixed(5)]));
      const away = state.found ? nearestOnLine(state.found.path, from).off : Infinity;
      const fresh = ends !== state.ends || (away > OFF_ROUTE_M && Date.now() - state.askedAt > ROUTE_EVERY_MS);
      if (fresh) ask(state, [from, ...via, ...(to ? [to] : [])], ends);
      if (state.found) drawRoute(map, L, state, from);
    }
  }

  function ask(state: RouteState, points: LatLng[], ends: string) {
    const finder = settings.route ?? settings.provider.route;
    state.ends = ends;
    state.askedAt = Date.now();
    if (!finder) {
      warnOnce(`This map has a route, and its provider "${settings.provider.id}" finds none: give mapParts a provider with routes, or the app's own route.`);
      return say(labels.routeFailed);
    }
    state.abort?.abort();
    const abort = new AbortController();
    state.abort = abort;
    const asked = ++state.asking;
    finder({ points, mode: state.layer.route?.mode ?? 'car', locale, signal: abort.signal })
      .then((found) => {
        if (asked !== state.asking || destroyed) return;
        state.found = { ...found, path: routeLine(found.line) };
        say('');
        box.ready((map, L) => {
          const from = positionOf(state.layer.route!.from);
          if (from) drawRoute(map, L, state, from);
          // The first route shows whole, unless the person has moved the map.
          if (!userMoved && state.written === undefined) {
            fitted = false;
            fit(map);
          }
        });
      })
      .catch((error: Error) => {
        if (abort.signal.aborted || destroyed) return;
        warnOnce(`A route could not be found: ${error.message}`);
        say(labels.routeFailed);
      });
  }

  /** The route as it stands: the part travelled faded, the part left bright; its numbers written where the page says. */
  function drawRoute(map: Leaflet.Map, L: LeafletModule, state: RouteState, from: LatLng) {
    const found = state.found!;
    const route = state.layer.route!;
    let left = found.path.line;
    let done: LatLng[] = [];
    let seconds = found.seconds;
    let metres = found.metres;
    if (route.progress) {
      const on = nearestOnLine(found.path, from);
      ({ done, left } = splitLine(found.path, on));
      const share = found.path.metres ? on.along / found.path.metres : 0;
      seconds = found.seconds * (1 - share);
      metres = Math.max(0, found.metres * (1 - share));
    }
    const latLngs = (line: LatLng[]) => line.map((p) => [p.lat, p.lng] as [number, number]);
    if (done.length > 1) {
      if (state.done) state.done.setLatLngs(latLngs(done));
      else state.done = L.polyline(latLngs(done), { className: 'fd-map-route-done', interactive: false }).addTo(map);
    } else {
      state.done?.remove();
      state.done = undefined;
    }
    if (state.left) state.left.setLatLngs(latLngs(left));
    else state.left = L.polyline(latLngs(left), { className: 'fd-map-route', interactive: false }).addTo(map);
    write(state, seconds, metres);
  }

  /** The route's numbers into the record's fields the page names, when they change: never in the middle of the form's own update. */
  function write(state: RouteState, seconds: number, metres: number) {
    const into = state.layer.route?.write;
    if (!into) return;
    const changes: [string, Value][] = [];
    if (into.seconds && values[into.seconds] !== Math.round(seconds)) changes.push([into.seconds, Math.round(seconds)]);
    if (into.metres && values[into.metres] !== Math.round(metres)) changes.push([into.metres, Math.round(metres)]);
    if (into.line && state.written !== state.asking) {
      const line = state.found!.line.map((p) => [Math.round(p.lng * 1e6) / 1e6, Math.round(p.lat * 1e6) / 1e6]);
      changes.push([into.line, { type: 'LineString', coordinates: line }]);
    }
    state.written = state.asking;
    if (!changes.length) return;
    // The app's change, not a person's: the page's change steps do not run for it.
    queueMicrotask(() => !destroyed && form.setValues(Object.fromEntries(changes)));
  }

  // ---- a card, the reader's own place, and the words over the map ----------------------

  function showCard(map: Leaflet.Map, L: LeafletModule, key: string, height: number, focus: boolean) {
    const mark = marks.get(key);
    const place = placesNow(values).find((p) => p.key === key);
    if (!mark || !place?.layer.card) return;
    closeCard(map, false);
    const scope = pinsOf.get(place.layer.id)!.scope;
    const card = drawCard({
      document: doc,
      page: scope,
      locale,
      labels,
      dir: doc.defaultView?.getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr',
      card: { ...place.layer.card, open: false },
      title: place.layer.card.title ?? '',
      fields: place.layer.card.fields ?? [],
      record: place.record,
      close: () => closeCard(map, true),
    });
    const back = mark.marker.getElement() ?? null;
    openCard = { popup: popCard(map, L, { at: mark.at, height, card, focus, escape: () => closeCard(map, true) }), back };
  }

  function closeCard(map: Leaflet.Map, back: boolean) {
    if (!openCard) return;
    const { popup, back: to } = openCard;
    openCard = null;
    map.closePopup(popup);
    if (back) to?.focus();
  }

  function say(words: string) {
    note.textContent = words;
    note.hidden = !words;
  }

  /** The reader's own place: asked of the browser only when they press for it, then kept up to date. */
  function locateMe() {
    const geo = doc.defaultView?.navigator.geolocation;
    if (watching !== null) {
      geo?.clearWatch(watching);
      watching = null;
      locate.setAttribute('aria-pressed', 'false');
      return;
    }
    if (!geo) return say(labels.locationFailed);
    locate.setAttribute('aria-pressed', 'true');
    say(labels.locating);
    let first = true;
    watching = geo.watchPosition(
      (position) => {
        mine = { at: { lat: position.coords.latitude, lng: position.coords.longitude }, accuracy: position.coords.accuracy };
        say('');
        box.ready((map, L) => {
          const at: [number, number] = [mine!.at.lat, mine!.at.lng];
          if (!meMark) meMark = L.marker(at, { icon: L.divIcon({ className: 'fd-map-me', iconSize: [18, 18] }), keyboard: false, interactive: false }).addTo(map);
          else meMark.setLatLng(at);
          if (!meCircle) meCircle = L.circle(at, { radius: mine!.accuracy, className: 'fd-map-accuracy', interactive: false }).addTo(map);
          else meCircle.setLatLng(at).setRadius(mine!.accuracy);
          drawRoutes(map, L);
          if (first) {
            first = false;
            fitted = false;
            fit(map);
          }
        });
      },
      (error) => {
        say(error.code === error.PERMISSION_DENIED ? labels.locationBlocked : labels.locationFailed);
        locate.setAttribute('aria-pressed', 'false');
        if (watching !== null) geo.clearWatch(watching);
        watching = null;
      },
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );
  }

  box.ready((map, L) => {
    box.element.append(note, followButton, ...(me ? [locate] : []));
    box.shield(followButton);
    box.shield(locate);
    box.follow(note);
    box.follow(followButton);
    locate.addEventListener('click', locateMe);
    followButton.addEventListener('click', () => {
      userMoved = false;
      followButton.hidden = true;
      const followed = [...marks.values()].find((mark) => mark.layer.live?.follow);
      if (followed) map.panTo(followed.marker.getLatLng());
    });
    map.on('moveend', () => {
      if (moving && following) {
        userMoved = true;
        followButton.hidden = false;
      }
      moving = false;
    });
    map.on('popupclose', (event: Leaflet.PopupEvent) => {
      if (openCard?.popup === event.popup) openCard = null;
    });
    draw(map, L);
  });

  return {
    element,
    update(state: FormState) {
      values = state.values;
      box.refresh();
      box.ready((map, L) => draw(map, L));
    },
    destroy() {
      destroyed = true;
      clearInterval(staleTimer);
      if (watching !== null) doc.defaultView?.navigator.geolocation.clearWatch(watching);
      for (const mark of marks.values()) if (mark.glide) cancelAnimationFrame(mark.glide);
      for (const route of routes.values()) route.abort?.abort();
      box.element.removeEventListener('pointerdown', pressed, { capture: true });
      box.element.removeEventListener('keydown', keyed, { capture: true });
      box.element.removeEventListener('wheel', wheeled, { capture: true });
      box.destroy();
    },
  };
}
