import type * as Leaflet from 'leaflet';
import type { Locale } from '@fieldia/core';
import { inPlural } from '@fieldia/widgets';
import { boxFrom, metresBetween, type Area, type LatLng, type Shape } from './geo';
import { type MapLabels } from './labels';
import type { LeafletModule } from './leaflet';
import type { MapBox } from './map-core';

/**
 * A shape drawn on a map: a polygon point by point, a box or a circle by a
 * drag, by a mouse, a finger, a pen or the keys. A bar over the map says what
 * to do, with Finish and Cancel. While a tool is in hand the ground holds
 * still: a press is a point, never a pan. Shared by the area field and a
 * list's map, which hand it what is drawn.
 */

/** Each tool's drawing, for its button. */
export const SHAPE_ICONS: Record<Shape, string> = {
  polygon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 8l7-5 7 6-3 11H7z"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>',
  circle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>',
};

/** How near the first point a press closes the ring: a fingertip's width, not the mark's. */
const CLOSE_PX = 22;
/** A press that moves less than this is a press, not a drag: no box, no circle. */
const DRAG_PX = 4;

/**
 * The browser's own held off while a drag of the map's own code lasts — a box or a circle drawn, a shape carried — as
 * Leaflet holds them off through its own drags (its Draggable): no words selected as the pointer crosses the zoom's
 * "+ −" or the bar over the map, and nothing dragged and dropped. Words left selected over the map are picked up by
 * the browser at the next press on the shape as a drag and drop of its own, which takes the pointer from the shape's
 * drag (pointercancel): the shape moved a few pixels for a drag of sixty. Returns what lets them go again (Leaflet
 * holds each once, however often asked).
 */
export function holdBrowserDrag(L: LeafletModule): () => void {
  L.DomUtil.disableTextSelection();
  L.DomUtil.disableImageDrag();
  return () => (L.DomUtil.enableTextSelection(), L.DomUtil.enableImageDrag());
}

export interface ShapeDrawingOptions {
  box: MapBox;
  labels: MapLabels;
  /** The page's language: its words for one point and for more. */
  locale?: Locale;
  /** Where the drawing's keys are heard, wherever the focus is inside it: a field, or a list's map. */
  keys: HTMLElement;
  announce(words: string): void;
  /** The tool in hand changed, or was put down. */
  armed(mode: Shape | null): void;
  /** A shape is drawn: the tool is put down first. */
  done(area: Area): void;
  /** Escape put the tool down: where the focus goes. */
  escaped(): void;
  /** Whether Enter on this part finishes a polygon, besides the map and Finish (the Polygon button). */
  finishesOn?(target: EventTarget | null): boolean;
  /** Parts over the map a press on is no point: the bar's own, the zoom, the credits, and the caller's. */
  over?: string;
}

export interface ShapeDrawing {
  /** The tool in hand, or none. */
  readonly mode: Shape | null;
  /** Take a tool, or put it down (null). */
  arm(next: Shape | null): void;
}

export function shapeDrawing(options: ShapeDrawingOptions): ShapeDrawing {
  const { box, labels, announce } = options;
  const doc = box.element.ownerDocument;
  const over = ['.fd-map-hint', '.fd-map-zoom', '.fd-map-credits', '.fd-map-logo', options.over].filter(Boolean).join(', ');
  let mode: Shape | null = null;
  /** A polygon's points so far. */
  let points: LatLng[] = [];
  /** Where a box or a circle began, by a press or by Space. */
  let anchor: LatLng | null = null;
  let map: Leaflet.Map | null = null;
  let L: LeafletModule | null = null;
  /** The outline reaching for the pointer. */
  let trace: Leaflet.Path | null = null;
  /** A polygon's points while it is drawn. */
  const marks: Leaflet.Marker[] = [];

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

  /** How many points so far, in the page's language: "1 point", "4 points". */
  const counted = () => inPlural(labels.points, labels.pointsOne, points.length, options.locale);

  function sayStep() {
    if (!mode) return;
    const words = mode === 'polygon' ? labels.drawPolygon : mode === 'box' ? labels.drawBox : labels.drawCircle;
    hintWords.textContent = mode === 'polygon' && points.length ? `${words} ${counted()}.` : words;
    finishButton.hidden = mode !== 'polygon' || points.length < 3;
  }

  function arm(next: Shape | null) {
    mode = next;
    points = [];
    anchor = null;
    trace?.remove();
    trace = null;
    remark();
    hint.hidden = !mode;
    // Every tool holds the ground still: a press is a point, never a pan.
    box.setPannable(!mode);
    box.ready((m) => (mode ? m.doubleClickZoom.disable() : m.doubleClickZoom.enable()));
    if (mode) box.element.dataset['drawing'] = mode;
    else delete box.element.dataset['drawing'];
    sayStep();
    options.armed(mode);
    if (mode) announce(hintWords.textContent ?? '');
  }

  function gripIcon() {
    return L!.divIcon({ className: 'fd-map-grip', iconSize: [24, 24], iconAnchor: [12, 12] });
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
      announce(counted());
      return;
    }
    if (!anchor) {
      anchor = at;
      retrace(at);
      return;
    }
    const start = anchor;
    if (mode === 'box') complete({ shape: 'box', points: boxFrom(start, at) });
    else if (mode === 'circle') complete({ shape: 'circle', center: start, radius: Math.max(1, metresBetween(start, at)) });
  }

  function finish() {
    if (mode !== 'polygon' || points.length < 3) return;
    complete({ shape: 'polygon', points: [...points] });
  }

  function complete(drawn: Area) {
    arm(null);
    options.done(drawn);
  }

  box.ready((m, leaflet) => {
    map = m;
    L = leaflet;
    m.on('click', (event: Leaflet.LeafletMouseEvent) => {
      if (mode === 'polygon') addPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
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
    let pressed: { x: number; y: number; id: number; letGo: () => void } | null = null;
    box.element.addEventListener('pointerdown', (event) => {
      if ((mode !== 'box' && mode !== 'circle') || event.button !== 0) return;
      if ((event.target as Element).closest(over)) return;
      const at = m.mouseEventToLatLng(event as unknown as MouseEvent);
      pressed = { x: event.clientX, y: event.clientY, id: event.pointerId, letGo: holdBrowserDrag(leaflet) };
      anchor = { lat: at.lat, lng: at.lng };
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
      pressed.letGo();
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

  // The keys of drawing, wherever in the part the focus is.
  options.keys.addEventListener('keydown', (event) => {
    if (!mode) return;
    const onMap = event.target === box.element;
    if (event.key === 'Escape') {
      event.preventDefault();
      // The list's own card and search take no Escape meant for the drawing.
      event.stopPropagation();
      arm(null);
      options.escaped();
    } else if (event.key === 'Enter' && mode === 'polygon' && points.length >= 3 && (onMap || event.target === finishButton || !!options.finishesOn?.(event.target))) {
      event.preventDefault();
      finish();
    } else if (event.key === 'Backspace' && mode === 'polygon' && points.length && onMap) {
      event.preventDefault();
      points.pop();
      sayStep();
      remark();
      retrace();
      announce(counted());
    } else if (event.key === ' ' && onMap && map) {
      event.preventDefault();
      const c = map.getCenter();
      addPoint({ lat: c.lat, lng: c.lng });
    }
  });

  return {
    get mode() {
      return mode;
    },
    arm,
  };
}
