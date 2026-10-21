import { suggestions, type DataSource, type Facet, type Field, type JsonValue, type ListNode, type Locale, type Page, type ResolvedFilterCondition } from '@fieldia/core';
import { drawIcon, type IconSet } from '@fieldia/widgets';
import { SPARKLE } from './assist-icon';
import { installAssistStyles } from './assist-styles';
import type { El } from './dom';
import type { FilterKit, RangeEnds } from './filter-range';
import type { ViewerLabels } from './labels';

type FieldFacet = Extract<Facet, { kind: 'field' }>;
type FacetValue = FieldFacet['values'][number];

/**
 * A list's search in plain words turned into filters (`searchToFilter`, the assist part), through the app's own model
 * — the data source's `searchToFilter`: "villas in New Cairo under 15M" read as Type: Villa, District: New Cairo,
 * Price: up to 15,000,000. A ✦ button beside the search box while it holds words (the list part's); pressed, the assist
 * part — loaded then — sends the words to the source,
 * and each condition it answers becomes a filter of the list's own kind — a chip in the search bar, a field's values
 * ticked or its range in the filter bar — which the person sees and takes away as any. Under the bar, what they were
 * read as, the app's why, and Undo, which puts the search and the words back as they were. A condition on a field the
 * list was not asked of, or one it cannot show, is left out and said; typing on, or pressing again, leaves an answer
 * on its way unheard.
 */

/** A list's search bar, as the words read as filters reach it: its box, its search now, and a search put in its place. */
export interface WordsBar {
  input: HTMLInputElement;
  /** The search now, as the bar draws it — the keyword in the box aside. */
  current(): Facet[];
  /** A search in place of the bar's own, and the words left in its box. */
  take(facets: Facet[], typed: string): void;
}

export interface WordsContext {
  page: Page;
  node: ListNode;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  fill(template: string, values: Record<string, string | number>): string;
  locale: Locale;
  icons?: IconSet;
  dataSource: DataSource;
  model: string;
  /** A range's words and value, the list part's (filter-range.ts): handed, never carried twice. */
  kit: Pick<FilterKit, 'rangeValue'>;
  bar: WordsBar;
  /** The ✦ the list part drew beside the box, its words in its last child: busy while the words are read. */
  button: HTMLElement;
  /** Under the bar, empty until words are read: what they were read as, the app's why, Undo. */
  line: HTMLElement;
  /** Shows the ✦ or not, as the box holds words: after a search taken in, or put back. */
  offer(): void;
}

/** The fields a list's words may be read into: those its filter bar offers, else its columns, search fields and groups. */
export function wordsFields(page: Page, node: ListNode): string[] {
  const named = node.search === 'fields' ? [...(node.filterFields ?? []), ...(node.searchFields ?? node.columns)] : [...node.columns, ...(node.searchFields ?? []), ...(node.filterFields ?? []), ...(node.groupBy ?? [])];
  return [...new Set(named)].filter((name) => page.fields[name]);
}

const NUMBERS = new Set(['integer', 'float', 'monetary']);
const RANGES = new Set([...NUMBERS, 'date', 'datetime']);
const TEXTS = new Set(['char', 'text', 'html']);

/** A link's value as a condition may give it: its id, or `{ id, label }` to name it in its filter. */
const linkValue = (value: JsonValue): { id: JsonValue; label: string } | null => {
  if (typeof value === 'number' || (typeof value === 'string' && value)) return { id: value, label: String(value) };
  if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in value) {
    const id = value['id'] as JsonValue;
    return { id, label: typeof value['label'] === 'string' ? value['label'] : String(id) };
  }
  return null;
};

/**
 * The conditions a source answered, as a list's facets: a field's values (any of them), a range of a number or a day,
 * a link by its id, words in a text — in the order their fields came; and those left out, in words.
 */
