import { MESSAGES, type Locale, type Messages } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetLabels } from '@fieldia/widgets';
import { VIEWER_LABELS, type ViewerLabels } from './labels';

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
  MESSAGES[locale] = { ...MESSAGES.en, ...ownCounts(words.messages, MESSAGES.en) };
  WIDGET_LABELS[locale] = { ...WIDGET_LABELS.en, ...ownCounts(words.widgets, WIDGET_LABELS.en) };
  VIEWER_LABELS[locale] = { ...VIEWER_LABELS.en, ...ownCounts(words.viewer, VIEWER_LABELS.en) };
}

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
    for (const [key, word] of Object.entries(english)) if (!Object.prototype.hasOwnProperty.call(table, key)) (table as Record<string, unknown>)[key] = own[key] ?? word;
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
    for (const count of ['One', 'Two', 'Many']) if (`${key}${count}` in english && !(`${key}${count}` in given)) words[`${key}${count}`] = value;
  }
  return words as Partial<T>;
}
