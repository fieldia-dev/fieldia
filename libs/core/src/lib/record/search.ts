import type { JsonValue } from '../format/json';
import type { FilterPeriod, ListNode } from '../format/layout';
import type { Page } from '../format/page';
import type { ResolvedFilter, ResolvedFilterCondition } from './data-source';
import { fill } from './messages';
import { labelAt } from './record-words';
import { plainPart } from '../format/translate';
import { foldDigits, foldForSearch, readNumber, stripMarks } from './input-rules';

/**
 * What a list's search bar holds, each shown as a chip: values searched in
 * one field (any of them), named filters (any of them), a custom filter, or
 * the fields the list is grouped by. The facets all apply together.
 *
 * A field's values may be a range, one value of one chip: `between` [from, to], `>=` from or `<=` to, its `label` the
 * range in words — "Price: 1,000,000 – 3,000,000", "Bedrooms: 2+", "Listed on: from 1 Oct 2026".
 *
 * A custom filter of a period ("Invoice date: This month") keeps the period,
 * counted again each time the list asks — kept as a favourite, it is right
 * the next day; `filter` is what it was counted as when it was made. A field
 * grouped by the span a date falls in is `field:interval` ("date:month").
 */
export type Facet =
  | { kind: 'field'; field: string; label: string; values: { op: ResolvedFilterCondition['op']; value: JsonValue; label: string }[] }
  | { kind: 'filters'; ids: string[]; labels: string[] }
  | { kind: 'custom'; label: string; filter: ResolvedFilter[]; period?: FilterPeriod }
  | { kind: 'groupBy'; fields: string[]; labels: string[] };

type FieldFacet = Extract<Facet, { kind: 'field' }>;

/** One way to search what was typed: a field, how to compare, and the words that say so. */
export interface Suggestion {
  field: string;
  fieldLabel: string;
  op: ResolvedFilterCondition['op'];
  value: JsonValue;
  valueLabel: string;
  label: string;
}

const TEXT = new Set(['char', 'text', 'html']);
const NUMBER = new Set(['integer', 'float', 'monetary']);
const LINK = new Set(['many2one', 'many2many']);

/** What a phone number is typed with: digits in any script, spaces, a plus and ( ) . - — no letters. */
const PHONE_LIKE = /^[+\d\s().\-\u0660-\u0669\u06f0-\u06f9\uff10-\uff19]+$/;

/**
 * The searches the typed text can be: text looked for in each text field, a
 * choice whose label it matches, a number where it is one, a link by its
 * record's name. Only the list's search fields, the columns unless it says.
 *
 * What is typed is read as every box reads it (FIELDIA INPUT RULES): digits in
 * any script are 0-9, direction marks are dropped, and a number is read in the
 * page's language (`locale`) — its grouping and decimal marks, never hex or an
 * exponent. A column the list shows as a phone (`cells.<field>.widget: "phone"`)
 * is searched by the typed digits in order, whatever the spacing: "3334400",
 * "+٢٠ ٤٠ ٣٣٣ ٤٤٠٠" and "333 4400" all find "+20 40 333 4400".
 */
export function suggestions(typed: string, page: Page, list: ListNode, words: { searchFor: string } = { searchFor: 'Search {field} for: {text}' }, locale = 'en'): Suggestion[] {
  const text = typed.trim();
  if (!text) return [];
  /** The typed text as it is searched for: digits as 0-9, no direction marks. */
  const sought = foldDigits(stripMarks(text)).trim();
  const found: Suggestion[] = [];
  for (const field of list.searchFields ?? list.columns) {
    // Its words as a person reads them, read once (`plainPart`).
    const def = plainPart(page.fields[field]);
    if (!def) continue;
    const say = (op: Suggestion['op'], value: JsonValue, valueLabel: string, label?: string) =>
      found.push({ field, fieldLabel: def.label, op, value, valueLabel, label: label ?? fill(words.searchFor, { field: labelAt(words.searchFor, 'field', page.lowerLabels, locale)(def.label), text }) });
    if (list.cells?.[field]?.widget === 'phone' && TEXT.has(def.type)) {
      // Its digits in order, whatever lies between them: a server's ilike finds them with % between.
      const digits = sought.replace(/\D/g, '');
      if (PHONE_LIKE.test(stripMarks(text)) && digits) say('ilike', digits.split('').join('%'), text);
      else say('ilike', sought, text);
    } else if (TEXT.has(def.type) || LINK.has(def.type)) say('ilike', sought, text);
    else if (def.type === 'selection') {
      const wanted = foldForSearch(text);
      for (const option of def.options) if (foldForSearch(option.label).includes(wanted)) say('=', option.value, option.label, `${def.label}: ${option.label}`);
    } else if (NUMBER.has(def.type)) {
      const read = readNumber(text, locale);
      if (read.ok && read.value !== null) say('=', read.value, text);
    }
  }
  // Text fields first, then the choices, then the links: the order a person looks in.
  const rank = (s: Suggestion) => {
    const type = page.fields[s.field]?.type ?? '';
    return TEXT.has(type) ? 0 : type === 'selection' ? 1 : NUMBER.has(type) ? 2 : 3;
  };
  return found.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map(({ s }) => s);
}

