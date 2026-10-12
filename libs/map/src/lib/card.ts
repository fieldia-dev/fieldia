import type { Locale, MapCard, Page } from '@fieldia/core';
import { fill, type ListMapLabels, type MapLabels } from './labels';
import { imageSource, shown, type MapRecord } from './pins';

/**
 * The card a pin opens on a list's map: the record's picture, its title,
 * the few fields the page names, a box to choose it (the same choice as its
 * row's) and a button to open it. Written in the page's direction, though
 * the map under it is left to right; every word goes in as text.
 */

export interface CardOptions {
  document: Document;
  page: Page;
  locale: Locale;
  labels: MapLabels & ListMapLabels;
  dir: 'ltr' | 'rtl';
  card: MapCard;
  /** The field that names the record. */
  title: string;
  /** The fields the card shows, in order. */
  fields: string[];
  record: MapRecord;
  chosen: boolean;
  choose(on: boolean): void;
  open?: () => void;
  close(): void;
}

export interface Card {
  element: HTMLElement;
  setChosen(on: boolean): void;
  /** Where focus goes when the card was opened from the keyboard. */
  focus(): void;
}

function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag);
  element.className = className;
  element.append(...children);
  return element;
}

function closeButton(doc: Document, labels: ListMapLabels, close: () => void) {
  const button = make(doc, 'button', 'fd-map-card-close', '×');
  button.type = 'button';
  button.setAttribute('aria-label', labels.closeCard);
  button.title = labels.closeCard;
  button.addEventListener('click', close);
  return button;
}

export function drawCard(options: CardOptions): Card {
  const { document: doc, page, locale, labels, record } = options;
  const title = shown(page, options.title, record.values, locale) || String(record.id);
  const element = make(doc, 'div', 'fd-map-card');
  element.dir = options.dir;
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', title);
  element.dataset['id'] = String(record.id);

  const picture = options.card.image ? imageSource(record.values[options.card.image]) : '';
  if (picture) {
    const img = make(doc, 'img', 'fd-map-card-image');
    img.alt = '';
    img.decoding = 'async';
    img.src = picture;
    element.append(img);
  }
  const body = make(doc, 'div', 'fd-map-card-body');
  const close = closeButton(doc, labels, options.close);
  body.append(make(doc, 'div', 'fd-map-card-head', make(doc, 'strong', 'fd-map-card-title', title), close));

  const lines = options.fields
    .map((name) => [page.fields[name]?.label ?? name, shown(page, name, record.values, locale)] as const)
    .filter(([, value]) => value !== '');
  if (lines.length) body.append(make(doc, 'dl', 'fd-map-card-fields', ...lines.map(([label, value]) => make(doc, 'div', '', make(doc, 'dt', '', label), make(doc, 'dd', '', value)))));

  const box = make(doc, 'input', 'fd-map-card-check');
  box.type = 'checkbox';
  box.checked = options.chosen;
  box.addEventListener('change', () => options.choose(box.checked));
  const actions = make(doc, 'div', 'fd-map-card-actions', make(doc, 'label', 'fd-map-card-choose', box, labels.choose));
  let first: HTMLElement = close;
  if (options.open && options.card.open !== false) {
    const open = make(doc, 'button', 'fd-button fd-button-primary fd-map-card-open', labels.openRecord);
    open.type = 'button';
    open.addEventListener('click', () => options.open?.());
    actions.append(open);
    first = open;
  }
  body.append(actions);
  element.append(body);
  return {
    element,
    setChosen: (on) => (box.checked = on),
    focus: () => first.focus(),
  };
}

/** Pins on one spot that no zoom parts: a list of them, each opening its own card. */
export function drawCrowd(options: {
  document: Document;
  labels: ListMapLabels;
  dir: 'ltr' | 'rtl';
  records: { record: MapRecord; name: string }[];
  pick(record: MapRecord): void;
  close(): void;
}): Card {
  const { document: doc, labels } = options;
  const heading = fill(labels.crowd, { n: options.records.length });
  const element = make(doc, 'div', 'fd-map-card fd-map-crowd');
  element.dir = options.dir;
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', heading);
  const close = closeButton(doc, labels, options.close);
  const items = options.records.map(({ record, name }) => {
    const button = make(doc, 'button', 'fd-map-crowd-item', name);
    button.type = 'button';
    button.dataset['id'] = String(record.id);
    button.addEventListener('click', () => options.pick(record));
    return make(doc, 'li', '', button);
  });
  element.append(make(doc, 'div', 'fd-map-card-body', make(doc, 'div', 'fd-map-card-head', make(doc, 'strong', 'fd-map-card-title', heading), close), make(doc, 'ul', 'fd-map-crowd-list', ...items)));
  return {
    element,
    setChosen: () => undefined,
    focus: () => (items[0]?.querySelector('button') ?? close).focus(),
  };
}
