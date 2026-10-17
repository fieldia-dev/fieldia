import { placesOfCurrency, type DataSource, type GroupInterval, type LineField, type ListNode, type Locale, type Page, type RecordId, type ResolvedFilter, type TotalKind, type TotalsRequest, type TotalsResult, type Value } from '@fieldia/core';
import { currencyOf, displayValue, formatNumber } from '@fieldia/widgets';
import type { El } from './dom';
import type { GroupKey } from './list-groups';
import type { ViewerLabels } from './labels';

export interface TotalsContext {
  page: Page;
  node: ListNode;
  el: El;
  labels: ViewerLabels;
  locale: Locale;
  fill: (template: string, values: Record<string, string | number>) => string;
  dataSource: DataSource | undefined;
  model: string;
  /** The cells before the fields': the box to choose a row, a parent's toggle. */
  leading: number;
  /** The cells after them: a row's own buttons, the header's Columns menu. None unless said. */
  trailing?: number;
  /** The columns shown, in their order: a person's; the list's unless said. */
  columns?: string[];
  /** A column's cell lines its words up at the end (a number's). */
  atEnd: (name: string) => boolean;
  /** How a Group By of a date asks for its spans. */
  interval: (key: GroupKey) => GroupInterval;
}

/** What a list's totals are, by column: a row under the list, the ticked rows' row, and a Group By heading's sums. */
export interface ListTotals {
  /** The table's foot: the ticked rows' totals over the totals of every record the search finds. */
  foot: HTMLTableSectionElement;
  /** Ask again for the search as it is now. */
  refresh(filter: ResolvedFilter[]): void;
  /** The rows ticked changed: their totals, or none. */
  ticked(ids: RecordId[], filter: ResolvedFilter[]): void;
  /** Each group's sums in words, by its value (JSON), for the groups of `key` under `filter` — and why one is not, where none is honest: none when they cannot be asked. */
  headings(key: GroupKey, filter: ResolvedFilter[]): Promise<Map<string, GroupSums>>;
  /**
   * For paper, each column's total in words as its totals cell says it — "Average 12.50" — by column: of every record
   * `filter` keeps (under ''), or with `key` of each of its groups, by the group's value (JSON). None where it cannot be asked.
   */
  byColumn(filter: ResolvedFilter[], key?: GroupKey): Promise<Map<string, Map<string, string>>>;
}

/** A group's sums in words, as its heading says them; `why`, the sentence for an amount over several currencies, which has none. */
export interface GroupSums {
  words: string;
  why?: string;
}

const KIND_WORDS: Record<Exclude<TotalKind, 'sum'>, keyof ViewerLabels> = { avg: 'totalAvg', min: 'totalMin', max: 'totalMax', count: 'totalCount' };

/**
 * A list's totals (`cells.<column>.total`), asked of the data source's
 * `totals`: none — no row, no sums — when the list totals no column or the
 * source cannot. Each total is written as its column writes a value, rounded
 * to its places; an amount whose currency each record keeps only in the one
 * currency the source says it is in, so a total that cannot be honest — over
 * more than one currency, or from a source that does not say — is nothing,
 * never a wrong number.
 */
