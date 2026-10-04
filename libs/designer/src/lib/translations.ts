import { pageWords, type Page } from '@fieldia/core';
import { Refusal } from './refusal';

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

/** Common languages, by tag, named in English: offered when adding one, and their names when the browser has none. */
export const COMMON_LANGUAGES: Record<string, string> = {
  ar: 'Arabic',
  bn: 'Bengali',
  zh: 'Chinese',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  fi: 'Finnish',
  fr: 'French',
  de: 'German',
  el: 'Greek',
  he: 'Hebrew',
  hi: 'Hindi',
  hu: 'Hungarian',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  ckb: 'Central Kurdish',
  ms: 'Malay',
  nb: 'Norwegian Bokmål',
  fa: 'Persian',
  pl: 'Polish',
  pt: 'Portuguese',
  'pt-BR': 'Brazilian Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  es: 'Spanish',
  sw: 'Swahili',
  sv: 'Swedish',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
};

/** The language the page's own words are written in: its `language`, or English. */
export const pageLanguage = (page: Page): string => page.language ?? 'en';

/** The languages the page keeps translations in, in the order they were added. */
export const languagesOf = (page: Page): string[] => Object.keys(page.translations ?? {});

/** A language's name in English: `ar` is Arabic. The browser's names, or the common ones', or the tag itself. */
export function languageName(tag: string): string {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(tag);
    if (name && name !== tag) return name;
  } catch {
    // A browser with no names of languages, or a tag it cannot read.
  }
  const [base, ...rest] = tag.split('-');
  if (COMMON_LANGUAGES[tag]) return COMMON_LANGUAGES[tag];
  return COMMON_LANGUAGES[base] ? `${COMMON_LANGUAGES[base]} (${rest.join('-')})` : tag;
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
export function languageTag(typed: string): string | null {
  const text = typed.trim();
  const named = Object.keys(COMMON_LANGUAGES).find((tag) => COMMON_LANGUAGES[tag].toLowerCase() === text.toLowerCase());
  return named ?? canonicalTag(text);
}

/** How many of the page's words a language has, of all of them. */
export function translationProgress(page: Page, tag: string): { done: number; total: number } {
  const words = pageWords(page);
  const kept = page.translations?.[tag] ?? {};
  return { done: words.filter((word) => kept[word]).length, total: words.length };
}

/** Words some language translates that the page no longer shows, in the order they are kept. */
export function staleWords(page: Page): string[] {
  const shown = new Set(pageWords(page));
  return [...new Set(Object.values(page.translations ?? {}).flatMap((words) => Object.keys(words)))].filter((word) => !shown.has(word));
}

/** For Publish: languages added and removed, and in each language words translated, changed and taken out. */
export function translationChanges(before: Page, after: Page): string[] {
  const [was, now] = [before.translations ?? {}, after.translations ?? {}];
  const out: string[] = [];
  if (pageLanguage(before) !== pageLanguage(after)) out.push(`The page is now written in ${languageName(pageLanguage(after))}`);
  for (const tag of Object.keys(now)) if (!(tag in was)) out.push(`Added ${languageName(tag)}`);
  for (const tag of Object.keys(was)) if (!(tag in now)) out.push(`Removed ${languageName(tag)}`);
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  for (const [tag, words] of Object.entries(now)) {
    const old = was[tag] ?? {};
    const added = Object.keys(words).filter((word) => !(word in old)).length;
    const changed = Object.keys(words).filter((word) => word in old && old[word] !== words[word]).length;
    const gone = Object.keys(old).filter((word) => !(word in words)).length;
    const name = languageName(tag);
    if (added) out.push(`${name}: ${count(added, 'word', 'words')} translated`);
    if (changed) out.push(`${name}: ${count(changed, 'translation', 'translations')} changed`);
    if (gone) out.push(`${name}: ${count(gone, 'translation', 'translations')} taken out`);
  }
  return out;
}

export function translationCommands({ apply, getPage }: TranslationCommandsDeps): TranslationCommands {
  /** The tag, written as tags are, or a refusal saying what a tag is. */
  function tagOf(typed: string): string {
    const tag = canonicalTag(typed.trim());
    if (!tag) throw new Refusal(`“${typed.trim()}” is not a language tag, such as ar, es or pt-BR`);
    return tag;
  }
  /** The tag, written as tags are, for a language the page may be translated into. */
  function newLanguage(draft: Page, typed: string): string {
    const tag = tagOf(typed);
    const own = pageLanguage(draft);
    if (tag === own) throw new Refusal(`The page is written in ${languageName(own)}: its words are the ${languageName(own)} already`);
    return tag;
  }
  /** The words the language keeps, refusing a language the page has not got. */
  function keptIn(draft: Page, tag: string): Record<string, string> {
    const words = draft.translations?.[tag];
    if (!words) throw new Refusal(`Add ${languageName(tag)} first`);
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
        if (draft.translations?.[tag]) throw new Refusal(`The page has ${languageName(tag)} already`);
        draft.translations = { ...draft.translations, [tag]: {} };
      }),

    removeLanguage: (tag) =>
      apply((draft) => {
        if (!draft.translations?.[tag]) throw new Refusal(`The page has no ${languageName(tag)}`);
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
          else if (!pageWords(draft).includes(source)) throw new Refusal(`“${source}” is not on the page`);
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
        if (!filled) throw new Refusal('None of these words is on the page');
      });
      return ok ? filled : false;
    },

    setPageLanguage(typed) {
      // Written in it already: no undo step for it.
      if (canonicalTag(typed.trim()) === pageLanguage(getPage())) return true;
      return apply((draft) => {
        const tag = tagOf(typed);
        if (draft.translations?.[tag]) throw new Refusal(`The page keeps a translation into ${languageName(tag)}: remove ${languageName(tag)} first to write the page in it`);
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
        if (!found) throw new Refusal('No language has those words');
      }),
  };
}
