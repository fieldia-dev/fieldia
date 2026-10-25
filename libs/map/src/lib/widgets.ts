import { createWidget, partFactory, type WidgetFactory } from '@fieldia/widgets';
import { mapWidgetsPart } from './map-parts';
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
 * Every map shares the settings given here: its provider above all. Their code is a part of its own
 * (`mapWidgetsPart`, 0.35), asked for with a page's own parts where the page has one of them and the page drawn once it
 * has come, as every part is; one made before it came, by something that did not wait for it, is Fieldia's own box for
 * its field until it comes.
 */
export function mapWidgets(settings: MapSettings): Record<string, WidgetFactory> {
  const plain: WidgetFactory = (context) => createWidget(context, {});
  let made: { place: WidgetFactory; area: WidgetFactory; address: WidgetFactory } | null = null;
  const real = (module: NonNullable<typeof mapWidgetsPart.loaded>) => (made ??= { place: module.placeWidget(settings), area: module.areaWidget(settings), address: module.addressSearchWidget(settings) });
  const place = partFactory(mapWidgetsPart, (module) => real(module).place, plain);
  return {
    'json.place': place,
    'float.place': place,
    'json.area': partFactory(mapWidgetsPart, (module) => real(module).area, plain),
    'char.address-search': partFactory(mapWidgetsPart, (module) => real(module).address, plain),
  };
}
