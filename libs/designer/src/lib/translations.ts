import { pageWords, type Page } from '@fieldia/core';
import { Refusal } from './refusal';
import { COMMON_LANGUAGES } from './language-names';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

export { COMMON_LANGUAGES } from './language-names';

/**
 * The page's words in other languages, as the page keeps them: by language
 * tag, each word as written mapped to its translation. Adding and removing a
 * language, translating a word, filling many at once and letting go of words
 * no longer on the page — each through the designer's `apply`, so it is
 * checked, undone and saved as every other edit is, and typing in one word's
 * translation is one undo step.
 */

export interface TranslationCommands {
  /** A language to translate the page into, by tag (`ar`, `pt-BR`). Not the page's own language. */
  addLanguage(tag: string): boolean;
  /** A language taken out, with every word translated into it. */
  removeLanguage(tag: string): boolean;
  /** One word's translation; empty or `null` takes it away. Typing in one word is one undo step. */
  setTranslation(tag: string, source: string, text: string | null): boolean;
  /**
   * Many translations at once, by language then by word, as one edit:
   * languages the page has not got are added, words not on the page and empty
   * translations left out. Returns how many were filled.
   */
  fillTranslations(words: Record<string, Record<string, string>>): number | false;
  /** Let go of words' translations in every language, as one edit: for words no longer on the page. */
  forgetWords(sources: string[]): boolean;
  /** The language the page's own words are written in, by tag: not one it keeps a translation into. */
  setPageLanguage(tag: string): boolean;
}

export interface TranslationCommandsDeps {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
  getPage(): Page;
}


/** The language the page's own words are written in: its `language`, or English. */
export const pageLanguage = (page: Page): string => page.language ?? 'en';

/** The languages the page keeps translations in, in the order they were added. */
export const languagesOf = (page: Page): string[] => Object.keys(page.translations ?? {});

/** A language's name in the designer's words — English unless given: `ar` is Arabic, or العربية. The browser's names, or the common ones', or the tag itself. */
export function languageName(tag: string, words: DesignerWords = en): string {
  return words.languages.name(tag);
}

/** A language tag written the way tags are written (`ar-EG`, `zh-Hant`), or null for what is not one. */
function canonicalTag(text: string): string | null {
  if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(text)) return null;
  try {
    return Intl.getCanonicalLocales(text)[0] ?? null;
  } catch {
    return null;
  }
}

/** What a person typed to name a language, as its tag: a tag (`pt-br`), or a common language's name (`Arabic`). */
export function languageTag(typed: string, words: DesignerWords = en): string | null {
  const text = typed.trim();
  // By its English name always, as a CSV from anywhere names it; and by its name in the designer's words.
  const named = Object.keys(COMMON_LANGUAGES).find((tag) => COMMON_LANGUAGES[tag].toLowerCase() === text.toLowerCase() || languageName(tag, words).toLowerCase() === text.toLowerCase());
  return named ?? canonicalTag(text);
}

/** The words last worked out, and the page they are of. */
let words: { page: Page; words: readonly string[] } | null = null;

/**
 * The page's words (`pageWords`), worked out once for a page, and kept for the
 * next while only its translations change — as they do at each key typed into
 * the translations' grid: a page's words are never its translations.
 */
export function wordsOf(page: Page): readonly string[] {
  if (!words || !sameButTranslations(words.page, page)) words = { page, words: Object.freeze(pageWords(page)) };
  else words = { page, words: words.words };
  return words.words;
}

function sameButTranslations(a: Page, b: Page): boolean {
  if (a === b) return true;
  const keys = Object.keys(a).filter((key) => key !== 'translations');
  const others = Object.keys(b).filter((key) => key !== 'translations');
  return keys.length === others.length && keys.every((key, i) => key === others[i] && a[key as keyof Page] === b[key as keyof Page]);
}

/** How many of the page's words a language has, of all of them. */
export function translationProgress(page: Page, tag: string): { done: number; total: number } {
  const words = wordsOf(page);
  const kept = page.translations?.[tag] ?? {};
  return { done: words.filter((word) => kept[word]).length, total: words.length };
}

/** Words some language translates that the page no longer shows, in the order they are kept. */
export function staleWords(page: Page): string[] {
  const shown = new Set(wordsOf(page));
  return [...new Set(Object.values(page.translations ?? {}).flatMap((words) => Object.keys(words)))].filter((word) => !shown.has(word));
}

