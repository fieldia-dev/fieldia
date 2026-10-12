import type { Locale } from '@fieldia/core';
import type { LatLng } from './geo';
import type { FormMapLabels, ListMapLabels, MapLabels } from './labels';
import type { PinDrawer } from './pins';
import type { AddressSearch, MapProvider, ReachFinder, ReverseSearch, RouteFinder } from './providers';

/** What every map of an app shares: given once to `mapWidgets`. */
export interface MapSettings {
  provider: MapProvider;
  /** The app's own address search, instead of the provider's. */
  search?: AddressSearch;
  /** The app's own naming of a point, instead of the provider's. */
  reverse?: ReverseSearch;
  /** Whether the app's own search may run for each pause in typing (it may unless false). */
  searchAsYouType?: boolean;
  /** Where an empty map opens, and how close. */
  center?: LatLng;
  zoom?: number;
  /** The app's own routes, instead of the provider's. */
  route?: RouteFinder;
  /** The app's own reachable areas, instead of the provider's. */
  reach?: ReachFinder;
  /**
   * The app's sets of borders, by the name a page's `regions.from` gives: each
   * a GeoJSON FeatureCollection of polygons, or a function that loads one
   * (`() => fetch('/geo/districts.json').then((r) => r.json())`), asked once.
   */
  regions?: Record<string, unknown | (() => unknown)>;
  /** The app's own pins for a list's map, by the name a page's `pin.widget` gives. */
  pins?: Record<string, PinDrawer>;
  /** The app's own words over the maps', by language. */
  labels?: Partial<Record<Locale, Partial<MapLabels & ListMapLabels & FormMapLabels>>>;
}
