import { LINK_URL, safeUrl, foldDigits, languagesOf, stripMarks, webAddress, type Field, type FieldNode, type LineField, type Locale, type Page, type RelatedRecord, type Value, type Values } from '@fieldia/core';
import { phoneSettings } from './phone-settings';
import { cellText } from './display';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import type { WidgetDialogs } from './widgets';
import { detailLines, linkAvatar } from './link-avatar';

/**
 * A read-only value drawn as its words, as Flectra draws one: a choice by its
 * label without an arrow, an amount with its currency, a date as a person
 * writes it, a link by its record's name (a link that opens it, where the
 * app can show it), a mail, phone or web address as a link to it, and long
 * words wrapped rather than cut at a box's edge. Empty, it is empty.
 */

/**
 * Whether a field drawn this way is shown as words while it is read-only: kinds whose box holds a value, not a table,
 * tags or a file. A phone its `page` reads the world over shows itself so, with its links (the phone part).
 */
export function readsAsText(field: Field, node: FieldNode, page?: Pick<Page, 'phone'>): boolean {
  const widget = node.widget;
  // A text in several languages keeps its switch while it is read, to read each.
  if (languagesOf(field)) return false;
  switch (field.type) {
    case 'char':
      if (widget === 'phone' && phoneSettings(page, node.options)) return false;
      return !widget || widget === 'email' || widget === 'phone' || widget === 'url';
    case 'selection':
      return !widget && !field.multiple && !field.optionsFrom;
    case 'text':
    case 'integer':
    case 'float':
      // Hours and per cents read as their widgets write them: 06:30, 35%.
      return !widget || widget === 'duration' || widget === 'percentage';
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

/**
 * The link a mail, phone or web address read-only goes to, or null when it is
 * none: a number dialled in 0-9 whatever script it was typed in, an address
 * without its direction marks, a web address typed without https:// given
 * it — and never a link of another kind (javascript:, data:), nor a link
 * kept as an address (mailto:mailto:…).
 */
function hrefOf(widget: string | undefined, value: string): string | null {
  const text = stripMarks(value).trim();
  // An address with a ":" before its @ (a link's "mailto:" kept from outside) is none: never mailto:mailto:….
  if (widget === 'email') return /^[^\s@()<>[\]:;\\,"]+@[^\s@]+$/.test(text) ? `mailto:${text}` : null;
  if (widget === 'phone') {
    const number = foldDigits(text);
    return /^\+?[\d\s().-]{3,}$/.test(number) ? `tel:${number.replace(/\s/g, '')}` : null;
  }
  if (widget === 'url' && webAddress(text) === 'ok') return /^https?:\/\//i.test(text) ? text : `https://${text}`;
  return null;
}

/** A number's unit around it, as its box shows it inside — "3.00 Days" — and nothing round an empty one. */
function withUnit(words: string, field: Field, node: FieldNode, value: Value | undefined): string {
  if ((field.type !== 'integer' && field.type !== 'float') || node.widget || value === null || value === undefined || words === '') return words;
  const unit = (key: 'prefix' | 'suffix') => (typeof node.options?.[key] === 'string' ? (node.options[key] as string).trim() : '');
  return [unit('prefix'), words, unit('suffix')].filter(Boolean).join(' ');
}

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
      const words = withUnit(cellText(field as LineField, value, values as Record<string, Value>, locale, undefined, { widget: node.widget, options: node.options }), field, node, value);
      const key = JSON.stringify([words, value ?? null]);
      if (key === drawn) return;
      drawn = key;
      const href = field.type === 'char' && typeof value === 'string' ? hrefOf(node.widget, value) : null;
      const record = relation !== null && value && typeof value === 'object' && 'id' in value ? (value as RelatedRecord) : null;
      let main: Node;
      if (href) {
        const link = doc.createElement('a');
        link.href = safeUrl(href, LINK_URL) ?? '';
        if (node.widget === 'url') Object.assign(link, { target: '_blank', rel: 'noopener noreferrer' });
        link.textContent = words;
        main = link;
      } else if (opens && record) {
        // The linked record, opened where the app can show it, as Flectra's read-only link.
        const link = doc.createElement('button');
        link.type = 'button';
        link.className = 'fd-read-link';
        link.textContent = words;
        link.setAttribute('aria-label', labels.openNamed.replace('{name}', record.label));
        link.addEventListener('click', () => void dialogs?.openRecord(relation as string, { recordId: record.id, title: record.label }));
        main = link;
      } else main = doc.createTextNode(words);
      // A link's picture before its name, and lines of it — an address — under it, when the page asks.
      const picture = record && node.options?.['avatar'] === true ? [linkAvatar(doc, record)] : [];
      const lines: HTMLElement[] = [];
      if (record?.details?.trim() && node.options?.['details'] === true) {
        const box = doc.createElement('div');
        box.className = 'fd-link-details';
        detailLines(box, record.details.trim());
        lines.push(box);
      }
      element.replaceChildren(...picture, main, ...lines);
    },
  };
}
