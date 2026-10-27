import { fieldiaStyle } from '@fieldia/widgets';
import type * as Leaflet from 'leaflet';
import type { Locale } from '@fieldia/core';
import { metresBetween, type LatLng } from './geo';
import { fill, forHand, type MapLabels } from './labels';
import type { LeafletModule } from './leaflet';
import type { MapBox } from './map-core';
import { intlFormat } from '@fieldia/core';

/**
 * Measuring a way on a map: points clicked along it (or put at the cross by
 * Space), its length said as it grows, ended by a double-click or Enter;
 * a point after that begins another. Backspace takes the last point back;
 * Escape clears it and stops. Loaded
 * the first time a map's Measure is pressed.
 */

/** The way's line, the line to the pointer, and its length beside its last point: loaded with the code that draws them. */
const MEASURE_CSS = `
path.fd-map-measure { stroke: var(--fd-text); stroke-width: 3; fill: none; stroke-linecap: round; stroke-linejoin: round; }
path.fd-map-measure-trace { stroke-dasharray: 4 6; stroke-opacity: 0.7; }
.fd-map-measure-tag span {
  display: inline-block; translate: 8px -50%; padding: 2px 8px; border-radius: 999px; white-space: nowrap; font-size: 12.5px; font-weight: 700;
  background: var(--fd-surface); color: var(--fd-text); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3); font-variant-numeric: tabular-nums;
}
`;

function installMeasureStyles(doc: Document) {
  if (doc.getElementById('fieldia-map-measure-styles')) return;
  const style = fieldiaStyle(doc, MEASURE_CSS, 'fieldia-map-measure-styles');
  doc.head.append(style);
}

/** A length as people read it: metres up to a kilometre, then kilometres to one decimal. */
export function distanceWords(metres: number, labels: MapLabels, locale: Locale): string {
  const number = (n: number, digits: number) => intlFormat('NumberFormat', locale, { numberingSystem: 'latn', maximumFractionDigits: digits }).format(n);
  return metres < 1000 ? fill(labels.metres, { n: number(Math.round(metres), 0) }) : fill(labels.kilometres, { n: number(metres / 1000, 1) });
}

export function measure(options: { box: MapBox; map: Leaflet.Map; L: LeafletModule; labels: MapLabels; locale: Locale; stopped(): void }): () => void {
  const { box, map, L, labels, locale } = options;
  const doc = box.element.ownerDocument;
  installMeasureStyles(doc);
  const points: LatLng[] = [];
  let finished = false;
  const line = L.polyline([], { className: 'fd-map-measure', interactive: false }).addTo(map);
  const trace = L.polyline([], { className: 'fd-map-measure fd-map-measure-trace', interactive: false }).addTo(map);
  let tag: Leaflet.Marker | null = null;
  const hint = doc.createElement('div');
  hint.className = 'fd-map-hint fd-map-measure-hint';
  const words = doc.createElement('p');
  words.textContent = forHand(doc, labels.measureHint, labels.measureHintTouch);
  hint.append(words);
  const live = doc.createElement('div');
  live.className = 'fd-sr-only';
  live.setAttribute('aria-live', 'polite');
  box.element.append(hint, live);
  box.shield(hint);
  box.follow(hint);
  // Every press is the map's meanwhile: pins and areas let it through.
  box.element.toggleAttribute('data-measuring', true);
  const wasDoubleZoom = map.doubleClickZoom.enabled();
  map.doubleClickZoom.disable();

  const length = (to?: LatLng) => {
    const all = to ? [...points, to] : points;
    return all.reduce((sum, p, i) => (i ? sum + metresBetween(all[i - 1], p) : 0), 0);
  };
  function redraw() {
    line.setLatLngs(points.map((p) => [p.lat, p.lng] as [number, number]));
    tag?.remove();
    tag = null;
    if (points.length < 2) return;
    const last = points[points.length - 1];
    const label = doc.createElement('span');
    label.textContent = distanceWords(length(), labels, locale);
    tag = L.marker([last.lat, last.lng], { icon: L.divIcon({ className: 'fd-map-measure-tag', html: label, iconSize: null as unknown as Leaflet.PointExpression }), interactive: false, keyboard: false }).addTo(map);
  }
  const say = () => {
    live.textContent = '';
    setTimeout(() => (live.textContent = fill(labels.measured, { distance: distanceWords(length(), labels, locale) })), 30);
  };
  function add(at: LatLng) {
    // A way finished, and another point: a new way begins.
    if (finished) {
      finished = false;
      points.length = 0;
      box.element.append(hint);
    }
    points.push(at);
    redraw();
    if (points.length > 1) say();
  }
  function finish() {
    finished = true;
    trace.setLatLngs([]);
    hint.remove();
  }
  function stop() {
    line.remove();
    trace.remove();
    tag?.remove();
    hint.remove();
    live.remove();
    map.off('click', click);
    map.off('dblclick', dblclick);
    map.off('mousemove', move);
    box.element.removeEventListener('keydown', keys, true);
    if (wasDoubleZoom) map.doubleClickZoom.enable();
    box.element.removeAttribute('data-measuring');
    options.stopped();
  }

  const click = (event: Leaflet.LeafletMouseEvent) => add({ lat: event.latlng.lat, lng: event.latlng.lng });
  const dblclick = () => {
    // The two clicks of a double-click have each put a point down, on top of each other: one is enough.
    const [a, b] = points.slice(-2);
    if (a && b && map.latLngToContainerPoint([a.lat, a.lng]).distanceTo(map.latLngToContainerPoint([b.lat, b.lng])) < 6) {
      points.pop();
      redraw();
    }
    finish();
  };
  const move = (event: Leaflet.LeafletMouseEvent) => {
    if (finished || !points.length) return;
    const last = points[points.length - 1];
    trace.setLatLngs([
      [last.lat, last.lng],
      [event.latlng.lat, event.latlng.lng],
    ]);
  };
  const keys = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      stop();
    } else if (event.key === 'Enter' && !finished && points.length > 1 && event.target === box.element) {
      event.preventDefault();
      finish();
    } else if (event.key === 'Backspace' && !finished && points.length && event.target === box.element) {
      event.preventDefault();
      points.pop();
      redraw();
    } else if (event.key === ' ' && event.target === box.element) {
      event.preventDefault();
      const c = map.getCenter();
      add({ lat: c.lat, lng: c.lng });
    }
  };
  map.on('click', click);
  map.on('dblclick', dblclick);
  map.on('mousemove', move);
  box.element.addEventListener('keydown', keys, true);
  return stop;
}
