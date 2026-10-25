/**
 * An edit made on a draft of a page that copies only what it writes (`produce`): each object or list on the way to a
 * change is copied once, as it is first written, and everything else stays the page's own — the same objects. A label
 * typed on a page of 500 fields copies its field, the fields' table and the page, not the page whole; and the page made
 * shares all the edit left alone with the page before, as `keepUnchanged` would make it by comparing them.
 *
 * The draft reads and writes as the page would — plain objects and lists, their keys in their order, `splice`, `push`,
 * `delete`, `in`, `Object.keys`, a spread, `JSON.stringify` — and the page it was made from is never written. What is
 * read of the draft is the draft (a part read twice is the same object); a part put elsewhere in it, moved, goes as it
 * is then. Pages are JSON: plain objects, lists and plain values are all it meets.
 */

/** A part of the draft: what it was, its copy once written, and where it hangs while it hangs there. */
interface State {
  readonly base: Record<PropertyKey, unknown>;
  copy: Record<PropertyKey, unknown> | null;
  readonly parent: State | null;
  readonly key: PropertyKey | null;
  readonly proxy: Record<PropertyKey, unknown>;
  /** The parts read of it, by key, while they hang there. */
  readonly children: Map<PropertyKey, State>;
}

const isPart = (value: unknown): value is Record<PropertyKey, unknown> => typeof value === 'object' && value !== null;

/** What each draft was made from, by the draft, while it is one: what `original` gives. */
const origins = new WeakMap<object, object>();

/**
 * What a draft was made from — the part of the page before the edit — or undefined for anything that is no draft: what
 * reads a draft at its cost may find its way in the page it was made from, then come back to the draft (`findNode`).
 */
export function original<T>(value: T): T | undefined {
  return isPart(value) ? (origins.get(value) as T | undefined) : undefined;
}

/** The page made by `edit` on a draft of `base`: `base` itself where nothing was written, else a page sharing what was not. */
export function produce<T extends object>(base: T, edit: (draft: T) => void): T {
  /** Each draft's state, by the draft: a part of the draft put into another part of it is known by it. */
  const states = new WeakMap<object, State>();
  /** Each draft let go once the page is made: one kept past the edit throws as it is read, never writing the page made. */
  const revokes: (() => void)[] = [];

  const make = (part: Record<PropertyKey, unknown>, parent: State | null, key: PropertyKey | null): State => {
    const state: State = { base: part, copy: null, parent, key, proxy: null as unknown as Record<PropertyKey, unknown>, children: new Map() };
    // The target is an empty object or list of its own kind: what the draft reports comes from the part, as it is now.
    const { proxy, revoke } = Proxy.revocable(Array.isArray(part) ? [] : {}, handler(state));
    (state as { proxy: unknown }).proxy = proxy;
    origins.set(proxy, part);
    revokes.push(revoke);
    states.set(state.proxy, state);
    return state;
  };
  const now = (state: State) => state.copy ?? state.base;
  /** Written: its copy made, and its parent's — its place in it the draft — up to the page. */
  const written = (state: State): Record<PropertyKey, unknown> => {
    if (state.copy) return state.copy;
    state.copy = (Array.isArray(state.base) ? state.base.slice() : { ...state.base }) as Record<PropertyKey, unknown>;
    const { parent, key } = state;
    if (parent && key !== null && parent.children.get(key) === state) written(parent)[key] = state.proxy;
    return state.copy;
  };

  function handler(state: State): ProxyHandler<object> {
    return {
      get(_target, key) {
        const source = now(state);
        const value = source[key];
        if (typeof key === 'symbol' || !Object.prototype.hasOwnProperty.call(source, key) || !isPart(value) || states.has(value)) return value;
        // A part of the page read: its draft, the same one each time while it hangs here.
        const child = state.children.get(key);
        if (child && child.base === value) return child.proxy;
        // Not the page's own at this place — a part the edit put here — it is itself. (A list's parts moved by `splice`
        // and its kin are read here first, and so moved as their drafts.)
        if (value !== state.base[key]) return value;
        const made = make(value, state, key);
        state.children.set(key, made);
        return made.proxy;
      },
      set(_target, key, value) {
        const copy = written(state);
        state.children.delete(key);
        copy[key] = value;
        return true;
      },
      deleteProperty(_target, key) {
        const copy = written(state);
        state.children.delete(key);
        delete copy[key];
        return true;
      },
      defineProperty(_target, key, descriptor) {
        const copy = written(state);
        state.children.delete(key);
        return Reflect.defineProperty(copy, key, descriptor);
      },
      has: (_target, key) => key in now(state),
      ownKeys: () => Reflect.ownKeys(now(state)),
      getOwnPropertyDescriptor(target, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(now(state), key);
        if (!descriptor) return undefined;
        // A list's length stays as its target has it: not to be configured. Every other key is the part's, as it is.
        if (Array.isArray(target) && key === 'length') return { ...descriptor, configurable: false };
        return { ...descriptor, configurable: true };
      },
      getPrototypeOf: () => Reflect.getPrototypeOf(now(state)),
    };
  }

  /** What a draft, or a part holding drafts, is once the edit is done: its copy, its drafts made what they are. */
  const done = (value: unknown, seen = new Set<object>()): unknown => {
    if (!isPart(value)) return value;
    const state = states.get(value);
    if (state) {
      if (!state.copy) return state.base;
      const copy = state.copy;
      for (const key of Object.keys(copy)) copy[key] = done(copy[key], seen);
      return copy;
    }
    // A part the edit made, or took from elsewhere: the drafts put in it made what they are.
    if (seen.has(value)) return value;
    seen.add(value);
    for (const key of Object.keys(value)) {
      const inner = value[key];
      if (isPart(inner)) {
        const made = done(inner, seen);
        if (made !== inner) value[key] = made;
      }
    }
    return value;
  };

  const root = make(base as Record<PropertyKey, unknown>, null, null);
  try {
    edit(root.proxy as T);
    return done(root.proxy) as T;
  } finally {
    for (const revoke of revokes) revoke();
  }
}

/**
 * Whether two pages are the same, as their JSON would be — keys in the same order, a key holding nothing left out —
 * comparing the parts they share by their identity: a page made by `produce` against the one before is compared at the
 * cost of what changed, never stringified whole.
 */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!isPart(a) && !isPart(b)) return JSON.stringify(a) === JSON.stringify(b);
  // A part is never the same as a plain value (a page, never the version none was published as).
  if (!isPart(a) || !isPart(b)) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as unknown as unknown[];
    if (a.length !== other.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameJson(a[i] ?? null, other[i] ?? null)) return false;
    return true;
  }
  const keys = Object.keys(a).filter((key) => a[key] !== undefined && typeof a[key] !== 'function');
  const others = Object.keys(b).filter((key) => b[key] !== undefined && typeof b[key] !== 'function');
  if (keys.length !== others.length) return false;
  for (let i = 0; i < keys.length; i++) if (keys[i] !== others[i] || !sameJson(a[keys[i]], b[keys[i]])) return false;
  return true;
}
