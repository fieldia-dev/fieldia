import type { Page } from './page';

/**
 * Keys whose text a person reads: titles, labels, help, prompts, messages, a printout's header and footer, why a
 * field is locked and why an answer does not fit its pattern, an ending's button (`again`). (What a page's records are called, `records`, is read
 * too: see `walk`.)
 * Any key ending in `Label` is read too — a wizard's `nextLabel`, and in a
 * widget's settings the words at a scale's ends.
 */
const TEXT_KEYS = new Set(['title', 'description', 'label', 'help', 'header', 'footer', 'placeholder', 'message', 'text', 'confirm', 'alt', 'caption', 'tooltip', 'unit', 'readonlyReason', 'patternHint', 'again']);

/** In a widget's settings, words besides those ending in `Label`: a links box's help and its empty box's link. */
const WIDGET_TEXT_KEYS = new Set(['help', 'emptyLink']);

/** A formatted text's kinds of record to link (`references`): each one's name is words; its key, model and icon stay. */
const wordsOfReference = (text: (words: string) => string) => (reference: unknown) =>
  reference !== null && typeof reference === 'object' && typeof (reference as { label?: unknown }).label === 'string' ? { ...reference, label: text((reference as { label: string }).label) } : reference;

/**
 * Parts that hold names or data, never words to translate: which line fields
 * mark sections and notes, a link's filter, a default value, what the page's
 * data is, and the page's translations themselves; and the maps by field name
 * — a table's optional columns, a step's values and answers, a call's params —
 * where a field may well be called `description` or `title`; and a list's
 * map, whose pin `label` and card `title` name fields (a map's layers too,
 * but for each layer's own `label`, which is words); and a list's calendar,
 * whose `title` names a field too, and its Gantt timeline's; and a list's card, whose `title` and
 * `subtitle` name fields, as its map card's do.
 */
const NOT_TEXT = new Set(['lineKinds', 'filter', 'default', 'data', 'translations', 'optionalColumns', 'values', 'into', 'params', 'map', 'calendar', 'gantt']);

/** A part of a card's line: the words after its value are words ("m²", "beds", each plural form); its field stays. */
const wordsOfPart = (text: (words: string) => string) => (part: unknown) => {
  if (part === null || typeof part !== 'object' || Array.isArray(part)) return part;
  const unit = (part as { unit?: unknown }).unit;
  if (typeof unit === 'string') return { ...part, unit: text(unit) };
  if (unit === null || typeof unit !== 'object') return part;
  return { ...part, unit: Object.fromEntries(Object.entries(unit).map(([form, words]) => [form, typeof words === 'string' ? text(words) : words])) };
};

/** A map's card: only the words after its lines' values; the rest names fields. */
const wordsOfCard = (text: (words: string) => string) => (owner: unknown) => {
  if (owner === null || typeof owner !== 'object') return owner;
  const card = (owner as { card?: { fields?: unknown } }).card;
  if (!card || !Array.isArray(card.fields)) return owner;
  const part = wordsOfPart(text);
  return { ...owner, card: { ...card, fields: card.fields.map((line: unknown) => (Array.isArray(line) ? line.map(part) : part(line))) } };
};

/** A map's layer: its own label is words, and its card's units; the rest names fields and layers, and stays as it is. */
const wordsOfLayer = (text: (words: string) => string) => (layer: unknown) => {
  const named = layer !== null && typeof layer === 'object' && typeof (layer as { label?: unknown }).label === 'string' ? { ...layer, label: text((layer as { label: string }).label) } : layer;
  return wordsOfCard(text)(named);
};

/**
 * Every word a person reads in `value` passed through `text`, the rest copied
 * as it is. `enter` sees each object before its parts. In a widget's settings
 * (`widget`) only the keys ending in `Label`, and a few that are always words (`WIDGET_TEXT_KEYS`), are words.
 */
function walk(value: unknown, key: string | null, text: (words: string) => string, enter?: (node: Record<string, unknown>) => void, widget = false): unknown {
  if (typeof value === 'string') return key !== null && (key.endsWith('Label') || (widget ? WIDGET_TEXT_KEYS : TEXT_KEYS).has(key)) ? text(value) : value;
  if (Array.isArray(value)) return value.map((item) => walk(item, null, text, enter, widget));
  if (value === null || typeof value !== 'object') return value;
  enter?.(value as Record<string, unknown>);
  const out: Record<string, unknown> = {};
  for (const [name, inner] of Object.entries(value)) {
    // A field node's `options` are its widget's settings, not a list of choices.
    if (name === 'layers' && Array.isArray(inner)) out[name] = inner.map(wordsOfLayer(text));
    else if (widget && name === 'references' && Array.isArray(inner)) out[name] = inner.map(wordsOfReference(text));
    // A list's map names fields, but for the words after its card's values.
    else if (name === 'map' && inner !== null && typeof inner === 'object' && !Array.isArray(inner)) out[name] = wordsOfCard(text)(inner);
    // A list's card names fields too, but for the words after its lines' values.
    else if (name === 'card' && inner !== null && typeof inner === 'object' && !Array.isArray(inner)) out[name] = (wordsOfCard(text)({ card: inner }) as { card: unknown }).card;
    // A head's link: the words after its number, each plural form ("Comment", "Comments"); a list's filters' own names, by
    // field; what a page's records are called ("customer", "customers", "a customer").
    else if ((name === 'words' || name === 'filterLabels' || name === 'records') && inner !== null && typeof inner === 'object' && !Array.isArray(inner)) out[name] = Object.fromEntries(Object.entries(inner).map(([form, words]) => [form, typeof words === 'string' ? text(words) : words]));
    else out[name] = NOT_TEXT.has(name) ? inner : walk(inner, name, text, enter, widget || (name === 'options' && !Array.isArray(inner)));
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
        for (const [part, name] of [[node, 'label'], [def, 'label'], [node, 'placeholder'], [node, 'help'], [def, 'help'], [node, 'readonlyReason']] as const) visit(part[name], name);
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

/** What parts a list of names, as a sentence writes them: ", ", or the Arabic comma "، " in a language written in Arabic's script (Arabic, Persian, Urdu). */
export const listComma = (tag: string): string => (/^(ar|fa|ur)(-|$)/i.test(tag) ? '\u060c ' : ', ');

/** A text's words, as a person reads them out: letters and digits, in the language's lower case. */
const wordsOf = (text: string, tag: string): string[] => text.toLocaleLowerCase(tag).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * A control's name holding the words it shows (WCAG 2.5.3, label in name): a person who sees "Sat 24" on a button and
 * says "click Sat 24" reaches it, and a screen reader still hears the whole of it. The name as it is when its words hold
 * what is shown, one after another; else the name, then what is shown — "Saturday 24 October, Sat 24" — or, `first`,
 * what is shown, then the name: "15K, 15,076 here. Zoom in to see them."
 */
export function nameShowing(name: string, shown: string, tag: string, first = false): string {
  const seen = wordsOf(shown, tag);
  if (!seen.length) return name;
  const said = wordsOf(name, tag);
  for (let at = 0; at + seen.length <= said.length; at++) if (seen.every((word, i) => said[at + i] === word)) return name;
  return first ? `${shown}${listComma(tag)}${name}` : `${name}${listComma(tag)}${shown}`;
}
