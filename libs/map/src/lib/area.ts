import type * as Leaflet from 'leaflet';
import type { JsonValue } from '@fieldia/core';
import type { Widget, WidgetContext, WidgetFactory, WidgetState } from '@fieldia/widgets';
import { areaBounds, asJson, boxFrom, metresBetween, moveArea, offsetEast, readArea, writeArea, type Area, type CircleArea, type LatLng, type PointsArea, type Shape } from './geo';
import { fill, mapLabels } from './labels';
import type { LeafletModule } from './leaflet';
import { createMapBox } from './map-core';
import type { MapSettings } from './settings';

/**
 * An area on a form: a polygon, a box or a circle, kept in a json field as a
 * GeoJSON Feature (see geo.ts). One shape at a time; a new one replaces the
 * last. A finished shape keeps its grips: a point or a corner drags to
 * reshape it, a circle's edge to resize it and its centre to move it, the
 * whole shape drags to move it, and a point between two adds one there.
 *
 * Every tool works by mouse, finger, pen and keyboard. Pointer events carry
 * the drags, so a finger draws a box as a mouse does. On the keyboard the map's
 * centre (the cross) is the pointer: Space puts a point there, Enter
 * finishes, Backspace takes a point back, Escape stops; a focused grip moves
 * with the arrow keys and leaves with Delete.
 *
 * Options: `shapes` (any of polygon, box, circle; all unless said), `areas`
 * (named areas to choose from instead of drawing: `[{ label, value }]`),
 * `height`.
 */

const ALL: Shape[] = ['polygon', 'box', 'circle'];
const ICONS: Record<Shape, string> = {
  polygon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 8l7-5 7 6-3 11H7z"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>',
  circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>',
};
/** How near the first point a press closes the ring: a fingertip's width, not the mark's. */
const CLOSE_PX = 22;
/** A press that moves less than this is a press, not a drag. */
const DRAG_PX = 4;

interface NamedArea {
  label: string;
  value: JsonValue;
}

const same = (a: Area | null, b: Area | null) => JSON.stringify(a && writeArea(a)) === JSON.stringify(b && writeArea(b));

