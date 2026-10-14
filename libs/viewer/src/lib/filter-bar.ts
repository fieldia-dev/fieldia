import { suggestions, type DataSource, type Facet, type JsonValue, type ListNode, type Locale, type Page, type ResolvedFilter } from '@fieldia/core';
import { drawIcon, type IconSet, type PreferenceStore } from '@fieldia/widgets';
import type { El } from './dom';
import { installFilterStyles } from './filter-styles';
import type { ViewerLabels } from './labels';

type FieldFacet = Extract<Facet, { kind: 'field' }>;
type Pick = { value: JsonValue; label: string };

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
  /** What the list starts with: a field's values of `filterFields` show picked in its list; the rest apply as they are. */
  facets: Facet[];
  onChange: (facets: Facet[]) => void;
}

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
 */
export function filterBar(context: FilterBarContext) {
  const { page, node, doc, el, labels, fill, uid } = context;
  installFilterStyles(doc);
  const fields = (node.filterFields ?? []).filter((name) => page.fields[name]);
  const icon = (name: string, className?: string) => {
    const drawn = drawIcon(doc, name, context.icons);
    drawn?.setAttribute('aria-hidden', 'true');
    if (className) drawn?.classList.add(className);
    return drawn ? [drawn] : [];
  };

  // ---- what is asked for: a keyword, each field's values ticked, and anything else the list started with ----

  let keyword = '';
  const picks = new Map<string, Pick[]>();
  /** Searches this bar does not draw (the list's default filters, a map's area): they apply until cleared. */
  let others: Facet[] = [];
  for (const facet of context.facets) {
    const own = facet.kind === 'field' && fields.includes(facet.field) && facet.values.every((v) => v.op === '=' || v.op === 'contains');
    if (own) picks.set(facet.field, facet.values.map((v) => ({ value: v.value, label: v.label })));
    else others.push(facet);
  }

  const opFor = (field: string) => (page.fields[field]?.type === 'many2many' ? 'contains' : '=');
  /** The keyword in any of the search fields: their words, a choice by its label, a number as the page writes one. */
  const keywordFilter = (text: string): ResolvedFilter[] => {
    const found = suggestions(text, page, node, undefined, context.locale).map((s) => ({ field: s.field, op: s.op, value: s.value }));
    return [{ any: found }];
  };
  const facets = (): Facet[] => [
    ...others,
    ...fields.flatMap((field): FieldFacet[] => {
      const ticked = picks.get(field) ?? [];
      return ticked.length ? [{ kind: 'field', field, label: page.fields[field].label, values: ticked.map((p) => ({ op: opFor(field), value: p.value, label: p.label })) }] : [];
    }),
    ...(keyword ? [{ kind: 'custom' as const, label: keyword, filter: keywordFilter(keyword) }] : []),
  ];
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

  // ---- a list of values to tick, for each field ---------------------------------------------------------

  /** Which fields the bar offers: all unless the person took some away with the gear. */
  const shownKey = `filters:${page.id}:${node.id}`;
  const hiddenFields = (): string[] => {
    const kept = context.preferences.get(shownKey);
    return Array.isArray(kept) ? kept.filter((name): name is string => typeof name === 'string') : [];
  };

  /** A field's values to tick: its choices, yes and no, or those its records hold. */
  async function valuesOf(field: string): Promise<Pick[]> {
    const def = page.fields[field];
    if (def.type === 'selection') return def.options.map((option) => ({ value: option.value, label: option.label }));
    if (def.type === 'boolean') return [{ value: true, label: labels.yes }, { value: false, label: labels.no }];
    const source = context.dataSource;
    if (def.type === 'many2many') {
      const found = (await source?.search?.({ model: def.relation, query: '', limit: 100 })) ?? [];
      return found.map((record) => ({ value: record.id, label: record.label }));
    }
    const groups = (await source?.groups?.({ model: context.model, field, filter: context.fixedFilter() })) ?? [];
    return groups.filter((group) => group.value !== null && group.label !== '').map((group) => ({ value: group.value, label: group.label || String(group.value) }));
  }

  const same = (a: JsonValue, b: JsonValue) => JSON.stringify(a) === JSON.stringify(b);
  const openMenus: (() => void)[] = [];
  /** Close every list but `keep`. */
  const closeOthers = (keep?: () => void) => {
    for (const close of openMenus) if (close !== keep) close();
  };

  function menuFor(button: HTMLButtonElement, menu: HTMLElement, load: () => Promise<void> | void) {
    const items = () => [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    const close = (focusBack = false) => {
      if (menu.hidden) return;
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (focusBack) button.focus();
    };
    const open = async (at: 'first' | 'last' | 'checked' = 'checked') => {
      closeOthers(closer);
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      await load();
      if (menu.hidden) return;
      const all = items();
      const first = at === 'last' ? all[all.length - 1] : at === 'checked' ? (all.find((item) => item.getAttribute('aria-checked') === 'true') ?? all[0]) : all[0];
      first?.focus();
    };
    const closer = () => close();
    openMenus.push(closer);
    button.addEventListener('click', () => (menu.hidden ? void open() : close()));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        void open(event.key === 'ArrowUp' ? 'last' : 'first');
      }
    });
    menu.addEventListener('keydown', (event) => {
      const all = items();
      const at = all.indexOf(doc.activeElement as HTMLElement);
      const to = ({ ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 } as Record<string, number>)[event.key];
      if (to !== undefined) {
        event.preventDefault();
        all[(to + all.length) % all.length]?.focus();
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        (doc.activeElement as HTMLElement | null)?.click();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        // Only the list closes: not a dialog the list is in.
        event.stopPropagation();
        close(true);
      } else if (event.key === 'Tab') close();
    });
    return { close };
  }

  /** A row of the list: a box ticked or not, and the value's words. */
  const tickRow = (text: string, checked: boolean, onClick: () => void) => {
    const row = el('div', { role: 'menuitemcheckbox', class: 'fd-filter-option', tabindex: '-1', 'aria-checked': String(checked) }, el('span', { class: 'fd-filter-box', 'aria-hidden': 'true' }, ...icon('check')), el('span', { class: 'fd-filter-option-text' }, text));
    row.addEventListener('click', onClick);
    return row;
  };

  const dropdowns = fields.map((field) => {
    // Its own name where the page gives one ("Iteration" for Iteration Path): on its button, its list and the gear's.
    const def = { ...page.fields[field], label: node.filterLabels?.[field] ?? page.fields[field].label };
    const menuId = uid(`${node.id}-filter-${field}`);
    const words = el('span', { class: 'fd-filter-words' });
    const button = el('button', { type: 'button', class: 'fd-filter-pick', 'data-field': field, 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': menuId }, words, ...icon('chevron-down', 'fd-filter-chevron'));
    const menu = el('div', { class: 'fd-filter-menu', role: 'menu', id: menuId, 'aria-label': fill(labels.filterNamed, { label: def.label }), hidden: '' });
    let known: Pick[] = [];
    const draw = () => {
      const ticked = picks.get(field) ?? [];
      // What is ticked first, though the records no longer hold it; then the rest, in their order.
      const all = [...ticked.filter((p) => !known.some((k) => same(k.value, p.value))), ...known];
      menu.replaceChildren(
        ...all.map((option) => {
          const on = ticked.some((p) => same(p.value, option.value));
          return tickRow(option.label, on, () => {
            const now = picks.get(field) ?? [];
            const next = on ? now.filter((p) => !same(p.value, option.value)) : [...now, option];
            if (next.length) picks.set(field, next);
            else picks.delete(field);
            const focused = [...menu.children].indexOf(doc.activeElement as Element);
            changed();
            draw();
            (menu.children[focused] as HTMLElement | undefined)?.focus();
          });
        })
      );
    };
    const { close } = menuFor(button, menu, async () => {
      known = await valuesOf(field);
      draw();
    });
    const holder = el('span', { class: 'fd-filter-field', 'data-field': field }, button, menu);
    return { field, def, button, words, holder, close };
  });

  function drawButtons() {
    const hidden = new Set(hiddenFields());
    for (const { field, def, button, words, holder } of dropdowns) {
      holder.hidden = hidden.has(field);
      const ticked = picks.get(field) ?? [];
      button.toggleAttribute('data-picked', ticked.length > 0);
      // The field's name read out before what is ticked, which alone shows: "Work Item Type: Bug".
      words.replaceChildren(...(ticked.length ? [el('span', { class: 'fd-sr-only' }, `${def.label}: `), ticked.map((p) => p.label).join(', ')] : [def.label]));
    }
    clear.hidden = !keyword && !others.length && ![...picks.values()].some((p) => p.length);
  }

  // ---- the gear: which fields the bar offers ------------------------------------------------------------

  const settingsId = uid(`${node.id}-filter-settings`);
  const gear = el('button', { type: 'button', class: 'fd-filter-tool', 'aria-label': labels.filterSettings, title: labels.filterSettings, 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': settingsId }, ...icon('gear'));
  const settings = el('div', { class: 'fd-filter-menu fd-filter-settings', role: 'menu', id: settingsId, 'aria-label': labels.filterSettings, hidden: '' });
  const drawSettings = () => {
    const hidden = new Set(hiddenFields());
    settings.replaceChildren(
      ...dropdowns.map(({ field, def }) =>
        tickRow(def.label, !hidden.has(field), () => {
          const next = hidden.has(field) ? [...hidden].filter((f) => f !== field) : [...hidden, field];
          context.preferences.set(shownKey, next);
          // A field taken away from the bar no longer filters the list.
          if (!hidden.has(field) && picks.delete(field)) changed();
          else drawButtons();
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

  // ---- × clears every filter ------------------------------------------------------------------------------

  const clear = el('button', { type: 'button', class: 'fd-filter-tool fd-filter-clear', 'aria-label': labels.clearFilters, title: labels.clearFilters }, ...icon('close'));
  clear.addEventListener('click', () => {
    keyword = '';
    input.value = '';
    picks.clear();
    others = [];
    changed();
    input.focus();
  });

  const element = el(
    'div',
    { class: 'fd-filter-bar', role: 'search', 'data-node': `${node.id}-filters` },
    el('label', { class: 'fd-filter-search' }, ...icon('filter-lines', 'fd-filter-icon'), input),
    el('div', { class: 'fd-filter-fields' }, ...dropdowns.map((d) => d.holder), gearHolder, clear)
  );
  // A press anywhere else closes an open list.
  const outside = (event: Event) => {
    if (!element.contains(event.target as Node)) closeOthers();
  };
  doc.addEventListener('pointerdown', outside);
  element.addEventListener('focusout', (event) => {
    if (!element.contains(event.relatedTarget as Node | null) && event.relatedTarget) closeOthers();
  });
  drawButtons();

  return {
    element,
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
      for (const dropdown of dropdowns) dropdown.close();
    },
  };
}