/** For Publish: languages added and removed, and in each language words translated, changed and taken out. */
export function translationChanges(before: Page, after: Page, words: DesignerWords = en): string[] {
  const w = words.changes;
  const [was, now] = [before.translations ?? {}, after.translations ?? {}];
  const out: string[] = [];
  if (pageLanguage(before) !== pageLanguage(after)) out.push(w.writtenIn(languageName(pageLanguage(after), words)));
  for (const tag of Object.keys(now)) if (!(tag in was)) out.push(w.addedLanguage(languageName(tag, words)));
  for (const tag of Object.keys(was)) if (!(tag in now)) out.push(w.removedLanguage(languageName(tag, words)));
  for (const [tag, translated] of Object.entries(now)) {
    const old = was[tag] ?? {};
    const added = Object.keys(translated).filter((word) => !(word in old)).length;
    const changed = Object.keys(translated).filter((word) => word in old && old[word] !== translated[word]).length;
    const gone = Object.keys(old).filter((word) => !(word in translated)).length;
    const name = languageName(tag, words);
    if (added) out.push(w.translated(name, added));
    if (changed) out.push(w.translationsChanged(name, changed));
    if (gone) out.push(w.translationsTakenOut(name, gone));
  }
  return out;
}

export function translationCommands({ apply, getPage }: TranslationCommandsDeps): TranslationCommands {
  /** The tag, written as tags are, or a refusal saying what a tag is. */
  function tagOf(typed: string): string {
    const tag = canonicalTag(typed.trim());
    if (!tag) throw new Refusal((w) => w.translations.notATag(typed.trim()));
    return tag;
  }
  /** The tag, written as tags are, for a language the page may be translated into. */
  function newLanguage(draft: Page, typed: string): string {
    const tag = tagOf(typed);
    const own = pageLanguage(draft);
    if (tag === own) throw new Refusal((w) => w.translations.writtenIn(languageName(own, w)));
    return tag;
  }
  /** The words the language keeps, refusing a language the page has not got. */
  function keptIn(draft: Page, tag: string): Record<string, string> {
    const words = draft.translations?.[tag];
    if (!words) throw new Refusal((w) => w.translations.addFirst(languageName(tag, w)));
    return words;
  }
  /** No language left: no translations at all. */
  const tidy = (draft: Page) => {
    if (draft.translations && !Object.keys(draft.translations).length) delete draft.translations;
  };

  return {
    addLanguage: (typed) =>
      apply((draft) => {
        const tag = newLanguage(draft, typed);
        if (draft.translations?.[tag]) throw new Refusal((w) => w.translations.hasAlready(languageName(tag, w)));
        draft.translations = { ...draft.translations, [tag]: {} };
      }),

    removeLanguage: (tag) =>
      apply((draft) => {
        if (!draft.translations?.[tag]) throw new Refusal((w) => w.translations.hasNo(languageName(tag, w)));
        delete draft.translations[tag];
        tidy(draft);
      }),

    setTranslation(tag, source, text) {
      const words = getPage().translations?.[tag];
      const next = text?.trim() ? text : undefined;
      // Nothing changes: no undo step for it.
      if (words && words[source] === next) return true;
      return apply(
        (draft) => {
          const kept = keptIn(draft, tag);
          if (next === undefined) delete kept[source];
          else if (!pageWords(draft).includes(source)) throw new Refusal((w) => w.translations.notOnPage(source));
          else kept[source] = next;
        },
        `translation:${tag}:${source}`
      );
    },

    fillTranslations(words) {
      let filled = 0;
      const ok = apply((draft) => {
        const shown = new Set(pageWords(draft));
        for (const [typed, given] of Object.entries(words)) {
          const tag = newLanguage(draft, typed);
          const kept = (draft.translations = { ...draft.translations, [tag]: { ...draft.translations?.[tag] } })[tag];
          for (const [source, text] of Object.entries(given)) {
            if (!shown.has(source) || !text.trim()) continue;
            kept[source] = text;
            filled++;
          }
        }
        if (!filled) throw new Refusal((w) => w.translations.noneOnPage);
      });
      return ok ? filled : false;
    },

    setPageLanguage(typed) {
      // Written in it already: no undo step for it.
      if (canonicalTag(typed.trim()) === pageLanguage(getPage())) return true;
      return apply((draft) => {
        const tag = tagOf(typed);
        if (draft.translations?.[tag]) throw new Refusal((w) => w.translations.keepsTranslation(languageName(tag, w)));
        // English is what a page is written in unless it says.
        if (tag === 'en') delete draft.language;
        else draft.language = tag;
      });
    },

    forgetWords: (sources) =>
      apply((draft) => {
        let found = false;
        for (const words of Object.values(draft.translations ?? {})) {
          for (const source of sources) {
            if (!(source in words)) continue;
            delete words[source];
            found = true;
          }
        }
        if (!found) throw new Refusal((w) => w.translations.noLanguageHas);
      }),
  };
}
