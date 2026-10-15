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

/**
 * Give Fieldia a language's own words, for every page shown in it from then
 * on. The packages have English, Arabic, German and French already; the
 * one-tag script has English alone, and its add-on scripts — `fieldia.ar.js`,
 * `fieldia.de.js`, `fieldia.fr.js` — call this with theirs. A language given
 * again takes the new words.
 */
export function addLanguage(locale: Locale, words: LanguageWords): void {
  MESSAGES[locale] = { ...MESSAGES.en, ...ownCounts(words.messages, MESSAGES.en) };
  WIDGET_LABELS[locale] = { ...WIDGET_LABELS.en, ...ownCounts(words.widgets, WIDGET_LABELS.en) };
  VIEWER_LABELS[locale] = { ...VIEWER_LABELS.en, ...ownCounts(words.viewer, VIEWER_LABELS.en) };
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
