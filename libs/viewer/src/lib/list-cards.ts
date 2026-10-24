import { cardLines, type CardLinePart, type ListNode, type Locale, type Page, type PluralWords, type Value, type Values, intlFormat } from '@fieldia/core';
import { keepsWhole } from '@fieldia/widgets';
import type { El } from './dom';
import type { Cells } from './list-cells';

/**
 * A record as a card (list.ts; the cards part, cards-part.ts): its picture, its title and the
 * words under it, its status as a pill, and a few lines — drawn in its row, a
 * cell the table hides and a narrow list or its gallery shows in place of the
 * columns, so a card is its row: ticked, opened, toned, its buttons pressed,
 * under its Group By heading and over the totals, as the row is.
 */

/** What a list's cards show, the page's card read with the columns' defaults. */
export interface CardSpec {
  title: string;
  subtitle?: string;
  image?: string;
  status?: string;
  lines: CardLinePart[][];
  labels: boolean;
  lead: boolean;
}

/** Kinds of field no card line shows: lines, rich text, files and raw data. */
const NO_LINE = new Set(['one2many', 'html', 'binary', 'image', 'json', 'properties']);
/** Cell widgets that draw a picture, and a value's look: a picture column, a status column. */
const PICTURE_WIDGETS = new Set(['image', 'avatar']);
const STATUS_WIDGETS = new Set(['badge', 'dot']);

/**
 * A list's cards, where it has any (`card`, or a `gallery` whose cards are the columns'): its own fields where it
 * names them, the columns' where it does not — its name column the title, its first picture column the photo, its
 * first column drawn as a pill or a dot the status, and the next three columns its lines.
 */
export function cardSpec(page: Page, node: ListNode, nameColumn: string): CardSpec | null {
  if (!node.card && !node.gallery) return null;
  const card = node.card ?? {};
  const known = (name: string | undefined) => (name && page.fields[name] ? name : undefined);
  const widget = (name: string) => node.cells?.[name]?.widget ?? '';
  const title = known(card.title) ?? nameColumn;
  const subtitle = known(card.subtitle);
  const image = known(card.image) ?? node.columns.find((name) => page.fields[name]?.type === 'image' || PICTURE_WIDGETS.has(widget(name)));
  const status = known(card.status) ?? node.columns.find((name) => name !== title && STATUS_WIDGETS.has(widget(name)));
  const taken = new Set([title, subtitle, image, status]);
  const lines = card.fields
    ? cardLines(card).map((parts) => parts.filter((part) => page.fields[part.field])).filter((parts) => parts.length)
    : node.columns
        .filter((name) => !taken.has(name) && !NO_LINE.has(page.fields[name]?.type ?? '') && !PICTURE_WIDGETS.has(widget(name)))
        .slice(0, 3)
        .map((field) => [{ field }]);
  return { title, ...(subtitle ? { subtitle } : {}), ...(image ? { image } : {}), ...(status ? { status } : {}), lines, labels: card.labels !== false, lead: !!card.lead };
}

/** Every field a card shows, for the list to ask for with its columns. */
export const cardReads = (spec: CardSpec | null): string[] =>
  spec ? [spec.title, ...(spec.subtitle ? [spec.subtitle] : []), ...(spec.image ? [spec.image] : []), ...(spec.status ? [spec.status] : []), ...spec.lines.flat().map((part) => part.field)] : [];

const plurals = new Map<Locale, Intl.PluralRules>();
/** The words after a number, in the plural form the page's language gives it: "1 bed", "4 beds". */
function unitWords(unit: string | PluralWords, value: Value | undefined, locale: Locale): string {
  if (typeof unit === 'string') return unit;
  let rules = plurals.get(locale);
  if (!rules) plurals.set(locale, (rules = intlFormat('PluralRules', locale)));
  const form = typeof value === 'number' ? (rules.select(value) as keyof PluralWords) : 'other';
  return unit[form] ?? unit.other;
}

