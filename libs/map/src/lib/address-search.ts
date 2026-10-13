import { createWidget, type WidgetFactory } from '@fieldia/widgets';
import { addressLine, directionOf } from './address-line';
import { searchBox } from './search-box';
import type { MapSettings } from './settings';

/**
 * An address typed on one line (`"widget": "address-search"` on a char
 * field), the addresses the map's provider suggests as people type in a list
 * under it, and no map: the place search's own combobox, its pauses, its
 * credits and its language. What is typed is the answer when nothing is
 * picked. A suggestion picked writes its whole address, and where the page
 * says, its place into a place field (`placeField`: a json field's GeoJSON
 * Point, or a float field's latitude with `longitudeField` for its
 * longitude) and its parts into an address field (`partsField`, a
 * `json.address`: street, city, region, postcode and country, the line under
 * the street kept as typed). `countries` (ISO codes) keeps the suggestions to
 * those countries; `near` (`{ "lat", "lng" }`, in the page's own country)
 * puts those near it first, as where the app's maps open does unless it
 * says. Addresses come before shops and malls.
 *
 * The box is the app's own text box, there at once; the suggestions come
 * with their code, loaded the first time an address field is shown. With no
 * address search to ask, the text box is all there is. Its words read in
 * the direction most of them are written in: an address mostly in Arabic
 * that starts with a Latin street still starts at an Arabic page's right.
 */
export function addressSearchWidget(settings: MapSettings): WidgetFactory {
  return (context) => {
    const plain = createWidget({ ...context, node: { ...context.node, widget: undefined } });
    const search = settings.search ?? settings.provider.search;
    const input = (plain.element.tagName === 'INPUT' ? plain.element : plain.element.querySelector('input')) as HTMLInputElement | null;
    if (!search || !input) return plain;
    const element = context.document.createElement('div');
    element.className = 'fd-address-search';
    element.append(plain.element);
    const align = () => {
      const dir = directionOf(input.value);
      if (dir) input.dir = dir;
      else input.removeAttribute('dir');
    };
    input.addEventListener('input', align);
    let stop: (() => void) | null | undefined;
    // The place search's own combobox and line are handed over, as the page has them already: the suggestions' chunk carries neither.
    import('./address-suggest').then(({ suggest }) => {
      if (stop === undefined) stop = suggest({ settings, context, search, element, input, searchBox, addressLine });
    });
    return {
      ...plain,
      element,
      update(state) {
        plain.update(state);
        align();
      },
      destroy() {
        stop?.();
        stop = null;
        plain.destroy?.();
      },
    };
  };
}
