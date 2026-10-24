import type { Field, Fields, LineField } from '../format/field';
import { languagesOf } from './languages';
import type { Line, RecordId, RelatedRecord, Value, Values } from './values';

/**
 * A record as its source gave it, read as its fields hold their values — the one place a loaded record's values come in
 * (form.ts's `load`). Each backend writes values its own way: Django REST and Postgres send decimals as text
 * ("1200.50"), Odoo's `read()` sends `false` for an empty field and a link as `[7, "Nile Traders"]`, a REST API a link
 * as `{ id, name }`. What reads one way only is read so; what cannot be read is named — never guessed, never laid as
 * an empty value the form would then save over what the source holds.
 */

/** A loaded record's values, read: those the form holds, and those it could not read, by field, with why. */
export interface FromSource {
  values: Values;
  /** Each value that could not be read as its field holds one: what it was, in a developer's words ("\"vip,new\" does not read as a many2many"). */
  unreadable: Record<string, string>;
}

const NUMBER = /^\s*-?\d+(\.\d+)?([eE][+-]?\d+)?\s*$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A value shown short in words: what it was, cut where it is long. */
const shown = (raw: unknown) => String(JSON.stringify(raw) ?? raw).slice(0, 40);

/** A link as a backend writes it: `{ id, label }`, Odoo's `[id, "name"]`, or `{ id, name }` / `{ id, display_name }`. */
function readLink(raw: unknown): RelatedRecord | undefined {
  if (Array.isArray(raw) && raw.length === 2 && (typeof raw[0] === 'number' || typeof raw[0] === 'string') && typeof raw[1] === 'string') return { id: raw[0] as RecordId, label: raw[1] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  const id = record['id'];
  if (typeof id !== 'number' && typeof id !== 'string') return undefined;
  if (typeof record['label'] === 'string') return raw as RelatedRecord;
  const name = typeof record['display_name'] === 'string' ? record['display_name'] : record['name'];
  return typeof name === 'string' ? { ...(record as object), id, label: name } as RelatedRecord : undefined;
}

/** A file as a field holds one: its name at least. */
const isFile = (one: unknown) => !!one && typeof one === 'object' && !Array.isArray(one) && typeof (one as { name?: unknown }).name === 'string';

/** A table's records as its lines: Fieldia's own `{ key, id, values }`, or records as a backend sends them, each read; undefined where one cannot be. */
function readLines(field: Extract<Field, { type: 'one2many' }>, raw: unknown[]): Line[] | undefined {
  const lines: Line[] = [];
  for (const [at, one] of raw.entries()) {
    if (!one || typeof one !== 'object' || Array.isArray(one)) return undefined;
    const line = one as Partial<Line> & Record<string, unknown>;
    const own = typeof line.key === 'string' && !!line.values && typeof line.values === 'object';
    const id = line.id as RecordId | undefined;
    const read = valuesFromSource(field.fields as Fields, own ? (line.values as Values) : (one as Values));
    if (Object.keys(read.unreadable).length) return undefined;
    if (!own) delete read.values['id'];
    lines.push({ key: own ? (line.key as string) : id !== undefined ? `id-${id}` : `line-${at + 1}`, ...(id !== undefined ? { id } : {}), values: read.values });
  }
  return lines;
}

/** One value as its field holds it — or undefined, it cannot be read so. */
function readValue(field: Field | LineField, raw: unknown): Value | undefined {
  // Odoo's empty field, of any kind but a yes or no.
  if (raw === null || (raw === false && field.type !== 'boolean')) return null;
  switch (field.type) {
    case 'char':
    case 'text':
    case 'html':
      if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
      // A text in several languages: each language's text by its tag.
      return typeof raw === 'string' || (languagesOf(field) && typeof raw === 'object' && !Array.isArray(raw) && Object.values(raw as object).every((text) => typeof text === 'string')) ? (raw as Value) : undefined;
    case 'integer':
    case 'float':
    case 'monetary':
      // A decimal sent as text, as Django REST and Postgres' numeric send it: only digits, a point and a sign read.
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : typeof raw === 'string' && NUMBER.test(raw) && Number.isFinite(Number(raw)) ? Number(raw) : undefined;
    case 'boolean':
      return typeof raw === 'boolean' ? raw : undefined;
    case 'date':
      return typeof raw === 'string' && DAY.test(raw) ? raw : undefined;
    case 'datetime':
      return typeof raw === 'string' ? raw : undefined;
    case 'selection':
      if (field.multiple) return Array.isArray(raw) && raw.every((one) => typeof one === 'string' || typeof one === 'number') ? (raw as Value) : undefined;
      return typeof raw === 'string' || typeof raw === 'number' ? raw : undefined;
    case 'many2one':
      return readLink(raw);
    case 'many2many': {
      const links = Array.isArray(raw) ? raw.map(readLink) : undefined;
      return links?.every((link) => !!link) ? (links as RelatedRecord[]) : undefined;
    }
    case 'one2many':
      return Array.isArray(raw) ? readLines(field as Extract<Field, { type: 'one2many' }>, raw) : undefined;
    case 'reference':
      return typeof (raw as { model?: unknown } | null)?.model === 'string' && readLink(raw) ? (raw as Value) : undefined;
    case 'binary':
    case 'image':
      return isFile(raw) || (Array.isArray(raw) && raw.every(isFile)) ? (raw as Value) : undefined;
    default:
      // A properties field, a matrix, structured data: as it came.
      return raw as Value;
  }
}

/**
 * A loaded record's values read as the page's fields hold theirs (`valuesFromSource`): numbers sent as text read as
 * numbers, Odoo's `false` as empty, links as `{ id, label }` from Odoo's and REST's shapes, a table's records as its
 * lines; a value of a field the page has not, kept as it came. Each value no field can read so is left out of
 * `values` and named in `unreadable` — what it was and why.
 */
export function valuesFromSource(fields: Fields, loaded: Readonly<Record<string, unknown>>): FromSource {
  const values: Values = {};
  const unreadable: Record<string, string> = {};
  for (const [name, raw] of Object.entries(loaded)) {
    if (raw === undefined) continue;
    const field = Object.prototype.hasOwnProperty.call(fields, name) ? (fields[name] as Field | undefined) : undefined;
    if (!field) {
      values[name] = raw as Value;
      continue;
    }
    const read = readValue(field, raw);
    if (read !== undefined) values[name] = read;
    else unreadable[name] = `${shown(raw)} does not read as a ${field.type}`;
  }
  return { values, unreadable };
}

/**
 * Whether a loaded record is a REST envelope round the record (`{ data: { … } }`, `{ record: { … } }`): one key that
 * is no field of the page, holding an object with fields of it. A load answering so is refused: every field would read
 * empty.
 */
export function envelopeOf(fields: Fields, loaded: Readonly<Record<string, unknown>>): string | null {
  const keys = Object.keys(loaded);
  if (keys.length !== 1 || Object.prototype.hasOwnProperty.call(fields, keys[0])) return null;
  const inner = loaded[keys[0]];
  return inner && typeof inner === 'object' && !Array.isArray(inner) && Object.keys(inner).some((name) => Object.prototype.hasOwnProperty.call(fields, name)) ? keys[0] : null;
}
