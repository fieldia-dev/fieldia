import { suggestions, DATE_INTERVALS, type DateInterval, type Facet, type FilterPeriod, type ListNode, type Locale, type Page, type ResolvedFilter, type Suggestion } from '@fieldia/core';
import { drawIcon, type IconSet, type PreferenceStore } from '@fieldia/widgets';
import { customFilterPart } from './custom-filter';
import type { El } from './dom';
import { favouritesPart } from './favourites';
import { countMark } from './filter-count';
import type { ViewerLabels, WordKey } from './labels';

type FieldFacet = Extract<Facet, { kind: 'field' }>;

export interface SearchContext {
  page: Page;
  node: ListNode;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  fill: (template: string, values: Record<string, string | number>) => string;
  uid: (id: string) => string;
  icons?: IconSet;
  preferences: PreferenceStore;
  /** The page's language: what is typed is read in it (a number's marks, a date's order). */
  locale?: Locale;
  /** What the list starts with. */
  facets: Facet[];
  /** A period as plain conditions, counted from now as the list counts days: for a person's own filter of one. */
  periods?: (period: FilterPeriod) => ResolvedFilter[];
  onChange: (facets: Facet[]) => void;
  /** False: the box alone, with no menu of filters, groups and favourites — a list inside a record's. */
  menu?: boolean;
  /**
   * With `filterCounts`: how many records a filter finds, where the source can count (null where it cannot), and the
   * conditions a search of facets makes, the list's fixed ones with them — so each named filter and favourite in the
   * menu says how many it finds ("Late 5").
   */
  count?: (filter: ResolvedFilter[]) => Promise<number | null>;
  searchFilter?: (facets: Facet[]) => ResolvedFilter[];
}

/** A date's spans in the menu, longest first, as a person narrows down: Year, Quarter, Month, Week, Day. */
const SPANS = [...DATE_INTERVALS].reverse();
const SPAN_WORDS: Record<DateInterval, WordKey> = { year: 'groupByYear', quarter: 'groupByQuarter', month: 'groupByMonth', week: 'groupByWeek', day: 'groupByDay' };

/** A chip's words: a field and the values looked for in it, filters any of which apply, or the fields grouped by. */
export function facetText(facet: Facet, labels: Pick<ViewerLabels, 'or'>): string {
  const or = ` ${labels.or} `;
  switch (facet.kind) {
    case 'field':
      return `${facet.label}: ${facet.values.map((v) => v.label).join(or)}`;
    case 'filters':
      return facet.labels.join(or);
    case 'groupBy':
      return facet.labels.join(' > ');
    case 'custom':
      return facet.label;
  }
}

/**
 * A list's search bar: what is typed becomes a search in one of the list's
 * fields, chosen from suggestions; the menu turns the list's filters on and
 * off, groups by its fields, builds a filter, and keeps searches as
 * favourites. Everything chosen shows as a chip, and all of it applies.
 */
