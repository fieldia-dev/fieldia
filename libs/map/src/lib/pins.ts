import { compileModifier, expressionContext, type FileValue, type LineField, type Locale, type Page, type Pin, type RecordId, type Tone, type Value, type Values } from '@fieldia/core';
import { currencyOf, displayValue, drawIcon, type IconSet } from '@fieldia/widgets';
import { MAP_ICONS } from './map-icons';

/**
 * A record's pin on a list's map, as the page says: a pin, an icon (a car
 * facing its way), a round photo (a courier's face), a label (a price, a
 * name, minutes away) or a dot, in a tone while a condition holds on the
 * record; or the app's own, drawn by its function. Built from elements:
 * a record's words and pictures never pass through HTML.
 */

export interface MapRecord {
  id: RecordId;
  values: Values;
}

/** The app's own pin, by the name `pin.widget` gives: an element drawn from the record. */
export type PinDrawer = (record: MapRecord, context: { document: Document; locale: Locale; page: Page }) => HTMLElement;

export interface PinFace {
  element: HTMLElement;
  /** Where the face stands on its point: by its foot (a pin, a label) or by its middle. */
  stands: 'foot' | 'middle';
  /** How tall it is, in pixels: a card opens above it. */
  height: number;
}

export interface Pins {
  face(record: MapRecord): PinFace;
  /** The pin's name for assistive technology: the record's title, and what the pin says. */
  name(record: MapRecord): string;
  /** The fields the pins read, to ask for with the records. */
  readonly fields: string[];
}

export interface PinsOptions {
  document: Document;
  page: Page;
  locale: Locale;
  pin: Pin;
  /** The field that names a record: the card's title, or the list's first column. */
  title: string;
  icons?: IconSet;
  drawers?: Record<string, PinDrawer>;
}

/** The icons drawn as seen from above, facing north: they turn whole with a record's heading. */
const FROM_ABOVE = new Set(['car', 'arrow']);

const PIN = `<svg viewBox="0 0 30 40" aria-hidden="true" focusable="false"><path class="fd-map-face-body" d="M15 1C7.3 1 1 7.1 1 14.7 1 25.3 15 39 15 39s14-13.7 14-24.3C29 7.1 22.7 1 15 1z"/></svg>`;

