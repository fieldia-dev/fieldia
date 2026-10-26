import { formJoins } from './joins';
import type { OutboxStore } from './outbox-form';
import type { RecordId } from './values';

/**
 * What Fieldia keeps in the browser belongs to a person: their drafts (`fieldia:draft:…` in the app's store, a timed
 * page's in the tab's own) and their sends kept without signal (IndexedDB `fieldia-outbox`) are each keyed by whose
 * they are — the app's signed-in person (`user.id`), else the tab they were typed in (an id the tab keeps in its own
 * store, `fieldia:tab`, for as long as it is open: a reload keeps it, another tab or person never sees it). The next
 * person on a shared device is never offered the last one's typing, nor sends it under their own session; `drafts.clear()`
 * and `outbox.clear()` let it go at sign-out.
 */

/** The browser's stores as far as Fieldia reads them: core names no DOM types. */
interface KeyedStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length?: number;
  key?(index: number): string | null;
}

/** The tab's own store (sessionStorage), or none where the browser has none or refuses it. */
export function tabStore(): KeyedStore | undefined {
  try {
    return (globalThis as { sessionStorage?: KeyedStore }).sessionStorage;
  } catch {
    return undefined;
  }
}

let ownTab: string | null = null;
/** This tab's own id: kept in the tab's store as long as it is open (a reload keeps it); this page's alone without one. */
export function tabId(): string {
  if (ownTab) return ownTab;
  const store = tabStore();
  let id: string | null = null;
  try {
    id = store?.getItem('fieldia:tab') ?? null;
    if (!id) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      store?.setItem('fieldia:tab', id);
    }
  } catch {
    id ??= `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
  return (ownTab = id);
}

/** Whose what is kept is: the signed-in person's (`u:<id>`), else this tab's (`t:<id>`). */
export function ownerOf(user: { id: RecordId | null } | null | undefined): string {
  return user?.id != null ? `u:${String(user.id)}` : `t:${tabId()}`;
}

/** Whether what an owner keeps outlives the page: a signed-in person's does; a tab's goes with the tab. */
export const lastsPastThePage = (owner: string) => owner.startsWith('u:');

/** The browser's local store, where an app keeps drafts (`drafts.store`), or none. */
function localStore(): KeyedStore | undefined {
  try {
    return (globalThis as { localStorage?: KeyedStore }).localStorage;
  } catch {
    return undefined;
  }
}

/** Every key of a store that lists its keys (localStorage and sessionStorage do), starting so. */
function keysOf(store: KeyedStore, start: string): string[] {
  const out: string[] = [];
  if (typeof store.key !== 'function' || typeof store.length !== 'number') return out;
  for (let at = 0; at < store.length; at++) {
    const key = store.key(at);
    if (key?.startsWith(start)) out.push(key);
  }
  return out;
}

/**
 * Drafts kept in the browser (`drafts.clear()`): every draft Fieldia kept — a person's alone, given their id — let go,
 * in the store given (the app's own `drafts.store`, which must list its keys as localStorage does) or else the browser's
 * local and tab stores. For sign-out, and a device handed to the next person.
 */
export const drafts = {
  clear(options: { user?: RecordId | null; store?: KeyedStore } = {}): void {
    const start = options.user != null ? `fieldia:draft:u:${String(options.user)}:` : 'fieldia:draft:';
    for (const store of options.store ? [options.store] : [localStore(), tabStore()]) {
      if (!store) continue;
      try {
        for (const key of keysOf(store, start)) store.removeItem(key);
      } catch {
        // A store that refuses keeps what it kept: there is nothing more to do here.
      }
    }
  },
};

/**
 * Sends kept without signal (`outbox.clear()`): every one waiting on this device — a person's alone, given their id —
 * let go, unsent, in the store given or else the browser's IndexedDB (`fieldia-outbox`). For sign-out: what is let go
 * never goes. The outbox part is asked for to do it.
 */
export const outbox = {
  async clear(options: { user?: RecordId | null; store?: OutboxStore } = {}): Promise<void> {
    const owner = options.user != null ? `u:${String(options.user)}` : undefined;
    const part = formJoins().find((one) => one.name === 'outbox');
    const store = options.store ?? ((await part?.load()) as { indexedOutbox?: () => OutboxStore | null } | undefined)?.indexedOutbox?.();
    await store?.clear?.(owner);
  },
};
