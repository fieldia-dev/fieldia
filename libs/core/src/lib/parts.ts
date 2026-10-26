/**
 * Code a page loads the first time it uses it — a work item's text editor,
 * its path picker, a record's head, a form's functions beyond the plain ones —
 * so that a page using none of it never downloads it. Each part is a module of its own (a `*-part.ts` file) asked
 * for with `import()`: an app's bundler makes it a file of its own, and the
 * script bundle a script beside fieldia.js, `fieldia.<name>.js`
 * (tools/script-bundle.mjs).
 *
 * A part is asked for once; a failure (offline, say) is forgotten, so the next
 * use asks again; one that does not come within `PART_WAIT_MS` (a network that
 * stalls) fails so too. What draws from a part draws from it at once when it has
 * come; the viewer waits for the parts a page needs before it draws that page,
 * and a widget made before its part has come is drawn plainly, then by its
 * part in the same place as soon as it comes (`partWidget`).
 */
import { safeUrl } from './safe-url';

export interface Part<M = unknown> {
  /** Its name: the script bundle's file for it is `fieldia.<name>.js`. */
  readonly name: string;
  /** Its code, once it has come; undefined until then. */
  readonly loaded: M | undefined;
  /** Its code: asked for the first time, then the same answer — unless that failed, when it is asked for again. */
  load(): Promise<M>;
  /**
   * Whether asking again once it failed can bring it: true where parts come by a script tag of their own (the one-tag
   * script, `partsComeByScriptTag`), which is asked for anew; false where they come by `import()` — an app's bundler —
   * whose module the browser keeps failed for the page's life, so only a reload brings it. What offers to try again
   * offers it only where it can work.
   */
  readonly asksAgain?: boolean;
  /** Whether it is asked for now and has not come nor failed yet: what waits for it waits for that answer first. */
  readonly coming?: boolean;
}

/** Whether this page's parts come by script tags of their own (the one-tag script) rather than by import(). */
let byScriptTag = false;
/** Said by the one-tag script as it starts: its parts come by script tags, each asked for anew after a failure. */
export function partsComeByScriptTag(): void {
  byScriptTag = true;
}

/** How long a part may take to come before it settles as failed (a network that stalls): the page goes on without it. */
export const PART_WAIT_MS = 30_000;

