import type { Locale } from '@fieldia/core';
import { directionOf } from './address-line';
import type { LatLng } from './geo';
import type { MapLabels } from './labels';
import { warnOnce } from './map-core';
import type { AddressSearch, PlaceFound } from './providers';

/**
 * An address search over a map: a combobox (ARIA's), its places in a list
 * under it. As people type, when the provider's terms allow it; otherwise
 * when Enter is pressed. The arrow keys move through the places, Enter picks
 * one, Escape closes the list and then empties the box (unless what is typed
 * is an answer itself: `freeText`). Read-only, it searches nothing. A search
 * waiting to go, or on its way, when Escape is pressed, a place is picked or
 * the box is left is dropped, so its list never opens after them and no
 * search is said to be going. Each request may be paid for: the same words,
 * near the same place, are asked for once while one address is typed (a
 * space typed, a letter taken back, Enter after Escape), until a place is
 * picked (Google's suggestions are its session's, which a pick ends); Enter
 * on the place picked asks nothing.
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
  /** What the search on its way asks for, and the places each search brought until a place is picked: the same words (near the same place) wait for them, or show them again. */
  let waiting = '';
  const answers = new Map<string, PlaceFound[]>();
  /** The search whose places the list shows. */
  let showing = '';
  /** A place picked, and nothing typed since: Enter asks nothing. */
  let picked = false;

  /** The search waiting to go, or gone and not yet answered, dropped: no longer said to be going. */
  function drop() {
    clearTimeout(timer);
    timer = undefined;
    if (!asking) return;
    asking.abort();
    asking = null;
    options.say(null);
  }

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
    // A pause in typing ends here: nothing more is asked for these words, and no answer opens the list again.
    drop();
    // The address is found: the next is a new one, its words asked for anew (a provider's session ends with the pick).
    answers.clear();
    picked = true;
    input.value = place.label;
    close();
    options.say(null);
    place.picked?.();
    options.pick(place);
  }

  function show(found: PlaceFound[], these: string) {
    showing = these;
    // Two rows that read alike are one to the person reading them: the first is kept.
    places = found.filter((place, i) => found.findIndex((other) => other.label === place.label && other.detail === place.detail) === i);
    list.replaceChildren(
      ...places.map((place, i) => {
        const option = doc.createElement('li');
        option.id = `${listId}-${i}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        // The place on one line, where it is on the next, as a map's own search shows them: both at the page's side, each in its own words' direction ("1 Mohammed Mahmoud" on an Arabic page).
        const line = (className: string, words: string) => {
          const span = doc.createElement('span');
          span.className = className;
          const own = doc.createElement('bdi');
          own.dir = directionOf(words) || 'auto';
          own.textContent = words;
          span.append(own);
          return span;
        };
        option.append(line('fd-map-result-name', place.label));
        if (place.detail) option.append(line('fd-map-result-detail', place.detail));
        // Picked on the press, the box keeping its focus.
        option.addEventListener('mousedown', (event) => event.preventDefault());
        option.addEventListener('click', () => choose(place));
        return option;
      })
    );
    const any = places.length > 0;
    list.hidden = !any;
    input.setAttribute('aria-expanded', String(any));
    active = -1;
    options.say(any ? null : labels.noResults);
  }

  function run() {
    clearTimeout(timer);
    timer = undefined;
    const text = input.value.trim();
    if (text.length < (options.asYouType ? 2 : 1)) {
      drop();
      close();
      options.say(null);
      return;
    }
    const near = options.near();
    const zoom = options.zoom?.();
    const these = JSON.stringify([text, near, zoom]);
    // On their way already: waited for.
    if (asking && these === waiting) return;
    const had = answers.get(these);
    if (had) {
      // Here already: shown, unless they are, and nothing else asked for.
      drop();
      if (list.hidden || showing !== these) show(had, these);
      return;
    }
    asking?.abort();
    const mine = (asking = new AbortController());
    waiting = these;
    options.say(labels.searching);
    options
      .search({ text, near, zoom, locale: options.locale, signal: mine.signal })
      .then((found) => {
        if (mine !== asking) return;
        asking = null;
        answers.set(these, found);
        show(found, these);
      })
      .catch((error: Error) => {
        if (mine !== asking || error.name === 'AbortError') return;
        asking = null;
        close();
        options.say(labels.searchFailed, 'error');
        // The reader is told to try again; the developer, why it failed.
        warnOnce(`The address search failed: ${error.message}`);
      });
  }

  input.addEventListener('input', () => {
    picked = false;
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
      // Enter takes the place chosen with the arrows, or the first: the one nearest and likeliest; on the place picked, nothing.
      if (!list.hidden && places.length) choose(places[Math.max(active, 0)]);
      else if (!picked) run();
    } else if (event.key === 'Escape') {
      // The list closed, and the search that would open it again dropped, waiting or on its way.
      if (!list.hidden || asking || timer) {
        event.preventDefault();
        close();
        drop();
      } else if (input.value && !options.freeText) {
        event.preventDefault();
        input.value = '';
        options.say(null);
      }
    }
  });
  // Left: nothing waiting goes on to open the list over the next box.
  input.addEventListener('blur', () => {
    close();
    drop();
  });

  return {
    element,
    input,
    list,
    destroy: drop,
  };
}
