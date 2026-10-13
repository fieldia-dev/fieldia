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
 * the one marked, or the first of a list made for the words in the box (for
 * words typed since, it searches them at once), Escape closes the list and
 * then empties the box (unless what is typed is an answer itself:
 * `freeText`). Read-only, it searches nothing. A search
 * waiting to go, or on its way, when Escape is pressed, more is typed, a
 * place is picked or the box is left is dropped, so its list never opens
 * after them and no search is said to be going. Each request may be paid
 * for, once it is sent, whether or not its answer is read: the same words,
 * near the same place, are asked for once while one address is typed (a
 * space typed, a letter taken back, Enter after Escape), a dropped search's
 * answer kept for them as it comes, and waited for while it is on its way;
 * until a place is picked (Google's suggestions are its session's, which a
 * pick ends), which calls back what is still on its way. Enter on the place
 * picked asks nothing.
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
  let timer: ReturnType<typeof setTimeout> | undefined;
  /**
   * The places each search brought, by its words (near the same place), and
   * the searches on their way, by theirs, until a place is picked: the same
   * words show them again, or wait for them. A search dropped is not called
   * back, as the provider has its request (and may bill it): its answer is
   * kept when it comes, and only not shown.
   */
  const answers = new Map<string, PlaceFound[]>();
  const going = new Map<string, AbortController>();
  /** The words whose answer opens the list when it comes, and which the search is said to be going for: none once it is dropped. */
  let wanted = '';
  /** The search whose places the list shows, and the words it asked for. */
  let showing = '';
  let listed = '';
  /** A place picked, and nothing typed since: Enter asks nothing. */
  let picked = false;

  /** The search waiting to go never goes; the one on its way opens nothing when it comes, and is no longer said to be going. */
  function drop() {
    clearTimeout(timer);
    timer = undefined;
    if (!wanted) return;
    wanted = '';
    options.say(null);
  }

  /** The address is found, or the box gone: what is on its way is of no use, and called back; the next words are asked for anew (a provider's session ends with the pick). */
  function stop() {
    drop();
    going.forEach((asked) => asked.abort());
    going.clear();
    answers.clear();
  }

  function close() {
    const open = !list.hidden;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
    // What was said of the list (how many places came) goes with it.
    if (open) options.say(null);
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
    stop();
    picked = true;
    input.value = place.label;
    close();
    options.say(null);
    place.picked?.();
    options.pick(place);
  }

  function show(found: PlaceFound[], these: string, words: string) {
    showing = these;
    listed = words;
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
    const had = answers.get(these);
    if (had) {
      // Here already: shown, unless they are, and nothing else waited for.
      drop();
      if (list.hidden || showing !== these) show(had, these, text);
      return;
    }
    // On their way and waited for already.
    if (wanted === these) return;
    wanted = these;
    options.say(labels.searching);
    // On their way though dropped (Escape, a letter more): waited for again, not asked again.
    if (going.has(these)) return;
    const mine = new AbortController();
    going.set(these, mine);
    // Its answer is kept, whether or not its words are still waited for, and shown if they are. Called back (by a pick), it is nobody's.
    options.search({ text, near, zoom, locale: options.locale, signal: mine.signal }).then(
      (found) => {
        if (mine.signal.aborted) return;
        going.delete(these);
        answers.set(these, found);
        if (wanted !== these) return;
        wanted = '';
        show(found, these, text);
      },
      (error: Error) => {
        if (mine.signal.aborted) return;
        going.delete(these);
        if (wanted !== these) return;
        wanted = '';
        close();
        options.say(labels.searchFailed, 'error');
        // The reader is told to try again; the developer, why it failed.
        warnOnce(`The address search failed: ${error.message}`);
      }
    );
  }

  input.addEventListener('input', () => {
    picked = false;
    // A row marked was marked for the words before.
    mark(-1);
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
      // From no row marked, Down marks the first and Up the last (as from the first); each goes round at the end.
      mark(((active < 0 && step < 0 ? 0 : active) + step + places.length) % places.length);
    } else if (event.key === 'Enter') {
      // Never the form's own Enter.
      event.preventDefault();
      // Enter takes the place chosen with the arrows, or the first: the one nearest and likeliest, of a list made for the words in the box. A list made for fewer words names another place ("Al" for "Al Malqa"): their own are asked for now, and listed. On the place picked, nothing.
      const chosen = active >= 0 ? places[active] : listed === input.value.trim() ? places[0] : undefined;
      if (!list.hidden && chosen) choose(chosen);
      else if (!picked) run();
    } else if (event.key === 'Escape') {
      // The list closed, and the search that would open it again dropped, waiting or on its way.
      if (!list.hidden || wanted || timer) {
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
    destroy: stop,
  };
}
