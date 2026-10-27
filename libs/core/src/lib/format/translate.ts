import type { Page } from './page';
import { literalWords, plainWords } from './words';

/**
 * Keys whose text a person reads: titles, labels, help, prompts, messages, a printout's header and footer, why a
 * field is locked and why an answer does not fit its pattern, an ending's button (`again`). (What a page's records are called, `records`, is read
 * too: see `walk`.)
 * Any key ending in `Label` is read too — a wizard's `nextLabel`, and in a
 * widget's settings the words at a scale's ends.
 */
export const TEXT_KEYS = new Set(['title', 'description', 'label', 'help', 'header', 'footer', 'placeholder', 'message', 'text', 'confirm', 'alt', 'caption', 'tooltip', 'unit', 'readonlyReason', 'patternHint', 'again']);

/** In a widget's settings, words besides those ending in `Label`: a links box's help and its empty box's link, a picture's words for who cannot see it. */
export const WIDGET_TEXT_KEYS = new Set(['help', 'emptyLink', 'alt']);

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
export const NOT_TEXT = new Set(['lineKinds', 'filter', 'default', 'data', 'translations', 'optionalColumns', 'values', 'into', 'params', 'map', 'calendar', 'gantt']);

/** Parts whose every value is words, by a name of their own: plural forms, a list's filters' names, what records are called. */
export const WORDS_BY_NAME = new Set(['words', 'filterLabels', 'records']);

/**
 * Maps whose every key is a name — a field's, a choice's value — never a setting: the fields of a page, of a table's
 * lines, of a link's table and of a list; a list's cells and filter ranges; the steps run as a field changes or shows
 * (`on.change`, `on.show`); what a link's new record and a new line start with; a kind's looks, a dot's colours and
 * what a scan fills, by value or field. Each entry is a part of its own whatever it is called, so a field named
 * `values`, `default`, `options` or `label` keeps its words. Every map of the format is one of these, of `NOT_TEXT`
 * (data by name) or of `WORDS_BY_NAME`: setting-names.spec.ts finds them all in the format's JSON Schema.
 */
export const NAME_MAPS = new Set(['fields', 'cells', 'filterRanges', 'change', 'show', 'createValues', 'lineDefaults', 'looks', 'colours', 'fills']);

/** A formatted text's kinds of record to link (`references`): each one's name is words; its key, model and icon stay. */
const wordsOfReference = (text: (words: string) => string) => (reference: unknown) =>
  reference !== null && typeof reference === 'object' && typeof (reference as { label?: unknown }).label === 'string' ? { ...reference, label: text((reference as { label: string }).label) } : reference;

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
 * (`widget`) only the keys ending in `Label`, and a few that are always words (`WIDGET_TEXT_KEYS`), are words. The
 * one list of a page's words: what is translated, what a translator works through, what `literalPage` writes to show
 * as it is and `plainPart` reads. A part `kept` says to keep is copied as it is.
 */
function walk(value: unknown, key: string | null, text: (words: string) => string, enter?: (node: Record<string, unknown>) => void, widget = false, kept?: (part: object) => boolean): unknown {
  if (typeof value === 'string') return key !== null && (key.endsWith('Label') || (widget ? WIDGET_TEXT_KEYS : TEXT_KEYS).has(key)) ? text(value) : value;
  if (value === null || typeof value !== 'object' || kept?.(value)) return value;
  if (Array.isArray(value)) return value.map((item) => walk(item, null, text, enter, widget, kept));
  enter?.(value as Record<string, unknown>);
  const out: Record<string, unknown> = {};
  for (const [name, inner] of Object.entries(value)) {
    const object = inner !== null && typeof inner === 'object' && !Array.isArray(inner);
    if (inner !== null && typeof inner === 'object' && kept?.(inner)) out[name] = inner;
    // A map by name: each key a name, whatever it is (a field called `values`), each entry a part of its own.
    else if (NAME_MAPS.has(name) && object) out[name] = Object.fromEntries(Object.entries(inner).map(([named, part]) => [named, walk(part, null, text, enter, widget, kept)]));
    // A field node's `options` are its widget's settings, not a list of choices.
    else if (name === 'layers' && Array.isArray(inner)) out[name] = inner.map(wordsOfLayer(text));
    else if (widget && name === 'references' && Array.isArray(inner)) out[name] = inner.map(wordsOfReference(text));
    // A list's map names fields, but for the words after its card's values.
    else if (name === 'map' && object) out[name] = wordsOfCard(text)(inner);
    // A list's card names fields too, but for the words after its lines' values.
    else if (name === 'card' && object) out[name] = (wordsOfCard(text)({ card: inner }) as { card: unknown }).card;
    // A head's link: the words after its number, each plural form ("Comment", "Comments"); a list's filters' own names, by
    // field; what a page's records are called ("customer", "customers", "a customer"); a quiz question's feedback, when its
    // answer is right and when it is wrong.
    else if ((WORDS_BY_NAME.has(name) || (name === 'feedback' && key === 'quiz')) && object) out[name] = Object.fromEntries(Object.entries(inner).map(([form, words]) => [form, typeof words === 'string' ? text(words) : words]));
    else out[name] = NOT_TEXT.has(name) ? inner : walk(inner, name, text, enter, widget || (name === 'options' && !Array.isArray(inner)), kept);
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
 * The page with every word a person reads written to show exactly as it is, with no value and nothing for the page check
 * to refuse (`literalWords`) — for a page an app fills with words it did not write. Its translations are written so too,
 * so each still finds its words. Names, ids, choice values, conditions, addresses and data stay as they are.
 */
export function literalPage(page: Page): Page {
  const literal = walk(page, null, literalWords) as Page;
  if (!page.translations) return literal;
  const translations = Object.fromEntries(Object.entries(page.translations).map(([locale, words]) => [locale, Object.fromEntries(Object.entries(words).map(([from, to]) => [literalWords(from), literalWords(to)]))]));
  return { ...literal, translations };
}

/** Each part `plainPart` made, and every part inside it: its words read already, never read again. */
const READ = new WeakSet<object>();

/** Every object and array in a value `plainPart` made: read already. */
function readAlready(value: unknown) {
  if (value === null || typeof value !== 'object' || READ.has(value)) return;
  READ.add(value);
  for (const inner of Object.values(value)) readAlready(inner);
}

/**
 * A part of a page — a field, a layout node, the page — with every word a person reads in it as it shows where it shows
 * no value (`plainWords`: `\{list}` reads "{list}"): for what draws a part's words as they are. The part itself where
 * none of its words escapes a brace. Read once: a part it gave, or one inside it, is given back as it is.
 */
export function plainPart<T>(part: T): T {
  if (part === null || typeof part !== 'object' || READ.has(part)) return part;
  let changed = false;
  const plain = walk(
    part,
    null,
    (words) => {
      const shown = plainWords(words);
      changed ||= shown !== words;
      return shown;
    },
    undefined,
    false,
    (inner) => READ.has(inner)
  );
  if (!changed) return part;
  readAlready(plain);
  return plain as T;
}

/**
 * A part as a page writes it, for what reads its words again — a dialog's own page of fields: one `plainPart` made has
 * its words written back with `literalWords`, so they show as they did; any other part as it is.
 */
export function writtenPart<T>(part: T): T {
  return part !== null && typeof part === 'object' && READ.has(part) ? (walk(part, null, literalWords) as T) : part;
}

/** A part whose words were read already — a choice's options with their answers filled in: `plainPart` gives it as it is. */
export function wordsRead<T>(part: T): T {
  readAlready(part);
  return part;
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