/** Cell widgets a card line draws as its column does: chips, a bar, a pill, a dot, a phone with its links. */
const DRAWN = new Set(['tags', 'progressbar', 'badge', 'dot', 'phone']);

export interface CardContext {
  page: Page;
  node: ListNode;
  el: El;
  locale: Locale;
  cells: Cells;
}

/** A record's card, in the cell its row keeps for it. */
export function drawCard(context: CardContext, spec: CardSpec, values: Values, fallbackName: string): HTMLTableCellElement {
  const { page, node, el, locale, cells } = context;
  const title = cells.words(spec.title, values) || fallbackName;
  const parts: Node[] = [];
  if (spec.image) {
    const source = cells.picture(spec.image, values);
    const photo = el('div', { class: 'fd-list-card-photo', 'data-empty': source ? undefined : '' });
    if (source) {
      const img = el('img', { alt: '', loading: 'lazy', decoding: 'async' });
      img.src = source;
      photo.append(img);
    } else photo.append(el('span', { class: 'fd-list-card-initials', 'aria-hidden': 'true', 'data-initials': cells.initials(title) }));
    parts.push(photo);
  }
  const status = spec.status ? cells.pill(spec.status, values) : null;
  // Its title and subtitle each in its own direction — a text kept in several languages in the reader's, else marked with another's.
  const titled = cells.words(spec.title, values) ? cells.text(spec.title, values) : [el('bdi', {}, title)];
  const head = el('div', { class: 'fd-list-card-head' }, el('strong', { class: 'fd-list-card-title' }, ...titled), ...(status ? [status] : []));
  const body = el('div', { class: 'fd-list-card-body' }, head);
  const subtitle = spec.subtitle ? cells.words(spec.subtitle, values) : '';
  if (subtitle && spec.subtitle) body.append(el('div', { class: 'fd-list-card-subtitle' }, ...cells.text(spec.subtitle, values)));
  // Each line, its parts side by side: each part its own label beside its own value — "Next follow-up 30 Sept 2026",
  // "Agent Mona Adel" — never the labels of a line together, then its values; one alone drawn as its column draws it.
  // The line wraps between its parts, a part moving whole to the next row where it does not fit beside the one before.
  const lines = spec.lines
    .map((line) => line.map((part) => ({ part, said: partWords(part, values) })).filter(({ said }) => said !== ''))
    .filter((line) => line.length)
    .map((line) => {
      const pairs = line.map(({ part, said }) => {
        const only = line.length === 1 && part.unit === undefined && DRAWN.has(node.cells?.[part.field]?.widget ?? '') ? part.field : null;
        const value = only ? cells.draw(only, values, title) : part.unit === undefined ? cells.text(part.field, values) : [el('bdi', {}, said)];
        // Words read as one — a number, an amount, a day, a phone number — never broken inside (cards-styles.ts).
        const whole = keepsWhole(page.fields[part.field]?.type, node.cells?.[part.field]?.widget);
        return el('div', { 'data-part': part.field, 'data-whole': whole ? '' : undefined }, el('dt', {}, page.fields[part.field]?.label ?? part.field), el('dd', {}, ...value));
      });
      const whole = line.every(({ part }) => keepsWhole(page.fields[part.field]?.type, node.cells?.[part.field]?.widget));
      return el('div', { 'data-field': line[0].part.field, 'data-whole': whole ? '' : undefined }, el('dl', {}, ...pairs));
    });
  if (lines.length) {
    const list = el('div', { class: 'fd-list-card-lines', 'data-labels': spec.labels ? undefined : 'hidden', 'data-lead': spec.lead ? '' : undefined }, ...lines);
    body.append(list);
  }
  parts.push(body);
  return el('td', { class: 'fd-list-card' }, ...parts);

  function partWords(part: CardLinePart, record: Values): string {
    const said = cells.words(part.field, record);
    if (said === '' || part.unit === undefined) return said;
    const unit = unitWords(part.unit, record[part.field], locale);
    return unit ? `${said}\u00a0${unit}` : said;
  }
}
