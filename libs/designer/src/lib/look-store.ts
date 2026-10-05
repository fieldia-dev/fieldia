import type { LookStore, SavedLook } from './designer';
import { PRESET_KEYS, type LookValues } from './look-presets';

/**
 * Where looks of one's own are kept, as Fieldia ships them: in memory, for a
 * test or a page that keeps nothing, and in this browser, so a look saved
 * today is offered tomorrow. An app keeps them for a whole workspace on its
 * server with a `LookStore` of its own.
 */

/** What each value of a look may be; anything else read back is let go. */
const ALLOWED: Record<(typeof PRESET_KEYS)[number], (value: unknown) => boolean> = {
  accent: (value) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value),
  font: (value) => value === 'system' || value === 'serif' || value === 'rounded',
  density: (value) => value === 'compact' || value === 'comfortable' || value === 'roomy',
  corners: (value) => value === 'square' || value === 'soft' || value === 'round',
  scheme: (value) => value === 'light' || value === 'dark' || value === 'auto',
};

/** The looks in what was read back, each well made: an id and a name, and only the values a look may hold. */
export function wellMadeLooks(value: unknown): SavedLook[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const looks: SavedLook[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { id, name, look } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !id || seen.has(id) || typeof name !== 'string' || !name.trim() || !look || typeof look !== 'object') continue;
    const values: LookValues = {};
    for (const key of PRESET_KEYS) if (ALLOWED[key]((look as Record<string, unknown>)[key])) (values as Record<string, unknown>)[key] = (look as Record<string, unknown>)[key];
    seen.add(id);
    looks.push({ id, name, look: values });
  }
  return looks;
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** The list with a look in it: in its own place when it is kept already (renamed), else at the end. */
function withLook(looks: readonly SavedLook[], look: SavedLook): SavedLook[] {
  const at = looks.findIndex((l) => l.id === look.id);
  return at < 0 ? [...looks, copy(look)] : looks.map((l, i) => (i === at ? copy(look) : l));
}

/** Looks kept in memory, for as long as the page is open. `looks` is what it holds, to look at in a test. */
export function createMemoryLookStore(initial: readonly SavedLook[] = []): LookStore & { looks: Map<string, SavedLook> } {
  const looks = new Map<string, SavedLook>(initial.map((look) => [look.id, copy(look)]));
  return {
    looks,
    async list() {
      return copy([...looks.values()]);
    },
    async save(look) {
      looks.set(look.id, copy(look));
    },
    async remove(id) {
      looks.delete(id);
    },
  };
}

/**
 * Looks kept in this browser, under `key`, so they are offered again after a
 * reload and on every page of the site. A browser that keeps nothing (a
 * private window, storage turned off or full) keeps them in memory for the
 * visit instead: every reading and writing is tried, never trusted.
 */
export function createBrowserLookStore(key = 'fieldia.designer.looks'): LookStore {
  /** Once the browser has failed to keep them, the looks live here for the rest of the visit. */
  let inMemory: SavedLook[] | null = null;
  const storage = (): Storage => {
    const found = (globalThis as { localStorage?: Storage }).localStorage;
    if (!found) throw new Error('This browser keeps nothing');
    return found;
  };
  const read = (): SavedLook[] => {
    if (inMemory) return inMemory;
    try {
      const text = storage().getItem(key);
      if (text === null) return [];
      try {
        return wellMadeLooks(JSON.parse(text));
      } catch {
        // Not written by us: read as none, and written over by the next look saved.
        return [];
      }
    } catch {
      inMemory = [];
      return inMemory;
    }
  };
  const write = (looks: SavedLook[]) => {
    if (inMemory) {
      inMemory = looks;
      return;
    }
    try {
      storage().setItem(key, JSON.stringify(looks));
    } catch {
      inMemory = looks;
    }
  };
  return {
    async list() {
      return copy(read());
    },
    async save(look) {
      write(withLook(read(), look));
    },
    async remove(id) {
      write(read().filter((look) => look.id !== id));
    },
  };
}

let shared: LookStore | null = null;

/** The looks every designer on the page keeps when the app gives no store: this browser's, one store for all of them. */
export function browserLooks(): LookStore {
  shared ??= createBrowserLookStore();
  return shared;
}
