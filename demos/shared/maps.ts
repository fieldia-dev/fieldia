import { azureMaps, mapListViews, mapParts, mapWidgets, openStreetMap, type MapSettings } from '@fieldia/map';
import type { MapPartFactory } from '@fieldia/viewer';
import { rideCourier } from './courier-ride';
import { cairoDistricts, madeUpReach } from './districts';

/**
 * The demos' maps: OpenStreetMap's own map images and search, which are for
 * demos and development only (an app in use names its provider), opening
 * on Cairo, where the demos' shop is. `?maps=azure` draws them from Azure
 * Maps instead, with a stand-in key, for a test that answers Azure's
 * requests itself: its live traffic, which OpenStreetMap has none of.
 */
const settings: MapSettings = {
  provider: new URLSearchParams(location.search).get('maps') === 'azure' ? azureMaps({ key: 'stand-in' }) : openStreetMap(),
  center: { lat: 30.0444, lng: 31.2357 },
  zoom: 12,
  // Rough districts drawn for the demos (not real borders), as an app hands over its own: loaded the first time a map shades them.
  regions: { 'cairo-districts': async () => cairoDistricts() },
  // OpenStreetMap works out no reachable areas: one made up for the demos, as an app's own function would answer.
  reach: madeUpReach,
};
export const demoMapWidgets = mapWidgets(settings);
/** The borders the demos' maps know, for the designer to offer a map's areas by colour. */
export const DEMO_REGION_SETS = [{ name: 'cairo-districts', key: 'code', nameKey: 'name', numbers: ['fee'] }];
/** A list's records on the same maps: the viewer's `listViews`. */
export const demoListViews = mapListViews(settings);

const parts = mapParts(settings);
/** The maps whose courier sets off as they are shown: the order's, and the kitchen's. */
const RIDES = new Set(['order-map', 'kitchen-map']);
/**
 * A form's maps, for the viewer's `maps`. The order's courier (and the
 * kitchen's) sets off along the road as its map is shown, as a courier's app would send their place;
 * `?ride=off` keeps them still, for a test to move them itself.
 */
export const demoMaps: MapPartFactory = (context) => {
  const part = parts(context);
  if (!RIDES.has(context.node.id) || new URLSearchParams(location.search).get('ride') === 'off') return part;
  const stop = rideCourier(context.form);
  return { ...part, destroy: () => (stop(), part.destroy?.()) };
};
