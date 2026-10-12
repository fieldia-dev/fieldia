import type { Value } from '@fieldia/core';
import type { WidgetContext } from '@fieldia/widgets';
import type { AddressParts } from './address-parts';
import { asJson, isLatLng, writePoint, type LatLng } from './geo';
import { addressLabels, fill } from './labels';
import { warnOnce } from './map-core';
import type { AddressSearch, PlaceFound } from './providers';
import type { searchBox } from './search-box';
import type { MapSettings } from './settings';
import { installMapStyles } from './styles';

/**
 * An address field's suggestions (address-search.ts), loaded the first time
 * one is shown: the place search's combobox on the field's own box, its list
 * in a box of its own under it with the provider's credit, and what a
 * suggestion picked writes.
 */

/** The list as the place search draws it, in a box of its own with the credit under it; hidden with the list. */
const ADDRESS_CSS = `
.fd-address-search { position: relative; min-width: 0; }
.fd-address-popup {
  position: absolute; inset-inline: 0; top: calc(100% + 4px); z-index: 1100; overflow: hidden;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
}
.fd-address-popup:has(> .fd-map-results[hidden]) { display: none; }
.fd-address-popup .fd-map-results { position: static; max-height: 264px; border: 0; border-radius: 0; box-shadow: none; background: none; }
.fd-address-credit { display: block; padding: 3px 10px 5px; border-top: 1px solid var(--fd-border); font-size: 11px; line-height: 1.4; color: var(--fd-muted); text-align: end; text-decoration: none; }
a.fd-address-credit:hover { text-decoration: underline; }
.fd-address-credit img { height: 14px; vertical-align: middle; }
`;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export interface SuggestOptions {
  settings: MapSettings;
  context: WidgetContext;
  search: AddressSearch;
  /** The field's box, and what holds it (and the list under it). */
  element: HTMLElement;
  input: HTMLInputElement;
  /** The place search's combobox. */
  searchBox: typeof searchBox;
}

/** The suggestions on the field's box; what it gives back takes them off. */
export function suggest({ settings, context, search, element, input, searchBox }: SuggestOptions): () => void {
  const { form, name, node, id, document: doc } = context;
  const locale = context.locale ?? 'en';
  const options = node.options ?? {};
  const words = addressLabels(locale, settings.labels?.[locale]);
  const named = (key: string) => (typeof options[key] === 'string' ? (options[key] as string) : null);
  const [placeField, longitudeField, partsField] = [named('placeField'), named('longitudeField'), named('partsField')];
  const listed = options['countries'];
  const countries = (Array.isArray(listed) ? listed.map(String) : typeof listed === 'string' ? listed.split(',') : []).map((code) => code.trim().toUpperCase()).filter(Boolean);
  const near = isObject(options['near']) && isLatLng(options['near']['lat'], options['near']['lng']) ? (options['near'] as unknown as LatLng) : settings.center;
  installMapStyles(doc);
  if (!doc.getElementById('fieldia-address-styles')) {
    const style = doc.createElement('style');
    style.id = 'fieldia-address-styles';
    style.textContent = ADDRESS_CSS;
    doc.head.prepend(style);
  }

  const status = doc.createElement('span');
  status.className = 'fd-sr-only';
  status.setAttribute('role', 'status');
  /** Said to screen readers alone: how many suggestions came, or why none did. A typed address needs none to be an answer. */
  const say = (said: string | null) => (status.textContent = said ?? (box.list.hidden ? '' : fill(words.suggested, { n: box.list.children.length })));
  const write = (text: string) => {
    input.value = text;
    form.setValue(name, text || null);
  };
  let picking = 0;

  const box = searchBox({
    document: doc,
    id,
    input,
    labels: words,
    search: (request) => search({ ...request, ...(countries.length ? { countries } : {}), ...(partsField ? { parts: true } : {}) }),
    asYouType: settings.search ? (settings.searchAsYouType ?? true) : !!settings.provider.searchAsYouType,
    locale,
    near: () => near,
    zoom: () => settings.zoom,
    freeText: true,
    say,
    // Its whole address at once; its place and parts as soon as they are known (looked up now, for a provider whose suggestions carry none).
    async pick(place: PlaceFound) {
      const mine = ++picking;
      const whole = [place.label, place.detail].filter(Boolean).join(', ');
      write(whole);
      let at: LatLng | null = place.lat !== undefined && place.lng !== undefined ? { lat: place.lat, lng: place.lng } : null;
      let parts = place.parts;
      if (!at && place.locate && (placeField || (partsField && !parts))) {
        const located = await place.locate().catch((error: Error) => (warnOnce(`Finding the address picked failed: ${error.message}`), null));
        if (mine !== picking || !located) return;
        at = located;
        parts = located.parts ?? parts;
        // The provider's own way of writing it, unless a person has typed since.
        if (located.address && input.value === whole) write(located.address);
      }
      if (at && placeField) {
        if (form.page.fields[placeField]?.type !== 'float') form.setValue(placeField, asJson(writePoint(at)));
        else if (longitudeField) {
          form.setValue(placeField, round6(at.lat));
          form.setValue(longitudeField, round6(at.lng));
        }
      }
      if (parts && partsField) {
        const now = form.getState().values[partsField];
        const line2 = isObject(now) && typeof now['line2'] === 'string' ? { line2: now['line2'] } : {};
        form.setValue(partsField, { ...parts, ...line2 } as AddressParts as Value);
      }
    },
  });

  // The list with what the provider's terms ask to be said under it: its mark, or its credit.
  const popup = doc.createElement('div');
  popup.className = 'fd-address-popup';
  popup.append(box.list);
  const mark = settings.search ? undefined : (settings.provider.logo ?? settings.provider.searchCredit);
  if (mark) {
    const credit = doc.createElement(mark.href ? 'a' : 'span');
    credit.className = 'fd-address-credit';
    if (mark.href) Object.assign(credit, { href: mark.href, target: '_blank', rel: 'noopener', tabIndex: -1 });
    const image = 'image' in mark ? mark.image : undefined;
    if (image) {
      const img = doc.createElement('img');
      Object.assign(img, { src: image, alt: mark.text });
      credit.append(img);
    } else credit.textContent = mark.text;
    popup.append(credit);
  }
  // A press on it keeps the box's focus, so the list stays open and a credit's link opens.
  popup.addEventListener('mousedown', (event) => event.preventDefault());
  element.append(popup, status);
  return () => {
    box.destroy();
    popup.remove();
    status.remove();
  };
}
