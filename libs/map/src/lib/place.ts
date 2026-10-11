import type * as Leaflet from 'leaflet';
import type { Value } from '@fieldia/core';
import { formatNumber, type Widget, type WidgetContext, type WidgetFactory, type WidgetState } from '@fieldia/widgets';
import { asJson, isLatLng, parseCoordinate, readPoint, writePoint, type LatLng } from './geo';
import { fill, mapLabels } from './labels';
import type { LeafletModule } from './leaflet';
import { createMapBox } from './map-core';
import { searchBox } from './search-box';
import type { MapSettings } from './settings';

/**
 * A place on a form: a click on the map, a dragged pin, an address found,
 * or "My location". Kept as a GeoJSON Point in a json field, or in two
 * number fields (`latitude` with `options.longitudeField`), the way Odoo
 * keeps a partner's place. The coordinates stay typeable under the map:
 * that is the way in without a mouse, beside Enter on the map (the place
 * at its centre) and the arrow keys on the pin.
 *
 * Options: `longitudeField`, `addressField` (filled from the address
 * found, or named from the point where the provider can), `myLocation`
 * (on unless false), `search` (on unless false), `zoom` (15), `height`.
 */

const PIN = `<svg viewBox="0 0 28 40" aria-hidden="true"><path class="fd-map-pin-body" d="M14 1C6.8 1 1 6.7 1 13.8 1 23.6 14 39 14 39s13-15.4 13-25.2C27 6.7 21.2 1 14 1z"/><circle class="fd-map-pin-dot" cx="14" cy="14" r="5"/></svg>`;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function placeWidget(settings: MapSettings): WidgetFactory {
  return (context: WidgetContext): Widget => {
    const { form, name, field, node, id, document: doc } = context;
    const options = node.options ?? {};
    const labels = mapLabels(context.locale, settings.labels?.[context.locale ?? 'en']);
    const longitudeField = typeof options['longitudeField'] === 'string' ? options['longitudeField'] : null;
    const addressField = typeof options['addressField'] === 'string' ? options['addressField'] : null;
    const inFields = field.type === 'float';
    if (inFields && !longitudeField) throw new Error(`The place on "${name}" keeps its latitude there and needs options.longitudeField for its longitude`);
    const zoom = typeof options['zoom'] === 'number' ? options['zoom'] : 15;
    const search = options['search'] === false ? undefined : (settings.search ?? settings.provider.search);
    const reverse = settings.reverse ?? settings.provider.reverse;
    const asYouType = settings.search ? (settings.searchAsYouType ?? true) : !!settings.provider.searchAsYouType;
    const geolocation = options['myLocation'] === false ? undefined : doc.defaultView?.navigator.geolocation;

    let readonly = false;
    let point: LatLng | null = null;
    /** The address this field last wrote: one a person typed is never written over. */
    let addressWritten: Value | undefined;
    let values: Readonly<Record<string, Value>> = form.getState().values;

    const element = doc.createElement('div');
    element.className = 'fd-map-field fd-place';
    element.setAttribute('role', 'group');
    element.setAttribute('aria-labelledby', `${id}-label`);
    const tools = doc.createElement('div');
    tools.className = 'fd-map-tools';
    const note = doc.createElement('p');
    note.className = 'fd-map-note';
    note.setAttribute('aria-live', 'polite');
    note.hidden = true;
    const say = (words: string | null, tone?: 'error') => {
      note.textContent = words ?? '';
      note.hidden = !words;
      if (tone) note.dataset['tone'] = tone;
      else delete note.dataset['tone'];
    };

    const box = createMapBox({
      document: doc,
      provider: settings.provider,
      locale: context.locale ?? 'en',
      labels,
      name: field.label,
      keys: labels.placeKeys,
      center: settings.center,
      zoom: settings.center ? (settings.zoom ?? 11) : undefined,
      height: typeof options['height'] === 'number' ? options['height'] : undefined,
    });

    // ---- the coordinates, typeable -------------------------------------------
    const coords = doc.createElement('div');
    coords.className = 'fd-map-coords';
    const coordinate = (words: string, inputId: string) => {
      const label = doc.createElement('label');
      const input = doc.createElement('input');
      input.className = 'fd-input';
      input.id = inputId;
      input.inputMode = 'decimal';
      input.autocomplete = 'off';
      input.spellcheck = false;
      label.append(words, input);
      coords.append(label);
      return input;
    };
    const lat = coordinate(labels.latitude, search ? `${id}-lat` : id);
    const lng = coordinate(labels.longitude, `${id}-lng`);
    const typed = () => {
      const a = parseCoordinate(lat.value);
      const b = parseCoordinate(lng.value);
      const empty = !lat.value.trim() && !lng.value.trim();
      const good = empty || isLatLng(a, b);
      lat.setAttribute('aria-invalid', String(!good || (a !== null && Math.abs(a) > 90)));
      lng.setAttribute('aria-invalid', String(!good || (b !== null && Math.abs(b) > 180)));
      if (!good) return say(labels.notACoordinate, 'error');
      say(null);
      if (empty) return set(null);
      set({ lat: a!, lng: b! }, { fly: true, name: true });
    };
    for (const input of [lat, lng]) {
      input.addEventListener('change', typed);
      input.addEventListener('keydown', (event) => event.key === 'Enter' && (event.preventDefault(), typed()));
    }

    // ---- writing ---------------------------------------------------------------
    function write(next: LatLng | null) {
      if (inFields) {
        form.setValue(name, next ? round6(next.lat) : null);
        form.setValue(longitudeField!, next ? round6(next.lng) : null);
      } else form.setValue(name, next ? asJson(writePoint(next)) : null);
    }

    let naming: AbortController | null = null;
    /** The address from the point, where the provider can say one, unless a person typed their own. */
    function nameFrom(at: LatLng) {
      if (!addressField || !reverse) return;
      const current = values[addressField];
      if (current !== null && current !== undefined && current !== '' && current !== addressWritten) return;
      naming?.abort();
      naming = new AbortController();
      reverse({ ...at, locale: context.locale ?? 'en', signal: naming.signal })
        .then((label) => {
          if (!label) return;
          addressWritten = label;
          form.setValue(addressField, label);
        })
        .catch(() => undefined);
    }

    function set(next: LatLng | null, how: { fly?: boolean; name?: boolean; address?: string; within?: number } = {}) {
      if (readonly) return;
      // How sure "My location" was: a circle while the place is the one it gave.
      showAccuracy(next && how.within !== undefined ? { at: next, metres: how.within } : null);
      if (next) next = { lat: round6(next.lat), lng: round6(next.lng) };
      point = next;
      show(how.fly);
      write(next);
      if (next && how.address !== undefined && addressField) {
        addressWritten = how.address;
        form.setValue(addressField, how.address);
      } else if (next && how.name) nameFrom(next);
    }

    // ---- the map and its pin ---------------------------------------------------
    let marker: Leaflet.Marker | null = null;
    let accuracy: Leaflet.Circle | null = null;
    /** The map, once it is there: where it is and how close, for the search's "near". */
    let shown: Leaflet.Map | null = null;

    /** The circle a rough location may be anywhere in, fitted into view; a desktop's is often kilometres wide. */
    function showAccuracy(within: { at: LatLng; metres: number } | null) {
      box.ready((map, L) => {
        accuracy?.remove();
        accuracy = null;
        if (!within) return;
        accuracy = L.circle([within.at.lat, within.at.lng], { radius: within.metres, className: 'fd-map-accuracy', interactive: false }).addTo(map);
        map.fitBounds(accuracy.getBounds(), { padding: [24, 24], maxZoom: zoom });
      });
    }
    function show(fly = false) {
      clear.hidden = readonly || !point;
      box.ready((map, L) => {
        if (!point) {
          marker?.remove();
          marker = null;
          return;
        }
        const at: [number, number] = [point.lat, point.lng];
        if (!marker) marker = makeMarker(map, L, at);
        else marker.setLatLng(at);
        if (marker.dragging) {
          if (readonly) marker.dragging.disable();
          else marker.dragging.enable();
        }
        marker.getElement()?.setAttribute('aria-label', `${field.label}: ${point.lat}, ${point.lng}`);
        if (fly) map.setView(at, Math.max(map.getZoom(), zoom));
        // A rough location's circle has fitted the map already.
        else if (!accuracy && !map.getBounds().contains(at)) map.setView(at, map.getZoom() < 5 ? zoom : map.getZoom());
      });
    }

    function makeMarker(map: Leaflet.Map, L: LeafletModule, at: [number, number]) {
      const icon = L.divIcon({ className: 'fd-map-pin', html: PIN, iconSize: [28, 40], iconAnchor: [14, 39] });
      const pin = L.marker(at, { icon, draggable: !readonly, keyboard: true, autoPan: true }).addTo(map);
      pin.on('dragend', () => {
        const moved = pin.getLatLng();
        set({ lat: moved.lat, lng: moved.lng }, { name: true });
      });
      // The arrow keys carry the pin a few pixels; Shift, further.
      pin.getElement()?.addEventListener('keydown', (event) => {
        const step = event.shiftKey ? 16 : 4;
        const by = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[event.key];
        if (!by || readonly) return;
        event.preventDefault();
        event.stopPropagation();
        const there = map.containerPointToLatLng(map.latLngToContainerPoint(pin.getLatLng()).add(L.point(by[0], by[1])));
        set({ lat: there.lat, lng: there.lng }, { name: true });
      });
      return pin;
    }

    box.ready((map) => {
      shown = map;
      map.on('click', (event: Leaflet.LeafletMouseEvent) => set({ lat: event.latlng.lat, lng: event.latlng.lng }, { name: true }));
      // Enter on the map: the place at its centre, where the cross is.
      box.element.addEventListener('keydown', (event) => {
        if ((event.key !== 'Enter' && event.key !== ' ') || event.target !== box.element || readonly) return;
        event.preventDefault();
        const centre = map.getCenter();
        set({ lat: centre.lat, lng: centre.lng }, { name: true });
      });
      show(true);
    });

    /** "3 km", "400 m", in the page's language and its way of writing numbers. */
    const distance = (metres: number) =>
      metres >= 1000 ? fill(labels.kilometres, { n: formatNumber(Math.round(metres / 1000), 0, context.locale ?? 'en') }) : fill(labels.metres, { n: formatNumber(Math.round(metres / 10) * 10, 0, context.locale ?? 'en') });

    // ---- search, my location, clear ---------------------------------------------
    const found = search
      ? searchBox({
          document: doc,
          id: lat.id === id ? `${id}-search` : id,
          labels,
          search,
          asYouType: asYouType,
          locale: context.locale ?? 'en',
          // Nearest where the map is looking first, as a map's own search does.
          near: () => {
            const centre = shown?.getCenter();
            return centre ? { lat: centre.lat, lng: centre.lng } : (point ?? settings.center);
          },
          zoom: () => shown?.getZoom(),
          pick: (place) => set({ lat: place.lat, lng: place.lng }, { fly: true, address: place.label }),
          say,
        })
      : null;
    if (found) tools.append(found.element);

    const myLocation = doc.createElement('button');
    myLocation.type = 'button';
    myLocation.className = 'fd-button';
    myLocation.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
    myLocation.append(labels.myLocation);
    let blocked = false;
    myLocation.hidden = !geolocation;
    myLocation.addEventListener('click', () => {
      if (!geolocation) return;
      say(labels.locating);
      geolocation.getCurrentPosition(
        (position) => {
          const metres = Math.round(position.coords.accuracy);
          // Named only when it is sure: an address from a point kilometres off would be someone else's.
          set({ lat: position.coords.latitude, lng: position.coords.longitude }, { name: metres <= 100, within: metres });
          // A rough location says how rough: a desktop's comes from its network, and may be a city away.
          if (metres > 100) say(fill(labels.locatedWithin, { distance: distance(metres) }));
          else say(null);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            blocked = true;
            myLocation.hidden = true;
            say(labels.locationBlocked);
          } else say(labels.locationFailed, 'error');
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
      );
    });
    // Location blocked for the site: the button goes, with the reason in its place.
    doc.defaultView?.navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        const read = () => {
          blocked = status.state === 'denied';
          myLocation.hidden = !geolocation || blocked || readonly;
          if (blocked) say(labels.locationBlocked);
        };
        read();
        status.onchange = read;
      })
      .catch(() => undefined);

    const clear = doc.createElement('button');
    clear.type = 'button';
    clear.className = 'fd-button fd-button-link';
    clear.textContent = labels.clear;
    clear.hidden = true;
    clear.addEventListener('click', () => {
      set(null);
      say(null);
      (found?.input ?? lat).focus();
    });
    tools.append(myLocation, clear);
    element.append(tools, box.element, coords, note);

    const showCoords = () => {
      for (const [input, n] of [[lat, point?.lat], [lng, point?.lng]] as const) {
        if (doc.activeElement === input) continue;
        input.value = n === undefined ? '' : String(n);
        input.setAttribute('aria-invalid', 'false');
      }
    };

    return {
      element,
      focus: () => (found?.input ?? lat).focus(),
      destroy: () => {
        naming?.abort();
        found?.destroy();
        box.destroy();
      },
      update(state: WidgetState) {
        values = state.values;
        readonly = state.readonly;
        const next = inFields
          ? isLatLng(state.value, state.values[longitudeField!])
            ? { lat: state.value as number, lng: state.values[longitudeField!] as number }
            : null
          : readPoint(state.value);
        const changed = next?.lat !== point?.lat || next?.lng !== point?.lng;
        point = next;
        tools.hidden = readonly;
        myLocation.hidden = !geolocation || blocked || readonly;
        for (const input of [lat, lng]) input.readOnly = readonly;
        const target = found?.input ?? lat;
        target.setAttribute('aria-invalid', String(state.invalid));
        target.setAttribute('aria-required', String(state.required));
        if (state.describedBy) target.setAttribute('aria-describedby', state.describedBy);
        else target.removeAttribute('aria-describedby');
        lat.setAttribute('aria-required', String(state.required));
        showCoords();
        box.refresh();
        if (changed) show();
        else clear.hidden = readonly || !point;
      },
    };
  };
}
