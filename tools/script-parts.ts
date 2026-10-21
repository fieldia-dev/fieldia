/**
 * The script bundle's parts (libs/widgets/src/lib/parts.ts): code a page loads
 * the first time it uses it, each part a script of its own beside fieldia.js —
 * `fieldia.head.js`, `fieldia.text.js`, `fieldia.path.js`, `fieldia.choice.js`,
 * `fieldia.filters.js`, `fieldia.date.js`, `fieldia.list.js`, `fieldia.cards.js`, `fieldia.columns.js`,
 * `fieldia.import.js`, `fieldia.editable.js`, `fieldia.lines.js`, `fieldia.files.js`, `fieldia.evidence.js`, `fieldia.business.js`, `fieldia.survey.js`,
 * `fieldia.phone.js`, `fieldia.slots.js`, `fieldia.relations.js`, `fieldia.duplicates.js`, `fieldia.answers.js`, `fieldia.limits.js`, `fieldia.approvals.js`,
 * `fieldia.assist.js`, `fieldia.print.js`, `fieldia.themes.js`, `fieldia.quiet.js`, `fieldia.memory.js`, `fieldia.functions.js`, `fieldia.options.js`, `fieldia.mapchecks.js`, `fieldia.languages.js`
 * (tools/script-bundle.mjs). The first time a page asks for a part, the main
 * script adds the part's tag, from the folder it came from itself; the part
 * runs, hands over its code, and the page draws from it.
 *
 * A part is built against the main script of its own version: what it shares
 * with it — the icons, the words, the helpers — it takes from the main
 * script's modules (`SHARED()`, in an order both are built with), never a copy of
 * its own. A part of another version is refused with a warning, and the page
 * draws plainly what it would have drawn from it.
 *
 * A part's tag may also be written into the page, after fieldia.js or before
 * it (an `async` script may run first): it waits in `FieldiaParts` for the
 * main script, which takes it as it starts.
 *
 * The English words only a part reads are its own too (tools/part-words.mjs):
 * the main script's tables leave them out, and a part puts them in every
 * language's table as it comes, before its code is made — where a table has
 * them already (an add-on's, an app's), they stay.
 */
import { SHARED } from 'fieldia:shared';
import type { LanguageWords } from '@fieldia/viewer';

declare const __FIELDIA_VERSION__: string;

/**
 * A part's script, as it runs: its name, the version it was built as, what makes its exports from the main script's
 * modules, and its own English words.
 */
export type PartEntry = [name: string, version: string, make: (shared: readonly unknown[]) => unknown, words?: LanguageWords];

/** The global a part's script hands itself to: a queue until the main script starts, then the main script's own. */
export interface PartsHost {
  FieldiaParts?: PartEntry[] | { push(entry: PartEntry): void };
}

const made = new Map<string, unknown>();
const waiting = new Map<string, { resolve(exports: unknown): void; reject(error: Error): void }[]>();
/** The folder the main script came from, where its parts are; empty when it came from no file of its own. */
let base = '';
/** What puts a part's words in the tables (`partWords`, add-language.ts), given as the main script starts. */
let fillWords: (words: LanguageWords) => void = () => undefined;

function settle(name: string, outcome: { exports: unknown } | { error: Error }) {
  for (const one of waiting.get(name) ?? []) {
    if ('exports' in outcome) one.resolve(outcome.exports);
    else one.reject(outcome.error);
  }
  waiting.delete(name);
}

function take([name, version, make, words]: PartEntry) {
  if (made.has(name)) return;
  if (version !== __FIELDIA_VERSION__) {
    const said = `fieldia.${name}.js is version ${version}, but fieldia.js is ${__FIELDIA_VERSION__}: load a part of the main script's own version, from the same folder. Its parts are drawn plainly meanwhile.`;
    console.warn(said);
    settle(name, { error: new Error(said) });
    return;
  }
  if (words) fillWords(words);
  const exports = make(SHARED());
  made.set(name, exports);
  settle(name, { exports });
}

/** A part's code: at once once it has come, else its script added to the page, beside the main one. */
export function loadPart(name: string): Promise<unknown> {
  if (made.has(name)) return Promise.resolve(made.get(name));
  return new Promise((resolve, reject) => {
    const asked = waiting.get(name);
    if (asked) {
      asked.push({ resolve, reject });
      return;
    }
    waiting.set(name, [{ resolve, reject }]);
    const doc = typeof document === 'undefined' ? null : document;
    if (!doc || !base) {
      settle(name, { error: new Error(`fieldia.${name}.js cannot be loaded: fieldia.js came from no address of its own. Add its tag after fieldia.js.`) });
      return;
    }
    const tag = doc.createElement('script');
    tag.src = `${base}fieldia.${name}.js`;
    tag.async = true;
    tag.onload = () => {
      tag.remove();
      if (!made.has(name)) settle(name, { error: new Error(`${tag.src} gave no part`) });
    };
    tag.onerror = () => {
      tag.remove();
      // Forgotten, so the next use asks again (a page that was offline).
      settle(name, { error: new Error(`${tag.src} could not be loaded`) });
    };
    (doc.head ?? doc.documentElement).append(tag);
  });
}

/**
 * Run as the main script starts: where it came from, while the browser still
 * says (`document.currentScript`), what puts a part's words in the tables, and
 * the parts whose scripts ran before it.
 */
export function startParts(words: (words: LanguageWords) => void): void {
  fillWords = words;
  const script = typeof document === 'undefined' ? null : document.currentScript;
  const src = script && 'src' in script ? String(script.src) : '';
  base = src ? src.replace(/[?#].*$/, '').replace(/[^/]*$/, '') : '';
  const host = globalThis as PartsHost;
  const queued = Array.isArray(host.FieldiaParts) ? host.FieldiaParts : [];
  host.FieldiaParts = { push: take };
  for (const entry of queued) take(entry);
}
