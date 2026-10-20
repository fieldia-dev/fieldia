import type { Field, LineField } from '../format/field';
import type { JsonValue } from '../format/json';
import { dayOf } from './limits';

/**
 * The values a form holds while someone edits it. Plain JSON, so a draft can
 * be stored and a record handed to any data source.
 */

export type RecordId = number | string;

/** A related record, as a many2one or many2many holds it: enough to show it. */
export interface RelatedRecord {
  id: RecordId;
  label: string;
  /**
   * What a link may show of the record besides its name, when the data source
   * gives it: the person's picture (an address or a data: URI), its colour as
   * Flectra numbers them (1 to 11; 0 or none for no colour), lines under its
   * name such as an address, and — for a stage — whether it is folded.
   */
  avatar?: string;
  color?: number;
  details?: string;
  folded?: boolean;
  /** For a record of a tree (an area, an iteration): the names from the top down to it, its own last — ["Portal", "Sprint 14"]. */
  path?: string[];
  /** Words at the end of its row in a picker, such as an iteration's dates "3/25/2026 - 4/16/2026". */
  aside?: string;
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
  /** A signature typed rather than drawn: the name typed, kept beside its picture. */
  text?: string;
  /**
   * A stored file's id, where its source keeps files as records of their own
   * (Flectra's attachments): from the data source's `upload`. Not `id`, which
   * would read as a link wherever a value is taken by its shape.
   */
  fileId?: RecordId;
  /** A signature that signs answers (its node's `options.signs`): when, by whom and the fingerprint of what it signed. */
  signed?: SignatureEvidence;
  /** A photo set's words under a photo (`"widget": "photos"`, `options.captions`), as a person typed them. */
  caption?: string;
  /**
   * A photo of a photo set cropped or turned (`"widget": "photos"`): the photo as it was before — its link, or its
   * bytes where files travel inside the record — kept unless the page's `options.keepOriginal` is false. A crop again
   * starts from it; Put back the original makes it the photo again. It holds no `original` of its own.
   */
  original?: FileValue;
  /** What was done to `original` to make this photo: the turn, then the part kept. */
  edit?: PhotoEdit;
}

/**
 * A photo cropped or turned in a photo set, as done to its original: turned clockwise by `turn` degrees, then the part
 * `crop` names kept — its left, top, width and height as fractions (0 to 1) of the turned photo's width and height.
 */
export interface PhotoEdit {
  turn: 0 | 90 | 180 | 270;
  crop: { x: number; y: number; width: number; height: number };
}

/**
 * What a signature that signs answers keeps beside its picture: who signed, when, which answers, and the SHA-256 of
 * those answers and of who and when, written in the canonical form `format` names (`signatureText` in
 * @fieldia/core, documented in its README), so an app can work the fingerprint out again from the record it keeps.
 * While it is kept, the answers it names are locked; taken away, they can be changed and signed again.
 */
export interface SignatureEvidence {
  /** The canonical form the fingerprint was made in: "fieldia-signature/1". */
  format: string;
  /** Who signed, as named: the field the page names for the signer, the name typed on the pad, or the person signed in. */
  by?: string;
  /** When, as an instant in ISO 8601 (UTC), by the form's clock: "2026-10-19T08:42:00.000Z". */
  at: string;
  /** The answers signed, by field name, in the page's order: those its `signs` names that were shown as it was signed. */
  fields: string[];
  /** The fingerprint: SHA-256 of the canonical text, in small hexadecimal letters. */
  sha256: string;
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

/** A fresh record: each field's default, or its empty value. A date's default may be a day counted from `today` ("today", "today+1"). */
export function initialValues(fields: Record<string, AnyField>, today?: string): Values {
  const values: Values = {};
  for (const [name, field] of Object.entries(fields)) {
    const start = field.default;
    values[name] = start === undefined ? emptyValue(field) : field.type === 'date' && typeof start === 'string' && start.startsWith('today') ? dayOf(start, today) : structuredCopy(start);
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
