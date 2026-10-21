import type { Facet, JsonValue, ListNode, Page } from '@fieldia/core';
import type { PreferenceStore } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';

/** A search a person kept, by its name; the one used by default opens the list. */
export interface Favourite {
  name: string;
  facets: Facet[];
  isDefault?: boolean;
}

const key = (page: Page) => `favourites:${page.id}`;

export function readFavourites(preferences: PreferenceStore, page: Page): Favourite[] {
  const kept = preferences.get(key(page));
  return Array.isArray(kept) ? (kept as unknown as Favourite[]) : [];
}

/** What a list starts with: the favourite used by default, or else the list's own default filters. */
export function startingFacets(node: ListNode, preferences: PreferenceStore, page: Page): Facet[] {
  const chosen = readFavourites(preferences, page).find((favourite) => favourite.isDefault);
  return chosen ? chosen.facets : defaultFacets(node);
}

/** The list's own default filters, as a chip. */
export function defaultFacets(node: ListNode): Facet[] {
  if (!node.defaultFilters?.length) return [];
  return [{ kind: 'filters', ids: [...node.defaultFilters], labels: node.defaultFilters.map((id) => node.filters?.find((f) => f.id === id)?.label ?? id) }];
}

/**
 * The Favourites of the search menu: searches kept by name, each one put back
 * with a click or deleted, and the search on screen kept as a new one, used by
 * default if the person says so. Kept where the page keeps its preferences.
 */
export function favouritesPart(context: FavouritesContext): Favourites {
  const { page, el, labels, fill, preferences } = context;
  const list = el('ul', { class: 'fd-favourite-list' });
  const none = el('p', { class: 'fd-favourites-none' }, labels.noFavourites);
  const name = el('input', { class: 'fd-input', 'aria-label': labels.searchName, placeholder: labels.searchName });
  const byDefault = el('input', { type: 'checkbox' });
  const save = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.save);
  const form = el('div', { class: 'fd-favourite-form', hidden: '' }, name, el('label', { class: 'fd-favourite-default' }, byDefault, labels.useByDefault), save);
  const open = el('button', { type: 'button', class: 'fd-search-option fd-search-add', 'aria-expanded': 'false' }, labels.saveSearch);

  const write = (favourites: Favourite[]) => preferences.set(key(page), favourites as unknown as JsonValue);
  /** Each favourite drawn, and where its count goes. */
  let slots: { slot: HTMLElement; name: string; facets: Facet[] }[] = [];

  function draw() {
    const favourites = readFavourites(preferences, page);
    none.hidden = favourites.length > 0;
    slots = [];
    list.replaceChildren(
      ...favourites.map((favourite) => {
        const slot = context.slot?.();
        if (slot) slots.push({ slot, name: favourite.name, facets: favourite.facets });
        const use = el('button', { type: 'button', class: 'fd-search-option', 'data-default': favourite.isDefault ? 'true' : undefined }, favourite.name, ...(slot ? [slot] : []));
        use.addEventListener('click', () => context.apply(favourite.facets));
        const remove = el('button', { type: 'button', class: 'fd-favourite-remove', 'aria-label': fill(labels.deleteFavourite, { name: favourite.name }) }, '×');
        remove.addEventListener('click', () => {
          write(readFavourites(preferences, page).filter((f) => f.name !== favourite.name));
          draw();
        });
        return el('li', { class: 'fd-favourite' }, use, remove);
      })
    );
    context.drawn?.();
  }

  open.addEventListener('click', () => {
    form.hidden = !form.hidden;
    open.setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) name.focus();
  });
  save.addEventListener('click', () => {
    const named = name.value.trim();
    if (!named) return name.focus();
    const kept: Favourite = { name: named, facets: context.current(), ...(byDefault.checked ? { isDefault: true } : {}) };
    // A name kept again replaces the old search; one default at a time.
    const others = readFavourites(preferences, page)
      .filter((f) => f.name !== named)
      .map((f) => (byDefault.checked ? { name: f.name, facets: f.facets } : f));
    write([...others, kept]);
    name.value = '';
    byDefault.checked = false;
    form.hidden = true;
    open.setAttribute('aria-expanded', 'false');
    draw();
  });

  draw();
  return { list, none, open, form, slots: () => slots };
}

/**
 * The menu's favourites from a part on its way (the views part, for a source that keeps views): drawn in their places
 * once it comes — the browser's own where it could not, or where it answers none.
 */
export function laterFavourites(coming: Promise<((context: FavouritesContext) => Favourites) | null>, el: El): (context: FavouritesContext) => Favourites {
  return (context) => {
    const [list, none, open, form] = [el('div', {}), el('div', {}), el('div', {}), el('div', {})];
    let made: Favourites | null = null;
    void coming.then((draw) => {
      made = (draw ?? favouritesPart)(context);
      list.replaceChildren(made.list);
      none.replaceChildren(made.none);
      open.replaceChildren(made.open);
      form.replaceChildren(made.form);
    });
    return { list, none, open, form, slots: () => made?.slots() ?? [] };
  };
}

/** What the search bar's menu draws its favourites with: those kept in the browser, or a list's saved views (saved-views.ts). */
export interface FavouritesContext {
  page: Page;
  el: El;
  labels: ViewerLabels;
  fill: (template: string, values: Record<string, string>) => string;
  preferences: PreferenceStore;
  current: () => Facet[];
  apply: (facets: Facet[]) => void;
  /** Where a favourite's count goes after its name, where the list counts (`filterCounts`); and what is told once the favourites are drawn. */
  slot?: () => HTMLElement;
  drawn?: () => void;
}

/** The menu's favourites: their list, what it says holding none, Save current search and its form, and where each one's count goes. */
export interface Favourites {
  list: HTMLElement;
  none: HTMLElement;
  open: HTMLElement;
  form: HTMLElement;
  slots(): { slot: HTMLElement; name: string; facets: Facet[] }[];
}
