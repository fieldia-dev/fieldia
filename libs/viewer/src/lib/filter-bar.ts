import { facetsToFilter, labelAt, optionsList, suggestions, type DataSource, type Facet, type Field, type Group, type ListNode, type Locale, type Page, type ResolvedFilter } from '@fieldia/core';
import { drawIcon, openToRoom, type IconSet, type PreferenceStore } from '@fieldia/widgets';
import type { El } from './dom';
import type { FilterKit, RangeEnds } from './filter-range';
import { rangeControl, type RangeControl } from './filter-range-control';
import { copyState, openFilterSheet, type BarState, type Pick } from './filter-sheet';
import { installFilterStyles } from './filter-styles';
import type { ViewerLabels } from './labels';

type FieldFacet = Extract<Facet, { kind: 'field' }>;

export interface FilterBarContext {
  page: Page;
  node: ListNode;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  fill: (template: string, values: Record<string, string | number>) => string;
  uid: (id: string) => string;
  icons?: IconSet;
  /** Where the fields the bar offers are kept, as the person chose them with its gear. */
  preferences: PreferenceStore;
  /** The page's language: a keyword is read in it as a number (its marks, Arabic digits), as every box reads one. */
  locale?: Locale;
  dataSource: DataSource | undefined;
  model: string;
  /** Conditions every search keeps: a field's values are listed from the records they let through. */
  fixedFilter: () => ResolvedFilter[];
  /**
   * Every condition a search of these facets makes, the fixed ones with them, as the list asks for its records (a date
   * and time's days in its zone): what a count is asked with. The fixed ones and the facets' own unless given.
   */
  searchFilter?: (facets: Facet[]) => ResolvedFilter[];
  /** How many records a filter finds, where the source can count; null where it cannot: the phone's sheet's Show. */
  count?: (filter: ResolvedFilter[]) => Promise<number | null>;
  /** What the list starts with: a field's values of `filterFields` show picked in its list; the rest apply as they are. */
  facets: Facet[];
  onChange: (facets: Facet[]) => void;
  /** A range's boxes and words and a count's mark, the list part's (filter-range.ts): handed, never carried twice. */
  kit: FilterKit;
}

/** Neither end of a range: nothing filtered. */
const OPEN: RangeEnds = { from: null, to: null };

/** How long typing rests before the keyword is looked for. */
const KEYWORD_PAUSE = 250;

/**
 * A list's filter bar (`search: "fields"`), as a work tracker's backlog has
 * it: "Filter by keyword" looks in the list's search fields; each field of
 * `filterFields` has a list of its values to tick, its button in muted words
 * until some are ticked, then the words ticked; × clears every filter; the
 * gear chooses which fields the bar offers, each by its own name where the
 * page gives one (`filterLabels`). A field's values are its
 * choices, yes and no, or those its records hold (a link's, through the data
 * source). Keys: ↓ opens a list, the arrows move, Space ticks, Escape closes.
 *
 * A number's or a date's field (`filterRanges`; a decimal's, an amount's and a date's always) is filtered by its
 * range — a press for each least value it names, From and To — its button saying it ("Price: 1,000,000 – 3,000,000"),
 * one chip. With `filterCounts`, each value says how many records it finds among the rest of the search ("Villa 12"),
 * asked of the source as it groups the field. With `filterSheet`, on a phone the fields are behind a Filters button, in
 * a sheet that shows them all and takes them together with "Show 37 homes".
 */
