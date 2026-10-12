import type { Locale } from '@fieldia/core';
import type { LatLng } from './geo';
import type { ListMapLabels, MapLabels } from './labels';
import type { PinDrawer } from './pins';
import type { AddressSearch, MapProvider, ReverseSearch } from './providers';

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
  /** The app's own pins for a list's map, by the name a page's `pin.widget` gives. */
  pins?: Record<string, PinDrawer>;
  /** The app's own words over the maps', by language. */
  labels?: Partial<Record<Locale, Partial<MapLabels & ListMapLabels>>>;
}
