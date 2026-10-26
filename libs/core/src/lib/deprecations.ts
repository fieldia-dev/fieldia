/**
 * What Fieldia will change, said for a minor before it does (docs/maintainers/release-train.md). A setting, a member, an
 * attribute, a default or a DOM contract that is to change or go is first written here, with the minor that first warns
 * of it and the minor that changes it; where a use of it can be seen as Fieldia runs, that use says so once in the
 * console (`deprecated`); and the minor's CHANGELOG section lists it under **Deprecated**. The minor it changes in cites
 * it in its Upgrading part. `node tools/release.mjs` refuses a minor whose Upgrading part changes something this list did
 * not name a minor before, and tools/release-train.test.mjs holds the console warnings and this list to each other.
 *
 * Written as plain data, read as it is by the release tools (Node reads this file itself, its types left out).
 */

/** Who a change touches, as a release's Upgrading part groups them. */
export type DeprecationWho = 'page authors' | 'app code' | 'tests and CSS' | 'self-hosters';

/** One thing that will change, and when. */
export interface Deprecation {
  /** Its name, as the console, the changelog and the code that warns of it say it: `viewer.mount-throws`. */
  id: string;
  /** The minor that first warns of it: `"0.36"`. */
  since: string;
  /** The minor that changes or removes it, one minor after `since` at the soonest: `"0.37"`. */
  changesIn: string;
  /** Who it touches. */
  who: DeprecationWho;
  /** What changes, and what to write instead, in words. */
  words: string;
  /**
   * How it is said: `"console"` where a use of it is seen as Fieldia runs — a setting given, a member called, a default
   * relied on — once per page; `"changelog"` where no use can be seen (a DOM or CSS change), in the CHANGELOG alone.
   */
  warns: 'console' | 'changelog';
}

/** Everything deprecated and not yet changed, oldest first. */
export const DEPRECATIONS: readonly Deprecation[] = [
  {
    id: 'format.under-stamped',
    since: '0.36',
    changesIn: '0.37',
    who: 'page authors',
    words: 'A page that says an older format than a setting it uses came in is read as it is in 0.36, and refused from 0.37 — an older Fieldia believing its stamp would read it without that setting. Stamp it with stampPage(page), or write the format lowestFormat(page) gives.',
    warns: 'console',
  },
];

/** The ids warned of in this page so far: one set however many copies of Fieldia the page carries. */
const SAID = Symbol.for('fieldia.deprecations.said');
/** The page's own: its console (core has no DOM, nor the console's types), and what was said in it. */
type WithSaid = { [SAID]?: Set<string>; console?: { warn(...what: unknown[]): void } };

/**
 * Say once in this page, in the console, that something used will change: `words`, what changes and what to write
 * instead; `changesIn`, the minor that changes it. Each `id` is one of `DEPRECATIONS`, with the same `changesIn`
 * (tools/release-train.test.mjs holds every call to its entry). Returns whether it said so now — false once said.
 */
export function deprecated(id: string, words: string, changesIn: string): boolean {
  const held = globalThis as WithSaid;
  const said = (held[SAID] ??= new Set<string>());
  if (said.has(id)) return false;
  said.add(id);
  held.console?.warn(`Fieldia: ${words} — deprecated, it changes in ${changesIn} (${id}; https://fieldia.dev/promises/#deprecations).`);
  return true;
}
