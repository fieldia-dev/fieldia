import type { Field } from '../format/field';
import type { FieldNode } from '../format/layout';
import { fill, type Messages } from './messages';
import { checkStructure } from './structures';
import type { Value } from './values';

/**
 * What a text field's widget asks of its answer, besides the field's own
 * rules: an email, a web address (example.com, www.example.com or https://…),
 * a phone number (a plus, digits, spaces, dots, dashes and brackets, 7 to 15
 * digits), a time of day (HH:MM, between the node's `min` and `max`), and no
 * more keywords than the node's `max` — and the structures' own, from
 * `structures`. Undefined when it keeps them, or when there is nothing to
 * check: an empty answer is `required`'s to judge.
 */
const FORMATS: Record<string, RegExp> = {
  email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  url: /^(https?:\/\/)?([\p{L}\p{N}-]+\.)+\p{L}{2,}(:\d+)?([/?#]\S*)?$/iu,
  phone: /^\+?[\p{Nd}\s.()-]+$/u,
  time: /^([01]\d|2[0-3]):[0-5]\d$/,
};

export function checkInput(field: Field, node: FieldNode, value: Value | undefined, messages: Messages): string | undefined {
  const widget = node.widget ?? '';
  // A bar a person types into keeps to its own range — its options' min and max, else the field's, else 0 to 100 —
  // so the bar and its box never disagree. A maximum read from another field (maxField) is the bar's alone.
  if (widget === 'progressbar' && node.options?.['editable'] === true && typeof value === 'number' && (field.type === 'integer' || field.type === 'float' || field.type === 'monetary')) {
    const options = node.options;
    const label = node.label ?? field.label;
    const min = typeof options['min'] === 'number' ? options['min'] : (field.min ?? 0);
    const max = typeof options['maxField'] === 'string' ? undefined : typeof options['max'] === 'number' ? options['max'] : (field.max ?? 100);
    if (value < min) return fill(messages.min, { label, min });
    if (max !== undefined && value > max) return fill(messages.max, { label, max });
  }
  if (field.type !== 'char') return checkStructure(field, node, value, messages);
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const text = value.trim();
  const options = node.options ?? {};
  const label = node.label ?? field.label;
  const format = FORMATS[widget];
  const digits = text.match(/\p{Nd}/gu)?.length ?? 0;
  if (format && (!format.test(text) || (widget === 'phone' && (digits < 7 || digits > 15)))) return messages[widget as 'email'];
  if (widget === 'time') {
    if (typeof options['min'] === 'string' && text < options['min']) return fill(messages.before, { label, min: options['min'] });
    if (typeof options['max'] === 'string' && text > options['max']) return fill(messages.after, { label, max: options['max'] });
  }
  if (widget === 'tags' && typeof options['max'] === 'number') {
    const count = text.split(typeof options['separator'] === 'string' && options['separator'] ? options['separator'] : ',').filter((t) => t.trim()).length;
    if (count > options['max']) return fill(messages.atMost, { label, max: options['max'] });
  }
  return undefined;
}
