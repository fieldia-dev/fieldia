import type { Field } from '../format/field';
import type { FieldNode } from '../format/layout';
import { foldDigits, stripMarks } from './input-rules';
import { fill, fillMessage, type Messages } from './messages';
import type { Value } from './values';
import { intlFormat } from '../intl-format';

/**
 * What a structure's widget asks of its answer beyond Required: an address
 * (`json.address`) its parts in `options.requiredParts` filled — the first
 * missing one named — and its postcode of its country's shape where that is
 * known; and a table of lines or a repeating group as few lines as
 * `options.min` and as many as `options.max`, once it has any. Undefined when
 * it keeps them, or when there is nothing to check.
 */

/** An address's parts, in the order its boxes and its messages name them. */
export const ADDRESS_PARTS = ['street', 'line2', 'city', 'region', 'postcode', 'country'] as const;

/**
 * A postcode's shape by its country, where it is known: how many digits, and
 * one as the country writes it. Egypt's, Saudi Arabia's, Kuwait's and
 * Jordan's have five; Bahrain's three or four; Oman's three. Others are not
 * checked.
 */
const POSTCODES: Record<string, { least: number; most: number; example: string }> = {
  EG: { least: 5, most: 5, example: '11511' },
  SA: { least: 5, most: 5, example: '12271' },
  KW: { least: 5, most: 5, example: '13001' },
  JO: { least: 5, most: 5, example: '11118' },
  BH: { least: 3, most: 4, example: '317' },
  OM: { least: 3, most: 3, example: '112' },
};

/** A postcode as it is kept: digits in any script as 0-9, no direction marks, no spaces at its ends. */
export const settledPostcode = (text: string) => foldDigits(stripMarks(text)).trim();

/** Whether a postcode is of its country's shape: null when the country's shape is not known, or there is no postcode. */
export function postcodeFits(country: unknown, postcode: unknown): boolean | null {
  const shape = typeof country === 'string' ? POSTCODES[country.toUpperCase()] : undefined;
  if (!shape || typeof postcode !== 'string' || !postcode.trim()) return null;
  const digits = settledPostcode(postcode);
  return /^[0-9]+$/.test(digits) && digits.length >= shape.least && digits.length <= shape.most;
}

/** A country's name in a language, by its code: Egypt, مصر, Égypte, Ägypten. */
function countryName(code: string, locale: string): string {
  try {
    return intlFormat('DisplayNames', [locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function checkStructure(field: Field, node: FieldNode, value: Value | undefined, messages: Messages): string | undefined {
  const options = node.options ?? {};
  const label = node.label ?? field.label;
  if (field.type === 'one2many' && Array.isArray(value) && value.length) {
    if (typeof options['min'] === 'number' && value.length < options['min']) return fillMessage(messages, messages.minLines, { label, min: options['min'] });
    if (typeof options['max'] === 'number' && value.length > options['max']) return fillMessage(messages, messages.maxLines, { label, max: options['max'] });
  }
  const needed = Array.isArray(options['requiredParts']) ? options['requiredParts'] : [];
  if (node.widget !== 'address' || !value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const asked = Array.isArray(options['parts']) ? options['parts'] : ADDRESS_PARTS;
  const parts = value as Record<string, unknown>;
  const missing = ADDRESS_PARTS.findIndex((part) => needed.includes(part) && asked.includes(part) && !String(parts[part] ?? '').trim());
  if (missing >= 0) return fill(messages.required, { label: messages.addressParts.split('|')[missing] });
  if (postcodeFits(parts['country'], parts['postcode']) !== false) return undefined;
  const country = String(parts['country']).toUpperCase();
  const shape = POSTCODES[country];
  const n = shape.least === shape.most ? shape.least : `${shape.least}–${shape.most}`;
  return fillMessage(messages, messages.postcode, { label, country: countryName(country, messages.locale), n, example: shape.example });
}
