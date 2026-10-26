import type * as Leaflet from 'leaflet';
import { mapLabels } from './labels';
import { createMapBox } from './map-core';
import { tiles } from './providers';

/**
 * A key that zooms (+ or -) pressed while the map still zooms from the last is kept, as a press of the zoom's buttons
 * is, and made when that zoom ends. 0.35 left the keys to Leaflet's keyboard, which drops a zoom asked for while one is
 * under way: + then - 120 ms after (the delivery demo's place), the map stayed a step closer. jsdom's Leaflet zooms at
 * once, with no glide: a zoom under way is stood for here as Leaflet marks one (`zoomstart`, `_animatingZoom`), and
 * ended as it ends (`zoomend`); the browser's own glide is driven in e2e/map-place.spec.ts.
 */

afterEach(() => document.body.replaceChildren());

async function mapOnPage() {
  const box = createMapBox({ document, provider: tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } }), locale: 'en', labels: mapLabels('en'), name: 'Delivery to', center: { lat: 30.05, lng: 31.23 }, zoom: 13 });
  document.body.append(box.element);
  const map = await new Promise<Leaflet.Map>((ready) => box.ready((m) => ready(m)));
  // The map has the keys, as after Tab: Leaflet's keyboard listens to the page while it does.
  box.element.focus();
  return { box, map };
}

/** A zoom under way, as Leaflet marks one, and its end. */
function gliding(map: Leaflet.Map) {
  (map as unknown as { _animatingZoom: boolean })._animatingZoom = true;
  map.fire('zoomstart');
  return () => {
    (map as unknown as { _animatingZoom: boolean })._animatingZoom = false;
    map.fire('zoomend');
  };
}

/** A key pressed on the map, with the code Leaflet's keyboard reads it by (187 the + and = key, 189 the - and _ key). */
const key = (element: HTMLElement, name: string, shiftKey = false) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key: name, keyCode: '+='.includes(name) ? 187 : 189, shiftKey, bubbles: true, cancelable: true } as KeyboardEventInit));

describe('the keys that zoom, while the map still zooms', () => {
  it('a minus pressed during a zoom in is kept, and made as the zoom ends', async () => {
    const { box, map } = await mapOnPage();
    expect(map.getZoom()).toBe(13);
    const end = gliding(map);
    key(box.element, '-');
    expect(map.getZoom()).toBe(13);
    end();
    expect(map.getZoom()).toBe(12);
    box.destroy();
  });

  it('every key pressed meanwhile is kept, Shift’s three steps too', async () => {
    const { box, map } = await mapOnPage();
    const end = gliding(map);
    key(box.element, '+');
    key(box.element, '=');
    key(box.element, '_', true);
    end();
    // Two steps in, three out: one further than it was.
    expect(map.getZoom()).toBe(12);
    box.destroy();
  });

  it('a key while the map is still is Leaflet’s, as before: one step at once', async () => {
    const { box, map } = await mapOnPage();
    key(box.element, '+');
    expect(map.getZoom()).toBe(14);
    box.destroy();
  });
});
