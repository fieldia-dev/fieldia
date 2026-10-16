import type * as Leaflet from 'leaflet';
import type { Value } from '@fieldia/core';
import { formatNumber, guard, numberRules, refusalHint, stillShown, type Guard, type RefusalHint, type Widget, type WidgetContext, type WidgetFactory, type WidgetState } from '@fieldia/widgets';
import { addressLine } from './address-line';
import { asJson, isLatLng, parseCoordinate, readPoint, writePoint, type LatLng } from './geo';
import { fill, mapLabels } from './labels';
import type { LeafletModule } from './leaflet';
import { createMapBox, mapTools, warnOnce } from './map-core';
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
 * (on unless false), `search` (on unless false), `zoom` (15), `height`,
 * `tools` (any of satellite, fullscreen, measure, under the zoom).
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
      tools: mapTools(options['tools']),
    });

    // ---- the coordinates, typeable -------------------------------------------
    const coords = doc.createElement('div');
    coords.className = 'fd-map-coords';
    const locale = context.locale ?? 'en';
    /**
     * A coordinate's box, guarded as every number box is (FIELDIA INPUT RULES): letters and a misplaced minus are
     * refused as they are typed, said under the box (after its label, so the words never join the box's name), and
     * the keys typed after a refused one are held with it. A coordinate is never grouped: its one mark is decimal.
     */
    const checks: Guard[] = [];
    const hints: RefusalHint[] = [];
    const coordinate = (words: string, inputId: string) => {
      const label = doc.createElement('label');
      const input = doc.createElement('input');
      input.className = 'fd-input';
      input.id = inputId;
      input.inputMode = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      label.append(words, input);
      coords.append(label);
      const box = { label: words, locale, labels: context.labels, limits: () => ({ ungrouped: true }) };
      hints.push(refusalHint(input, label));
      checks.push(guard(input, numberRules(box), hints[hints.length - 1]));
      return input;
    };
    const lat = coordinate(labels.latitude, search ? `${id}-lat` : id);
    const lng = coordinate(labels.longitude, `${id}-lng`);
    /**
     * The text each box was left with that does not read. The form keeps it as the place's field's unread text (its
     * latitude's, for a place in two number fields: the field the page places), with why, so its check and save
     * refuse it — never a place saved half new, the new latitude with the old longitude.
     */
    let left: [string | null, string | null] = [null, null];
    /** Which of the two boxes does not read: the other, kept as typed beside it, is not marked. */
    let wrong: [boolean, boolean] = [false, false];
    const unread = () => form.getState().unread?.[name];
    /** Why a coordinate typed is none: no number in its range (or none, beside the other). */
    const why = (i: number, value: number | null): string | null => {
      const most = i === 0 ? 90 : 180;
      if (value !== null && Math.abs(value) <= most) return null;
      return fill(labels.coordinateRange, { label: i === 0 ? labels.latitude : labels.longitude, min: formatNumber(-most, 0, locale), max: formatNumber(most, 0, locale) });
    };
    /** The text left unread let go: a place set since, or the boxes put right. */
    const letGo = () => {
      left = [null, null];
      wrong = [false, false];
      if (unread()) form.setUnread(name, null);
    };
    const typed = () => {
      // Keys held after a refused one are part of what was typed: the box shows them, marked, with why in the note.
      const held = checks.map((guarded) => guarded.held());
      [lat, lng].forEach((input, i) => {
        if (!held[i]) return;
        hints[i].hide();
        input.value = (held[i] as { text: string }).text;
        checks[i].accept();
      });
      const texts = [lat.value, lng.value] as const;
      const empty = !texts[0].trim() && !texts[1].trim();
      const words = texts.map((text, i) => (empty ? null : (held[i]?.words ?? why(i, parseCoordinate(text, locale)))));
      lat.setAttribute('aria-invalid', String(!!words[0]));
      lng.setAttribute('aria-invalid', String(!!words[1]));
      if (words[0] || words[1]) {
        // Kept as typed, marked, with why: in the note under the map, and in the form, whose save refuses it.
        say(words[0] ?? words[1], 'error');
        // Both boxes stay as typed while the place does not read: a coordinate that reads is never put back, under the
        // other still to come, by the place the field held ("30.0444" typed, then the longitude's box entered).
        left = [texts[0], texts[1]];
        wrong = [!!words[0], !!words[1]];
        form.setUnread(name, { text: `${texts[0]} ${texts[1]}`.trim(), message: (words[0] ?? words[1]) as string });
        return;
      }
      letGo();
      say(null);
      if (empty) return set(null);
      set({ lat: parseCoordinate(texts[0], locale)!, lng: parseCoordinate(texts[1], locale)! }, { fly: true, name: true });
    };
    [lat, lng].forEach((input, i) => {
      input.addEventListener('change', typed);
      input.addEventListener('keydown', (event) => event.key === 'Enter' && (event.preventDefault(), typed()));
      // Keys held change nothing the box shows, so no change is said for them: leaving reads them.
      input.addEventListener('blur', () => checks[i].held() && typed());
    });

    // ---- writing ---------------------------------------------------------------
    /** While the widget writes its own place: shown already, and in two fields half written at first (the new latitude, the old longitude), which is no place. */
    let writing = false;
    function write(next: LatLng | null) {
      writing = true;
      try {
        if (inFields) {
          form.setValue(name, next ? round6(next.lat) : null);
          form.setValue(longitudeField!, next ? round6(next.lng) : null);
        } else form.setValue(name, next ? asJson(writePoint(next)) : null);
      } finally {
        writing = false;
      }
    }

    let naming: AbortController | null = null;
    /** A place picked from the search, while where it is is found: a save waits for it. */
    let finding: Promise<void> | null = null;
    /** The address from the point, where the provider can say one, unless a person typed their own. */
    function nameFrom(at: LatLng) {
      if (!addressField || !reverse) return;
      const current = values[addressField];
      if (current !== null && current !== undefined && current !== '' && current !== addressWritten) return;
      naming?.abort();
      naming = new AbortController();
      // Named for the record shown now: found once another is shown, it names nothing of that one.
      const asked = stillShown(form);
      reverse({ ...at, locale: context.locale ?? 'en', signal: naming.signal })
        .then((label) => {
          if (!label || !asked()) return;
          addressWritten = label;
          form.setValue(addressField, label);
        })
        .catch((error: Error) => error.name !== 'AbortError' && warnOnce(`Naming the place failed: ${error.message}`));
    }

    function set(next: LatLng | null, how: { fly?: boolean; name?: boolean; address?: string; within?: number } = {}) {
      if (readonly) return;
      // A place set — typed, clicked, dragged, found — is the boxes' now: text left in them unread goes.
      if (left[0] !== null || left[1] !== null) letGo();
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
          // Nearest where the map is looking first, as a map's own search does; a map of the whole world or a continent (no centre given, nothing picked yet) looks nowhere: not the Sahara in its middle.
          near: () => {
            const centre = shown && shown.getZoom() >= 5 ? shown.getCenter() : null;
            return centre ? { lat: centre.lat, lng: centre.lng } : (point ?? settings.center);
          },
          zoom: () => shown?.getZoom(),
          // A place picked: where it is (looked up now, when the provider's suggestions carry no place), and its whole address
          // for Address. A save made while it is found waits for it (`finding`): the place picked is what is saved.
          pick: (place) => {
            const asked = stillShown(form);
            const run = (async () => {
              const located =
                place.lat !== undefined && place.lng !== undefined
                  ? { lat: place.lat, lng: place.lng, address: undefined }
                  : await place.locate?.().catch((error: Error) => (warnOnce(`Finding the place picked failed: ${error.message}`), null));
              // Picked on a record no longer shown: placed on no other.
              if (!asked()) return;
              if (!located) return say(labels.searchFailed, 'error');
              set({ lat: located.lat, lng: located.lng }, { fly: true, address: addressLine(located.address ? [located.address] : [place.label, place.detail], context.locale) });
            })();
            finding = run;
            void run.finally(() => {
              if (finding === run) finding = null;
            });
            return run;
          },
          say,
        })
      : null;
    if (found) tools.append(found.element);
    const stopReading = typeof form.settling === 'function' ? form.settling(() => finding ?? undefined) : null;

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
      const asked = stillShown(form);
      geolocation.getCurrentPosition(
        (position) => {
          // Found once another record is shown: placed on no other.
          if (!asked()) return say(null);
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
      ([[lat, point?.lat], [lng, point?.lng]] as const).forEach(([input, n], i) => {
        // Text left that does not read stays as typed, marked, while the form keeps it; else the place's coordinate.
        if (left[i] !== null && !unread()) left[i] = null;
        if (doc.activeElement === input) return;
        const kept = left[i];
        input.value = kept ?? (n === undefined ? '' : String(n));
        checks[i].accept();
        input.setAttribute('aria-invalid', String(kept !== null && wrong[i]));
      });
    };

    return {
      element,
      focus: () => (found?.input ?? lat).focus(),
      destroy: () => {
        stopReading?.();
        checks.forEach((guarded) => guarded.destroy());
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
        // Its own place, as set() has it: not one written by another field.
        const changed = !writing && (next?.lat !== point?.lat || next?.lng !== point?.lng);
        if (!writing) point = next;
        tools.hidden = readonly;
        myLocation.hidden = !geolocation || blocked || readonly;
        for (const input of [lat, lng]) input.readOnly = readonly;
        const target = found?.input ?? lat;
        // The latitude's box, when it is the one the field's label names, stays marked while its text is unread.
        target.setAttribute('aria-invalid', String(state.invalid || (target === lat && wrong[0] && !!unread())));
        target.setAttribute('aria-required', String(state.required));
        if (state.describedBy) target.setAttribute('aria-describedby', state.describedBy);
        else target.removeAttribute('aria-describedby');
        lat.setAttribute('aria-required', String(state.required));
        showCoords();
        box.refresh();
        // Written by another field (an address picked) or a record: the map goes to it, as close as a place is shown. In view already is not enough: a map on the whole world (no centre given) has every place in view.
        if (changed) show(true);
        else clear.hidden = readonly || !point;
      },
    };
  };
}