export function searchBar(context: SearchContext) {
  const { page, node, doc, el, labels, fill, uid } = context;
  let facets = context.facets;
  /** Each round of counts counts on: an older answer is not drawn over a newer one's. */
  let counting = 0;
  const icon = (name: string) => {
    const drawn = drawIcon(doc, name, context.icons);
    drawn?.setAttribute('aria-hidden', 'true');
    return drawn ? [drawn] : [];
  };

  function change(next: Facet[]) {
    facets = next;
    drawChips();
    drawPanel();
    drawCounts();
    context.onChange(facets);
  }

  // ---- the box, its chips and its suggestions -----------------------------------------

  const listId = uid(`${node.id}-suggestions`);
  const panelId = uid(`${node.id}-search-panel`);
  const input = el('input', {
    class: 'fd-search-input',
    role: 'combobox',
    autocomplete: 'off',
    placeholder: labels.search,
    'aria-label': labels.searchLabel,
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': listId,
  });
  const chips = el('div', { class: 'fd-facets' });
  const offeredList = el('ul', { class: 'fd-search-suggestions', role: 'listbox', id: listId, 'aria-label': labels.searchLabel, hidden: '' });
  const toggle = el('button', { type: 'button', class: 'fd-search-toggle', 'aria-label': labels.searchOptions, 'aria-expanded': 'false', 'aria-controls': panelId });
  let offered: Suggestion[] = [];
  let active = 0;

  function drawChips() {
    chips.replaceChildren(
      ...facets.map((facet, index) => {
        const text = facetText(facet, labels);
        const remove = el('button', { type: 'button', class: 'fd-facet-remove', 'aria-label': fill(labels.removeFacet, { label: text }) }, '×');
        remove.addEventListener('click', () => {
          change(facets.filter((_, i) => i !== index));
          input.focus();
        });
        const kind = facet.kind === 'groupBy' ? 'layers' : facet.kind === 'field' ? '' : 'filter';
        return el('span', { class: 'fd-facet', 'data-kind': facet.kind }, ...(kind ? icon(kind) : []), el('span', { class: 'fd-facet-text' }, text), remove);
      })
    );
  }

  function drawOffered() {
    offeredList.replaceChildren(
      ...offered.map((suggestion, index) => {
        const option = el('li', { role: 'option', id: `${listId}-${index}`, 'aria-selected': String(index === active) }, suggestion.label);
        // The box keeps the focus while a suggestion is clicked.
        option.addEventListener('mousedown', (event) => event.preventDefault());
        option.addEventListener('click', () => pick(suggestion));
        return option;
      })
    );
    offeredList.hidden = offered.length === 0;
    input.setAttribute('aria-expanded', String(!offeredList.hidden));
    if (offeredList.hidden) input.removeAttribute('aria-activedescendant');
    else input.setAttribute('aria-activedescendant', `${listId}-${active}`);
  }

  function closeOffered() {
    offered = [];
    drawOffered();
  }

  /** A search in a field joins the field's chip, any of its values; the same value twice is once. */
  function pick(suggestion: Suggestion) {
    const value = { op: suggestion.op, value: suggestion.value, label: suggestion.valueLabel };
    const at = facets.findIndex((f) => f.kind === 'field' && f.field === suggestion.field);
    const next = [...facets];
    if (at < 0) next.push({ kind: 'field', field: suggestion.field, label: suggestion.fieldLabel, values: [value] });
    else {
      const facet = next[at] as FieldFacet;
      const known = facet.values.some((v) => v.op === value.op && JSON.stringify(v.value) === JSON.stringify(value.value));
      if (!known) next[at] = { ...facet, values: [...facet.values, value] };
    }
    input.value = '';
    closeOffered();
    change(next);
  }

  input.addEventListener('input', () => {
    offered = suggestions(input.value, page, node, { searchFor: labels.searchFor }, context.locale);
    active = 0;
    drawOffered();
  });
  input.addEventListener('blur', closeOffered);
  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && offered.length) {
      event.preventDefault();
      active = (active + (event.key === 'ArrowDown' ? 1 : offered.length - 1)) % offered.length;
      drawOffered();
    } else if (event.key === 'Enter') {
      // Never the form's Enter: a list has nothing to send.
      event.preventDefault();
      if (offered.length) pick(offered[active]);
    } else if (event.key === 'Backspace' && !input.value && facets.length) {
      change(facets.slice(0, -1));
    } else if (event.key === 'Escape' && !offeredList.hidden) {
      event.preventDefault();
      closeOffered();
    }
  });

  // ---- the menu: filters, group by, favourites ---------------------------------------

  const heading = (iconName: string, text: string, id: string) => el('div', { class: 'fd-search-heading', id }, ...icon(iconName), text);
  const toggleIn = (kind: 'filters' | 'groupBy', key: string) => {
    const at = facets.findIndex((f) => f.kind === kind);
    const now = at < 0 ? [] : kind === 'filters' ? (facets[at] as Extract<Facet, { kind: 'filters' }>).ids : (facets[at] as Extract<Facet, { kind: 'groupBy' }>).fields;
    const keys = now.includes(key) ? now.filter((k) => k !== key) : [...now, key];
    const facet: Facet =
      kind === 'filters'
        ? { kind, ids: keys, labels: keys.map((id) => node.filters?.find((f) => f.id === id)?.label ?? id) }
        : { kind, fields: keys, labels: keys.map(groupWords) };
    const next = [...facets];
    if (at < 0) next.push(facet);
    else if (keys.length) next[at] = facet;
    else next.splice(at, 1);
    change(next);
  };

  /** Where a filter's or a favourite's count goes, after its words. */
  const countSlot = () => el('span', { class: 'fd-search-count' });
  const filterSlots = new Map<string, HTMLElement>();
  const filterButtons = (node.filters ?? []).map((filter) => {
    const slot = countSlot();
    filterSlots.set(filter.id, slot);
    const button = el('button', { type: 'button', class: 'fd-search-option', 'aria-pressed': 'false', 'data-filter': filter.id }, filter.label, slot);
    button.addEventListener('click', () => toggleIn('filters', filter.id));
    return button;
  });
  /** A grouping in words: its field's label, and for a date the span it is grouped in ("Invoice date: Month"). */
  function groupWords(key: string): string {
    const [field, span] = key.split(':');
    const label = page.fields[field]?.label ?? key;
    return (SPANS as string[]).includes(span) ? fill(labels.periodChip, { field: label, period: labels[SPAN_WORDS[span as DateInterval]] }) : label;
  }
  const groupButton = (key: string, words: string) => {
    const button = el('button', { type: 'button', class: 'fd-search-option', 'aria-pressed': 'false', 'data-group': key }, words);
    button.addEventListener('click', () => toggleIn('groupBy', key));
    return button;
  };
  /** Each field to group by: a date by the span it falls in — its year, quarter, month, week or day — on a line of its own. */
  const groupChoices = (node.groupBy ?? []).map((field) => {
    const def = page.fields[field];
    if (def.type !== 'date' && def.type !== 'datetime') return groupButton(field, def.label);
    return el(
      'div',
      { class: 'fd-search-spans', role: 'group', 'aria-label': def.label, 'data-group-field': field },
      el('span', { class: 'fd-search-spans-name', 'aria-hidden': 'true' }, def.label),
      el('span', { class: 'fd-search-spans-list' }, ...SPANS.map((span) => groupButton(`${field}:${span}`, labels[SPAN_WORDS[span]])))
    );
  });
  const groupButtons = groupChoices.flatMap((choice) => (choice.matches('button') ? [choice as HTMLButtonElement] : [...choice.querySelectorAll('button')]));
  const menu = context.menu !== false;
  const group = (kind: string, iconName: string, title: string, ...parts: HTMLElement[]) =>
    el('div', { class: 'fd-search-group', 'data-group-kind': kind, role: 'group', 'aria-labelledby': `${panelId}-${kind}` }, heading(iconName, title, `${panelId}-${kind}`), ...parts);
  const panel = el('div', { class: 'fd-search-panel', id: panelId, hidden: '' });
  let favourites: ReturnType<typeof favouritesPart> | null = null;
  if (menu) {
    const custom = customFilterPart({ page, el, labels, locale: context.locale, periods: context.periods, add: (facet) => change([...facets, facet]) });
    favourites = favouritesPart({ page, el, labels, fill, preferences: context.preferences, current: () => facets, apply: change, ...(context.count ? { slot: countSlot, drawn: drawCounts } : {}) });
    panel.append(
      group('filters', 'filter', labels.filters, ...filterButtons, custom.button, custom.form),
      ...(groupChoices.length ? [group('groupBy', 'layers', labels.groupBy, ...groupChoices)] : []),
      group('favourites', 'star', labels.favourites, favourites.list, favourites.none, favourites.open, favourites.form)
    );
  }

  function drawPanel() {
    const ids = (facets.find((f) => f.kind === 'filters') as Extract<Facet, { kind: 'filters' }> | undefined)?.ids ?? [];
    const fields = (facets.find((f) => f.kind === 'groupBy') as Extract<Facet, { kind: 'groupBy' }> | undefined)?.fields ?? [];
    for (const button of filterButtons) button.setAttribute('aria-pressed', String(ids.includes(button.dataset['filter'] ?? '')));
    for (const button of groupButtons) button.setAttribute('aria-pressed', String(fields.includes(button.dataset['group'] ?? '')));
  }

  /**
   * How many records each named filter finds among the rest of the search, and each favourite as it was kept — asked
   * as the menu opens and as the search changes while it is open, each drawn as it comes; none where the source cannot
   * count.
   */
  function drawCounts() {
    const { count, searchFilter } = context;
    if (!count || !searchFilter || panel.hidden) return;
    const mine = ++counting;
    const mark = (slot: HTMLElement, of: Facet[]) =>
      count(searchFilter(of)).then(
        (n) => mine === counting && slot.replaceChildren(...(n === null ? [] : countMark(el, n, page, labels, fill, context.locale))),
        () => mine === counting && slot.replaceChildren()
      );
    // A named filter as if it were the only one on: the filters on are any of them.
    const rest = facets.filter((f) => f.kind !== 'filters');
    for (const filter of node.filters ?? []) void mark(filterSlots.get(filter.id) as HTMLElement, [...rest, { kind: 'filters', ids: [filter.id], labels: [filter.label] }]);
    for (const { slot, facets: kept } of favourites?.slots() ?? []) void mark(slot, kept);
  }

  function showPanel(open: boolean) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      closeOffered();
      drawCounts();
    }
  }
  toggle.addEventListener('click', () => showPanel(panel.hidden));
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    showPanel(false);
    toggle.focus();
  });
  const element = el('div', { class: 'fd-search' }, el('div', { class: 'fd-search-field' }, ...icon('search'), chips, input, ...(menu ? [toggle] : [])), offeredList, ...(menu ? [panel] : []));
  // A press anywhere else closes the menu.
  const outside = (event: Event) => {
    if (!panel.hidden && !element.contains(event.target as Node)) showPanel(false);
  };
  doc.addEventListener('pointerdown', outside);

  drawChips();
  drawPanel();
  return {
    element,
    /** A search put in from outside, as a person's own: one with the same words takes its place, as a map's "In this area" does. */
    add(facet: Facet) {
      const words = facet.kind === 'custom' ? facet.label : null;
      change([...facets.filter((f) => !(words !== null && f.kind === 'custom' && f.label === words)), facet]);
    },
    destroy: () => doc.removeEventListener('pointerdown', outside),
  };
}
