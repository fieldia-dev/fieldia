import type { Field, LineField } from '../format/field';
import type { JsonValue } from '../format/json';

/**
 * The values a form holds while someone edits it. Plain JSON, so a draft can
 * be stored and a record handed to any data source.
 */

export type RecordId = number | string;

/** A related record, as a many2one or many2many holds it: enough to show it. */
export interface RelatedRecord {
  id: RecordId;
  label: string;
}

/** A reference points at a record of one of several models. */
export interface ReferenceValue {
  model: string;
  id: RecordId;
  label: string;
}

/** An uploaded or stored file. `data` is base64; `url` is where a stored one lives. */
export interface FileValue {
  name: string;
  type: string;
  size: number;
  data?: string;
  url?: string;
}

/**
 * One line of a one2many. `key` is stable for the life of the form, so a line
 * keeps its identity while it is edited; `id` is the saved record's id, absent
 * until the line is saved.
 */
export interface Line {
  key: string;
  id?: RecordId;
  values: Values;
}

export type Value =
  | JsonValue
  | RelatedRecord
  | RelatedRecord[]
  | ReferenceValue
  | FileValue
  | FileValue[]
  | Line[];

export type Values = Record<string, Value>;

type AnyField = Field | LineField;

/** What a field holds before anyone types in it. */
export function emptyValue(field: AnyField): Value {
  switch (field.type) {
    case 'boolean':
      return false;
    case 'many2many':
    case 'one2many':
      return [];
    case 'selection':
    case 'binary':
    case 'image':
      return field.multiple ? [] : null;
    default:
      return null;
  }
}

/** A fresh record: each field's default, or its empty value. */
export function initialValues(fields: Record<string, AnyField>): Values {
  const values: Values = {};
  for (const [name, field] of Object.entries(fields)) {
    values[name] = field.default !== undefined ? structuredCopy(field.default) : emptyValue(field);
  }
  return values;
}

/** Nothing worth keeping: no value, blank text, or an empty list. Numbers and booleans never are. */
export function isEmpty(field: AnyField, value: Value | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  // A matrix with no row answered is not answered at all.
  if (field.type === 'matrix' && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every((a) => a === null || a === undefined || (Array.isArray(a) && !a.length));
  }
  return false;
}

/**
 * The values as modifiers read them, matching what backends write in their
 * expressions: a many2one is its id, a many2many its ids, a reference
 * "model,id", a file its name — several files their names — and lines a list
 * (so `not child_ids` works).
 */
export function expressionContext(values: Values, fields: Record<string, AnyField>): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(values)) {
    const field = fields[name];
    context[name] = field ? forExpressions(field, value) : value;
  }
  return context;
}

function forExpressions(field: AnyField, value: Value): unknown {
  if (value === null || value === undefined) return null;
  switch (field.type) {
    case 'many2one':
      return (value as RelatedRecord).id;
    case 'many2many':
      return (value as RelatedRecord[]).map((record) => record.id);
    case 'one2many':
      return (value as Line[]).map((line) => line.key);
    case 'reference': {
      const ref = value as ReferenceValue;
      return `${ref.model},${ref.id}`;
    }
    case 'binary':
    case 'image':
      return Array.isArray(value) ? (value as FileValue[]).map((file) => file.name) : (value as FileValue).name;
    default:
      return value;
  }
}

/**
 * What a line of a one2many is: a section heading, a note, or (null) an item.
 * Lines only have kinds when the field declares `lineKinds`.
 */
export function lineKind(field: Extract<Field, { type: 'one2many' }>, values: Values): 'section' | 'note' | null {
  const kinds = field.lineKinds;
  if (!kinds) return null;
  const value = values[kinds.field];
  if (value === (kinds.section ?? 'section')) return 'section';
  if (value === (kinds.note ?? 'note')) return 'note';
  return null;
}

/** Whether two values are the same, as they would be saved: a missing value is an empty one. */
export function sameValue(a: Value | undefined, b: Value | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** A deep copy of plain JSON. */
export function structuredCopy<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
