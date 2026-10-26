import { plainPart, plainWords, splitValues, type Fields, type LineField, type Locale, type Value, type Values } from '@fieldia/core';
import { displayValue } from '@fieldia/widgets';

/** How a value is written inside words: `displayValue`'s way, or another's (a sentence's, the answers part's). */
export type ValueWriter = (def: LineField, value: Value | undefined, values: Record<string, Value>) => string;

/**
 * Words that hold fields' values — "Entries before {lock_date} cannot be
 * posted." — drawn as text with each value in a span of its own, written as
 * the field shows it (or as `write` writes it: a sentence's way), and brought
 * up to date as the record changes; an empty one says its words while empty
 * ({branch|this branch}), drawn as the words round it.
 */
export function valueWords(doc: Document, fields: Fields, text: string, locale: Locale, write?: ValueWriter): { nodes: (Node | string)[]; update(values: Readonly<Values>): void } {
  const parts = splitValues(text);
  if (!parts.some((part) => part.field)) return { nodes: [plainWords(text)], update: () => undefined };
  const values: { field: string; span: HTMLElement; fallback?: string }[] = [];
  const nodes = parts.map((part) => {
    if (!part.field) return part.text;
    // Set apart from the words round it, so a date or an amount keeps its own order on a page read right to left.
    const span = doc.createElement('bdi');
    span.className = 'fd-value';
    span.dataset['field'] = part.field;
    values.push({ field: part.field, span, fallback: part.fallback });
    return span;
  });
  return {
    nodes,
    update(record) {
      for (const { field, span, fallback } of values) {
        const def = fields[field];
        const value = record[field] as Value | undefined;
        const words = !def ? '' : write ? write(def as LineField, value, record as Record<string, Value>) : displayValue(plainPart(def) as LineField, value, record as Record<string, Value>, locale);
        const shown = words || (fallback ?? '');
        if (span.textContent !== shown) span.textContent = shown;
        span.toggleAttribute('data-empty', !words && !!fallback);
      }
    },
  };
}

/** Words that name something: a letter or a digit in them — never "", "/" (a draft invoice's number) or "—". */
export const named = (words: string): boolean => /[\p{L}\p{N}]/u.test(words);

/**
 * A printout's own words (a page's `print.header` or `footer`), a line at a time: each line a box of its own, and one
 * whose `{field}` is empty — or holds no letter or digit, as a draft invoice's "/" — left out whole, never "quoting .
 * Thank you".
 */
export function printWords(doc: Document, fields: Fields, text: string, locale: Locale): { nodes: Node[]; update(values: Readonly<Values>): void } {
  const lines = text.split('\n').map((line) => {
    const words = valueWords(doc, fields, line, locale);
    const box = doc.createElement('span');
    box.className = 'fd-print-line';
    box.append(...words.nodes);
    return { box, words, values: [...box.querySelectorAll<HTMLElement>('.fd-value')] };
  });
  return {
    nodes: lines.map((line) => line.box),
    update(record) {
      for (const line of lines) {
        line.words.update(record);
        line.box.hidden = line.values.some((value) => !named(value.textContent ?? ''));
      }
    },
  };
}