export function listTotals(context: TotalsContext): ListTotals | null {
  const { page, node, el, labels, locale, fill } = context;
  const source = context.dataSource;
  const columns = node.columns.filter((name) => node.cells?.[name]?.total && page.fields[name]);
  if (!source?.totals || !columns.length) return null;
  const totals = source.totals.bind(source);
  const kindOf = (name: string) => node.cells?.[name]?.total as TotalKind;
  /** The money columns whose currency each record keeps: totalled within one currency only. */
  const currencies: Record<string, string> = {};
  for (const name of columns) {
    const def = page.fields[name];
    if (def.type === 'monetary' && !def.currency && def.currencyField) currencies[name] = def.currencyField;
  }
  /** What a source is told of them: a line's currency (`parent.`) is no list record's, and its amount has no honest total. */
  const asked = Object.fromEntries(Object.entries(currencies).filter(([, held]) => !held.startsWith('parent.')));
  const request = (filter: ResolvedFilter[], more: Partial<TotalsRequest> = {}): TotalsRequest => ({
    model: context.model,
    filter,
    totals: Object.fromEntries(columns.map((name) => [name, [kindOf(name)]])),
    ...(Object.keys(asked).length ? { currencies: asked } : {}),
    ...more,
  });

  /**
   * A column's total in words — in full, with its currency, wherever it is said: under the list, over the rows ticked,
   * on a Group By heading ("EGP 591,500.00", never "EGP 591.5K") — or null where there is none to say honestly.
   */
  function words(name: string, result: Pick<TotalsResult, 'totals' | 'currencies'>): string | null {
    const kind = kindOf(name);
    const value = result.totals[name]?.[kind];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    if (kind === 'count') return displayValue({ type: 'integer', label: '' }, value, {}, locale);
    const def = page.fields[name] as LineField;
    let values: Record<string, Value> = {};
    const held = currencies[name];
    if (held) {
      // A record's own currency: only the one the source names. A line's (parent.) is no list record's.
      if (held.startsWith('parent.') || !result.currencies || !(name in result.currencies)) return null;
      values = { [held]: result.currencies[name] as Value };
    }
    // Rounded to the column's places, as its cells write it: an average of whole numbers to two.
    const places = def.type === 'monetary' ? (def.digits?.[1] ?? placesOfCurrency(currencyOf(def, values))) : def.type === 'float' ? (def.digits?.[1] ?? 2) : kind === 'avg' ? 2 : 0;
    const rounded = Math.round(value * 10 ** places) / 10 ** places;
    const shown: LineField = def.type === 'integer' && places ? ({ ...def, type: 'float', digits: [16, places] } as LineField) : def;
    return displayValue(shown, rounded, values, locale);
  }

  /** An amount over records in more than one currency: no honest total, which is said, never a blank. */
  const mixed = (name: string, result: Pick<TotalsResult, 'currencies' | 'count'>) => name in currencies && result.currencies?.[name] === null && result.count > 0;

  // ---- the table's foot: the ticked rows' totals, then every record's ----

  /** The columns as they are shown, in their order. */
  const shown = context.columns ?? node.columns;
  function totalsRow(kind: string) {
    const head = el('th', { scope: 'row', class: 'fd-list-total-head' });
    const cells = new Map<string, HTMLTableCellElement>();
    // The row's words in its first column, or before its fields where that column has a total of its own.
    const first = columns.includes(shown[0]) ? null : shown[0];
    const lead: HTMLTableCellElement[] = Array.from({ length: context.leading }, (_, i) => (i === 0 && first === null ? head : el('td', {})));
    const row = el(
      'tr',
      { class: 'fd-list-total', 'data-total': kind, hidden: '' },
      ...lead,
      ...shown.map((name) => {
        if (name === first) return head;
        // Its field's name, said before its total where the rows are cards.
        const cell = el('td', { class: context.atEnd(name) ? 'fd-num' : undefined, 'data-field': name, 'data-label': page.fields[name]?.label });
        cells.set(name, cell);
        return cell;
      }),
      ...Array.from({ length: context.trailing ?? 0 }, () => el('td', {}))
    );
    return {
      row,
      head,
      draw(result: TotalsResult) {
        for (const [name, cell] of cells) {
          const said = columns.includes(name) ? words(name, result) : null;
          const kindWord = kindOf(name) && kindOf(name) !== 'sum' ? labels[KIND_WORDS[kindOf(name) as Exclude<TotalKind, 'sum'>]] : '';
          // An amount in several currencies: no number, and why in sight — a phone has no pointer to hover with — in a
          // few words, the sentence as their title.
          const several = said === null && mixed(name, result);
          cell.replaceChildren(
            ...(said === null ? [] : [...(kindWord ? [el('span', { class: 'fd-list-total-kind' }, kindWord), ' '] : []), el('bdi', {}, said)]),
            ...(several ? [el('span', { class: 'fd-list-total-mixed' }, labels.totalMixedShort)] : [])
          );
          if (several) cell.title = labels.totalMixed;
          else cell.removeAttribute('title');
        }
      },
    };
  }
  const all = totalsRow('all');
  all.head.textContent = labels.total;
  const chosen = totalsRow('ticked');
  const foot = el('tfoot', { class: 'fd-list-totals' }, chosen.row, all.row);
  if (!all.row.contains(all.head)) all.row.setAttribute('aria-label', labels.total);

  let allAsked = 0;
  let tickedAsked = 0;
  return {
    foot,
    refresh(filter) {
      const mine = ++allAsked;
      totals(request(filter)).then(
        (result) => {
          if (mine !== allAsked) return;
          all.draw(result);
          // No records, no totals: the list says it has none.
          all.row.hidden = result.count === 0;
        },
        () => {
          if (mine === allAsked) all.row.hidden = true;
        }
      );
    },
    ticked(ids, filter) {
      const mine = ++tickedAsked;
      if (!ids.length) {
        chosen.row.hidden = true;
        return;
      }
      totals(request([...filter, { field: 'id', op: 'in', value: ids }])).then(
        (result) => {
          if (mine !== tickedAsked) return;
          chosen.draw(result);
          // As the page writes numbers, as the count of those chosen over the table is: "1,284 selected".
          const said = fill(labels.selected, { n: formatNumber(ids.length, 0, locale) });
          chosen.head.textContent = said;
          if (!chosen.row.contains(chosen.head)) chosen.row.setAttribute('aria-label', said);
          chosen.row.hidden = false;
        },
        () => {
          if (mine === tickedAsked) chosen.row.hidden = true;
        }
      );
    },
    async byColumn(filter, key) {
      const found = new Map<string, Map<string, string>>();
      const cells = (result: Pick<TotalsResult, 'totals' | 'currencies'>) =>
        new Map(
          columns.flatMap((name) => {
            const said = words(name, result);
            const kind = kindOf(name);
            return said === null ? [] : [[name, kind === 'sum' ? said : `${labels[KIND_WORDS[kind]]} ${said}`] as [string, string]];
          })
        );
      try {
        const result = await totals(request(filter, key ? { groupBy: key.field, ...context.interval(key) } : {}));
        if (!key) found.set('', cells(result));
        for (const group of key ? (result.groups ?? []) : []) found.set(JSON.stringify(group.value), cells(group));
      } catch {
        // No totals on paper either: the rows alone.
      }
      return found;
    },
    async headings(key, filter) {
      const sums = new Map<string, GroupSums>();
      try {
        const result = await totals(request(filter, { groupBy: key.field, ...context.interval(key) }));
        // The sums of the columns shown: a column the person hid takes its sums with it.
        const named = columns.filter((name) => shown.includes(name));
        for (const group of result.groups ?? []) {
          let why: string | undefined;
          const parts = named.flatMap((name) => {
            const said = words(name, group);
            const several = said === null && mixed(name, group);
            if (several) why = labels.totalMixed;
            if (said === null && !several) return [];
            const kind = kindOf(name);
            return [[named.length > 1 ? page.fields[name].label : '', kind === 'sum' || several ? '' : labels[KIND_WORDS[kind]], said ?? labels.totalMixedShort].filter(Boolean).join(' ')];
          });
          if (parts.length) sums.set(JSON.stringify(group.value), { words: `· ${parts.join(' · ')}`, ...(why ? { why } : {}) });
        }
      } catch {
        // No sums: the headings keep their names and counts.
      }
      return sums;
    },
  };
}