interface HostTimers {
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/**
 * Whatever comes in time, or a failure once `ms` passed with nothing — a part's script, a language's chunk on a network
 * that stalls: what waits for it (a page undrawn, `aria-busy`) goes on, never for ever. The timer keeps no process
 * alive by itself.
 */
export function inTime<M>(coming: Promise<M>, ms: number, why: string): Promise<M> {
  const timers = globalThis as unknown as Partial<HostTimers>;
  // A place with no timers (a bare script context): as it comes.
  if (typeof timers.setTimeout !== 'function' || typeof timers.clearTimeout !== 'function') return coming;
  return new Promise<M>((resolve, reject) => {
    const timer = (timers as HostTimers).setTimeout(() => reject(new Error(why)), ms);
    (timer as { unref?: () => void } | null)?.unref?.();
    coming.then(
      (value) => {
        (timers as HostTimers).clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        (timers as HostTimers).clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** The URL parser every runtime has, as far as a part's address needs it (core is typed for none: safe-url.ts). */
interface Address {
  href: string;
  protocol: string;
  readonly searchParams: { set(name: string, value: string): void };
}
const Url = (globalThis as unknown as { URL: new (url: string, base?: string) => Address }).URL;

/**
 * The address of the module an `import()` could not fetch, as the browser says it — Chromium "Failed to fetch dynamically
 * imported module: <address>", Firefox "error loading dynamically imported module: <address>" — or null where it says
 * none (WebKit's "Importing a module script failed."), or the failure was of another kind (the module's own error).
 */
export function failedModule(error: unknown): string | null {
  const said = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const found = /dynamically imported module:?\s+(\S+)/i.exec(said);
  if (!found) return null;
  try {
    const address = new Url(found[1]);
    return address.protocol === 'http:' || address.protocol === 'https:' ? address.href : null;
  } catch {
    return null;
  }
}

/** The page's document as far as asking for a part anew reads it: core names no DOM types. */
interface PageDocument {
  readonly head: { append(node: unknown): void } | null;
  readonly baseURI: string;
  querySelectorAll(selectors: string): ArrayLike<{ getAttribute(name: string): string | null }>;
  createElement(tag: 'link'): { rel: string; href: string; integrity: string; crossOrigin: string | null; nonce?: string; setAttribute(name: string, value: string): void };
}

/**
 * A module asked for again at an address of its own — the same file, `fd-again` beside it — which the browser has not
 * kept failed: it keeps a failed `import()` failed for the page's life, the same address never asked of the network
 * again. Its request carries what the page said of the first: its integrity (a module preload's or a script's
 * `integrity`, with its `crossorigin` and the page's nonce), so the file is still checked by its hash.
 */
function importAnew(address: string, again: number): Promise<unknown> {
  const asked = new Url(address);
  asked.searchParams.set('fd-again', String(again));
  // The browser's own address for the module, as its error named it: a web address, or not asked for again.
  const anew = safeUrl(asked.href, ['http', 'https']);
  if (!anew) return Promise.reject(new Error(`${address} could not be asked for again`));
  const doc = (globalThis as { document?: PageDocument }).document;
  if (doc?.head) {
    const said = [...Array.from(doc.querySelectorAll('link[integrity][href], script[integrity][src]'))].find((tag) => {
      try {
        return new Url(tag.getAttribute('href') ?? tag.getAttribute('src') ?? '', doc.baseURI).href === address;
      } catch {
        return false;
      }
    });
    const integrity = said?.getAttribute('integrity');
    if (integrity) {
      const preload = doc.createElement('link');
      preload.rel = 'modulepreload';
      preload.integrity = integrity;
      preload.crossOrigin = said?.getAttribute('crossorigin') ?? null;
      const nonce = said?.getAttribute('nonce') ?? (doc.querySelectorAll('script[nonce]')[0]?.getAttribute('nonce') || '');
      if (nonce) preload.setAttribute('nonce', nonce);
      preload.href = safeUrl(anew, ['http', 'https']) ?? '';
      doc.head.append(preload);
    }
  }
  // Left as the browser's own import, never a bundler's: the address is the browser's, known only now.
  return import(/* webpackIgnore: true */ /* @vite-ignore */ anew);
}

/**
 * A part, asked for by `load` (a dynamic import of the part's module) the first time something needs it. One whose
 * module failed is asked for anew at its own address where the browser said which (`failedModule`), as Retry asks; where
 * it said none, it asks no more (`asksAgain`).
 */
export function lazyPart<M>(name: string, load: () => Promise<M>): Part<M> {
  let pending: Promise<M> | undefined;
  let loaded: M | undefined;
  /** Where the browser said the part's module failed, and how often it was asked for anew since. */
  let failedAt: string | null = null;
  let tries = 0;
  /** A bundler's own loading that asks the network again itself (webpack's chunks: a `ChunkLoadError`). */
  let asksItself = false;
  return {
    name,
    get loaded() {
      return loaded;
    },
    get asksAgain() {
      return byScriptTag || asksItself || failedAt !== null;
    },
    get coming() {
      return pending !== undefined && loaded === undefined;
    },
    load() {
      // One that does not come in time settles as failed — asked for again by the next use — never waited on for ever.
      return (pending ??= inTime(failedAt && !byScriptTag ? (importAnew(failedAt, ++tries) as Promise<M>) : load(), PART_WAIT_MS, `fieldia.${name}.js did not come within ${PART_WAIT_MS / 1000} s`).then(
        (module) => (loaded = module),
        (error: unknown) => {
          pending = undefined;
          if ((error as { name?: unknown } | null)?.name === 'ChunkLoadError') asksItself = true;
          else failedAt ??= failedModule(error);
          throw error;
        }
      ));
    },
  };
}

/** Every part asked for, and settled: each one in, or failed (and drawn plainly). Never rejects. */
export function settleParts(parts: readonly Part[]): Promise<void> {
  return Promise.all(parts.map((part) => part.load().then(
    () => undefined,
    () => undefined
  ))).then(() => undefined);
}

/**
 * A part that draws with others' widgets — an analytic distribution's lines, each with a link's box: in once they all
 * are, its own code its answer. A page that needs it waits for them all; a widget drawn from it before they came is
 * drawn plainly until they have.
 */
export function partWith<M>(part: Part<M>, ...others: readonly Part[]): Part<M> & { readonly parts: readonly Part[] } {
  return {
    name: part.name,
    parts: [part, ...others],
    get loaded() {
      return others.every((other) => other.loaded) ? part.loaded : undefined;
    },
    get asksAgain() {
      return part.asksAgain === true && others.every((other) => other.asksAgain === true);
    },
    get coming() {
      return [part, ...others].some((one) => one.coming === true);
    },
    load: () => Promise.all([part.load(), ...others.map((other) => other.load())]).then(([module]) => module),
  };
}

/** The parts a part stands for: those it was made `partWith`, or itself. */
export function partsOf(part: Part): readonly Part[] {
  return (part as { parts?: readonly Part[] }).parts ?? [part];
}