export function filterBar(context: FilterBarContext) {
  const { page, node, doc, el, labels, fill, uid } = context;
  const { rangeValue, rangeWords, endsOf, countMark, rangeOnly } = context.kit;
  const locale = context.locale ?? 'en';
  installFilterStyles(doc);
  const fields = (node.filterFields ?? []).filter((name) => page.fields[name]);
  const icon = (name: string, className?: string) => {
    const drawn = drawIcon(doc, name, context.icons);
    drawn?.setAttribute('aria-hidden', 'true');
    if (className) drawn?.classList.add(className);
    return drawn ? [drawn] : [];
  };
  /** A field by the name its filter goes by: its own on the bar where the page gives one ("Iteration" for Iteration Path). */
  const defOf = (field: string): Field => ({ ...page.fields[field], label: node.filterLabels?.[field] ?? page.fields[field].label }) as Field;
  /** Whether a field is filtered by its range: a decimal's, an amount's and a date's always, a whole number's where the page says. */
  const ranged = (field: string) => rangeOnly.has(page.fields[field].type) || (page.fields[field].type === 'integer' && !!node.filterRanges?.[field]);
  const counting = node.filterCounts === true;
  const searchFilter = context.searchFilter ?? ((of: Facet[]) => [...context.fixedFilter(), ...facetsToFilter(of, node)]);

  // ---- what is asked for: a keyword, each field's values ticked or its range, and anything else the list started with ----

  let keyword = '';
  const state: BarState = { picks: new Map(), ranges: new Map() };
  /** Searches this bar does not draw (the list's default filters, a map's area): they apply until cleared. */
  let others: Facet[] = [];
  /** A search read into the bar: each field's values ticked or its range where the bar draws them, the rest as they are. */
  const read = (given: readonly Facet[]) => {
    for (const facet of given) {
      if (facet.kind === 'field' && fields.includes(facet.field)) {
        const ends = ranged(facet.field) && facet.values.length === 1 ? endsOf(facet.values[0]) : null;
        if (ends && !state.ranges.has(facet.field)) {
          state.ranges.set(facet.field, ends);
          continue;
        }
        if (!ranged(facet.field) && !state.picks.has(facet.field) && facet.values.every((v) => v.op === '=' || v.op === 'contains')) {
          state.picks.set(facet.field, facet.values.map((v) => ({ value: v.value, label: v.label })));
          continue;
        }
      }
      others.push(facet);
    }
  };
  read(context.facets);

  const opFor = (field: string) => (page.fields[field]?.type === 'many2many' ? 'contains' : '=');
  /** The keyword in any of the search fields: their words, a choice by its label, a number as the page writes one. */
  const keywordFilter = (text: string): ResolvedFilter[] => {
    const found = suggestions(text, page, node, undefined, context.locale).map((s) => ({ field: s.field, op: s.op, value: s.value }));
    return [{ any: found }];
  };
  /** The search the bar makes of what its fields hold — of every field but `but`, for that field's counts — with the keyword and the rest. */
  const facetsOf = (of: BarState, but?: string, withKeyword = true): Facet[] => [
    ...others,
    ...fields
      .filter((field) => field !== but)
      .flatMap((field): FieldFacet[] => {
        const def = page.fields[field];
        if (ranged(field)) {
          const value = rangeValue(def, of.ranges.get(field) ?? OPEN, labels, locale);
          return value ? [{ kind: 'field', field, label: def.label, values: [value] }] : [];
        }
        const ticked = of.picks.get(field) ?? [];
        return ticked.length ? [{ kind: 'field', field, label: def.label, values: ticked.map((p) => ({ op: opFor(field), value: p.value, label: p.label })) }] : [];
      }),
    ...(keyword && withKeyword ? [{ kind: 'custom' as const, label: keyword, filter: keywordFilter(keyword) }] : []),
  ];
  const facets = () => facetsOf(state);
  const changed = () => {
    drawButtons();
    context.onChange(facets());
  };

  // ---- the keyword ----------------------------------------------------------------------------------

  const input = el('input', { type: 'search', class: 'fd-filter-keyword', placeholder: labels.filterByKeyword, 'aria-label': labels.filterByKeyword, autocomplete: 'off', enterkeyhint: 'search' });
  let pause: ReturnType<typeof setTimeout> | null = null;
  const takeKeyword = () => {
    if (pause) clearTimeout(pause);
    pause = null;
    const next = input.value.trim();
    if (next === keyword) return;
    keyword = next;
    changed();
  };
  input.addEventListener('input', () => {
    if (pause) clearTimeout(pause);
    pause = setTimeout(takeKeyword, KEYWORD_PAUSE);
  });
  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Enter') {
      // Never the form's Enter: a list has nothing to send.
      event.preventDefault();
      takeKeyword();
    } else if (event.key === 'Escape' && input.value) {
      event.preventDefault();
      event.stopPropagation();
      input.value = '';
      takeKeyword();
    }
  });

  // ---- a list of values to tick, or a range, for each field ----------------------------------------------------------

  /** Which fields the bar offers: all unless the person took some away with the gear. */
  const shownKey = `filters:${page.id}:${node.id}`;
  const hiddenFields = (): string[] => {
    const kept = context.preferences.get(shownKey);
    return Array.isArray(kept) ? kept.filter((name): name is string => typeof name === 'string') : [];
  };

  /**
   * A field's values to tick: its choices, yes and no, or those its records hold. With `filterCounts`, each with how
   * many records it finds among the rest of `of`'s search, as the source groups the field — none where it cannot.
   */
  async function valuesOf(field: string, of: BarState): Promise<Pick[]> {
    const def = page.fields[field];
    const source = context.dataSource;
    const fixed = context.fixedFilter();
    const grouped = (filter: ResolvedFilter[]): Promise<Group[]> => source?.groups?.({ model: context.model, field, filter }) ?? Promise.resolve([]);
    // Its values are those the fixed conditions let through; its counts, those the rest of the search does. A choice
    // from the app's list has no options of the page's to list: its records' values, as any field's.
    const fromList = def.type === 'selection' && !!optionsList(def.optionsFrom);
    const listedByGroups = (def.type !== 'selection' || fromList) && def.type !== 'boolean' && def.type !== 'many2many';
    const listing = listedByGroups ? grouped(fixed) : null;
    const narrowed = counting && source?.groups ? searchFilter(facetsOf(of, field)) : null;
    const counts = narrowed ? (listing && JSON.stringify(narrowed) === JSON.stringify(fixed) ? listing : grouped(narrowed)).catch(() => null) : null;
    let values: Pick[];
    if (def.type === 'selection' && !fromList) values = def.options.map((option) => ({ value: option.value, label: option.label }));
    else if (def.type === 'boolean') values = [{ value: true, label: labels.yes }, { value: false, label: labels.no }];
    else if (def.type === 'many2many') {
      const found = (await source?.search?.({ model: def.relation, query: '', limit: 100 })) ?? [];
      values = found.map((record) => ({ value: record.id, label: record.label }));
    } else {
      const groups = await (listing as Promise<Group[]>);
      values = groups.filter((group) => group.value !== null && group.label !== '').map((group) => ({ value: group.value, label: group.label || String(group.value) }));
    }
    const told = await counts;
    if (!told) return values;
    const by = new Map(told.map((group) => [JSON.stringify(group.value), group.count]));
    return values.map((value) => ({ ...value, count: by.get(JSON.stringify(value.value)) ?? 0 }));
  }

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const openMenus: ((to?: Node) => void)[] = [];
  /** Close every list but `keep` — and, focus moving `to` a part of the bar, but the one it is in. */
  const closeOthers = (keep?: (to?: Node) => void, to?: Node) => {
    for (const close of openMenus) if (close !== keep) close(to);
  };

  /**
   * A button and what it opens: a menu of values (the arrows move in it, Space and Enter tick, Tab leaves) or, for a
   * range, a small dialog of presses and boxes (Tab moves in it; leaving it takes what its boxes read). Escape closes
   * either, the focus back on its button.
   */
  function menuFor(button: HTMLButtonElement, menu: HTMLElement, load: () => Promise<void> | void, range?: RangeControl) {
    const items = () => [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    const close = (focusBack = false, escaped = false) => {
      if (menu.hidden) return;
      // Leaving a range takes what its boxes read, as leaving a box does; Escape leaves them as typed, untaken.
      if (range && !escaped) range.commit();
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (focusBack) button.focus();
    };
    const open = async (at: 'first' | 'last' | 'checked' = 'checked') => {
      closeOthers(closer);
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      // Over its button where there is not room under it and more over it, no taller than the room (room.ts in
      // @fieldia/widgets): measured as it opens, and again once its values have come.
      const roomed = () => menu.offsetParent instanceof HTMLElement && openToRoom(menu, menu.offsetParent);
      roomed();
      // A range has nothing to wait for: its press that is on, else From, takes the focus at once.
      if (range) return range.focus();
      await load();
      if (menu.hidden) return;
      roomed();
      const all = items();
      const first = at === 'last' ? all[all.length - 1] : at === 'checked' ? (all.find((item) => item.getAttribute('aria-checked') === 'true') ?? all[0]) : all[0];
      first?.focus();
    };
    const closer = (to?: Node) => void (to && (menu.contains(to) || button.contains(to)) ? undefined : close());
    openMenus.push(closer);
    button.addEventListener('click', () => (menu.hidden ? void open() : close()));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        void open(event.key === 'ArrowUp' ? 'last' : 'first');
      }
    });
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        // Only the list closes: not a dialog the list is in.
        event.stopPropagation();
        close(true, true);
        return;
      }
      // A range's keys are its boxes' and presses' own.
      if (range) return;
      const all = items();
      const at = all.indexOf(doc.activeElement as HTMLElement);
      const to = ({ ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 } as Record<string, number>)[event.key];
      if (to !== undefined) {
        event.preventDefault();
        all[(to + all.length) % all.length]?.focus();
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        (doc.activeElement as HTMLElement | null)?.click();
      } else if (event.key === 'Tab') close();
    });
    return { close };
  }

  /** A row of the list: a box ticked or not, the value's words, and how many records it finds where the list counts. */
  const tickRow = (text: string, checked: boolean, onClick: () => void, count?: number) => {
    const counted = count === undefined ? null : countMark(el, count, page, labels, fill, locale);
    const row = el(
      'div',
      { role: 'menuitemcheckbox', class: 'fd-filter-option', tabindex: '-1', 'aria-checked': String(checked), 'aria-label': counted?.named(text) },
      el('span', { class: 'fd-filter-box', 'aria-hidden': 'true' }, ...icon('check')),
      el('span', { class: 'fd-filter-option-text' }, text),
      ...(counted ? [counted.mark] : [])
    );
    row.addEventListener('click', onClick);
    return row;
  };

  /** A field's range taken: the bar's, its button's words, the list's search. */
  const setRange = (field: string, ends: RangeEnds) => {
    if (ends.from === null && ends.to === null) state.ranges.delete(field);
    else state.ranges.set(field, ends);
    changed();
  };

  const dropdowns = fields.map((field) => {
    // Its own name where the page gives one ("Iteration" for Iteration Path): on its button, its list and the gear's.
    const def = defOf(field);
    const menuId = uid(`${node.id}-filter-${field}`);
    const words = el('span', { class: 'fd-filter-words' });
    const button = el('button', { type: 'button', class: 'fd-filter-pick', 'data-field': field, 'aria-haspopup': ranged(field) ? 'dialog' : 'menu', 'aria-expanded': 'false', 'aria-controls': menuId }, words, ...icon('chevron-down', 'fd-filter-chevron'));
    const named = fill(labels.filterNamed, { label: labelAt(labels.filterNamed, 'label', page.lowerLabels, context.locale)(def.label) });
    if (ranged(field)) {
      const menu = el('div', { class: 'fd-filter-menu fd-filter-range-menu', role: 'dialog', id: menuId, 'aria-label': named, hidden: '' });
      const control = rangeControl({ kit: context.kit, page, def, el, labels, locale, range: node.filterRanges?.[field], ends: state.ranges.get(field) ?? OPEN, onChange: (ends) => setRange(field, ends) });
      menu.append(control.element);
      const { close } = menuFor(button, menu, () => undefined, control);
      const holder = el('span', { class: 'fd-filter-field', 'data-field': field }, button, menu);
      return { field, def, button, words, holder, close, control };
    }
    const menu = el('div', { class: 'fd-filter-menu', role: 'menu', id: menuId, 'aria-label': named, hidden: '' });
    let known: Pick[] = [];
    const draw = () => {
      const ticked = state.picks.get(field) ?? [];
      // What is ticked first, though the records no longer hold it; then the rest, in their order.
      const all = [...ticked.filter((p) => !known.some((k) => same(k.value, p.value))), ...known];
      menu.replaceChildren(
        ...all.map((option) => {
          const on = ticked.some((p) => same(p.value, option.value));
          const count = known.find((k) => same(k.value, option.value))?.count;
          return tickRow(
            option.label,
            on,
            () => {
              const now = state.picks.get(field) ?? [];
              const next = on ? now.filter((p) => !same(p.value, option.value)) : [...now, { value: option.value, label: option.label }];
              if (next.length) state.picks.set(field, next);
              else state.picks.delete(field);
              const focused = [...menu.children].indexOf(doc.activeElement as Element);
              changed();
              draw();
              (menu.children[focused] as HTMLElement | undefined)?.focus();
            },
            count
          );
        })
      );
    };
    const { close } = menuFor(button, menu, async () => {
      known = await valuesOf(field, state);
      draw();
    });
    const holder = el('span', { class: 'fd-filter-field', 'data-field': field }, button, menu);
    return { field, def, button, words, holder, close, control: null };
  });

  function drawButtons() {
    const hidden = new Set(hiddenFields());
    for (const { field, def, button, words, holder } of dropdowns) {
      holder.hidden = hidden.has(field);
      if (ranged(field)) {
        // A range says itself whole, its field's name with it: "Price: 1,000,000 – 3,000,000".
        const range = rangeWords(def, state.ranges.get(field) ?? OPEN, labels, locale);
        button.toggleAttribute('data-picked', !!range);
        words.textContent = range ? `${def.label}: ${range}` : def.label;
        continue;
      }
      const ticked = state.picks.get(field) ?? [];
      button.toggleAttribute('data-picked', ticked.length > 0);
      // The field's name read out before what is ticked, which alone shows: "Work Item Type: Bug".
      words.replaceChildren(...(ticked.length ? [el('span', { class: 'fd-sr-only' }, `${def.label}: `), ticked.map((p) => p.label).join(', ')] : [def.label]));
    }
    const on = onCount();
    clear.hidden = !keyword && !others.length && !on;
    if (sheetButton) {
      sheetBadge.textContent = on ? String(on) : '';
      sheetBadge.hidden = !on;
      sheetButton.toggleAttribute('data-picked', on > 0);
      if (on) sheetButton.setAttribute('aria-label', fill(labels.filtersOn, { n: on }));
      else sheetButton.removeAttribute('aria-label');
    }
  }
  /** How many of the bar's fields filter now: values ticked, or a range. */
  const onCount = () => {
    const hidden = new Set(hiddenFields());
    return fields.filter((field) => !hidden.has(field) && (ranged(field) ? state.ranges.has(field) : !!state.picks.get(field)?.length)).length;
  };

  // ---- the gear: which fields the bar offers ------------------------------------------------------------

  const settingsId = uid(`${node.id}-filter-settings`);
  const gear = el('button', { type: 'button', class: 'fd-filter-tool', 'aria-label': labels.filterSettings, title: labels.filterSettings, 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': settingsId }, ...icon('gear'));
  const settings = el('div', { class: 'fd-filter-menu fd-filter-settings', role: 'menu', id: settingsId, 'aria-label': labels.filterSettings, hidden: '' });
  const drawSettings = () => {
    const hidden = new Set(hiddenFields());
    settings.replaceChildren(
      ...dropdowns.map(({ field, def, control }) =>
        tickRow(def.label, !hidden.has(field), () => {
          const next = hidden.has(field) ? [...hidden].filter((f) => f !== field) : [...hidden, field];
          context.preferences.set(shownKey, next);
          // A field taken away from the bar no longer filters the list.
          const taken = !hidden.has(field) && (state.picks.delete(field) || state.ranges.delete(field));
          if (taken) {
            control?.show(OPEN);
            changed();
          } else drawButtons();
          const focused = [...settings.children].indexOf(doc.activeElement as Element);
          drawSettings();
          (settings.children[focused] as HTMLElement | undefined)?.focus();
        })
      )
    );
  };
  const gearMenu = menuFor(gear, settings, drawSettings);
  const gearHolder = el('span', { class: 'fd-filter-field' }, gear, settings);
  gearHolder.hidden = dropdowns.length === 0;

  // ---- on a phone: every field in a sheet, behind Filters ----------------------------------------------------------

  const sheetBadge = el('span', { class: 'fd-filter-badge', 'aria-hidden': 'true', hidden: '' });
  const sheetButton = node.filterSheet && dropdowns.length ? el('button', { type: 'button', class: 'fd-filter-sheet-open', 'aria-haspopup': 'dialog' }, ...icon('filter-lines', 'fd-filter-sheet-icon'), el('span', {}, labels.filters), sheetBadge) : null;
  let sheet: { close(): void } | null = null;
  sheetButton?.addEventListener('click', () => {
    closeOthers();
    const hidden = new Set(hiddenFields());
    sheet = openFilterSheet({
      kit: context.kit,
      doc,
      el,
      page,
      labels,
      fill,
      locale,
      from: element,
      fields: dropdowns.filter(({ field }) => !hidden.has(field)).map(({ field, def }) => ({ field, def, range: ranged(field) ? (node.filterRanges?.[field] ?? {}) : null })),
      state,
      valuesOf,
      ...(context.count ? { count: (of: BarState) => (context.count as NonNullable<FilterBarContext['count']>)(searchFilter(facetsOf(of))) } : {}),
      apply: (of) => {
        const taken = copyState(of);
        state.picks = taken.picks;
        state.ranges = taken.ranges;
        for (const { field, control } of dropdowns) control?.show(state.ranges.get(field) ?? OPEN);
        changed();
      },
      opener: sheetButton,
    });
  });

  // ---- × clears every filter ------------------------------------------------------------------------------

  const clear = el('button', { type: 'button', class: 'fd-filter-tool fd-filter-clear', 'aria-label': labels.clearFilters, title: labels.clearFilters }, ...icon('close'));
  clear.addEventListener('click', () => {
    keyword = '';
    input.value = '';
    state.picks.clear();
    state.ranges.clear();
    for (const { control } of dropdowns) control?.show(OPEN);
    others = [];
    changed();
    input.focus();
  });

  const element = el(
    'div',
    { class: 'fd-filter-bar', role: 'search', 'data-node': `${node.id}-filters`, ...(sheetButton ? { 'data-sheet': '' } : {}) },
    el('label', { class: 'fd-filter-search' }, ...icon('filter-lines', 'fd-filter-icon'), input),
    el('div', { class: 'fd-filter-fields' }, ...dropdowns.map((d) => d.holder), gearHolder, ...(sheetButton ? [sheetButton] : []), clear)
  );
  // A press anywhere else closes an open list.
  const outside = (event: Event) => {
    if (!element.contains(event.target as Node)) closeOthers();
  };
  doc.addEventListener('pointerdown', outside);
  element.addEventListener('focusout', (event) => {
    if (!element.contains(event.relatedTarget as Node | null) && event.relatedTarget) closeOthers();
  });
  // As every menu Fieldia opens over a box: the focus moving to another part of the bar — the keyword's box, another
  // button — closes the list open, which is never left over what is typed.
  element.addEventListener('focusin', (event) => closeOthers(undefined, event.target as Node));
  drawButtons();

  return {
    element,
    /** The keyword's box. */
    input,
    /** The search now, the keyword aside: each field's values ticked, its range, and the rest. */
    current: () => facetsOf(state, undefined, false),
    /** A search in place of this one — a person's words read as filters, or Undo putting them back — and the keyword. */
    take(next: Facet[], typed: string) {
      if (pause) clearTimeout(pause);
      pause = null;
      state.picks.clear();
      state.ranges.clear();
      others = [];
      read(next);
      input.value = typed;
      keyword = typed.trim();
      for (const { field, control } of dropdowns) control?.show(state.ranges.get(field) ?? OPEN);
      changed();
    },
    /** A search put in from outside (a map's "In this area"): it applies with the rest, one with the same words in its place. */
    add(facet: Facet) {
      const words = facet.kind === 'custom' ? facet.label : null;
      others = [...others.filter((f) => !(words !== null && f.kind === 'custom' && f.label === words)), facet];
      changed();
    },
    destroy() {
      if (pause) clearTimeout(pause);
      doc.removeEventListener('pointerdown', outside);
      gearMenu.close();
      sheet?.close();
      for (const dropdown of dropdowns) {
        dropdown.close();
        dropdown.control?.destroy();
      }
    },
  };
}
