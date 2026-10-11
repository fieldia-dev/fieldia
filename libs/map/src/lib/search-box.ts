import type { Locale } from '@fieldia/core';
import type { LatLng } from './geo';
import type { MapLabels } from './labels';
import type { AddressSearch, PlaceFound } from './providers';

/**
 * An address search over a map: a combobox (ARIA's), its places in a list
 * under it. As people type, when the provider's terms allow it; otherwise
 * when Enter is pressed. The arrow keys move through the places, Enter picks
 * one, Escape closes the list and then empties the box.
 */

export interface SearchBoxOptions {
  document: Document;
  id: string;
  labels: MapLabels;
  search: AddressSearch;
  asYouType: boolean;
  locale: Locale;
  /** Where to look first: the map's place, or its centre. */
  near: () => LatLng | undefined;
  pick: (place: PlaceFound) => void;
  /** Says how the search is going, under the map. */
  say: (words: string | null, tone?: 'error') => void;
}

export function searchBox(options: SearchBoxOptions) {
  const { document: doc, labels } = options;
  const element = doc.createElement('div');
  element.className = 'fd-map-search';
  const input = doc.createElement('input');
  input.className = 'fd-input';
  input.id = options.id;
  input.type = 'text';
  input.placeholder = labels.search;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.enterKeyHint = 'search';
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
  element.append(input, list);

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
        option.textContent = place.label;
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
    if (text.length < (options.asYouType ? 3 : 1)) {
      close();
      options.say(null);
      return;
    }
    const mine = (asking = new AbortController());
    options.say(labels.searching);
    options
      .search({ text, near: options.near(), locale: options.locale, signal: mine.signal })
      .then((found) => mine === asking && show(found))
      .catch((error: Error) => {
        if (mine !== asking || error.name === 'AbortError') return;
        close();
        options.say(labels.searchFailed, 'error');
      });
  }

  input.addEventListener('input', () => {
    if (!options.asYouType) {
      close();
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(run, 350);
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (list.hidden) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      mark((active + step + places.length) % places.length);
    } else if (event.key === 'Enter') {
      // Never the form's own Enter.
      event.preventDefault();
      if (!list.hidden && active >= 0) choose(places[active]);
      else run();
    } else if (event.key === 'Escape') {
      if (!list.hidden) {
        event.preventDefault();
        close();
      } else if (input.value) {
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
    destroy() {
      clearTimeout(timer);
      asking?.abort();
    },
  };
}
