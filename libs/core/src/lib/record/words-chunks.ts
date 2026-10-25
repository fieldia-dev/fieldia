import { inTime, PART_WAIT_MS } from '../parts';
/**
 * Languages whose words come in chunks of their own: in the packages, every language but English — Arabic, German,
 * French, and Turkish, Persian, Urdu and Spanish (machine-assisted, not yet reviewed by a native speaker) — so an app
 * never carries the words of a language it does not show (0.35; Arabic, German and French were carried at once before).
 * Each package says how it fetches its words in one (`wordsInChunks`); `wordsReady(tag)` fetches every package's for a
 * language, once, and what draws in it — `mountViewer`, a map's widgets, `mountChatter` — waits for them before it
 * draws, as it waits for its parts. The one-tag script has none: its languages are its add-on scripts.
 */

/** A package's words in languages that come in chunks of their own. */
export interface WordsChunks {
  /** Whether `locale`'s words are in a chunk not fetched yet. */
  coming(locale: string): boolean;
  /** Fetch them; settled once they are in the package's table (or could not come, which leaves it English). */
  fetch(locale: string): Promise<void>;
}

const packages: WordsChunks[] = [];
/** The languages asked for, each once: a package that says how later fetches its words for them too. */
const asked = new Map<string, Promise<void>>();
const baseOf = (tag: string | null | undefined) => (tag || 'en').split('-')[0].toLowerCase();

/** A package's words in chunks of their own: fetched with every other package's by `wordsReady`. */
export function wordsInChunks(chunks: WordsChunks): void {
  packages.push(chunks);
  for (const [locale, ready] of asked) if (chunks.coming(locale)) asked.set(locale, Promise.all([ready, chunks.fetch(locale)]).then(() => undefined));
}

/** Whether a language tag's words, in some package, come in a chunk not fetched yet. */
export const wordsComing = (tag: string | null | undefined): boolean => packages.some((chunks) => chunks.coming(baseOf(tag)));

const toldNotYet = new Set<string>();
/**
 * Whether a language tag's words come in a chunk not fetched yet, asked by what does not wait for them (as `mountViewer`
 * does): fetched now, each table there at once with English's words till they come, and the console told once what to
 * await.
 */
export function wordsNotYet(tag: string | null | undefined): boolean {
  const locale = baseOf(tag);
  if (!wordsComing(locale)) return false;
  void wordsReady(locale);
  if (!toldNotYet.has(locale)) {
    toldNotYet.add(locale);
    (globalThis as unknown as { console?: { warn(...what: unknown[]): void } }).console?.warn(
      `Fieldia: the words in "${locale}" come in a chunk of their own and have not come yet, so they show in English until they do. Await wordsReady('${locale}') from @fieldia/core first (mountViewer does).`
    );
  }
  return true;
}

/**
 * Every package's words for a language tag's language, fetched where they come in chunks of their own: settled at once
 * for any other. Meanwhile each package's table for it is there, English's words, filled in place as they come — so
 * what was made before reads the language's words from then on, and what is drawn after reads them at once.
 */
export function wordsReady(tag: string | null | undefined): Promise<void> {
  const locale = baseOf(tag);
  const coming = packages.filter((chunks) => chunks.coming(locale));
  const before = asked.get(locale);
  if (!coming.length && before) return before;
  const ready = Promise.all([before, ...coming.map((chunks) => chunks.fetch(locale))]).then(() => undefined);
  asked.set(locale, ready);
  return ready;
}

/**
 * A package's table of words by language, some of them in chunks of their own (`later`, each fetching its table): what
 * `wordsInChunks` takes. Asked for, a language's table is there at once — a copy of English's — and filled in place once
 * its chunk has come, keeping only the words it has (a sentence it leaves out says its plain one), so whatever took it
 * meanwhile reads the language's words from then on. A chunk that cannot be fetched leaves it English, said once.
 */
export function tableInChunks<T extends object>(table: Record<string, T>, later: Record<string, () => Promise<T>>): WordsChunks {
  const fetching = new Map<string, Promise<void>>();
  const done = new Set<string>();
  return {
    coming: (locale) => Object.prototype.hasOwnProperty.call(later, locale) && !done.has(locale),
    fetch(locale) {
      const already = fetching.get(locale);
      if (already) return already;
      if (!Object.prototype.hasOwnProperty.call(later, locale)) return Promise.resolve();
      const own = (table[locale] ??= { ...table['en'] } as T) as Record<string, unknown>;
      const said = (error: unknown) =>
        (globalThis as unknown as { console?: { warn(...what: unknown[]): void } }).console?.warn(`Fieldia: the words in "${locale}" could not be fetched, so they show in English.`, error);
      const arriving = later[locale]().then(
        (words) => {
          for (const key of Object.keys(own)) if (!(key in words)) delete own[key];
          Object.assign(own, words);
          done.add(locale);
        },
        (error: unknown) => {
          done.add(locale);
          said(error);
        }
      );
      // A chunk that stalls settles in English after `PART_WAIT_MS`, so what waits draws; its words still go in their
      // table in place, should they come after.
      const fetched = inTime(arriving, PART_WAIT_MS, `the words in "${locale}" did not come within ${PART_WAIT_MS / 1000} s`).catch(said);
      fetching.set(locale, fetched);
      return fetched;
    },
  };
}
