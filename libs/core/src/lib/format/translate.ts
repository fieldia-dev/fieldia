import type { Page } from './page';

/** Keys whose text a person reads: titles, labels, help, prompts, messages and a wizard's buttons. */
const TEXT_KEYS = new Set(['title', 'description', 'label', 'help', 'placeholder', 'message', 'text', 'confirm', 'nextLabel', 'backLabel', 'finishLabel', 'alt']);

/**
 * Parts that hold names or data, never words to translate: which line fields
 * mark sections and notes, a link's filter, a default value, a widget's options,
 * and what the page's data is.
 */
const NOT_TEXT = new Set(['lineKinds', 'filter', 'default', 'data']);

/**
 * The page with every word a person reads passed through the app's own
 * translator, for apps that keep their translations by text or by key. Ids,
 * field names, choice values, conditions and data stay as they are; the page
 * given is left alone.
 */
export function translatePage(page: Page, translate: (text: string) => string): Page {
  const walk = (value: unknown, key: string | null): unknown => {
    if (typeof value === 'string') return key !== null && TEXT_KEYS.has(key) ? translate(value) : value;
    if (Array.isArray(value)) return value.map((item) => walk(item, null));
    if (value === null || typeof value !== 'object') return value;
    const out: Record<string, unknown> = {};
    for (const [name, inner] of Object.entries(value)) {
      // A field node's `options` are its widget's settings, not a list of choices.
      const widgetOptions = name === 'options' && !Array.isArray(inner);
      out[name] = NOT_TEXT.has(name) || widgetOptions ? inner : walk(inner, name);
    }
    return out;
  };
  return walk(page, null) as Page;
}

/**
 * The page in one of the languages it keeps in `translations`: every word a
 * person reads that has a translation there, translated; the rest as written.
 * A language the page does not keep gives the page as it is.
 */
export function localizePage(page: Page, locale: string): Page {
  const words = page.translations?.[locale] ?? page.translations?.[locale.split('-')[0]];
  if (!words) return page;
  return translatePage(page, (text) => words[text] ?? text);
}
