import { cardLines, type CardLine, type CardLinePart, type Locale, type MapCard, type Page, type PluralWords, type Value, type Values } from '@fieldia/core';
import { fill, type ListMapLabels, type MapLabels } from './labels';
import { imageSource, shown, type MapRecord } from './pins';

/**
 * The card a pin opens on a list's map: the record's picture, its title,
 * the lines the page names, a box to choose it (the same choice as its
 * row's) and a button to open it. Written in the page's direction, though
 * the map under it is left to right; every word goes in as text, and each
 * of the record's words in its own direction: an English name on an Arabic
 * page reads as typed, "280 m²" stays "280 m²".
 *
 * A page may write its lines bare ("13,900,000 EGP", "Sheikh Zayed · 4 beds
 * · 280 m²"), their labels kept for a screen reader; lead with the first;
 * link the title and the picture to the record's own address; and leave the
 * box to choose off a map people only look at.
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
  /** The lines the card shows, in order: a field, a field with its words, or several on one line. */
  fields: CardLine[];
  record: MapRecord;
  /** A box to choose the record, as its row's is: a list's map has one, a form's does not. */
  chosen?: boolean;
  choose?(on: boolean): void;
  open?: () => void;
  /** The list's buttons, each pressed for this record alone. */
  actions?: { id: string; label: string; style?: string }[];
  act?(id: string, button: HTMLElement): void;
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

/** A record's address on the web, when a link may go there: a web, mail or phone address, or a path of this site; never a script. */
export function webAddress(value: Value | undefined): string {
  const text = typeof value === 'string' ? value.trim() : '';
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(text)?.[1].toLowerCase();
  return text && (!scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme)) ? text : '';
}

const plurals = new Map<Locale, Intl.PluralRules>();
/** The words after a number, in the plural form the page's language gives it: "1 bed", "4 beds". */
function unitWords(unit: string | PluralWords, value: Value | undefined, locale: Locale): string {
  if (typeof unit === 'string') return unit;
  let rules = plurals.get(locale);
  if (!rules) plurals.set(locale, (rules = new Intl.PluralRules(locale)));
  const form = typeof value === 'number' ? (rules.select(value) as keyof PluralWords) : 'other';
  return unit[form] ?? unit.other;
}

/** A part of a line as words: its value as the field shows it, and its own words after it, kept on one line with it. */
function partWords(page: Page, part: CardLinePart, values: Values, locale: Locale): string {
  const said = shown(page, part.field, values, locale);
  if (said === '' || part.unit === undefined) return said;
  const unit = unitWords(part.unit, values[part.field], locale);
  return unit ? `${said}\u00a0${unit}` : said;
}

export function drawCard(options: CardOptions): Card {
  const { document: doc, page, locale, labels, record, card } = options;
  const title = shown(page, options.title, record.values, locale) || String(record.id);
  const element = make(doc, 'div', 'fd-map-card');
  element.dir = options.dir;
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', title);
  element.dataset['id'] = String(record.id);
  const href = card.href ? webAddress(record.values[card.href]) : '';
  /** A link to the record's own address: one a person can open in a new tab, or copy. */
  const link = (className: string, ...children: Node[]) => {
    const a = make(doc, 'a', className, ...children);
    a.href = href;
    return a;
  };

  const picture = card.image ? imageSource(record.values[card.image]) : '';
  if (picture) {
    const img = make(doc, 'img', 'fd-map-card-image');
    img.alt = '';
    img.decoding = 'async';
    img.src = picture;
    // The picture goes where the title does; the title's link is the one the keys and a screen reader reach.
    if (href) {
      const to = link('fd-map-card-picture', img);
      to.tabIndex = -1;
      to.setAttribute('aria-hidden', 'true');
      element.append(to);
    } else element.append(img);
  }
  const body = make(doc, 'div', 'fd-map-card-body');
  const close = closeButton(doc, labels, options.close);
  const name = make(doc, 'bdi', '', title);
  body.append(make(doc, 'div', 'fd-map-card-head', make(doc, 'strong', 'fd-map-card-title', href ? link('fd-map-card-link', name) : name), close));

  // Each line: its label (or its parts' labels), and its parts, each a value in its own direction, parted by a dot.
  const lines = cardLines({ fields: options.fields })
    .map((parts) => parts.map((part) => ({ part, said: partWords(page, part, record.values, locale) })).filter(({ said }) => said !== ''))
    .filter((parts) => parts.length);
  if (lines.length) {
    const list = make(
      doc,
      'dl',
      'fd-map-card-fields',
      ...lines.map((parts) => {
        const label = parts.map(({ part }) => page.fields[part.field]?.label ?? part.field).join(' · ');
        const value = make(doc, 'dd', '', ...parts.flatMap(({ said }, i) => [...(i ? [' · '] : []), make(doc, 'bdi', '', said)]));
        return make(doc, 'div', '', make(doc, 'dt', '', label), value);
      })
    );
    // Bare values, their labels said to a screen reader alone; the first line leading.
    if (card.labels === false) list.dataset['labels'] = 'hidden';
    if (card.lead) list.toggleAttribute('data-lead', true);
    body.append(list);
  }

  const box = make(doc, 'input', 'fd-map-card-check');
  box.type = 'checkbox';
  box.checked = !!options.chosen;
  box.addEventListener('change', () => options.choose?.(box.checked));
  const actions = make(doc, 'div', 'fd-map-card-actions', ...(options.choose ? [make(doc, 'label', 'fd-map-card-choose', box, labels.choose)] : []));
  let first: HTMLElement = close;
  for (const action of options.actions ?? []) {
    const button = make(doc, 'button', `fd-button fd-button-${action.style ?? 'secondary'} fd-map-card-act`, action.label);
    button.type = 'button';
    button.dataset['action'] = action.id;
    button.addEventListener('click', () => options.act?.(action.id, button));
    actions.append(button);
    first = button;
  }
  if (options.open && card.open !== false) {
    const open = make(doc, 'button', 'fd-button fd-button-primary fd-map-card-open', labels.openRecord);
    open.type = 'button';
    open.addEventListener('click', () => options.open?.());
    actions.append(open);
    first = open;
  }
  if (actions.childElementCount) body.append(actions);
  element.append(body);
  return {
    element,
    setChosen: (on) => (box.checked = on),
    focus: () => first.focus(),
  };
}

/** Pins on one spot that no zoom parts: a list of them, each opening its own card; one with no card is only named. */
export function drawCrowd(options: {
  document: Document;
  labels: ListMapLabels;
  dir: 'ltr' | 'rtl';
  records: { record: MapRecord; name: string; plain?: boolean }[];
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
  const items = options.records.map(({ record, name, plain }) => {
    if (plain) return make(doc, 'li', '', make(doc, 'span', 'fd-map-crowd-item', make(doc, 'bdi', '', name)));
    const button = make(doc, 'button', 'fd-map-crowd-item', make(doc, 'bdi', '', name));
    button.type = 'button';
    button.dataset['id'] = String(record.id);
    button.addEventListener('click', () => options.pick(record));
    return make(doc, 'li', '', button);
  });
  element.append(make(doc, 'div', 'fd-map-card-body', make(doc, 'div', 'fd-map-card-head', make(doc, 'strong', 'fd-map-card-title', heading), close), make(doc, 'ul', 'fd-map-crowd-list', ...items)));
  return {
    element,
    setChosen: () => undefined,
    focus: () => (element.querySelector<HTMLElement>('.fd-map-crowd-list button') ?? close).focus(),
  };
}
