import type { Field, FieldNode, LineField, Locale, RelatedRecord, Value, Values } from '@fieldia/core';
import { displayValue } from './display';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import type { WidgetDialogs } from './widgets';

/**
 * A read-only value drawn as its words, as Flectra draws one: a choice by its
 * label without an arrow, an amount with its currency, a date as a person
 * writes it, a link by its record's name (a link that opens it, where the
 * app can show it), a mail, phone or web address as a link to it, and long
 * words wrapped rather than cut at a box's edge. Empty, it is empty.
 */

/** Whether a field drawn this way is shown as words while it is read-only: kinds whose box holds a value, not a table, tags or a file. */
export function readsAsText(field: Field, node: FieldNode): boolean {
  const widget = node.widget;
  switch (field.type) {
    case 'char':
      return !widget || widget === 'email' || widget === 'phone' || widget === 'url';
    case 'selection':
      return !widget && !field.multiple && !field.optionsFrom;
    case 'text':
    case 'integer':
    case 'float':
    case 'monetary':
    case 'date':
    case 'datetime':
    case 'many2one':
    case 'reference':
      return !widget;
    default:
      return false;
  }
}

export interface ReadText {
  element: HTMLElement;
  update(value: Value | undefined, values: Readonly<Values>): void;
}

const ADDRESSES: Record<string, [RegExp, string]> = {
  email: [/^[^\s@]+@[^\s@]+$/, 'mailto:'],
  phone: [/^\+?[\d\s().-]{3,}$/, 'tel:'],
  url: [/^https?:\/\/\S+$/i, ''],
};

export function readText(context: { document: Document; field: Field; node: FieldNode; id: string; locale?: Locale; labels?: WidgetLabels; dialogs?: WidgetDialogs }): ReadText {
  const { document: doc, field, node, locale = 'en', labels = WIDGET_LABELS.en, dialogs } = context;
  const element = doc.createElement('div');
  element.className = 'fd-read-text';
  element.id = `${context.id}-text`;
  const relation = field.type === 'many2one' ? field.relation : null;
  const opens = relation !== null && node.options?.['open'] !== false && !!dialogs?.canOpen(relation);
  let drawn = '';
  return {
    element,
    update(value, values) {
      const words = displayValue(field as LineField, value, values as Record<string, Value>, locale);
      const key = JSON.stringify([words, value ?? null]);
      if (key === drawn) return;
      drawn = key;
      const address = node.widget ? ADDRESSES[node.widget] : undefined;
      if (address && typeof value === 'string' && address[0].test(value.trim())) {
        const link = doc.createElement('a');
        link.href = `${address[1]}${value.trim()}`;
        if (node.widget === 'url') Object.assign(link, { target: '_blank', rel: 'noopener noreferrer' });
        link.textContent = words;
        element.replaceChildren(link);
      } else if (opens && value && typeof value === 'object' && 'id' in value) {
        // The linked record, opened where the app can show it, as Flectra's read-only link.
        const record = value as RelatedRecord;
        const link = doc.createElement('button');
        link.type = 'button';
        link.className = 'fd-read-link';
        link.textContent = words;
        link.setAttribute('aria-label', labels.openNamed.replace('{name}', record.label));
        link.addEventListener('click', () => void dialogs?.openRecord(relation as string, { recordId: record.id, title: record.label }));
        element.replaceChildren(link);
      } else element.textContent = words;
    },
  };
}
