import { mapListViews, mapWidgets, openStreetMap, type MapSettings } from '@fieldia/map';

/**
 * The demos' maps: OpenStreetMap's own map images and search, which are for
 * demos and development only (an app in use names its provider), opening
 * on Cairo, where the demos' shop is.
 */
const settings: MapSettings = { provider: openStreetMap(), center: { lat: 30.0444, lng: 31.2357 }, zoom: 12 };
export const demoMapWidgets = mapWidgets(settings);
/** A list's records on the same maps: the viewer's `listViews`. */
export const demoListViews = mapListViews(settings);
