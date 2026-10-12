import { mapListViews, mapParts, mapWidgets, openStreetMap, type MapSettings } from '@fieldia/map';
import type { MapPartFactory } from '@fieldia/viewer';
import { rideCourier } from './courier-ride';

/**
 * The demos' maps: OpenStreetMap's own map images and search, which are for
 * demos and development only (an app in use names its provider), opening
 * on Cairo, where the demos' shop is.
 */
const settings: MapSettings = { provider: openStreetMap(), center: { lat: 30.0444, lng: 31.2357 }, zoom: 12 };
export const demoMapWidgets = mapWidgets(settings);
/** A list's records on the same maps: the viewer's `listViews`. */
export const demoListViews = mapListViews(settings);

const parts = mapParts(settings);
/**
 * A form's maps, for the viewer's `maps`. The order's courier sets off along
 * the road as its map is shown, as a courier's app would send their place;
 * `?ride=off` keeps them still, for a test to move them itself.
 */
export const demoMaps: MapPartFactory = (context) => {
  const part = parts(context);
  if (context.node.id !== 'order-map' || new URLSearchParams(location.search).get('ride') === 'off') return part;
  const stop = rideCourier(context.form);
  return { ...part, destroy: () => (stop(), part.destroy?.()) };
};
