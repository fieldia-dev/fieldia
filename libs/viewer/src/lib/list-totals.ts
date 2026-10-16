import { placesOfCurrency, type DataSource, type GroupInterval, type LineField, type ListNode, type Locale, type Page, type RecordId, type ResolvedFilter, type TotalKind, type TotalsRequest, type TotalsResult, type Value } from '@fieldia/core';
import { currencyOf, displayValue } from '@fieldia/widgets';
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
  /** Each group's sums in words, by its value (JSON), for the groups of `key` under `filter`: none when they cannot be asked. */
  headings(key: GroupKey, filter: ResolvedFilter[]): Promise<Map<string, string>>;
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

  /** A column's total in words — short for a heading's amount ("EGP 4.3M") — or null where there is none to say honestly. */
  function words(name: string, result: Pick<TotalsResult, 'totals' | 'currencies'>, short = false): string | null {
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
    const shown: LineField = def.type === 'integer' && places ? ({ ...def, type: 'float', digits: [16, places] } as LineField) : short && def.type === 'monetary' ? { ...def, money: { ...def.money, short: true } } : def;
    return displayValue(shown, rounded, values, locale);
  }

  // ---- the table's foot: the ticked rows' totals, then every record's ----

  function totalsRow(kind: string) {
    const head = el('th', { scope: 'row', class: 'fd-list-total-head' });
    const cells = new Map<string, HTMLTableCellElement>();
    // The row's words in its first column, or before its fields where that column has a total of its own.
    const first = columns.includes(node.columns[0]) ? null : node.columns[0];
    const lead: HTMLTableCellElement[] = Array.from({ length: context.leading }, (_, i) => (i === 0 && first === null ? head : el('td', {})));
    const row = el(
      'tr',
      { class: 'fd-list-total', 'data-total': kind, hidden: '' },
      ...lead,
      ...node.columns.map((name) => {
        if (name === first) return head;
        const cell = el('td', { class: context.atEnd(name) ? 'fd-num' : undefined, 'data-field': name });
        cells.set(name, cell);
        return cell;
      })
    );
    return {
      row,
      head,
      draw(result: TotalsResult) {
        for (const [name, cell] of cells) {
          const said = columns.includes(name) ? words(name, result) : null;
          const kindWord = kindOf(name) && kindOf(name) !== 'sum' ? labels[KIND_WORDS[kindOf(name) as Exclude<TotalKind, 'sum'>]] : '';
          cell.replaceChildren(...(said === null ? [] : [...(kindWord ? [el('span', { class: 'fd-list-total-kind' }, kindWord), ' '] : []), el('bdi', {}, said)]));
          // An amount in several currencies: no number, and why for whoever points at it.
          const mixed = said === null && name in currencies && result.currencies?.[name] === null && result.count > 0;
          if (mixed) cell.title = labels.totalMixed;
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
          chosen.head.textContent = fill(labels.selected, { n: ids.length });
          if (!chosen.row.contains(chosen.head)) chosen.row.setAttribute('aria-label', fill(labels.selected, { n: ids.length }));
          chosen.row.hidden = false;
        },
        () => {
          if (mine === tickedAsked) chosen.row.hidden = true;
        }
      );
    },
    async headings(key, filter) {
      const sums = new Map<string, string>();
      try {
        const result = await totals(request(filter, { groupBy: key.field, ...context.interval(key) }));
        for (const group of result.groups ?? []) {
          const parts = columns.flatMap((name) => {
            const said = words(name, group, true);
            if (said === null) return [];
            const kind = kindOf(name);
            return [[columns.length > 1 ? page.fields[name].label : '', kind === 'sum' ? '' : labels[KIND_WORDS[kind]], said].filter(Boolean).join(' ')];
          });
          if (parts.length) sums.set(JSON.stringify(group.value), `· ${parts.join(' · ')}`);
        }
      } catch {
        // No sums: the headings keep their names and counts.
      }
      return sums;
    },
  };
}
