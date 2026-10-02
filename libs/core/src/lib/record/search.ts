import type { JsonValue } from '../format/json';
import type { ListNode } from '../format/layout';
import type { Page } from '../format/page';
import type { ResolvedFilter, ResolvedFilterCondition } from './data-source';
import { fill } from './messages';

/**
 * What a list's search bar holds, each shown as a chip: values searched in
 * one field (any of them), named filters (any of them), a custom filter, or
 * the fields the list is grouped by. The facets all apply together.
 */
export type Facet =
  | { kind: 'field'; field: string; label: string; values: { op: ResolvedFilterCondition['op']; value: JsonValue; label: string }[] }
  | { kind: 'filters'; ids: string[]; labels: string[] }
  | { kind: 'custom'; label: string; filter: ResolvedFilter[] }
  | { kind: 'groupBy'; fields: string[]; labels: string[] };

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

/**
 * The searches the typed text can be: text looked for in each text field, a
 * choice whose label it matches, a number where it is one, a link by its
 * record's name. Only the list's search fields, the columns unless it says.
 */
export function suggestions(typed: string, page: Page, list: ListNode, words: { searchFor: string } = { searchFor: 'Search {field} for: {text}' }): Suggestion[] {
  const text = typed.trim();
  if (!text) return [];
  const found: Suggestion[] = [];
  for (const field of list.searchFields ?? list.columns) {
    const def = page.fields[field];
    if (!def) continue;
    const say = (op: Suggestion['op'], value: JsonValue, valueLabel: string, label?: string) =>
      found.push({ field, fieldLabel: def.label, op, value, valueLabel, label: label ?? fill(words.searchFor, { field: def.label, text }) });
    if (TEXT.has(def.type) || LINK.has(def.type)) say('ilike', text, text);
    else if (def.type === 'selection') {
      const lower = text.toLowerCase();
      for (const option of def.options) if (option.label.toLowerCase().includes(lower)) say('=', option.value, option.label, `${def.label}: ${option.label}`);
    } else if (NUMBER.has(def.type)) {
      const number = Number(text.replace(/[\s,]/g, ''));
      if (text && Number.isFinite(number)) say('=', number, text);
    }
  }
  // Text fields first, then the choices, then the links: the order a person looks in.
  const rank = (s: Suggestion) => {
    const type = page.fields[s.field]?.type ?? '';
    return TEXT.has(type) ? 0 : type === 'selection' ? 1 : NUMBER.has(type) ? 2 : 3;
  };
  return found.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map(({ s }) => s);
}

/** The filter a list's facets make: the values of one field any of them, named filters any of them, the facets all together. */
export function facetsToFilter(facets: readonly Facet[], list: ListNode): ResolvedFilter[] {
  const filter: ResolvedFilter[] = [];
  for (const facet of facets) {
    if (facet.kind === 'field') {
      const conditions = facet.values.map((v) => ({ field: facet.field, op: v.op, value: v.value }));
      filter.push(conditions.length === 1 ? conditions[0] : { any: conditions });
    } else if (facet.kind === 'filters') {
      // A list's own filters have no valueFrom: their conditions are already values.
      const chosen = facet.ids.map((id) => (list.filters?.find((f) => f.id === id)?.filter ?? []) as ResolvedFilter[]).filter((items) => items.length);
      if (chosen.length === 1) filter.push(...chosen[0]);
      else if (chosen.length > 1) filter.push({ any: chosen.map((items) => (items.length === 1 ? items[0] : { all: items })) });
    } else if (facet.kind === 'custom') {
      filter.push(...facet.filter);
    }
  }
  return filter;
}

/** The fields a list is grouped by, in order, from its Group By facet. */
export function groupByFields(facets: readonly Facet[]): string[] {
  return facets.find((f): f is Extract<Facet, { kind: 'groupBy' }> => f.kind === 'groupBy')?.fields ?? [];
}
