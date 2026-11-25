import { PICTURE_URL, safeUrl, recordSentence, type DataSource, type DayCount, type Facet, type ListNode, type Locale, type Page, type ResolvedFilter, type SortOrder, type Values, intlFormat } from '@fieldia/core';
import { formatNumber, restingText } from '@fieldia/widgets';
import type { El } from './dom';
import { gather } from './list-export';
import { groupFilter, groupName, type GroupKey, type Heading } from './list-groups';
import type { ListTotals } from './list-totals';
import type { ViewerLabels } from './labels';
import { facetText, facetTexts } from './search-bar';
import { printWords } from './value-words';

/**
 * A list on paper (its bar's Print, `"print": true`): every record the
 * search finds — each page of them asked of the data source, as Export asks
 * for every match (`gather`) — the columns as the list shows them (those a
 * person chose, in their order, as Export writes them), each value as its
 * cell says it, under the list's Group By headings with their
 * counts and their sums in their columns, the totals under them all; over
 * them the page's logo and words (its `print`), the list's title, its
 * filters in words, how many, and the day it was printed. In the list part.
 */

/** The most records a printout holds: past it, the first so many, and the list says so. */
export const PRINT_MOST = 10000;

export interface PrintList {
  page: Page;
  node: ListNode;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  locale: Locale;
  fill: (template: string, values: Record<string, string | number>) => string;
  model: string;
  dataSource: DataSource;
  /** The columns printed, in their order: those the list shows — the person's own (`optionalColumns`), as Export writes them. */
  columns: string[];
  /** What is asked of each record: its columns, and what their words read (a currency). */
  reads: string[];
  /** A column's words for a record, as its cell says them. */
  words: (name: string, values: Values) => string;
  /** A column's words keep to its end: a number's. */
  atEnd: (name: string) => boolean;
  /** A column's words are one thing, kept on one line: a number, an amount, a day, a phone number (`keepsWhole`). */
  whole?: (name: string) => boolean;
  filter: ResolvedFilter[];
  sort: SortOrder[];
  /** The search as it stands: its filters said in words, its Group By. */
  facets: Facet[];
  /** The Group By keys, outermost first: none for rows alone. */
  grouping: GroupKey[];
  /** The groups under a key of the records a filter keeps, as the list's headings count them. */
  groups: (key: GroupKey, filter: ResolvedFilter[]) => Promise<Heading[]>;
  /** How the list counts days, for a group's span in words and its records. */
  count: DayCount;
  totals: ListTotals | null;
  /** How many records the search matches, as the list counts them. */
  matching: number;
  now: () => Date;
}

/**
 * Room kept at the foot of every printed sheet for a footer (`foot`) the stylesheet repeats there, fixed to each
 * sheet's foot (list-styles.ts): its height as it is written on paper, measured out of sight at a sheet's width (a
 * narrow one's, so it is never too little), with a gap over it — on the part it closes (`data-print-room`,
 * `--fd-print-room`). A list's printout keeps it: rows of a table break cleanly between sheets, the room kept at each
 * sheet's foot in Chromium and Firefox alike. A record's footer is printed once, after it: its groups' grids do not
 * (Chromium laid a group's last field over the next group's heading; Firefox let a group run under the footer).
 */
export function keepFootRoom(foot: HTMLElement | null | undefined): void {
  const holder = foot?.parentElement;
  if (!foot || !holder) return;
  const was = foot.style.cssText;
  foot.style.cssText = 'display:block;position:absolute;visibility:hidden;inset-inline-start:0;width:640px';
  const height = foot.getBoundingClientRect().height;
  foot.style.cssText = was;
  holder.style.setProperty('--fd-print-room', `${Math.ceil(height) + 16}px`);
  holder.setAttribute('data-print-room', '');
}

/** The printout, ready to print, and how many of how many records it holds. */
export interface Printout {
  sheet: HTMLElement;
  done: number;
  total: number;
}

