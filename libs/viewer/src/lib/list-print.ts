import { type DataSource, type DayCount, type Facet, type ListNode, type Locale, type Page, type ResolvedFilter, type SortOrder, type Values } from '@fieldia/core';
import { formatNumber, restingText } from '@fieldia/widgets';
import type { El } from './dom';
import { gather } from './list-export';
import { groupFilter, groupName, type GroupKey, type Heading } from './list-groups';
import type { ListTotals } from './list-totals';
import type { ViewerLabels } from './labels';
import { facetText } from './search-bar';
import { valueWords } from './value-words';

/**
 * A list on paper (its bar's Print, `"print": true`): every record the
 * search finds — each page of them asked of the data source, as Export asks
 * for every match (`gather`) — the columns as the list shows them, each
 * value as its cell says it, under the list's Group By headings with their
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
  /** What is asked of each record: its columns, and what their words read (a currency). */
  reads: string[];
  /** A column's words for a record, as its cell says them. */
  words: (name: string, values: Values) => string;
  /** A column's words keep to its end: a number's. */
  atEnd: (name: string) => boolean;
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
  const columns = node.columns;
  const number = (n: number) => formatNumber(n, 0, list.locale);
  let done = 0;
  let total = list.matching;
  let left = most;
  const cell = (tag: 'td' | 'th', name: string | null, text: string) => el(tag, { class: name && list.atEnd(name) ? 'fd-num' : undefined }, el('bdi', {}, text));

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
  const header = own.header ? valueWords(list.doc, fields, own.header, list.locale) : null;
  const footer = own.footer ? valueWords(list.doc, fields, own.footer, list.locale) : null;
  header?.update({});
  footer?.update({});
  const filters = list.facets.filter((facet) => facet.kind !== 'groupBy').map((facet) => facetText(facet, labels));
  const grouped = list.facets.flatMap((facet) => (facet.kind === 'groupBy' ? [facetText(facet, labels)] : []));
  const about = [
    ...(filters.length ? [list.fill(labels.printFilters, { filters: filters.join(' · ') })] : []),
    ...(grouped.length ? [list.fill(labels.printGroups, { groups: grouped.join(' > ') })] : []),
    list.fill(new Intl.PluralRules(list.locale).select(total) === 'one' ? labels.printCountOne : labels.printCount, { n: number(total) }),
  ];
  const sheet = el(
    'div',
    { class: 'fd-print-sheet' },
    el(
      'div',
      { class: 'fd-print-head' },
      ...(own.logo ? [el('img', { class: 'fd-print-logo', src: own.logo, alt: '' })] : []),
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
