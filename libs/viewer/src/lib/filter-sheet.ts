import { recordSentence, type Field, type FilterRange, type JsonValue, type Locale, type Page, intlFormat } from '@fieldia/core';
import { formatNumber, keepTabIn } from '@fieldia/widgets';
import type { El } from './dom';
import type { FilterKit, RangeEnds } from './filter-range';
import { rangeControl, type RangeControl } from './filter-range-control';
import type { ViewerLabels } from './labels';

/** A value to tick, and how many records it finds among the rest of the search, where the list counts. */
export type Pick = { value: JsonValue; label: string; count?: number };

/** What a filter bar's fields hold: each field's values ticked, each range's ends. */
export interface BarState {
  picks: Map<string, Pick[]>;
  ranges: Map<string, RangeEnds>;
}

export const copyState = (state: BarState): BarState => ({ picks: new Map([...state.picks].map(([field, picks]) => [field, [...picks]])), ranges: new Map(state.ranges) });

export interface SheetField {
  field: string;
  /** The field, by the name its filter goes by on the bar. */
  def: Field;
  /** Its range, where it is filtered by one; null for values to tick. */
  range: FilterRange | null;
}

export interface FilterSheetContext {
  /** A range's boxes and a count's mark, the list part's. */
  kit: FilterKit;
  doc: Document;
  el: El;
  page: Page;
  labels: ViewerLabels;
  fill: (template: string, values: Record<string, string | number>) => string;
  locale?: Locale;
  /** What the sheet sits over: its page's look (skin, theme, tokens, direction, language) is taken from it. */
  from: HTMLElement;
  fields: SheetField[];
  /** What the bar holds now: the sheet changes a copy of it, kept only by Show. */
  state: BarState;
  /** A field's values to tick, with their counts among the rest of `state`'s search where the list counts. */
  valuesOf: (field: string, state: BarState) => Promise<Pick[]>;
  /** How many records `state`'s search finds, where the source can count; null where it cannot. Without it, Show says no number. */
  count?: (state: BarState) => Promise<number | null>;
  /** Show: the sheet's filters taken by the bar. */
  apply: (state: BarState) => void;
  /** Where the focus goes back as the sheet closes. */
  opener: HTMLElement;
}

const same = (a: JsonValue, b: JsonValue) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A filter bar's fields on a phone (`filterSheet`), as a sheet over the list: every field at once — its values to tick
 * with their counts, its range — changed together, counted as they change, and taken only by "Show 37 homes"; × and
 * Escape let what was changed go. Clear all empties it, still to be shown. The focus stays in it while it is open.
 */
