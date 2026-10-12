import type { Locale } from '@fieldia/core';
import type { LatLng } from './geo';
import type { MapLabels } from './labels';
import { warnOnce } from './map-core';
import type { AddressSearch, PlaceFound } from './providers';

/**
 * An address search over a map: a combobox (ARIA's), its places in a list
 * under it. As people type, when the provider's terms allow it; otherwise
 * when Enter is pressed. The arrow keys move through the places, Enter picks
 * one, Escape closes the list and then empties the box (unless what is typed
 * is an answer itself: `freeText`). Read-only, it searches nothing.
 */

export interface SearchBoxOptions {
  document: Document;
  id: string;
  labels: MapLabels;
  search: AddressSearch;
  asYouType: boolean;
  locale: Locale;
  /** Where to look first: where the map is. */
  near: () => LatLng | undefined;
  /** How close the map is: how far "near" reaches. */
  zoom?: () => number | undefined;
  pick: (place: PlaceFound) => void | Promise<void>;
  /** Says how the search is going, under the map. */
  say: (words: string | null, tone?: 'error') => void;
  /** What is typed is an answer too, as an address field's is: Escape only closes the list. */
  freeText?: boolean;
  /** A field's own box to search from, in place of one of its own: the list is made for it, and placed by the field. */
  input?: HTMLInputElement;
}

export function searchBox(options: SearchBoxOptions) {
  const { document: doc, labels } = options;
  const element = doc.createElement('div');
  element.className = 'fd-map-search';
  const input = options.input ?? doc.createElement('input');
  if (!options.input) {
    input.className = 'fd-input';
    input.id = options.id;
    input.type = 'text';
    input.placeholder = labels.search;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.enterKeyHint = 'search';
  }
  const listId = `${options.id}-places`;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listId);
  const list = doc.createElement('ul');
  list.className = 'fd-map-results';
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', labels.search);
  list.hidden = true;
  element.append(...(options.input ? [] : [input]), list);

  let places: PlaceFound[] = [];
  let active = -1;
  let asking: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function mark(index: number) {
    active = index;
    [...list.children].forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
    const chosen = list.children[index] as HTMLElement | undefined;
    if (chosen) {
      input.setAttribute('aria-activedescendant', chosen.id);
      chosen.scrollIntoView?.({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function choose(place: PlaceFound) {
    input.value = place.label;
    close();
    options.say(null);
    place.picked?.();
    options.pick(place);
  }

  function show(found: PlaceFound[]) {
    places = found;
    list.replaceChildren(
      ...found.map((place, i) => {
        const option = doc.createElement('li');
        option.id = `${listId}-${i}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        // The place on one line, where it is on the next, as a map's own search shows them; each in its own words' direction ("1 Mohammed Mahmoud" on an Arabic page).
        const name = doc.createElement('span');
        name.className = 'fd-map-result-name';
        name.dir = 'auto';
        name.textContent = place.label;
        option.append(name);
        if (place.detail) {
          const detail = doc.createElement('span');
          detail.className = 'fd-map-result-detail';
          detail.dir = 'auto';
          detail.textContent = place.detail;
          option.append(detail);
        }
        // Picked on the press, the box keeping its focus.
        option.addEventListener('mousedown', (event) => event.preventDefault());
        option.addEventListener('click', () => choose(place));
        return option;
      })
    );
    const any = found.length > 0;
    list.hidden = !any;
    input.setAttribute('aria-expanded', String(any));
    active = -1;
    options.say(any ? null : labels.noResults);
  }

  function run() {
    clearTimeout(timer);
    const text = input.value.trim();
    asking?.abort();
    if (text.length < (options.asYouType ? 2 : 1)) {
      close();
      options.say(null);
      return;
    }
    const mine = (asking = new AbortController());
    options.say(labels.searching);
    options
      .search({ text, near: options.near(), zoom: options.zoom?.(), locale: options.locale, signal: mine.signal })
      .then((found) => mine === asking && show(found))
      .catch((error: Error) => {
        if (mine !== asking || error.name === 'AbortError') return;
        close();
        options.say(labels.searchFailed, 'error');
        // The reader is told to try again; the developer, why it failed.
        warnOnce(`The address search failed: ${error.message}`);
      });
  }

  input.addEventListener('input', () => {
    if (!options.asYouType) {
      close();
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  });
  input.addEventListener('keydown', (event) => {
    if (input.readOnly) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (list.hidden) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      mark((active + step + places.length) % places.length);
    } else if (event.key === 'Enter') {
      // Never the form's own Enter.
      event.preventDefault();
      // Enter takes the place chosen with the arrows, or the first: the one nearest and likeliest.
      if (!list.hidden && places.length) choose(places[Math.max(active, 0)]);
      else run();
    } else if (event.key === 'Escape') {
      if (!list.hidden) {
        event.preventDefault();
        close();
      } else if (input.value && !options.freeText) {
        event.preventDefault();
        input.value = '';
        options.say(null);
      }
    }
  });
  input.addEventListener('blur', () => close());

  return {
    element,
    input,
    list,
    destroy() {
      clearTimeout(timer);
      asking?.abort();
    },
  };
}
