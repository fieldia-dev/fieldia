import type { Field, FieldNode, Locale, Page } from '@fieldia/core';
import { countriesIn } from '@fieldia/widgets';
import { addressLabels, type AddressLabels } from './address-labels';
import { mapLabels, type MapLabels } from './labels';

/**
 * The maps as kinds of field in Fieldia's designer: Place, Area and an
 * address with suggestions in its toolbox, each with its settings on the
 * picked field. Pass them to the
 * designer as `kinds`, and the widgets as `widgets`, as an app does its own
 * kinds. Shaped as the designer's AppKind, without this package needing the
 * designer.
 */

export interface MapKindContext {
  document: Document;
  /** Keeps settings on the field's place on the page (`node.options`); null takes one away. */
  set(patch: Record<string, string | number | boolean | null>): boolean;
}

export interface MapKind {
  id: string;
  label: string;
  group: string;
  icon: string;
  widget: string;
  field(label: string): Field;
  fits(field: Field): boolean;
  settings(context: MapKindContext): { element: HTMLElement; refresh(page: Page, node: FieldNode): void };
  preview(context: { document: Document }): HTMLElement;
}

const PIN_ICON = '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9.8" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/>';
const AREA_ICON = '<path d="M4.5 8.5 11 4l8.5 5-2.5 10.5H7.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>';

const HEIGHTS = [
  ['heightSmall', 200],
  ['heightMedium', 280],
  ['heightLarge', 400],
] as const;

/** A setting: words then a choice, or a tick then its words, as the designer's own ticks read. */
function row(doc: Document, words: string, control: HTMLElement) {
  const label = doc.createElement('label');
  label.className = 'fd-inline-setting';
  const span = doc.createElement('span');
  span.textContent = words;
  if (control instanceof HTMLInputElement && control.type === 'checkbox') label.append(control, span);
  else label.append(span, control);
  return label;
}

/** The settings side by side, spaced so each tick plainly goes with its own words. */
function settingsRow(doc: Document) {
  const element = doc.createElement('div');
  element.className = 'fd-map-settings';
  element.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;';
  return element;
}

function checkbox(doc: Document, onChange: (on: boolean) => void) {
  const box = doc.createElement('input');
  box.type = 'checkbox';
  box.addEventListener('change', () => onChange(box.checked));
  return box;
}

function heightSetting(doc: Document, words: MapLabels, set: MapKindContext['set']) {
  const select = doc.createElement('select');
  select.className = 'fd-inline-select';
  for (const [key, px] of HEIGHTS) select.append(new Option(words[key], String(px)));
  select.addEventListener('change', () => set({ height: select.value === '280' ? null : Number(select.value) }));
  return { element: row(doc, words.settingHeight, select), read: (node: FieldNode) => (select.value = String(node.options?.['height'] ?? 280)) };
}