/** Every record the search finds, laid out for paper: `progress` told how far it has got. */
export async function printout(list: PrintList, progress: (done: number, total: number) => void, most = PRINT_MOST): Promise<Printout> {
  const { el, labels, node, page } = list;
  const fields = page.fields;
  const columns = list.columns;
  const number = (n: number) => formatNumber(n, 0, list.locale);
  let done = 0;
  let total = list.matching;
  let left = most;
  const classes = (name: string) => [list.atEnd(name) ? 'fd-num' : '', list.whole?.(name) ? 'fd-whole' : ''].filter(Boolean).join(' ') || undefined;
  const cell = (tag: 'td' | 'th', name: string | null, text: string) => el(tag, { class: name ? classes(name) : undefined }, el('bdi', {}, text));

  /** The records a filter keeps, as rows: at most what is left of the most. */
  async function rows(filter: ResolvedFilter[], level: number): Promise<HTMLTableRowElement[]> {
    if (left <= 0) return [];
    const before = done;
    const found = await gather(list, { filter, sort: list.sort, count: 0 }, (got) => progress(before + got, total), left);
    done += found.records.length;
    left -= found.records.length;
    return found.records.map((record) => {
      const row = el('tr', {}, ...columns.map((name) => cell('td', name, list.words(name, record.values))));
      if (level) row.style.setProperty('--fd-level', String(level));
      return row;
    });
  }

  /** A level of groups: each heading — its name, its count and its sums in their columns — then what is under it. */
  async function groups(level: number, within: ResolvedFilter[]): Promise<HTMLTableRowElement[]> {
    const key = list.grouping[level];
    const [heads, sums] = await Promise.all([list.groups(key, within), list.totals?.byColumn(within, key)]);
    const drawn: HTMLTableRowElement[] = [];
    // The heading's words before the first column with a sum: across the columns before it.
    const first = columns.findIndex((name) => sums && [...sums.values()].some((by) => by.has(name)));
    const across = first === -1 ? columns.length : Math.max(first, 1);
    for (const head of heads) {
      if (left <= 0) break;
      const own = sums?.get(JSON.stringify(head.value));
      const name = el('td', { colspan: String(across) }, el('bdi', {}, groupName(list, key, head)), ` (${number(head.count)})`);
      const row = el('tr', { class: 'fd-print-group' }, name, ...columns.slice(across).map((column) => cell('td', column, own?.get(column) ?? '')));
      row.style.setProperty('--fd-level', String(level));
      const filter = [...within, ...groupFilter(list, key, head)];
      drawn.push(row, ...(level + 1 < list.grouping.length ? await groups(level + 1, filter) : await rows(filter, level + 1)));
    }
    return drawn;
  }

  const body = el('tbody');
  if (list.grouping.length) body.append(...(await groups(0, list.filter)));
  else {
    // As the source counts them, from its first page on: the list's own count is only where it starts.
    const found = await gather(list, { filter: list.filter, sort: list.sort, count: list.matching }, progress, most);
    total = found.total;
    done = found.records.length;
    body.append(...found.records.map((record) => el('tr', {}, ...columns.map((name) => cell('td', name, list.words(name, record.values))))));
  }
  const all = (await list.totals?.byColumn(list.filter))?.get('');
  const foot = all?.size ? el('tfoot', {}, el('tr', {}, ...columns.map((name, at) => cell('td', name, all.get(name) ?? (at === 0 ? labels.total : ''))))) : null;
  const table = el('table', { class: 'fd-print-table' }, el('thead', {}, el('tr', {}, ...columns.map((name) => cell('th', name, fields[name].label)))), body, ...(foot ? [foot] : []));

  // Over it: the page's logo and words, the list's title and the day; what the search is, in words, and how many.
  const own = page.print ?? {};
  // A line naming a record's value names none in a list of them: left out whole.
  const header = own.header ? printWords(list.doc, fields, own.header, list.locale) : null;
  const footer = own.footer ? printWords(list.doc, fields, own.footer, list.locale) : null;
  header?.update({});
  footer?.update({});
  // Each chip's words: the named filters on, one for each of their groups.
  const filters = list.facets.filter((facet) => facet.kind !== 'groupBy').flatMap((facet) => facetTexts(facet, labels, node));
  const grouped = list.facets.flatMap((facet) => (facet.kind === 'groupBy' ? [facetText(facet, labels)] : []));
  const about = [
    ...(filters.length ? [list.fill(labels.printFilters, { filters: filters.join(' · ') })] : []),
    ...(grouped.length ? [list.fill(labels.printGroups, { groups: grouped.join(' > ') })] : []),
    intlFormat('PluralRules', list.locale).select(total) === 'one' ? recordSentence(page.records, labels.printCountNounOne, labels.printCountOne, list.locale, { n: number(total) }) : recordSentence(page.records, labels.printCountNoun, labels.printCount, list.locale, { n: number(total) }),
  ];
  const sheet = el(
    'div',
    { class: 'fd-print-sheet' },
    el(
      'div',
      { class: 'fd-print-head' },
      ...(own.logo ? [el('img', { class: 'fd-print-logo', src: safeUrl(own.logo, PICTURE_URL), alt: '' })] : []),
      ...(header ? [el('div', { class: 'fd-print-words', dir: 'auto' }, ...header.nodes)] : []),
      el(
        'div',
        { class: 'fd-print-what' },
        el('div', { class: 'fd-print-title' }, page.title || node.id),
        el('div', { class: 'fd-print-when' }, list.fill(labels.printedOn, { date: restingText(list.now().toISOString(), 'datetime', list.locale, page.timeZone) }))
      )
    ),
    el('div', { class: 'fd-print-about' }, ...about.map((line) => el('div', { dir: 'auto' }, line))),
    table,
    ...(footer ? [el('div', { class: 'fd-print-foot', dir: 'auto' }, ...footer.nodes)] : [])
  );
  return { sheet, done, total: Math.max(total, done) };
}
