/**
 * The script bundle's parts (libs/widgets/src/lib/parts.ts): code a page loads
 * the first time it uses it, each part a script of its own beside fieldia.js —
 * `fieldia.head.js`, `fieldia.text.js`, `fieldia.path.js`, `fieldia.choice.js`,
 * `fieldia.filters.js`, `fieldia.date.js`, `fieldia.months.js`, `fieldia.typed.js`, `fieldia.list.js`, `fieldia.cards.js`, `fieldia.columns.js`,
 * `fieldia.import.js`, `fieldia.editable.js`, `fieldia.views.js`, `fieldia.rows.js`, `fieldia.lines.js`, `fieldia.files.js`, `fieldia.evidence.js`, `fieldia.photos.js`, `fieldia.record.js`, `fieldia.codes.js`, `fieldia.pins.js`, `fieldia.business.js`, `fieldia.survey.js`,
 * `fieldia.phone.js`, `fieldia.slots.js`, `fieldia.schedule.js`, `fieldia.templates.js`, `fieldia.live.js`, `fieldia.undo.js`, `fieldia.relations.js`, `fieldia.duplicates.js`, `fieldia.answers.js`, `fieldia.limits.js`, `fieldia.approvals.js`,
 * `fieldia.assist.js`, `fieldia.print.js`, `fieldia.themes.js`, `fieldia.quiet.js`, `fieldia.memory.js`, `fieldia.functions.js`, `fieldia.options.js`, `fieldia.mapchecks.js`, `fieldia.languages.js`,
 * `fieldia.scan.js`, `fieldia.decode.js`, `fieldia.surveyflow.js`, `fieldia.prefill.js`, `fieldia.verify.js`, `fieldia.pay.js`, `fieldia.element.js`, `fieldia.outbox.js`
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
import { styleNonce, useStyleNonce } from '@fieldia/widgets';

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
/**
 * The main script's own nonce (`<script nonce>`), which its parts' tags carry: a Content-Security-Policy that lets
 * scripts run by their nonce lets the parts run too. Empty under none.
 */
let nonce = '';
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

/**
 * The tag a part is asked for with, as the main script adds it: its address, beside the main script's own, and its
 * nonce. The one place it is made — the page's own tags for its parts (`partTags`, a server's preload links) carry what
 * it carries, or the browser fetches the part twice (a preload is used only by a request made the same way).
 */
export function partTag(name: string): { src: string; nonce?: string } {
  return { src: `${base}fieldia.${name}.js`, ...(nonce ? { nonce } : {}) };
}

/**
 * The page's own tag for a part still on its way — a server wrote it before fieldia.js (`partFiles`): waited for, never
 * asked for a second time. One that came already (the browser's resource timing has it) and gave no part is not.
 */
function onItsWay(doc: Document, src: string): HTMLScriptElement | undefined {
  const timing = globalThis.performance;
  // A full buffer of timings can no longer say whether it came: asked for again then, as before.
  if (!timing?.getEntriesByName || timing.getEntriesByType('resource').length > 249 || timing.getEntriesByName(src).length) return undefined;
  return [...doc.scripts].find((one) => one.src === src);
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
    const { src, nonce: own } = partTag(name);
    // The page's own tag for it, still coming — its script hands the part over as it runs (`FieldiaParts`) — else one
    // of the main script's own.
    const written = onItsWay(doc, src);
    const tag = written ?? doc.createElement('script');
    tag.addEventListener('load', () => {
      tag.remove();
      if (!made.has(name)) settle(name, { error: new Error(`${src} gave no part`) });
    });
    tag.addEventListener('error', () => {
      tag.remove();
      // Forgotten, so the next use asks again (a page that was offline).
      settle(name, { error: new Error(`${src} could not be loaded`) });
    });
    if (written) return;
    tag.src = src;
    tag.async = true;
    if (own) tag.nonce = own;
    (doc.head ?? doc.documentElement).append(tag);
  });
}

/**
 * Run as the main script starts: where it came from and its nonce, while the
 * browser still says (`document.currentScript`), what puts a part's words in the
 * tables, and the parts whose scripts ran before it.
 */
export function startParts(words: (words: LanguageWords) => void): void {
  fillWords = words;
  const script = typeof document === 'undefined' ? null : document.currentScript;
  const src = script && 'src' in script ? String(script.src) : '';
  base = src ? src.replace(/[?#].*$/, '').replace(/[^/]*$/, '') : '';
  // A browser hides a nonce's attribute once a policy came with the page: its property keeps it. Fieldia's <style>
  // elements carry it too, unless the page or the app gives them one of their own (the viewer's `nonce`).
  nonce = (script as HTMLScriptElement | null)?.nonce || script?.getAttribute('nonce') || '';
  if (nonce && typeof document !== 'undefined' && !styleNonce(document)) useStyleNonce(document, nonce);
  const host = globalThis as PartsHost;
  const queued = Array.isArray(host.FieldiaParts) ? host.FieldiaParts : [];
  host.FieldiaParts = { push: take };
  for (const entry of queued) take(entry);
}
