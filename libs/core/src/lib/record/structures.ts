import type { Field } from '../format/field';
import type { FieldNode } from '../format/layout';
import { fill, type Messages } from './messages';
import type { Value } from './values';

/**
 * What a structure's widget asks of its answer beyond Required: an address
 * (`json.address`) its parts in `options.requiredParts` filled — the first
 * missing one named — and a table of lines or a repeating group as few lines
 * as `options.min` and as many as `options.max`, once it has any. Undefined
 * when it keeps them, or when there is nothing to check.
 */

/** An address's parts, in the order its boxes and its messages name them. */
export const ADDRESS_PARTS = ['street', 'line2', 'city', 'region', 'postcode', 'country'] as const;

export function checkStructure(field: Field, node: FieldNode, value: Value | undefined, messages: Messages): string | undefined {
  const options = node.options ?? {};
  const label = node.label ?? field.label;
  if (field.type === 'one2many' && Array.isArray(value) && value.length) {
    if (typeof options['min'] === 'number' && value.length < options['min']) return fill(messages.minLines, { label, min: options['min'] });
    if (typeof options['max'] === 'number' && value.length > options['max']) return fill(messages.maxLines, { label, max: options['max'] });
  }
  const needed = options['requiredParts'];
  if (node.widget !== 'address' || !Array.isArray(needed) || !value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const asked = Array.isArray(options['parts']) ? options['parts'] : ADDRESS_PARTS;
  const parts = value as Record<string, unknown>;
  const missing = ADDRESS_PARTS.findIndex((part) => needed.includes(part) && asked.includes(part) && !String(parts[part] ?? '').trim());
  return missing < 0 ? undefined : fill(messages.required, { label: messages.addressParts.split('|')[missing] });
}