export function wordsFacets(conditions: readonly ResolvedFilterCondition[], context: Pick<WordsContext, 'page' | 'node' | 'labels' | 'locale' | 'kit'>, fields: readonly string[]): { facets: FieldFacet[]; unused: string[] } {
  const { page, node, labels, locale } = context;
  const byField = new Map<string, ResolvedFilterCondition[]>();
  const unused: string[] = [];
  for (const condition of conditions) {
    if (!condition || typeof condition.field !== 'string' || !fields.includes(condition.field)) {
      unused.push(String(condition?.field ?? '?'));
      continue;
    }
    byField.set(condition.field, [...(byField.get(condition.field) ?? []), condition]);
  }
  const facets: FieldFacet[] = [];
  for (const [field, given] of byField) {
    const def = page.fields[field] as Field;
    const label = node.filterLabels?.[field] ?? def.label;
    const values: FacetValue[] = [];
    const ends: RangeEnds = { from: null, to: null };
    const end = (value: JsonValue): number | string | null => (typeof value === 'number' || (typeof value === 'string' && value !== '') ? value : null);
    const wrong = () => unused.push(label);
    for (const { op, value } of given) {
      // A number or a day as it is: a range from it to it, as both bars show one ("Bedrooms: 3").
      if (RANGES.has(def.type) && op === '=' && end(value) !== null) {
        ends.from = ends.to = end(value);
        continue;
      }
      if (RANGES.has(def.type) && (op === '>=' || op === '>' || op === '<=' || op === '<' || op === 'between')) {
        if (op === 'between' && Array.isArray(value) && value.length === 2) {
          ends.from = end(value[0]);
          ends.to = end(value[1]);
        } else if (op === '>=' || op === '>') ends.from = end(value);
        else ends.to = end(value);
        continue;
      }
      const items = op === 'in' && Array.isArray(value) ? value : [value];
      if (def.type === 'selection' && (op === '=' || op === 'in')) {
        for (const item of items) {
          const option = def.options.find((one) => one.value === item || String(one.value) === String(item));
          if (option) values.push({ op: '=', value: option.value, label: option.label });
          else wrong();
        }
      } else if ((def.type === 'many2one' && (op === '=' || op === 'in')) || (def.type === 'many2many' && (op === 'contains' || op === '=' || op === 'in'))) {
        for (const item of items) {
          const link = linkValue(item);
          if (link) values.push({ op: def.type === 'many2many' ? 'contains' : '=', value: link.id, label: link.label });
          else wrong();
        }
      } else if (def.type === 'boolean' && op === '=' && typeof value === 'boolean') values.push({ op: '=', value, label: value ? labels.yes : labels.no });
      else if (TEXTS.has(def.type) && (op === 'ilike' || op === '=') && typeof value === 'string' && value.trim()) values.push({ op: 'ilike', value: value.trim(), label: value.trim() });
      else wrong();
    }
    const range = ends.from !== null || ends.to !== null ? context.kit.rangeValue(def, ends, labels, locale) : null;
    if (range) values.push(range);
    if (values.length) facets.push({ kind: 'field', field, label, values });
  }
  // In the order the list names its fields: Type, District, Price.
  facets.sort((a, b) => fields.indexOf(a.field) - fields.indexOf(b.field));
  return { facets, unused };
}

/**
 * What the words were read as, under the bar, and the reading itself — for the ✦ the list part draws beside the box
 * (shown while it holds words), pressed: the assist part, loaded then. `read` asks the source for the box's words and
 * lays its filters; `typing` leaves an answer on its way unheard.
 */
