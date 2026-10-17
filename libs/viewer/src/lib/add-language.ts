import { MESSAGES, type Locale, type Messages } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetLabels } from '@fieldia/widgets';
import { plainOf, VIEWER_LABELS, type ViewerLabels } from './labels';

/** A language's own words, in the three places Fieldia keeps them. A word left out shows in English. */
export interface LanguageWords {
  /** The validation messages (`MESSAGES`). */
  messages?: Partial<Messages>;
  /** The widgets' own words (`WIDGET_LABELS`). */
  widgets?: Partial<WidgetLabels>;
  /** The viewer's own words (`VIEWER_LABELS`). */
  viewer?: Partial<ViewerLabels>;
}

/** Each language's words as it was last given them, for the words a part brings later. */
const languagesGiven = new Map<Locale, LanguageWords>();

/**
 * Give Fieldia a language's own words, for every page shown in it from then
 * on. The packages have English, Arabic, German and French already; the
 * one-tag script has English alone, and its add-on scripts — `fieldia.ar.js`,
 * `fieldia.de.js`, `fieldia.fr.js` — call this with theirs. A language given
 * again takes the new words.
 */
export function addLanguage(locale: Locale, words: LanguageWords): void {
  languagesGiven.set(locale, words);
  MESSAGES[locale] = withOwn(MESSAGES.en, words.messages);
  WIDGET_LABELS[locale] = withOwn(WIDGET_LABELS.en, words.widgets);
  VIEWER_LABELS[locale] = withOwn(VIEWER_LABELS.en, words.viewer);
}

/** A language's words over English's, its counts' own (`ownCounts`), and none of English's sentences it says plainly. */
function withOwn<T extends object>(english: T, given: Partial<T> | undefined): T {
  const words: Record<string, unknown> = { ...english, ...ownCounts(given, english) };
  for (const key of Object.keys(words)) if (leftOut(key, given)) delete words[key];
  return words as T;
}

/**
 * A sentence in a page's words for its records (`exportedNoun`) that a language left out where it gave the sentence it
 * stands for (`exported`): it says that one, its own, on such a page — never English's round the language's words.
 */
const leftOut = (key: string, given: object | undefined) => {
  const plain = plainOf(key);
  return plain !== null && !!given && !(key in given) && plain in given;
};

/**
 * A part's own words, in English, as the one-tag script's part brings them (tools/script-parts.ts): the main script's
 * English leaves out the words only a part reads (tools/part-words.mjs), and the part puts them, as it comes, in each
 * language's table that has no such word yet — never over one it has, the language's own or an app's. A language added
 * keeps every word it was given, a part's too, so an add-on's come before or after the part alike; a word a language
 * left out is English, or its own count's words for a count's word for one (as `addLanguage` says it).
 */
export function partWords(words: LanguageWords): void {
  fillIn(MESSAGES, words.messages, 'messages');
  fillIn(WIDGET_LABELS, words.widgets, 'widgets');
  fillIn(VIEWER_LABELS, words.viewer, 'viewer');
}

function fillIn<T extends object>(tables: Record<string, T>, english: Partial<T> | undefined, kind: keyof LanguageWords): void {
  if (!english) return;
  for (const [locale, table] of Object.entries(tables)) {
    const own: Record<string, unknown> = locale === 'en' ? {} : ownCounts(languagesGiven.get(locale as Locale)?.[kind] as Partial<T> | undefined, english as T);
    const given = locale === 'en' ? undefined : (languagesGiven.get(locale as Locale)?.[kind] as object | undefined);
    for (const [key, word] of Object.entries(english)) if (!Object.prototype.hasOwnProperty.call(table, key) && !leftOut(key, given)) (table as Record<string, unknown>)[key] = own[key] ?? word;
  }
}

/**
 * A count's own words a language gave (`pastedCells`) without those for one, two or many (`pastedCellsOne`): its own
 * words stand for them too — "1 cellules" reads better in French than English in the middle of a French page.
 */
function ownCounts<T extends object>(given: Partial<T> | undefined, english: T): Partial<T> {
  if (!given) return {};
  const words: Record<string, unknown> = { ...given };
  for (const [key, value] of Object.entries(given)) {
    for (const count of ['One', 'Two', 'Many']) {
      const counted = `${key}${count}`;
      if (!(counted in english) || counted in given) continue;
      // A count's sentence for a page's records (`exportedNounOne`) is the language's plain one for that count, where given.
      const plain = plainOf(counted);
      if (plain === null || !(plain in given)) words[counted] = value;
    }
  }
  return words as Partial<T>;
}
