import type * as Leaflet from 'leaflet';
import type { Locale } from '@fieldia/core';
import type { Card } from './card';
import type { LatLng } from './geo';
import type { LeafletModule } from './leaflet';
import type { PinFace } from './pins';
import { intlFormat } from '@fieldia/core';

/**
 * What every map of records does with its marks: each as large as its face
 * and stood on its point; pressed by a click, or by Enter or Space when it
 * has the focus; and the card it opens, over the map at its place.
 */

/** Pins nearer than this, in pixels, are gathered into one bubble. */
export const CROWD = 48;

/** The keys that move a map: on a card they stay with the card. */
export const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '-', '=', '_']);

/** No size for a mark: Leaflet then sets none, and the mark is as large as its face (its types leave null out; its code takes it). */
export const SIZED_BY_FACE = null as unknown as Leaflet.PointExpression;

/** How a mark stands on its point: its size is its face's, so CSS stands it there. */
export const anchor = (face: PinFace) => (face.element.dataset['look'] === 'label' ? 'fd-map-tail' : face.stands === 'foot' ? 'fd-map-foot' : 'fd-map-middle');

/**
 * A mark pressed: clicked, or Enter or Space while it has the focus. Leaflet
 * makes a mark a button to the keyboard but clicks it only for a popup of its own.
 */
export function onPress(marker: Leaflet.Marker, act: (event: MouseEvent | KeyboardEvent | undefined) => void) {
  marker.on('click', (event: Leaflet.LeafletMouseEvent) => act(event.originalEvent));
  marker.on('keydown', (event: Leaflet.LeafletKeyboardEvent) => {
    const key = event.originalEvent;
    if (key.key !== 'Enter' && key.key !== ' ') return;
    key.preventDefault();
    act(key);
  });
}

/** Whether a press came from the keys: then its card takes the focus. */
export const byKeys = (event: Event | undefined) => !!event && event.type.startsWith('key');

/**
 * A card over the map, its tip on a mark `height` pixels tall: Escape closes
 * it (back to its mark), and the arrows stay with the card, not the map.
 *
 * Every card stays inside the map and clear of what is drawn over it: the
 * map pans it between the columns of buttons at the map's sides (48 pixels
 * each) and above the credits at its foot, no wider than that leaves, and
 * no taller than the map leaves room for (`--fd-map-card-room`): a phone's
 * map is shorter than a card, whose picture and lines then scroll under its
 * buttons (styles.ts). The map says it has one open (`data-card`), and the
 * words over it step out of its way.
 */
export function popCard(map: Leaflet.Map, L: LeafletModule, options: { at: LatLng; height: number; card: Card; focus: boolean; escape(): void }): Leaflet.Popup {
  options.card.element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      options.escape();
    } else if (MOVE_KEYS.has(event.key)) event.stopPropagation();
  });
  const size = map.getSize();
  const width = Math.min(280, Math.max(200, size.x - 96));
  // Its tip and the room under it (40), and the room above and below it (8 and 4).
  options.card.element.style.setProperty('--fd-map-card-room', `${size.y - 52}px`);
  const box = map.getContainer();
  const popup = L.popup({
    closeButton: false,
    autoPanPaddingTopLeft: [48, 8],
    autoPanPaddingBottomRight: [48, 4],
    className: 'fd-map-card-popup',
    minWidth: Math.min(220, width),
    maxWidth: width,
    offset: [0, 4 - options.height],
  })
    .setLatLng([options.at.lat, options.at.lng])
    .setContent(options.card.element)
    .on('add', () => box.toggleAttribute('data-card', true))
    .on('remove', () => box.removeAttribute('data-card'));
  popup.openOn(map);
  if (options.focus) options.card.focus();
  return popup;
}

/** A bubble's face: how many pins it holds, written short (12, 1.2K), larger for more. */
export function bubbleFace(doc: Document, n: number, locale: Locale): HTMLElement {
  const face = doc.createElement('div');
  face.className = 'fd-map-bubble';
  face.dataset['size'] = n < 10 ? 's' : n < 100 ? 'm' : 'l';
  face.textContent = intlFormat('NumberFormat', locale, { notation: 'compact', numberingSystem: 'latn' }).format(n);
  return face;
}

/**
 * A bubble pressed: the map closer, until its pins part — fitted to them,
 * or, where they spread wider than the map shows (a source's bubbles
 * gathered again, a phone's small map), a fit that would come no closer, one
 * step closer on the bubble's own spot (`middle`), as a person zooms in on
 * it: never a fit that only pans or backs away, the bubble whole. Pins on one
 * spot, that no zoom parts (a tower's flats), and a map already as close as
 * it comes are not zoomed: false, and the bubble lists them instead.
 */
export function zoomToPart(map: Leaflet.Map, L: LeafletModule, spots: LatLng[], room: number, middle: LatLng): boolean {
  const most = Math.min(map.getMaxZoom(), 19);
  const now = map.getZoom();
  const bounds = L.latLngBounds(spots.map((p) => [p.lat, p.lng] as [number, number]));
  if (now >= most || bounds.getNorthEast().equals(bounds.getSouthWest(), 1e-7)) return false;
  if (map.getBoundsZoom(bounds, false, L.point(room * 2, room * 2)) > now) map.fitBounds(bounds, { padding: [room, room], maxZoom: most });
  else map.setView([middle.lat, middle.lng], now + 1);
  return true;
}