export function makePins(options: PinsOptions): Pins {
  const { document: doc, page, locale, pin } = options;
  const icons: IconSet = { ...MAP_ICONS, ...options.icons };
  const look = pin.widget ? 'own' : (pin.look ?? (pin.label ? 'label' : pin.image ? 'photo' : pin.icon || pin.iconField ? 'icon' : 'pin'));
  const drawer = pin.widget ? options.drawers?.[pin.widget] : undefined;
  const tones = (pin.tones ?? []).map(({ tone, when }) => ({ tone, when: compileModifier(when) }));
  const fields = [
    ...new Set(
      [options.title, pin.label, pin.iconField, pin.image, pin.turn, ...tones.flatMap((t) => t.when.fields)]
        .filter((name): name is string => !!name && name in page.fields)
        .flatMap((name) => withCurrency(page, name))
    ),
  ];

  const toneOf = (values: Values): Tone | undefined => {
    if (!tones.length) return undefined;
    const context = expressionContext(values, page.fields);
    return tones.find((t) => t.when.evaluate(context))?.tone;
  };
  const icon = (values: Values) => {
    const named = pin.iconField ? values[pin.iconField] : undefined;
    const name = typeof named === 'string' && named ? named : pin.icon;
    return drawIcon(doc, name, icons) ?? drawIcon(doc, pin.icon ?? 'pin', icons);
  };
  const span = (className: string, ...children: (Node | string)[]) => {
    const element = doc.createElement('span');
    element.className = className;
    element.append(...children);
    return element;
  };

  function face(record: MapRecord): PinFace {
    const { values } = record;
    const element = doc.createElement('div');
    element.className = 'fd-map-face';
    element.dataset['look'] = look;
    const tone = toneOf(values);
    if (tone) element.dataset['tone'] = tone;
    const said = pin.label ? pinText(page, pin.label, values, locale) : '';
    if (look === 'own') {
      if (drawer) element.append(drawer(record, { document: doc, locale, page }));
      element.dataset['stands'] = 'middle';
      return { element, stands: 'middle', height: 32 };
    }
    if (look === 'label' && said) {
      element.append(span('fd-map-face-text', said));
      element.dataset['stands'] = 'foot';
      return { element, stands: 'foot', height: 34 };
    }
    if (look === 'pin') {
      element.innerHTML = PIN;
      const inside = pin.icon || pin.iconField ? icon(values) : null;
      element.append(span('fd-map-face-icon', ...(inside ? [inside] : [])));
      element.dataset['stands'] = 'foot';
      return { element, stands: 'foot', height: 40 };
    }
    if (look === 'icon') {
      const drawn = icon(values);
      const glyph = span('fd-map-face-icon', ...(drawn ? [drawn] : []));
      element.append(glyph);
      const turn = pin.turn ? values[pin.turn] : null;
      if (typeof turn === 'number' && Number.isFinite(turn)) {
        // A car seen from above turns itself; a scooter seen from its side stays upright, a pointer on its edge showing the way.
        if (FROM_ABOVE.has(drawn?.dataset['icon'] ?? '')) glyph.style.transform = `rotate(${turn}deg)`;
        else {
          const pointer = span('fd-map-face-turn');
          pointer.style.transform = `rotate(${turn}deg)`;
          element.append(pointer);
        }
      }
      element.dataset['stands'] = 'middle';
      return { element, stands: 'middle', height: 34 };
    }
    if (look === 'photo') {
      const source = pin.image ? imageSource(values[pin.image]) : '';
      if (source) {
        const img = doc.createElement('img');
        img.className = 'fd-map-face-photo';
        img.alt = '';
        img.decoding = 'async';
        img.src = source;
        element.append(img);
      } else element.append(span('fd-map-face-photo', ...[drawIcon(doc, 'user', icons)].filter((n): n is SVGSVGElement => !!n)));
      if (said) element.append(span('fd-map-face-text', said));
      element.dataset['stands'] = 'middle';
      return { element, stands: 'middle', height: 42 };
    }
    // A dot; and a label with nothing to say.
    element.dataset['look'] = 'dot';
    element.dataset['stands'] = 'middle';
    return { element, stands: 'middle', height: 16 };
  }

  function name(record: MapRecord): string {
    const title = shown(page, options.title, record.values, locale);
    const said = pin.label && pin.label !== options.title ? shown(page, pin.label, record.values, locale) : '';
    return [title, said].filter(Boolean).join(comma(locale)) || String(record.id);
  }

  return { face, name, fields };
}

/** The comma between a name's parts, in the page's language. */
export const comma = (locale: Locale) => (locale === 'ar' ? '، ' : ', ');

/** A field, and the field its amount's currency is in. */
export function withCurrency(page: Page, name: string): string[] {
  const def = page.fields[name];
  return def?.type === 'monetary' && def.currencyField && !def.currencyField.startsWith('parent.') ? [name, def.currencyField] : [name];
}

/** A value as a person reads it in full: a card's line, a pin's name. */
export function shown(page: Page, name: string, values: Values, locale: Locale): string {
  const def = page.fields[name];
  const value = values[name];
  if (value === null || value === undefined || value === '') return '';
  return def ? displayValue(def as LineField, value, values, locale) : String(value);
}

/**
 * What a pin says, short enough for a pin: an amount or a number in the
 * page's language, compact ("E£9.5M", "12K", "4.6"); anything else as a
 * card would show it.
 */
export function pinText(page: Page, name: string, values: Values, locale: Locale): string {
  const def = page.fields[name];
  const value: Value | undefined = values[name];
  if (def && typeof value === 'number' && Number.isFinite(value) && (def.type === 'monetary' || def.type === 'integer' || def.type === 'float')) {
    const currency = currencyOf(def as LineField, values);
    const plain = { notation: 'compact', numberingSystem: 'latn', maximumFractionDigits: 1 } as const;
    try {
      if (currency) return new Intl.NumberFormat(locale, { ...plain, style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(value);
    } catch {
      // A currency named by words that are no code: written before the amount, as it is.
      return `${currency} ${new Intl.NumberFormat(locale, plain).format(value)}`;
    }
    return new Intl.NumberFormat(locale, plain).format(value);
  }
  return shown(page, name, values, locale);
}

/** An image field's picture as an address: its first file's data, or where it is kept. */
export function imageSource(value: Value | undefined): string {
  const file = (Array.isArray(value) ? value[0] : value) as FileValue | string | null | undefined;
  if (!file) return '';
  if (typeof file === 'string') return file;
  return file.data ? `data:${file.type};base64,${file.data}` : (file.url ?? '');
}
