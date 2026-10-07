import { splitValues, type Fields, type LineField, type Locale, type Value, type Values } from '@fieldia/core';
import { displayValue } from '@fieldia/widgets';

/**
 * Words that hold fields' values — "Entries before {lock_date} cannot be
 * posted." — drawn as text with each value in a span of its own, written as
 * the field shows it, and brought up to date as the record changes.
 */
export function valueWords(doc: Document, fields: Fields, text: string, locale: Locale): { nodes: (Node | string)[]; update(values: Readonly<Values>): void } {
  const parts = splitValues(text);
  if (!parts.some((part) => part.field)) return { nodes: [text], update: () => undefined };
  const values: { field: string; span: HTMLElement }[] = [];
  const nodes = parts.map((part) => {
    if (!part.field) return part.text;
    // Set apart from the words round it, so a date or an amount keeps its own order on a page read right to left.
    const span = doc.createElement('bdi');
    span.className = 'fd-value';
    span.dataset['field'] = part.field;
    values.push({ field: part.field, span });
    return span;
  });
  return {
    nodes,
    update(record) {
      for (const { field, span } of values) {
        const def = fields[field];
        const words = def ? displayValue(def as LineField, record[field] as Value | undefined, record as Record<string, Value>, locale) : '';
        if (span.textContent !== words) span.textContent = words;
      }
    },
  };
}
