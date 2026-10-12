import type { WidgetFactory } from '@fieldia/widgets';
import { addressSearchWidget } from './address-search';
import { areaWidget } from './area';
import { placeWidget } from './place';
import type { MapSettings } from './settings';

/**
 * The maps' widgets, for the viewer's (and the designer's) `widgets`:
 *
 * - `"widget": "place"` on a json field keeps a GeoJSON Point; on a float
 *   field, its latitude, with `options.longitudeField` naming the field for
 *   its longitude.
 * - `"widget": "area"` on a json field keeps a GeoJSON Feature: a polygon,
 *   a box or a circle.
 * - `"widget": "address-search"` on a char field keeps an address typed on
 *   one line, the provider's suggestions under it and no map; a suggestion
 *   picked can fill a place field and an address's parts too.
 *
 * Every map shares the settings given here: its provider above all.
 */
export function mapWidgets(settings: MapSettings): Record<string, WidgetFactory> {
  const place = placeWidget(settings);
  return {
    'json.place': place,
    'float.place': place,
    'json.area': areaWidget(settings),
    'char.address-search': addressSearchWidget(settings),
  };
}
