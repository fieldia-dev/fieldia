import type { JsonValue } from '@fieldia/core';

/**
 * Where a person's choices are kept between visits: a table's column widths,
 * their order, which columns show — and the templates they save and the
 * records they opened last, which are theirs (kept by their id where the app
 * says who they are). Never anything a page needs to work: a store that
 * forgets is fine.
 */
export interface PreferenceStore {
  get(key: string): JsonValue | null;
  set(key: string, value: JsonValue): void;
}

/**
 * Preferences in the browser's local storage, under `fieldia:` — a signed-in person's under their own id
 * (`fieldia:u:<id>:`), so the next person on the device never meets their templates or the records they opened last.
 * A browser that refuses storage just forgets.
 */
export function browserPreferences(storage?: Storage, user?: string | number | null): PreferenceStore {
  const prefix = user != null ? `fieldia:u:${String(user)}:` : 'fieldia:';
  const area = () => {
    try {
      return storage ?? globalThis.localStorage ?? null;
    } catch {
      return null; // reading localStorage itself throws where site data is blocked
    }
  };
  return {
    get(key) {
      try {
        const text = area()?.getItem(`${prefix}${key}`);
        return text == null ? null : (JSON.parse(text) as JsonValue);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        area()?.setItem(`${prefix}${key}`, JSON.stringify(value));
      } catch {
        // Full, private or blocked: the choice lasts until the page closes.
      }
    },
  };
}

/** Preferences that last as long as the page: for tests, and apps that keep nothing. */
export function memoryPreferences(): PreferenceStore {
  const values = new Map<string, JsonValue>();
  return {
    get: (key) => (values.has(key) ? structuredCloneSafe(values.get(key) as JsonValue) : null),
    set: (key, value) => void values.set(key, structuredCloneSafe(value)),
  };
}

const structuredCloneSafe = (value: JsonValue): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