export function searchWords(context: WordsContext): { read(): Promise<void>; typing(): void } {
  const { page, node, doc, el, labels, fill, bar, button, line } = context;
  installAssistStyles(doc);
  const icon = drawIcon(doc, 'sparkle', { ...SPARKLE, ...context.icons });
  const fields = wordsFields(page, node);
  const words = button.lastElementChild as HTMLElement;
  const said = words.textContent ?? '';
  const readText = el('span', { class: 'fd-assist-read-text', role: 'status', 'aria-live': 'polite' });
  const undo = el('button', { type: 'button', class: 'fd-button fd-button-link fd-assist-read-undo', hidden: '' }, labels.assistUndo);
  const close = el('button', { type: 'button', class: 'fd-button fd-button-link fd-assist-read-close', 'aria-label': labels.close, title: labels.close }, '×');
  line.replaceChildren(...(icon ? [icon] : []), readText, undo, close);
  /** Each press counts on: a later one, or typing on, leaves an earlier answer unheard. */
  let asking = 0;
  /** The search and the words before the last were read: what Undo puts back. */
  let before: { facets: Facet[]; typed: string } | null = null;
  const tell = (text: string, undoable: boolean) => {
    readText.replaceChildren(...text.split('\n').map((part, i) => (i ? el('span', { class: 'fd-assist-read-why', dir: 'auto' }, ` ${part}`) : part)));
    undo.hidden = !undoable;
    line.hidden = !text;
  };
  const idle = () => {
    button.removeAttribute('aria-busy');
    words.textContent = said;
  };
  undo.addEventListener('click', () => {
    if (!before) return;
    asking++;
    bar.take(before.facets, before.typed);
    before = null;
    tell('', false);
    context.offer();
    bar.input.focus();
  });
  close.addEventListener('click', () => {
    before = null;
    tell('', false);
    bar.input.focus();
  });

  return {
    typing() {
      asking++;
      if (button.getAttribute('aria-busy')) idle();
    },
    async read() {
      const typed = bar.input.value.trim();
      if (!typed || button.getAttribute('aria-busy')) return;
      const mine = ++asking;
      button.setAttribute('aria-busy', 'true');
      words.textContent = labels.assistReading;
      tell(labels.assistWordsReading, false);
      try {
        const answer = await context.dataSource.searchToFilter?.({ pageId: page.id, model: context.model, page, text: typed, fields, language: page.language ?? context.locale });
        if (mine !== asking) return;
        const { facets, unused } = wordsFacets(answer?.filter ?? [], context, fields);
        const left = typeof answer?.text === 'string' ? answer.text.trim() : '';
        if (!facets.length && !left) return tell([labels.assistWordsNone, answer?.why ?? ''].filter(Boolean).join('\n'), false);
        const now = bar.current();
        before = { facets: now, typed };
        // Its filters in place of the search's own on the same fields; words left to search for as a person's would be.
        const made = new Set(facets.map((facet) => facet.field));
        let next: Facet[] = [...now.filter((facet) => !(facet.kind === 'field' && made.has(facet.field))), ...facets];
        let keep = '';
        if (left && node.search === 'fields') keep = left;
        else if (left) {
          const first = suggestions(left, page, node, { searchFor: labels.searchFor }, context.locale)[0];
          if (first) next = [...next, { kind: 'field', field: first.field, label: first.fieldLabel, values: [{ op: first.op, value: first.value, label: first.valueLabel }] }];
        }
        const pressed = doc.activeElement === button;
        bar.take(next, keep);
        context.offer();
        // The ✦ pressed goes with the words it read: the keyboard back in the box, to type on.
        if (pressed && button.hidden) bar.input.focus();
        const read = facets.map((facet) => `${facet.label}: ${facet.values.map((value) => value.label).join(` ${labels.or} `)}`);
        const why = [answer?.why ?? '', unused.length ? fill(labels.assistNotUsed, { items: unused.join(', ') }) : ''].filter(Boolean).join(' ');
        tell([fill(labels.assistWordsMade, { filters: read.join(' · ') || left }), why].filter(Boolean).join('\n'), true);
      } catch (error) {
        if (mine === asking) tell(fill(labels.assistWordsFailed, { why: error instanceof Error ? error.message : String(error) }), false);
      } finally {
        if (mine === asking) idle();
      }
    },
  };
}
