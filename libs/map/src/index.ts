export { mapWidgets } from './lib/widgets';
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
  type ReverseSearch,
  type SearchRequest,
  type TileSpec,
  type TilesOptions,
} from './lib/providers';
export { readArea, readPoint, writeArea, writePoint, metresBetween, type Area, type AreaFeature, type LatLng, type PointGeometry, type Shape } from './lib/geo';
export { MAP_LABELS, type MapLabels } from './lib/labels';
