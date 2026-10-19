/**
 * The front page's map, for its stage's third tab: @fieldia/map, drawing with the Fieldia of the page's own
 * fieldia.js. tools/build-site.mjs builds it into /hero/map.js, its imports of Fieldia's packages read from
 * `window.Fieldia`, and Leaflet in a chunk of its own, loaded with the first map shown. home.js imports it the first
 * time the tab is shown, or once the first tab has played: a visitor who never gets there loads none of it.
 */
import { mapListViews, openStreetMap } from '@fieldia/map';
// The demos' districts of central Cairo: rough shapes round each district's middle, not their real borders.
import { cairoDistricts } from '../demos/shared/districts';

/** The list's map, on OpenStreetMap's images as the demos' maps are, its districts given once by name. */
export const heroMapViews = () =>
  mapListViews({
    provider: openStreetMap(),
    center: { lat: 30.05, lng: 31.23 },
    zoom: 12,
    // A price on its pin in pounds, its currency unsaid: 9.5M.
    homeCurrency: 'EGP',
    regions: { districts: async () => cairoDistricts() },
  });
