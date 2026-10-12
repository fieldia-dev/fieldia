import type * as Leaflet from 'leaflet';
import type { Locale } from '@fieldia/core';
import type { Card } from './card';
import type { LatLng } from './geo';
import type { LeafletModule } from './leaflet';
import type { PinFace } from './pins';

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
 */
export function popCard(map: Leaflet.Map, L: LeafletModule, options: { at: LatLng; height: number; card: Card; focus: boolean; escape(): void }): Leaflet.Popup {
  options.card.element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      options.escape();
    } else if (MOVE_KEYS.has(event.key)) event.stopPropagation();
  });
  const popup = L.popup({ closeButton: false, autoPanPadding: [16, 16], className: 'fd-map-card-popup', minWidth: 220, maxWidth: 280, offset: [0, 4 - options.height] })
    .setLatLng([options.at.lat, options.at.lng])
    .setContent(options.card.element);
  popup.openOn(map);
  if (options.focus) options.card.focus();
  return popup;
}

/** A bubble's face: how many pins it holds, written short (12, 1.2K), larger for more. */
export function bubbleFace(doc: Document, n: number, locale: Locale): HTMLElement {
  const face = doc.createElement('div');
  face.className = 'fd-map-bubble';
  face.dataset['size'] = n < 10 ? 's' : n < 100 ? 'm' : 'l';
  face.textContent = new Intl.NumberFormat(locale, { notation: 'compact', numberingSystem: 'latn' }).format(n);
  return face;
}

/**
 * A bubble pressed: the map closer, until its pins part. Pins on one spot,
 * that no zoom parts (a tower's flats), are not zoomed to: false, and the
 * bubble lists them instead.
 */
export function zoomToPart(map: Leaflet.Map, L: LeafletModule, spots: LatLng[], room: number): boolean {
  const most = Math.min(map.getMaxZoom(), 19);
  const bounds = L.latLngBounds(spots.map((p) => [p.lat, p.lng] as [number, number]));
  if (map.getZoom() >= most || bounds.getNorthEast().equals(bounds.getSouthWest(), 1e-7)) return false;
  map.fitBounds(bounds, { padding: [room, room], maxZoom: most });
  return true;
}