/** The demo's drawing on a closed card: a pin or an outline on a faint grid, never a live map. */
function previewOf(doc: Document, icon: string, words: string) {
  const element = doc.createElement('div');
  element.className = 'fd-map-preview';
  element.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px dashed var(--fd-border);border-radius:var(--fd-control-radius);color:var(--fd-muted);font-size:13px;';
  element.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${icon}</svg>`;
  element.append(words);
  return element;
}

/** Place, Area and an address with suggestions for the designer, in its language. */
export function mapKinds(options: { locale?: Locale; labels?: Partial<MapLabels & AddressLabels> } = {}): MapKind[] {
  const words = mapLabels(options.locale, options.labels);
  const place: MapKind = {
    id: 'map-place',
    label: words.placeKind,
    group: words.mapsGroup,
    icon: PIN_ICON,
    widget: 'place',
    field: (label) => ({ type: 'json', label }) as Field,
    fits: (field) => field.type === 'json',
    settings({ document: doc, set }) {
      const myLocation = checkbox(doc, (on) => set({ myLocation: on ? null : false }));
      const search = checkbox(doc, (on) => set({ search: on ? null : false }));
      const height = heightSetting(doc, words, set);
      // The words of the address found, written into a text field of the page.
      const address = doc.createElement('select');
      address.className = 'fd-inline-select';
      address.addEventListener('change', () => set({ addressField: address.value || null }));
      const element = settingsRow(doc);
      element.append(row(doc, words.settingMyLocation, myLocation), row(doc, words.settingSearch, search), row(doc, words.settingAddress, address), height.element);
      return {
        element,
        refresh(page, node) {
          myLocation.checked = node.options?.['myLocation'] !== false;
          search.checked = node.options?.['search'] !== false;
          height.read(node);
          const texts = Object.entries(page.fields).filter(([, field]) => field.type === 'char' || field.type === 'text');
          address.replaceChildren(new Option(words.settingNowhere, ''), ...texts.map(([name, field]) => new Option(field.label, name)));
          address.value = String(node.options?.['addressField'] ?? '');
        },
      };
    },
    preview: ({ document: doc }) => previewOf(doc, PIN_ICON, words.placeKind),
  };
  const area: MapKind = {
    id: 'map-area',
    label: words.areaKind,
    group: words.mapsGroup,
    icon: AREA_ICON,
    widget: 'area',
    field: (label) => ({ type: 'json', label }) as Field,
    fits: (field) => field.type === 'json',
    settings({ document: doc, set }) {
      const element = settingsRow(doc);
      const boxes = (['polygon', 'box', 'circle'] as const).map((shape) => {
        const box = checkbox(doc, () => {
          const on = boxes.filter((b) => b.box.checked).map((b) => b.shape);
          // At least one shape stays: the last one ticked cannot be taken away.
          if (!on.length) {
            box.checked = true;
            return;
          }
          set({ shapes: on.length === 3 ? null : on.join(',') });
        });
        element.append(row(doc, words[shape], box));
        return { shape, box };
      });
      const legend = doc.createElement('span');
      legend.className = 'fd-map-settings-title';
      legend.style.cssText = 'font-weight:600;';
      legend.textContent = words.settingShapes;
      element.prepend(legend);
      const height = heightSetting(doc, words, set);
      element.append(height.element);
      return {
        element,
        refresh(_page, node) {
          const raw = node.options?.['shapes'];
          const listed = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? raw.split(',').map((s) => s.trim()) : null;
          for (const { shape, box } of boxes) box.checked = !listed || listed.includes(shape);
          height.read(node);
        },
      };
    },
    preview: ({ document: doc }) => previewOf(doc, AREA_ICON, words.areaKind),
  };
  return [place, area, addressKind(options)];
}

// ---- an address with suggestions --------------------------------------------

const ADDRESS_ICON = '<path d="M8 20s-4.5-4.4-4.5-8a4.5 4.5 0 0 1 9 0c0 3.6-4.5 8-4.5 8z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15 8h6M15 12h6M15 16h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';

/** A text field the provider suggests addresses for, its settings the fields a picked one also fills and the country it keeps to. */
function addressKind(options: { locale?: Locale; labels?: Partial<MapLabels & AddressLabels> }): MapKind {
  const words = addressLabels(options.locale, options.labels);
  return {
    id: 'map-address',
    label: words.addressKind,
    group: words.mapsGroup,
    icon: ADDRESS_ICON,
    widget: 'address-search',
    field: (label) => ({ type: 'char', label }) as Field,
    fits: (field) => field.type === 'char',
    settings({ document: doc, set }) {
      const [place, parts, country] = ['placeField', 'partsField', 'countries'].map((key) => {
        const select = doc.createElement('select');
        select.className = 'fd-inline-select';
        // As wide as a field's name, not as the longest country's.
        select.style.maxWidth = '16em';
        select.addEventListener('change', () => set({ [key]: select.value || null }));
        return select;
      });
      const element = settingsRow(doc);
      element.append(row(doc, words.settingPlace, place), row(doc, words.settingParts, parts), row(doc, words.settingCountry, country));
      return {
        element,
        refresh(page, node) {
          // A place and an address's parts are kept in json fields: a place's, an address's.
          const json = Object.entries(page.fields).filter(([, field]) => field.type === 'json');
          for (const [select, key] of [[place, 'placeField'], [parts, 'partsField']] as const) {
            select.replaceChildren(new Option(words.settingNowhere, ''), ...json.map(([name, field]) => new Option(field.label, name)));
            select.value = String(node.options?.[key] ?? '');
          }
          // One country here; several, written on the page, are kept as they are.
          const kept = node.options?.['countries'];
          const codes = Array.isArray(kept) ? kept.join(',') : typeof kept === 'string' ? kept : '';
          const listed = countriesIn(options.locale ?? 'en');
          country.replaceChildren(
            new Option(words.anywhere, ''),
            ...(codes && !listed.some(([code]) => code === codes) ? [new Option(codes, codes)] : []),
            ...listed.map(([code, name]) => new Option(name, code))
          );
          country.value = codes;
        },
      };
    },
    preview: ({ document: doc }) => previewOf(doc, ADDRESS_ICON, words.addressKind),
  };
}
