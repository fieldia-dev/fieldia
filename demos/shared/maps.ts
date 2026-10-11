import { mapWidgets, openStreetMap } from '@fieldia/map';

/**
 * The demos' maps: OpenStreetMap's own map images and search, which are for
 * demos and development only (an app in use names its provider), opening
 * on Cairo, where the demos' shop is.
 */
export const demoMapWidgets = mapWidgets({ provider: openStreetMap(), center: { lat: 30.0444, lng: 31.2357 }, zoom: 12 });