export function areaWidget(settings: MapSettings): WidgetFactory {
  return (context: WidgetContext): Widget => {
    const { form, name, field, node, id, document: doc } = context;
    const options = node.options ?? {};
    const labels = mapLabels(context.locale, settings.labels?.[context.locale ?? 'en']);
    // A list, or words with commas between ("polygon,box"), as the designer keeps a setting.
    const listed = Array.isArray(options['shapes']) ? (options['shapes'] as unknown[]) : typeof options['shapes'] === 'string' ? options['shapes'].split(',').map((s) => s.trim()) : null;
    const shapes = listed ? ALL.filter((s) => listed.includes(s)) : ALL;
    if (!shapes.length) shapes.push(...ALL);
    const named: NamedArea[] = Array.isArray(options['areas'])
      ? (options['areas'] as unknown[]).flatMap((a) => (a && typeof a === 'object' && typeof (a as NamedArea).label === 'string' ? [a as NamedArea] : []))
      : [];

    let readonly = false;
    let area: Area | null = null;
    let mode: Shape | null = null;
    /** A polygon's points so far. */
    let points: LatLng[] = [];
    /** Where a box or a circle began, by pointer or by Space. */
    let anchor: LatLng | null = null;

    const element = doc.createElement('div');
    element.className = 'fd-map-field fd-area';
    // The field's label names the group, so each tool keeps its own name ("Polygon", not "Area").
    element.id = id;
    element.setAttribute('role', 'group');
    element.setAttribute('aria-labelledby', `${id}-label`);
    const tools = doc.createElement('div');
    tools.className = 'fd-map-tools';
    const live = doc.createElement('div');
    live.className = 'fd-sr-only';
    live.setAttribute('aria-live', 'polite');
    const announce = (words: string) => {
      live.textContent = '';
      // A new node each time, so the same words are said again.
      setTimeout(() => (live.textContent = words), 30);
    };

    const box = createMapBox({
      document: doc,
      provider: settings.provider,
      locale: context.locale ?? 'en',
      labels,
      name: field.label,
      keys: labels.drawKeys,
      center: settings.center,
      zoom: settings.center ? (settings.zoom ?? 11) : undefined,
      height: typeof options['height'] === 'number' ? options['height'] : undefined,
    });

    const toolButtons = new Map<Shape, HTMLButtonElement>();
    shapes.forEach((shape) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'fd-button';
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = ICONS[shape];
      button.append(labels[shape]);
      button.addEventListener('click', () => arm(mode === shape ? null : shape));
      toolButtons.set(shape, button);
      tools.append(button);
    });
    let chooser: HTMLSelectElement | null = null;
    if (named.length) {
      chooser = doc.createElement('select');
      chooser.className = 'fd-input fd-select';
      chooser.setAttribute('aria-label', labels.chooseArea);
      const first = doc.createElement('option');
      first.value = '';
      first.textContent = labels.chooseArea;
      chooser.append(first);
      named.forEach((choice, i) => {
        const option = doc.createElement('option');
        option.value = String(i);
        option.textContent = choice.label;
        chooser!.append(option);
      });
      chooser.addEventListener('change', () => {
        const choice = named[Number(chooser!.value)];
        const chosen = choice ? readArea(choice.value) : null;
        if (!chosen) return;
        arm(null);
        commit(chosen, true);
      });
      tools.append(chooser);
    }
    const clear = doc.createElement('button');
    clear.type = 'button';
    clear.className = 'fd-button fd-button-link';
    clear.textContent = labels.clear;
    clear.hidden = true;
    clear.addEventListener('click', () => {
      arm(null);
      commit(null);
      announce(labels.shapeCleared);
      (toolButtons.get(shapes[0]) ?? box.element).focus();
    });
    tools.append(clear);

    // The bar over the map while a tool is in hand: what to do, and the ways out.
    const hint = doc.createElement('div');
    hint.className = 'fd-map-hint';
    hint.hidden = true;
    const hintWords = doc.createElement('p');
    const finishButton = doc.createElement('button');
    finishButton.type = 'button';
    finishButton.className = 'fd-button fd-button-primary';
    finishButton.textContent = labels.finish;
    finishButton.addEventListener('click', () => finish());
    const cancelButton = doc.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'fd-button';
    cancelButton.textContent = labels.cancel;
    cancelButton.addEventListener('click', () => arm(null));
    hint.append(hintWords, finishButton, cancelButton);
    box.element.append(hint);
    box.shield(hint);
    box.follow(hint);
    element.append(tools, box.element, live);

    // ---- the value -------------------------------------------------------------
    function commit(next: Area | null, fit = false) {
      area = next;
      clear.hidden = readonly || !area;
      form.setValue(name, area ? asJson(writeArea(area)) : null);
      draw(fit);
    }

    // ---- drawing on the map ----------------------------------------------------
    let map: Leaflet.Map | null = null;
    let L: LeafletModule | null = null;
    let shapeLayer: Leaflet.Path | null = null;
    let trace: Leaflet.Path | null = null;
    const grips: Leaflet.Marker[] = [];
    /** The grip under the hand: the others follow it, it follows the hand. */
    let held: Leaflet.Marker | null = null;
    /** A polygon's points while it is drawn, and the line reaching for the pointer. */
    const marks: Leaflet.Marker[] = [];

    function clearLayers() {
      shapeLayer?.remove();
      shapeLayer = null;
      for (const grip of grips.splice(0)) grip.remove();
    }

    function layerFor(shape: Area, className: string): Leaflet.Path {
      return shape.shape === 'circle'
        ? L!.circle([shape.center.lat, shape.center.lng], { radius: shape.radius, className, interactive: !readonly && !mode })
        : L!.polygon(shape.points.map((p) => [p.lat, p.lng] as [number, number]), { className, interactive: !readonly && !mode });
    }

    /** The shape as it now is, and its grips; `fit` brings it into view. */
    function draw(fit = false) {
      if (!map || !L) return;
      clearLayers();
      if (!area || mode) return;
      shapeLayer = layerFor(area, `fd-map-shape${readonly ? '' : ' fd-map-movable'}`).addTo(map);
      if (!readonly) {
        makeMovable(shapeLayer);
        placeGrips();
      }
      if (fit) {
        const b = areaBounds(area);
        map.fitBounds([[b.south, b.west], [b.north, b.east]], { padding: [32, 32], maxZoom: 17 });
      }
    }

    /** Changes the drawn outline in place while a grip moves: never torn down and drawn again. */
    function reshape(next: Area) {
      area = next;
      if (!shapeLayer || !L) return;
      if (next.shape === 'circle') {
        const circle = shapeLayer as Leaflet.Circle;
        circle.setLatLng([next.center.lat, next.center.lng]);
        circle.setRadius(next.radius);
      } else (shapeLayer as Leaflet.Polygon).setLatLngs(next.points.map((p) => [p.lat, p.lng] as [number, number]));
    }

    function gripIcon(extra = '') {
      return L!.divIcon({ className: `fd-map-grip${extra}`, iconSize: [24, 24], iconAnchor: [12, 12] });
    }

    function grip(at: LatLng, words: string, onMove: (to: LatLng) => void, extra = '', onDelete?: () => void): Leaflet.Marker {
      const marker = L!.marker([at.lat, at.lng], { icon: gripIcon(extra), draggable: true, keyboard: true, autoPan: true }).addTo(map!);
      const el = marker.getElement()!;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${words}. ${labels.gripKeys}`);
      marker.on('dragstart', () => (held = marker));
      marker.on('drag', () => {
        const to = marker.getLatLng();
        onMove({ lat: to.lat, lng: to.lng });
      });
      marker.on('dragend', () => {
        held = null;
        commit(area, false);
      });
      el.addEventListener('keydown', (event) => {
        if ((event.key === 'Delete' || event.key === 'Backspace') && onDelete) {
          event.preventDefault();
          event.stopPropagation();
          onDelete();
          return;
        }
        const step = event.shiftKey ? 16 : 4;
        const by = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[event.key];
        if (!by) return;
        event.preventDefault();
        event.stopPropagation();
        const to = map!.containerPointToLatLng(map!.latLngToContainerPoint(marker.getLatLng()).add(L!.point(by[0], by[1])));
        onMove({ lat: to.lat, lng: to.lng });
        commit(area, false);
        focusGrip(words);
      });
      grips.push(marker);
      return marker;
    }

    /** After the grips are placed again, the one being moved by keys keeps the focus. */
    function focusGrip(words: string) {
      const again = grips.find((g) => g.getElement()?.getAttribute('aria-label')?.startsWith(words));
      again?.getElement()?.focus();
    }

    /** The others follow the one in hand: every grip where the shape now says. */
    function follow() {
      if (!area) return;
      const places = gripPlaces(area);
      grips.forEach((g, i) => g !== held && places[i] && g.setLatLng([places[i].lat, places[i].lng]));
    }

    function gripPlaces(shape: Area): LatLng[] {
      if (shape.shape === 'circle') return [shape.center, offsetEast(shape.center, shape.radius)];
      const corners = shape.points;
      if (shape.shape === 'box') return corners;
      const middles = corners.map((p, i) => {
        const q = corners[(i + 1) % corners.length];
        return { lat: (p.lat + q.lat) / 2, lng: (p.lng + q.lng) / 2 };
      });
      return [...corners, ...middles];
    }

    function placeGrips() {
      if (!area) return;
      const shape = area;
      if (shape.shape === 'circle') {
        grip(shape.center, labels.centre, (to) => {
          const current = area as CircleArea;
          reshape({ ...current, center: to });
          follow();
        });
        grip(offsetEast(shape.center, shape.radius), labels.edge, (to) => {
          const current = area as CircleArea;
          reshape({ ...current, radius: Math.max(1, metresBetween(current.center, to)) });
        });
        return;
      }
      if (shape.shape === 'box') {
        shape.points.forEach((_, i) => {
          // Each corner drags against the one across from it, where it was when the drag began:
          // read again from the box as it changes, it would be another corner once the box turns over.
          const opposite = shape.points[(i + 2) % 4];
          grip(shape.points[i], fill(labels.point, { n: i + 1 }), (to) => {
            reshape({ shape: 'box', points: boxFrom(to, opposite) });
            follow();
          });
        });
        return;
      }
      const corners = shape.points;
      corners.forEach((_, i) => {
        grip(
          corners[i],
          fill(labels.point, { n: i + 1 }),
          (to) => {
            const current = area as PointsArea;
            reshape({ shape: 'polygon', points: current.points.map((p, j) => (j === i ? to : p)) });
            follow();
          },
          '',
          corners.length > 3
            ? () => {
                const current = area as PointsArea;
                commit({ shape: 'polygon', points: current.points.filter((_, j) => j !== i) });
                grips[Math.min(i, grips.length - 1)]?.getElement()?.focus();
              }
            : undefined
        );
      });
      // A point between two: dragged, it becomes a point of the shape there.
      corners.forEach((_, i) => {
        let added = false;
        grip(
          gripPlaces(shape)[corners.length + i],
          labels.addPoint,
          (to) => {
            const current = (area as PointsArea).points;
            const next = added ? current.map((p, j) => (j === i + 1 ? to : p)) : [...current.slice(0, i + 1), to, ...current.slice(i + 1)];
            added = true;
            reshape({ shape: 'polygon', points: next });
          },
          ' fd-map-grip-add'
        );
      });
    }

    /** The whole shape, carried by a press on it. */
    function makeMovable(layer: Leaflet.Path) {
      const el = layer.getElement() as SVGElement | undefined;
      if (!el) return;
      el.addEventListener('pointerdown', (event: PointerEvent) => {
        if (!map || !area || readonly || mode || event.button !== 0) return;
        event.stopPropagation();
        const start = map.mouseEventToLatLng(event as unknown as MouseEvent);
        const from = area;
        let moved = false;
        map.dragging.disable();
        const target = box.element;
        target.setPointerCapture?.(event.pointerId);
        const move = (e: PointerEvent) => {
          const now = map!.mouseEventToLatLng(e as unknown as MouseEvent);
          moved = true;
          reshape(moveArea(from, now.lat - start.lat, now.lng - start.lng));
          follow();
        };
        const up = () => {
          target.removeEventListener('pointermove', move);
          target.removeEventListener('pointerup', up);
          target.removeEventListener('pointercancel', up);
          box.setPannable(true);
          if (moved) commit(area);
        };
        target.addEventListener('pointermove', move);
        target.addEventListener('pointerup', up);
        target.addEventListener('pointercancel', up);
      });
    }

    // ---- the tools ---------------------------------------------------------------
    function sayStep() {
      if (!mode) return;
      const words = mode === 'polygon' ? labels.drawPolygon : mode === 'box' ? labels.drawBox : labels.drawCircle;
      hintWords.textContent = mode === 'polygon' && points.length ? `${words} ${fill(labels.points, { n: points.length })}.` : words;
      finishButton.hidden = mode !== 'polygon' || points.length < 3;
    }

    function arm(next: Shape | null) {
      if (readonly) next = null;
      mode = next;
      points = [];
      anchor = null;
      trace?.remove();
      trace = null;
      remark();
      for (const [shape, button] of toolButtons) button.setAttribute('aria-pressed', String(shape === mode));
      hint.hidden = !mode;
      // Every tool holds the ground still: a press is a point, never a pan.
      box.setPannable(!mode);
      box.ready((m) => (mode ? m.doubleClickZoom.disable() : m.doubleClickZoom.enable()));
      box.element.dataset['drawing'] = mode ?? '';
      if (!mode) delete box.element.dataset['drawing'];
      sayStep();
      draw();
      if (mode) announce(hintWords.textContent ?? '');
    }

    /** The marks of a polygon's points: made again only when the points change, never as the pointer moves. */
    function remark() {
      for (const m of marks.splice(0)) m.remove();
      if (!map || !L || mode !== 'polygon') return;
      points.forEach((p, i) => {
        const mark = L!.marker([p.lat, p.lng], { icon: gripIcon(), interactive: i === 0, keyboard: false }).addTo(map!);
        // Back on the first point closes the ring.
        if (i === 0) mark.on('click', () => points.length >= 3 && finish());
        marks.push(mark);
      });
    }

    /** The outline being drawn, toward the pointer: changed in place as it moves. */
    function retrace(toward?: LatLng) {
      if (!map || !L) return;
      let ring: LatLng[] | null = null;
      let circle: { center: LatLng; radius: number } | null = null;
      if (mode === 'polygon') {
        ring = [...points, ...(toward ? [toward] : [])];
        if (ring.length < 2) ring = null;
        marks[0]?.getElement()?.toggleAttribute('data-closes', nearFirst(toward));
      } else if (anchor && toward) {
        if (mode === 'box') ring = boxFrom(anchor, toward);
        else circle = { center: anchor, radius: metresBetween(anchor, toward) };
      }
      const latLngs = ring?.map((p) => [p.lat, p.lng] as [number, number]);
      if (trace && latLngs && trace instanceof L.Polygon && !(trace instanceof L.Rectangle)) {
        trace.setLatLngs(latLngs);
        return;
      }
      if (trace && circle && trace instanceof L.Circle) {
        trace.setLatLng([circle.center.lat, circle.center.lng]);
        trace.setRadius(circle.radius);
        return;
      }
      trace?.remove();
      trace = null;
      if (latLngs) trace = L.polygon(latLngs, { className: 'fd-map-trace', interactive: false }).addTo(map);
      else if (circle) trace = L.circle([circle.center.lat, circle.center.lng], { radius: circle.radius, className: 'fd-map-trace', interactive: false }).addTo(map);
    }

    function nearFirst(at?: LatLng): boolean {
      if (!map || !at || points.length < 3) return false;
      return map.latLngToContainerPoint([points[0].lat, points[0].lng]).distanceTo(map.latLngToContainerPoint([at.lat, at.lng])) <= CLOSE_PX;
    }

    function addPoint(at: LatLng) {
      if (mode === 'polygon') {
        if (nearFirst(at)) return finish();
        points.push(at);
        sayStep();
        remark();
        retrace();
        announce(fill(labels.points, { n: points.length }));
        return;
      }
      if (!anchor) {
        anchor = at;
        retrace(at);
        return;
      }
      const end = at;
      const start = anchor;
      if (mode === 'box') complete({ shape: 'box', points: boxFrom(start, end) });
      else if (mode === 'circle') complete({ shape: 'circle', center: start, radius: Math.max(1, metresBetween(start, end)) });
    }

    function finish() {
      if (mode !== 'polygon' || points.length < 3) return;
      complete({ shape: 'polygon', points: [...points] });
    }

    function complete(drawn: Area) {
      mode = null;
      arm(null);
      commit(drawn);
      announce(labels.shapeDrawn);
    }

    box.ready((m, leaflet) => {
      map = m;
      L = leaflet;
      draw(!!area);
      m.on('click', (event: Leaflet.LeafletMouseEvent) => {
        if (mode !== 'polygon' || readonly) return;
        addPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      m.on('dblclick', () => {
        if (mode !== 'polygon') return;
        // The two clicks of a double-click have each placed a point, on top of each other: one is enough.
        const [a, b] = points.slice(-2);
        if (a && b && m.latLngToContainerPoint([a.lat, a.lng]).distanceTo(m.latLngToContainerPoint([b.lat, b.lng])) < 6) {
          points.pop();
          remark();
        }
        finish();
      });
      m.on('mousemove', (event: Leaflet.LeafletMouseEvent) => {
        if (mode === 'polygon' && points.length) retrace({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      // A box and a circle are drawn by dragging: pointer events, which a mouse, a finger and a pen all raise.
      let pressed: { x: number; y: number; at: LatLng; id: number } | null = null;
      box.element.addEventListener('pointerdown', (event) => {
        if ((mode !== 'box' && mode !== 'circle') || readonly || event.button !== 0) return;
        if ((event.target as Element).closest('.fd-map-hint, .fd-map-zoom, .fd-map-credits, .fd-map-logo')) return;
        const at = m.mouseEventToLatLng(event as unknown as MouseEvent);
        pressed = { x: event.clientX, y: event.clientY, at: { lat: at.lat, lng: at.lng }, id: event.pointerId };
        anchor = pressed.at;
        box.element.setPointerCapture?.(event.pointerId);
      });
      box.element.addEventListener('pointermove', (event) => {
        if (!pressed || event.pointerId !== pressed.id) return;
        const at = m.mouseEventToLatLng(event as unknown as MouseEvent);
        retrace({ lat: at.lat, lng: at.lng });
      });
      const release = (event: PointerEvent) => {
        if (!pressed || event.pointerId !== pressed.id) return;
        const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
        const at = m.mouseEventToLatLng(event as unknown as MouseEvent);
        pressed = null;
        // A press with no drag is no shape: the tool stays in hand.
        if (event.type === 'pointercancel' || moved < DRAG_PX) {
          anchor = null;
          retrace();
          return;
        }
        addPoint({ lat: at.lat, lng: at.lng });
      };
      box.element.addEventListener('pointerup', release);
      box.element.addEventListener('pointercancel', release);
    });

    // The keys of drawing, wherever in the field the focus is.
    element.addEventListener('keydown', (event) => {
      if (!mode) return;
      const onMap = event.target === box.element;
      if (event.key === 'Escape') {
        event.preventDefault();
        arm(null);
        (toolButtons.get(shapes[0]) ?? box.element).focus();
      } else if (event.key === 'Enter' && mode === 'polygon' && points.length >= 3 && (onMap || event.target === finishButton || toolButtons.get('polygon') === event.target)) {
        event.preventDefault();
        finish();
      } else if (event.key === 'Backspace' && mode === 'polygon' && points.length && onMap) {
        event.preventDefault();
        points.pop();
        sayStep();
        remark();
        retrace();
        announce(fill(labels.points, { n: points.length }));
      } else if (event.key === ' ' && onMap && map) {
        event.preventDefault();
        const c = map.getCenter();
        addPoint({ lat: c.lat, lng: c.lng });
      }
    });

    return {
      element,
      focus: () => (toolButtons.get(shapes[0]) ?? box.element).focus(),
      destroy: () => box.destroy(),
      update(state: WidgetState) {
        const wasReadonly = readonly;
        readonly = state.readonly;
        tools.hidden = readonly;
        if (readonly && mode) arm(null);
        const next = readArea(state.value);
        const outside = !same(next, area);
        if (outside) area = next;
        clear.hidden = readonly || !area;
        if (state.describedBy) element.setAttribute('aria-describedby', state.describedBy);
        else element.removeAttribute('aria-describedby');
        element.toggleAttribute('data-invalid', state.invalid);
        box.refresh();
        if (outside || wasReadonly !== readonly) draw(outside);
      },
    };
  };
}
