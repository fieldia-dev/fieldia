import type { Locale, Value } from '@fieldia/core';
import { stillShown, type WidgetContext, fieldiaStyle } from '@fieldia/widgets';
import type { addressLine } from './address-line';
import type { AddressParts } from './address-parts';
import { asJson, isLatLng, writePoint, type LatLng } from './geo';
import { addressLabels } from './address-labels';
import { fill } from './labels';
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
.fd-address-note { margin-top: 4px; font-size: 12.5px; line-height: 1.4; color: var(--fd-error); }
`;

/** Said under the box when the address picked is not found on the map: loaded with the suggestions, not with every page that shows a map. */
const NOT_PLACED: Record<Locale, string> = {
  en: 'Not found on the map: no place was saved for this address.',
  ar: 'لم يُعثر على هذا العنوان على الخريطة، فلم يُحفظ له مكان.',
  fr: 'Introuvable sur la carte : aucun lieu n’a été enregistré pour cette adresse.',
  de: 'Nicht auf der Karte gefunden: Für diese Adresse wurde kein Ort gespeichert.',
};
/** Said when the place could not be asked for (the line dropped, the provider down or refusing): it may well be on the map. */
const LOCATE_FAILED: Record<Locale, string> = {
  en: 'The map did not answer, so no place was saved for this address: check the connection, then pick it again.',
  ar: 'لم تُجب الخريطة، فلم يُحفظ مكان لهذا العنوان: تحقّق من الاتصال، ثم اختره مرة أخرى.',
  fr: 'La carte n’a pas répondu, aucun lieu n’a donc été enregistré pour cette adresse : vérifiez la connexion, puis choisissez-la de nouveau.',
  de: 'Die Karte hat nicht geantwortet, daher wurde für diese Adresse kein Ort gespeichert: Prüfen Sie die Verbindung und wählen Sie sie dann erneut.',
};
/** Said when only a place near it is found (`precise: false`): its street, district or town, kilometres off perhaps. */
const PLACED_NEAR: Record<Locale, string> = {
  en: 'Placed only near this address: its exact place was not found on the map.',
  ar: 'لم يُعثر على مكان هذا العنوان بالضبط على الخريطة، فوُضع قربه فقط.',
  fr: 'Placé seulement près de cette adresse : son emplacement exact est introuvable sur la carte.',
  de: 'Nur in der Nähe dieser Adresse platziert: Der genaue Ort wurde auf der Karte nicht gefunden.',
};

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
/**
 * Whether a lookup failed for want of an answer, not because the provider
 * found no such place: nothing came back (fetch fails with a TypeError, as
 * on a line dropped), the page is offline, or the provider refused or failed
 * (answers.ts says what it answered: a 503, a 429, a 403); not its 404, a
 * place it does not know.
 */
const unanswered = (error: Error, offline: boolean) => offline || error.name === 'TypeError' || / answered (?!404)\d{3}\b/.test(error.message);
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export interface SuggestOptions {
  settings: MapSettings;
  context: WidgetContext;
  search: AddressSearch;
  /** The field's box, and what holds it (and the list under it). */
  element: HTMLElement;
  input: HTMLInputElement;
  /** The place search's combobox, and the line it writes. */
  searchBox: typeof searchBox;
  addressLine: typeof addressLine;
}

/** The suggestions on the field's box: `described` says again what describes the box after the field's own update has, and `destroy` takes them off. */
export function suggest({ settings, context, search, element, input, searchBox, addressLine }: SuggestOptions): { described: () => void; destroy: () => void } {
  const { form, name, node, id, document: doc } = context;
  const locale = context.locale ?? 'en';
  const options = node.options ?? {};
  const words = { notPlaced: NOT_PLACED[locale], placedNear: PLACED_NEAR[locale], locateFailed: LOCATE_FAILED[locale], ...addressLabels(locale, settings.labels?.[locale]) };
  const named = (key: string) => (typeof options[key] === 'string' ? (options[key] as string) : null);
  const [placeField, longitudeField, partsField] = [named('placeField'), named('longitudeField'), named('partsField')];
  const listed = options['countries'];
  // "UK" as every provider's parts name it, "GB".
  const countries = (Array.isArray(listed) ? listed.map(String) : typeof listed === 'string' ? listed.split(',') : []).map((code) => code.trim().toUpperCase().replace(/^UK$/, 'GB')).filter(Boolean);
  const near = isObject(options['near']) && isLatLng(options['near']['lat'], options['near']['lng']) ? (options['near'] as unknown as LatLng) : settings.center;
  installMapStyles(doc);
  if (!doc.getElementById('fieldia-address-styles')) {
    const style = fieldiaStyle(doc, ADDRESS_CSS, 'fieldia-address-styles');
    doc.head.prepend(style);
  }

  const status = doc.createElement('span');
  status.className = 'fd-sr-only';
  status.setAttribute('role', 'status');
  /** Said to screen readers alone: how many suggestions came, or why none did. A typed address needs none to be an answer. */
  const say = (said: string | null) => {
    status.textContent = said ?? (box.list.hidden ? '' : fill(words.suggested, { n: box.list.children.length }));
    // Suggestions come: all of them in sight, as near the bottom of a phone's screen as the box is.
    if (!box.list.hidden) popup.scrollIntoView?.({ block: 'nearest' });
  };
  const write = (text: string) => {
    input.value = text;
    form.setValue(name, text || null);
  };
  /** Shown, and said, when the address picked is not found where it is, or only near it: the console is not where a person looks. */
  const note = doc.createElement('div');
  note.className = 'fd-address-note';
  note.id = `${id}-note`;
  note.hidden = true;
  /** Read with the box, beside what describes it already (its help, its error), while it is shown. */
  const described = () => {
    const ids = (input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((one) => one && one !== note.id);
    if (!note.hidden) ids.push(note.id);
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
    else input.removeAttribute('aria-describedby');
  };
  const tell = (said: string | null) => {
    note.hidden = !said;
    note.textContent = said ?? '';
    described();
    if (said) status.textContent = said;
  };
  let picking = 0;
  /** Whether the box has been emptied since the last pick: the words it wrote all taken out, whatever is typed in their place. */
  let emptied = false;
  /** The words that name the address picked (its first line, and the provider's own first piece): while the box still says one, it is that address, edited. */
  let picked: string[] = [];
  const plain = (text: string) => text.toLocaleLowerCase(locale).replace(/\s+/g, ' ').trim();
  const firstPiece = (line: string) => plain(line.split(/[,،]/)[0] ?? '');
  const typedOver = () => picked.length > 0 && !picked.some((words) => words && plain(input.value).includes(words));
  const typedOn = () => {
    tell(null);
    if (!input.value.trim()) emptied = true;
  };
  input.addEventListener('input', typedOn);

  const now = () => form.getState().values;
  const inFloats = () => !!placeField && form.page.fields[placeField]?.type === 'float';
  /** The place and the parts as the form holds them, the line a person typed under the street left out: to tell this field's own from one set since. */
  const placeNow = () => JSON.stringify(placeField ? [now()[placeField] ?? null, inFloats() && longitudeField ? (now()[longitudeField] ?? null) : null] : null);
  const partsNow = () => {
    const held = partsField ? now()[partsField] : null;
    return JSON.stringify(isObject(held) ? { ...held, line2: undefined } : (held ?? null));
  };
  /** What the last pick wrote, while the form still holds it as written: a pick that finds no place, or no parts, takes them back (they were another address's), as the box emptied and left does; a place set since by hand (a pin dragged) stays. */
  let wrote: { place?: string; parts?: string } = {};
  const setPlace = (at: LatLng | null) => {
    if (!placeField) return;
    const point = at && { lat: round6(at.lat), lng: round6(at.lng) };
    if (!inFloats()) form.setValue(placeField, point && asJson(writePoint(point)));
    else if (longitudeField) {
      form.setValue(placeField, point && point.lat);
      form.setValue(longitudeField, point && point.lng);
    }
  };
  /** Its parts, the line under the street kept as the person typed it. */
  const setParts = (parts: AddressParts | undefined) => {
    if (!partsField) return;
    const held = now()[partsField];
    const line2 = isObject(held) && typeof held['line2'] === 'string' ? { line2: held['line2'] } : null;
    form.setValue(partsField, parts || line2 ? ({ ...parts, ...line2 } as AddressParts as Value) : null);
  };
  /** A pick's place and parts written; where it found none, the last pick's taken back, while the form still holds them as that pick wrote them. */
  const writeFound = (at: LatLng | null, parts: AddressParts | undefined) => {
    const before = wrote;
    wrote = {};
    if (placeField && (at || before.place === placeNow())) {
      setPlace(at);
      if (at) wrote.place = placeNow();
    }
    if (partsField && (parts || before.parts === partsNow())) {
      setParts(parts);
      if (parts) wrote.parts = partsNow();
    }
  };
  // Emptied and left, or typed over in one go (all of it selected, then typed or pasted): the address picked is no longer the
  // box's, nor its place and parts (a delivery would go to it); words only edited, a flat added or a word taken out, keep them.
  const left = () => {
    if (!emptied && !typedOver()) return;
    emptied = false;
    picked = [];
    // A pick still finding its place writes nothing now.
    picking++;
    tell(null);
    writeFound(null, undefined);
  };
  input.addEventListener('blur', left);
  // Read by a save made from inside it (a change) as leaving reads it: typed over, the address picked is no longer its.
  input.addEventListener('change', left);
  /** An address picked, while its place and parts are found: a save waits for them. */
  let finding: Promise<void> | null = null;
  const stopReading = typeof form.settling === 'function' ? form.settling(() => finding ?? undefined) : null;

  const box = searchBox({
    document: doc,
    id,
    input,
    labels: words,
    search: (request) => search({ ...request, addresses: true, ...(countries.length ? { countries } : {}), ...(partsField ? { parts: true } : {}) }),
    asYouType: settings.search ? (settings.searchAsYouType ?? true) : !!settings.provider.searchAsYouType,
    locale,
    near: () => near,
    zoom: () => settings.zoom,
    freeText: true,
    say,
    // Its whole address at once; its place and parts as soon as they are known (looked up now, for a provider whose
    // suggestions carry none). A save made meanwhile waits for them (`finding`): never the address with another's place.
    pick(place: PlaceFound) {
      const run = pickPlace(place);
      finding = run;
      void run.finally(() => {
        if (finding === run) finding = null;
      });
      return run;
    },
  });

  async function pickPlace(place: PlaceFound) {
    const mine = ++picking;
    // Picked on the record shown now: where it is, found once another is shown, is written on no other.
    const asked = stillShown(form);
    emptied = false;
    picked = [plain(place.label)];
    tell(null);
    const whole = addressLine([place.label, place.detail], locale);
    write(whole);
    let at: LatLng | null = place.lat !== undefined && place.lng !== undefined ? { lat: place.lat, lng: place.lng } : null;
    let parts = place.parts;
    if (!at && place.locate && (placeField || (partsField && !parts))) {
      let failed = false;
      const located = await place.locate().catch((error: Error) => {
        failed = unanswered(error, doc.defaultView?.navigator.onLine === false);
        warnOnce(`Finding the address picked failed: ${error.message}`);
        return null;
      });
      if (mine !== picking || !asked()) return;
      // Not found where it is: no place written, its parts still are; and the person is told, or told the map did not answer (it may well be on it). Only near it: written, and said.
      tell(!located ? (failed ? words.locateFailed : words.notPlaced) : located.precise === false ? words.placedNear : null);
      if (located) {
        at = located;
        parts = located.parts ?? parts;
        // The provider's own way of writing it, unless a person has typed since.
        if (located.address && input.value === whole) {
          write(addressLine([located.address], locale));
          picked.push(firstPiece(located.address));
        }
      }
    }
    // The pick before's place and parts, still as it wrote them, were another address's: they go, though nothing comes in their place.
    writeFound(at, parts);
  }

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
    } else {
      // Its own words in their own direction: "© OpenStreetMap contributors" in an Arabic page too.
      const text = doc.createElement('bdi');
      text.textContent = mark.text;
      credit.append(text);
    }
    popup.append(credit);
  }
  // A press on it keeps the box's focus, so the list stays open and a credit's link opens.
  popup.addEventListener('mousedown', (event) => event.preventDefault());
  element.append(popup, note, status);
  return {
    described,
    destroy() {
      box.destroy();
      stopReading?.();
      input.removeEventListener('input', typedOn);
      input.removeEventListener('blur', left);
      input.removeEventListener('change', left);
      tell(null);
      popup.remove();
      note.remove();
      status.remove();
    },
  };
}
