import type { Page } from './page';

/**
 * Keys whose text a person reads: titles, labels, help, prompts and messages.
 * Any key ending in `Label` is read too — a wizard's `nextLabel`, and in a
 * widget's settings the words at a scale's ends.
 */
const TEXT_KEYS = new Set(['title', 'description', 'label', 'help', 'placeholder', 'message', 'text', 'confirm', 'alt', 'caption', 'tooltip', 'unit']);

/**
 * Parts that hold names or data, never words to translate: which line fields
 * mark sections and notes, a link's filter, a default value, what the page's
 * data is, and the page's translations themselves; and the maps by field name
 * — a table's optional columns, a step's values and answers, a call's params —
 * where a field may well be called `description` or `title`.
 */
const NOT_TEXT = new Set(['lineKinds', 'filter', 'default', 'data', 'translations', 'optionalColumns', 'values', 'into', 'params']);

/**
 * Every word a person reads in `value` passed through `text`, the rest copied
 * as it is. `enter` sees each object before its parts. In a widget's settings
 * (`widget`) only the keys ending in `Label` are words.
 */
function walk(value: unknown, key: string | null, text: (words: string) => string, enter?: (node: Record<string, unknown>) => void, widget = false): unknown {
  if (typeof value === 'string') return key !== null && (key.endsWith('Label') || (!widget && TEXT_KEYS.has(key))) ? text(value) : value;
  if (Array.isArray(value)) return value.map((item) => walk(item, null, text, enter, widget));
  if (value === null || typeof value !== 'object') return value;
  enter?.(value as Record<string, unknown>);
  const out: Record<string, unknown> = {};
  for (const [name, inner] of Object.entries(value)) {
    // A field node's `options` are its widget's settings, not a list of choices.
    out[name] = NOT_TEXT.has(name) ? inner : walk(inner, name, text, enter, widget || (name === 'options' && !Array.isArray(inner)));
  }
  return out;
}

/**
 * The page with every word a person reads passed through the app's own
 * translator, for apps that keep their translations by text or by key. Ids,
 * field names, choice values, conditions and data stay as they are; the page
 * given is left alone.
 */
export function translatePage(page: Page, translate: (text: string) => string): Page {
  return walk(page, null, translate) as Page;
}

/**
 * Every word of the page a person reads, once each, in the order they read
 * it: the title and description, then each part of the layout — a field where
 * it stands, with its label, the words in its box, its help, its choices and
 * its messages — a wizard's buttons under its pages, and last the words of
 * fields no part shows. The same words `translatePage` translates: the list a
 * translator works through.
 */
export function pageWords(page: Page): string[] {
  const words = new Set<string>();
  const fields = page.fields as Record<string, Record<string, unknown>>;
  const visit = (value: unknown, key: string | null = null): unknown =>
    walk(
      value,
      key,
      (text) => (text.trim() && words.add(text), text),
      (node) => {
        // A wizard's pages before its buttons.
        if (node['type'] === 'wizard') visit(node['children']);
        const def = node['type'] === 'field' ? fields[node['field'] as string] : undefined;
        if (!def) return;
        for (const [part, name] of [[node, 'label'], [def, 'label'], [node, 'placeholder'], [node, 'help'], [def, 'help']] as const) visit(part[name], name);
        visit(def);
      }
    );
  visit({ title: page.title, description: page.description, layout: page.layout });
  visit(page);
  return [...words];
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

/**
 * Whether a language is written right to left, by its tag: the script it
 * names (`az-Arab`), or else its language (`ar`, `he`, `fa-IR`).
 */
export function isRightToLeft(tag: string): boolean {
  const [language, ...rest] = tag.toLowerCase().split('-');
  const script = rest.find((part) => part.length === 4 && !/\d/.test(part));
  return script ? /^(arab|hebr|syrc|thaa|nkoo|adlm|rohg)$/.test(script) : /^(ar|he|iw|fa|ur|ps|sd|yi|dv|ckb|ug|ks|syr|prs|pnb|azb)$/.test(language);
}