/** A day as a date field holds one: "2026-10-19". */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The conditions for a field's days from `from` to `last`, both kept (either left out for no end), as a list counts
 * days — on a date and time, from the first moment of `from` to before the first of the day after `last` in its time
 * zone; null where the field's days need nothing of the kind (a date's own days compare as they are).
 */
export type RangeDays = (field: string, from: string | null, last: string | null) => ResolvedFilter[] | null;

/**
 * A field facet's value as the conditions a data source reads: its own, or for a range — `between` [from, to], `>=`
 * from, `<=` to, each end kept — `>=` and `<=` (any source reads them; `between` it need not), a range of days on a
 * date and time as `days` counts them.
 */
function valueConditions(field: string, value: FieldFacet['values'][number], days?: RangeDays): ResolvedFilter[] {
  const { op } = value;
  if (op !== 'between' && op !== '>=' && op !== '<=') return [{ field, op, value: value.value }];
  const ends = op === 'between' ? (Array.isArray(value.value) && value.value.length === 2 ? value.value : null) : op === '>=' ? [value.value, null] : [null, value.value];
  if (!ends) return [{ field, op, value: value.value }];
  const [from, to] = ends.map((end) => (end === undefined || end === '' ? null : end));
  const isDay = (end: JsonValue) => end === null || (typeof end === 'string' && DAY.test(end));
  const counted = days && (from !== null || to !== null) && isDay(from) && isDay(to) ? days(field, from as string | null, to as string | null) : null;
  if (counted) return counted;
  return [...(from !== null ? [{ field, op: '>=' as const, value: from }] : []), ...(to !== null ? [{ field, op: '<=' as const, value: to }] : [])];
}

/**
 * The named filters on, by id, in their groups (`ListFilter.group`): the groups in the order they first come in the
 * list's filters, those that name none one group of their own, each group's filters in the order they were turned on.
 * One group where the list's filters name none, as before 0.37. An id the list does not have is with those that name
 * none.
 */
export function filterGroups(ids: readonly string[], list: ListNode): string[][] {
  const named = new Map((list.filters ?? []).map((filter) => [filter.id, filter.group ?? '']));
  const order = [...new Set((list.filters ?? []).map((filter) => filter.group ?? ''))];
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const group = named.get(id) ?? '';
    groups.set(group, [...(groups.get(group) ?? []), id]);
  }
  return [...groups.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((group) => groups.get(group) as string[]);
}

/**
 * The filter a list's facets make: the values of one field any of them, named filters any of each group's (Odoo's
 * filters between separators) and every group, the facets all together. A period — a named filter's, a custom
 * filter's — is counted by `periods`, as the list counts days (its clock, its week, its time zone); a custom filter
 * without it keeps what it was counted as. A field's range — one chip, "Price: 1,000,000 – 3,000,000" — reaches the
 * source as `>=` and `<=`, a date and time's days counted by `days`.
 */
export function facetsToFilter(facets: readonly Facet[], list: ListNode, periods?: (period: FilterPeriod) => ResolvedFilter[], days?: RangeDays): ResolvedFilter[] {
  const filter: ResolvedFilter[] = [];
  for (const facet of facets) {
    if (facet.kind === 'field') {
      const each = facet.values.map((v) => valueConditions(facet.field, v, days)).filter((conditions) => conditions.length);
      if (each.length === 1) filter.push(...each[0]);
      else if (each.length > 1) filter.push({ any: each.map((conditions) => (conditions.length === 1 ? conditions[0] : { all: conditions })) });
    } else if (facet.kind === 'filters') {
      // Each group any of its filters, the groups side by side. A list's own filters have no valueFrom: their
      // conditions are already values.
      for (const group of filterGroups(facet.ids, list)) {
        const chosen = group
          .map((id) => list.filters?.find((f) => f.id === id))
          .map((named) => [...((named?.filter ?? []) as ResolvedFilter[]), ...(named?.period && periods ? periods(named.period) : [])])
          .filter((items) => items.length);
        if (chosen.length === 1) filter.push(...chosen[0]);
        else if (chosen.length > 1) filter.push({ any: chosen.map((items) => (items.length === 1 ? items[0] : { all: items })) });
      }
    } else if (facet.kind === 'custom') {
      filter.push(...(facet.period && periods ? periods(facet.period) : facet.filter));
    }
  }
  return filter;
}

/** The fields a list is grouped by, in order, from its Group By facet. */
export function groupByFields(facets: readonly Facet[]): string[] {
  return facets.find((f): f is Extract<Facet, { kind: 'groupBy' }> => f.kind === 'groupBy')?.fields ?? [];
}
