import type * as Leaflet from 'leaflet';
import { loadLeaflet, type LeafletModule } from './leaflet';
import { zoomToPart } from './marks';

/**
 * A bubble pressed comes closer until its pins part (`zoomToPart`, a list's map's and a form's). 0.35 fitted the map
 * to the bubble's pins and said it had moved, though a fit to pins spread wider than the map shows comes no closer —
 * it pans, or backs away: a source's bubbles gathered again ("12,134 here" at zoom 8, on a phone's map of the twenty
 * thousand homes) stayed whole — no zoom, no list. Leaflet in jsdom, the map a phone's size (jsdom lays nothing out).
 */

let L: LeafletModule;
beforeAll(async () => ({ L } = await loadLeaflet()));
afterEach(() => document.body.replaceChildren());

/** A map 358 by 300 pixels (a phone's, in the many homes' demo), at `zoom` over Cairo. */
function phoneMap(zoom: number): Leaflet.Map {
  const element = document.createElement('div');
  document.body.append(element);
  const map = L.map(element, { zoomAnimation: false, fadeAnimation: false, maxZoom: 19 });
  // A new point each time, as Leaflet's own: its code halves the one it is given in place.
  jest.spyOn(map, 'getSize').mockImplementation(() => L.point(358, 300));
  return map.setView([30.05, 31.23], zoom);
}
const ROOM = 48;

describe('a bubble pressed', () => {
  it('its pins spread wider than the map shows: one step closer on the bubble’s own spot, never a fit that pans or backs away', () => {
    const map = phoneMap(8);
    // Three degrees across: a fit with room round them would be zoom 7, further than the map is now.
    const spots = [
      { lat: 29.2, lng: 29.9 },
      { lat: 31.1, lng: 32.9 },
      { lat: 30.6, lng: 31.4 },
    ];
    const middle = { lat: 30.4, lng: 31.1 };
    expect(zoomToPart(map, L, spots, ROOM, middle)).toBe(true);
    expect(map.getZoom()).toBe(9);
    expect(map.getCenter().lat).toBeCloseTo(middle.lat, 6);
    expect(map.getCenter().lng).toBeCloseTo(middle.lng, 6);
  });

  it('its pins near each other: the map fitted to them, every one in view with room round it', () => {
    const map = phoneMap(8);
    const spots = [
      { lat: 30.05, lng: 31.22 },
      { lat: 30.06, lng: 31.24 },
      { lat: 30.04, lng: 31.23 },
    ];
    expect(zoomToPart(map, L, spots, ROOM, spots[0])).toBe(true);
    expect(map.getZoom()).toBeGreaterThan(12);
    const shown = map.getBounds();
    for (const spot of spots) expect(shown.contains([spot.lat, spot.lng])).toBe(true);
  });

  it('pins on one spot, or a map as close as it comes: no zoom, and false (the bubble lists them)', () => {
    const map = phoneMap(10);
    const spot = { lat: 30.05, lng: 31.23 };
    expect(zoomToPart(map, L, [spot, { ...spot }], ROOM, spot)).toBe(false);
    expect(map.getZoom()).toBe(10);
    map.setZoom(19);
    expect(zoomToPart(map, L, [spot, { lat: 30.051, lng: 31.231 }], ROOM, spot)).toBe(false);
    expect(map.getZoom()).toBe(19);
  });
});
