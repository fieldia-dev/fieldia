import type { Facet, SortOrder } from '@fieldia/core';

/**
 * Where a list stood as a row of it opened its record on a page of its own (0.35.1: far down the activity log, an entry
 * opened and Back started the list again at its top, its 450 loaded rows gone) — its search, its order, its page or
 * the rows it had loaded as it was scrolled, the row at the top of the window and how far down it was, and the row
 * opened. Kept in the page's own entry of the browser's history (`history.state`, under Fieldia's key, beside what
 * the app keeps there): Back — the browser's, or the app's own router's — finds the list where it was left, and the
 * keyboard on the row it opened; the list opened anew (a new entry) starts at its top, as ever.
 */
export interface ListPlace {
  facets: Facet[];
  keys: SortOrder[];
  offset: number;
  reach: number;
  /** The row at the window's top, by its record's id, and its top's distance from the window's. */
  at?: string;
  top?: number;
  /** The row whose record was opened. */
  open?: string;
}

const KEY = 'fieldia:lists';

/** The windows whose history moved back or forward since a list watched them: a router's own pages came back. */
const traversed = new WeakSet<object>();
const watched = new WeakSet<object>();

/**
 * Whether the page was come back to — the browser's Back or Forward, a reload, or an app's router moving through the
 * history (popstate) — rather than opened anew: only then does a list open where it was left, never in a page (or a
 * test) that merely draws the same list again.
 */
export function cameBack(doc: Document): boolean {
  const view = doc.defaultView;
  if (!view) return false;
  if (!watched.has(view)) {
    watched.add(view);
    view.addEventListener('popstate', () => traversed.add(view));
  }
  if (traversed.has(view)) return true;
  try {
    const arrived = (view.performance?.getEntriesByType?.('navigation')[0] as { type?: string } | undefined)?.type;
    return arrived === 'back_forward' || arrived === 'reload';
  } catch {
    return false;
  }
}

type History = { state: unknown; replaceState(state: unknown, unused: string): void };
const historyOf = (doc: Document): History | null => (doc.defaultView?.history as History | undefined) ?? null;

/** The place kept for a list in this page's history entry, by its page's and its node's ids; null for none. */
export function placeKept(doc: Document, list: string): ListPlace | null {
  try {
    const state = historyOf(doc)?.state as Record<string, Record<string, unknown> | undefined> | null;
    const kept = state?.[KEY]?.[list] as ListPlace | undefined;
    return kept && typeof kept === 'object' && Array.isArray(kept.facets) ? kept : null;
  } catch {
    return null;
  }
}

/** Keep a list's place in this page's history entry (null lets it go), what the app keeps there left as it is. */
export function keepPlace(doc: Document, list: string, place: ListPlace | null): void {
  const history = historyOf(doc);
  if (!history) return;
  try {
    const state = history.state && typeof history.state === 'object' ? (history.state as Record<string, unknown>) : {};
    const lists = { ...((state[KEY] as Record<string, ListPlace> | undefined) ?? {}) };
    if (place) lists[list] = place;
    else delete lists[list];
    history.replaceState({ ...state, [KEY]: lists }, '');
  } catch {
    // A history the page may not write (a sandboxed frame), or a search that is no plain data: the list starts at its top.
  }
}

/** The first of `rows` whose foot is under the window's top: the row a person reads first, and its top from the window's. */
export function topRow(rows: Iterable<HTMLElement>): { at: string; top: number } | null {
  for (const row of rows) {
    if (row.hidden || !row.dataset['id']) continue;
    const box = row.getBoundingClientRect();
    if (box.bottom > 0 && box.height > 0) return { at: row.dataset['id'], top: Math.round(box.top) };
  }
  return null;
}
