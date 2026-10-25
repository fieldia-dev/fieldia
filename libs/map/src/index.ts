export { mapWidgets } from './lib/widgets';
// Each a part of its own, fetched the first time a page shows it (map-parts.ts).
export { mapListViews, mapParts } from './lib/map-parts';
export { MAP_ICONS } from './lib/map-icons';
export type { MapRecord, PinDrawer } from './lib/pins';
export { mapKinds, type MapKind, type MapKindContext } from './lib/kinds';
export type { MapSettings } from './lib/settings';
export {
  azureMaps,
  googleMaps,
  mapbox,
  openStreetMap,
  tiles,
  type AddressSearch,
  type AzureMapsOptions,
  type BaseMap,
  type Credit,
  type GoogleMapsOptions,
  type MapboxOptions,
  type MapProvider,
  type MapView,
  type OpenStreetMapOptions,
  type PlaceFound,
  type ReachFinder,
  type ReachFound,
  type ReachRequest,
  type ReverseSearch,
  type RouteFinder,
  type RouteFound,
  type RouteRequest,
  type TravelMode,
  type SearchRequest,
  type TileSpec,
  type TilesOptions,
} from './lib/providers';
export { readArea, readPoint, writeArea, writePoint, metresBetween, type Area, type AreaFeature, type LatLng, type PointGeometry, type Shape } from './lib/geo';
export { MAP_LABELS, type MapLabels } from './lib/labels';
export type { AddressLabels } from './lib/address-labels';
export type { AddressParts } from './lib/address-parts';
// A list's map in a page of the app's own, outside the viewer.
export { mountListMap, type ListMapHandle, type ListMapOptions } from './lib/embed';
export type { MapSearch, MapViewChange } from './lib/list-view';
export type { Box as MapBounds } from './lib/view-box';