export function openFilterSheet(context: FilterSheetContext): { close(): void } {
  const { doc, el, page, labels, fill } = context;
  const { countMark } = context.kit;
  const locale = context.locale ?? 'en';
  const state = copyState(context.state);
  const OPEN: RangeEnds = { from: null, to: null };
  const id = `fd-filter-sheet-${Math.random().toString(36).slice(2, 8)}`;

  const title = el('h2', { id: `${id}-title`, class: 'fd-form-dialog-title' }, labels.filters);
  const close = el('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': labels.close, title: labels.close }, '×');
  const clear = el('button', { type: 'button', class: 'fd-button fd-filter-sheet-clear' }, labels.filtersClearAll);
  const show = el('button', { type: 'button', class: 'fd-button fd-button-primary fd-filter-sheet-show' }, labels.showResultsSome);
  const body = el('div', { class: 'fd-form-dialog-body fd-filter-sheet-body' });
  const box = el(
    'div',
    { class: 'fd-theme fd-form-dialog fd-filter-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title.id, tabindex: '-1' },
    el('div', { class: 'fd-form-dialog-head' }, title, close),
    body,
    el('div', { class: 'fd-actions fd-form-dialog-foot fd-filter-sheet-foot' }, clear, show)
  );
  // The look of the page the list is on, as the sheet sits outside it.
  const root = context.from.closest<HTMLElement>('.fd-form') ?? context.from;
  for (const { name, value } of [...root.attributes]) if ((name.startsWith('data-') && name !== 'data-max-width') || name === 'style' || name === 'dir' || name === 'lang') box.setAttribute(name, value);
  const backdrop = el('div', { class: 'fd-dialog-backdrop fd-form-dialog-backdrop fd-filter-sheet-backdrop' }, box);

  // ---- each field: its values to tick, or its range ----------------------------------------------------------------

  const ranges = new Map<string, RangeControl>();
  /** Each field of values: its list, drawn again as its counts come. */
  const lists = new Map<string, { element: HTMLElement; known: Pick[] }>();
  const sections = context.fields.map(({ field, def, range }) => {
    const heading = el('legend', { class: 'fd-filter-sheet-name' }, def.label);
    if (range) {
      const control = rangeControl({
        kit: context.kit,
        page,
        def,
        el,
        labels,
        locale,
        range,
        ends: state.ranges.get(field) ?? OPEN,
        onChange: (ends) => {
          if (ends.from === null && ends.to === null) state.ranges.delete(field);
          else state.ranges.set(field, ends);
          changed(field);
        },
      });
      ranges.set(field, control);
      return el('fieldset', { class: 'fd-filter-sheet-field', 'data-field': field }, heading, control.element);
    }
    const list = el('div', { class: 'fd-filter-sheet-values' });
    lists.set(field, { element: list, known: [] });
    return el('fieldset', { class: 'fd-filter-sheet-field', 'data-field': field }, heading, list);
  });
  body.append(...sections);

  /** A field's values as boxes to tick, what is ticked first though the records no longer hold it, each with its count. */
  function drawValues(field: string) {
    const list = lists.get(field);
    if (!list) return;
    const ticked = state.picks.get(field) ?? [];
    const all = [...ticked.filter((p) => !list.known.some((k) => same(k.value, p.value))), ...list.known];
    const focused = doc.activeElement instanceof HTMLInputElement && list.element.contains(doc.activeElement) ? doc.activeElement.dataset['value'] : undefined;
    list.element.replaceChildren(
      ...all.map((option) => {
        const on = ticked.some((p) => same(p.value, option.value));
        const count = list.known.find((k) => same(k.value, option.value))?.count;
        const counted = count === undefined ? null : countMark(el, count, page, labels, fill, locale);
        const input = el('input', { type: 'checkbox', class: 'fd-filter-sheet-box', 'data-value': JSON.stringify(option.value), 'aria-label': counted?.named(option.label) });
        input.checked = on;
        input.addEventListener('change', () => {
          const now = state.picks.get(field) ?? [];
          const next = input.checked ? [...now.filter((p) => !same(p.value, option.value)), { value: option.value, label: option.label }] : now.filter((p) => !same(p.value, option.value));
          if (next.length) state.picks.set(field, next);
          else state.picks.delete(field);
          changed(field);
        });
        return el('label', { class: 'fd-filter-sheet-option' }, input, el('span', { class: 'fd-filter-option-text' }, option.label), ...(counted ? [' ', counted.mark] : []));
      })
    );
    if (focused !== undefined) [...list.element.querySelectorAll<HTMLInputElement>('input')].find((input) => input.dataset['value'] === focused)?.focus();
  }

  // ---- counts: each field's values among the rest, and what Show shows ---------------------------------------------

  /** Each change counts on: an older count's answer is not drawn over a newer one's. */
  let asked = 0;
  let closed = false;
  function recount(except?: string) {
    const mine = ++asked;
    for (const field of lists.keys()) {
      // A field's own ticks never change its counts: they are among the rest of the search's.
      if (field === except) continue;
      context
        .valuesOf(field, state)
        .then((values) => {
          const list = lists.get(field);
          if (closed || mine !== asked || !list) return;
          list.known = values;
          drawValues(field);
        })
        .catch(() => undefined);
    }
    if (!context.count) return;
    show.setAttribute('aria-busy', 'true');
    context
      .count(state)
      .then((n) => {
        if (closed || mine !== asked) return;
        show.removeAttribute('aria-busy');
        show.textContent = showWords(n);
      })
      .catch(() => {
        if (closed || mine !== asked) return;
        show.removeAttribute('aria-busy');
        show.textContent = labels.showResultsSome;
      });
  }
  /** "Show 37 homes", "Show 1 home"; "Show results" where nothing could count them. */
  function showWords(n: number | null): string {
    if (n === null) return labels.showResultsSome;
    const one = intlFormat('PluralRules', locale).select(n) === 'one';
    return one ? recordSentence(page.records, labels.showResultsNounOne, labels.showResultsOne, locale, { n: formatNumber(n, 0, locale) }) : recordSentence(page.records, labels.showResultsNoun, labels.showResults, locale, { n: formatNumber(n, 0, locale) });
  }
  function changed(field?: string) {
    for (const f of lists.keys()) if (f === field) drawValues(f);
    recount(field);
  }

  // ---- its buttons, keys and end -------------------------------------------------------------------------------------

  function finish(take: boolean) {
    if (closed) return;
    if (take) {
      // A box's typing is read before anything is shown: text that is no number or no day stays, said, and the sheet open.
      for (const control of ranges.values()) if (!control.commit(true)) return;
      context.apply(state);
    }
    closed = true;
    for (const control of ranges.values()) control.destroy();
    backdrop.remove();
    doc.removeEventListener('keydown', onKey, true);
    if (context.opener.isConnected) context.opener.focus();
  }
  function onKey(event: KeyboardEvent) {
    if (!box.contains(event.target as Node) && event.target !== doc.body) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    } else keepTabIn(box, event);
  }
  doc.addEventListener('keydown', onKey, true);
  close.addEventListener('click', () => finish(false));
  show.addEventListener('click', () => finish(true));
  clear.addEventListener('click', () => {
    state.picks.clear();
    state.ranges.clear();
    for (const control of ranges.values()) control.show(OPEN);
    for (const field of lists.keys()) drawValues(field);
    recount();
  });

  (doc.body ?? doc.documentElement).append(backdrop);
  box.focus();
  recount();
  return { close: () => finish(false) };
}
