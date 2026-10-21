import { fill, foldForSearch, isEmpty, readNumber, type Field, type JsonValue, type LineField, type Locale, type Option, type RelatedRecord, type Value, type Values } from '@fieldia/core';

/**
 * A value an app's model proposed, read as its field holds one (the assist part): never taken as it came. Words for
 * words; a number as the page writes one ("15,000,000", "1.5"); yes or no; a choice by its value or its label among
 * those offered; a day as "2026-10-20"; a link as `{ id, label }`, or by its name, looked for exactly as a name typed
 * is (none or several called so, it is not taken, and why is said); links by each; a table's lines, each line's values
 * read so. A value of a kind a proposal does not fill (a file, a picture, a matrix) is not taken.
 */

/** A value read: what the field holds, or why it was not taken, in the person's words. */
export type Read = { value: Value } | { refused: string };

/** The words a refusal says, from the viewer's: a name none or several records have, a choice not offered, a kind not filled. */
export interface ReadWords {
  assistNoneCalled: string;
  assistSeveralCalled: string;
  assistNotOffered: string;
  assistNotRead: string;
}

/** How a proposal's values are read: a link's name looked for (exactly), a choice's options as they are offered now. */
export interface ReadHow {
  locale: Locale;
  words: ReadWords;
  /** The records named exactly so, for a link at `path` (a field, or a table's `field.subfield`). */
  look(path: string, name: string): Promise<RelatedRecord[]>;
  /** A choice's options offered now, at `path`; null where the field's own are all there is. */
  offered?(path: string): readonly Option[] | null;
}

const TEXTS = new Set(['char', 'text', 'html']);
const NUMBERS = new Set(['integer', 'float', 'monetary']);
const DAY = /^\d{4}-\d{2}-\d{2}/;

/** A link as a proposal gives one: `{ id, label }` (a name besides, as `name`), or its name alone. */
const linkOf = (given: unknown): RelatedRecord | string | null => {
  if (typeof given === 'string') return given.trim() ? given.trim() : null;
  if (typeof given === 'number') return { id: given, label: String(given) };
  if (!given || typeof given !== 'object' || Array.isArray(given)) return null;
  const record = given as Record<string, unknown>;
  const id = record['id'];
  const label = record['label'] ?? record['name'];
  if (typeof id === 'number' || (typeof id === 'string' && id)) return { id, label: typeof label === 'string' ? label : String(id) };
  return typeof label === 'string' && label.trim() ? label.trim() : null;
};

/** A link read: given with its id, as it is; by its name, the one record called exactly so. */
async function readLink(given: unknown, path: string, how: ReadHow): Promise<{ value: RelatedRecord } | { refused: string }> {
  const link = linkOf(given);
  if (!link) return { refused: how.words.assistNotRead };
  if (typeof link !== 'string') return { value: link };
  // A source that failed finds none: the name is said, never taken.
  const found = await how.look(path, link).catch((): RelatedRecord[] => []);
  const exact = found.filter((record) => foldForSearch(record.label) === foldForSearch(link));
  const one = exact.length === 1 ? exact[0] : found.length === 1 ? found[0] : null;
  if (one) return { value: { id: one.id, label: one.label } };
  return { refused: fill(found.length ? how.words.assistSeveralCalled : how.words.assistNoneCalled, { name: link }) };
}

/** A number read: a number as it is, words in the page's way; a whole number's whole. */
function readNumberValue(def: Field | LineField, given: unknown, how: ReadHow): Read {
  let number: number | null = typeof given === 'number' && Number.isFinite(given) ? given : null;
  if (typeof given === 'string') {
    const read = readNumber(given, how.locale);
    if (read.ok && read.value !== null) number = read.value;
  }
  if (number === null || (def.type === 'integer' && !Number.isInteger(number))) return { refused: how.words.assistNotRead };
  return { value: number };
}

/** A choice read: by an option's value, or by its label in any case, among those offered now. */
function readChoice(def: Field | LineField, given: unknown, path: string, how: ReadHow): Read {
  const options = how.offered?.(path) ?? (def as { options?: Option[] }).options ?? [];
  const one = (item: unknown): JsonValue | undefined => {
    const byValue = options.find((option) => option.value === item || String(option.value) === String(item));
    if (byValue) return byValue.value;
    const words = typeof item === 'string' ? foldForSearch(item) : null;
    return words ? options.find((option) => foldForSearch(option.label) === words)?.value : undefined;
  };
  const several = (def as { multiple?: boolean }).multiple === true;
  const items = several ? (Array.isArray(given) ? given : [given]) : [given];
  const values = items.map(one);
  const missing = items.find((_, i) => values[i] === undefined);
  if (missing !== undefined || !items.length) return { refused: fill(how.words.assistNotOffered, { name: typeof missing === 'string' ? missing : JSON.stringify(missing ?? null) }) };
  return { value: several ? (values as JsonValue[]) : (values[0] as JsonValue) };
}

/** A proposed value as its field holds one, or why it is not taken. */
export async function readProposed(def: Field | LineField, given: unknown, path: string, how: ReadHow): Promise<Read> {
  if (given === undefined) return { refused: how.words.assistNotRead };
  // Nothing proposed: the field emptied, where it holds something.
  if (given === null || (typeof given === 'string' && !given.trim() && !TEXTS.has(def.type))) return { value: def.type === 'many2many' || def.type === 'one2many' ? [] : null };
  if (TEXTS.has(def.type)) return typeof given === 'string' || typeof given === 'number' ? { value: String(given) } : { refused: how.words.assistNotRead };
  if (NUMBERS.has(def.type)) return readNumberValue(def, given, how);
  switch (def.type) {
    case 'boolean': {
      const words = typeof given === 'string' ? foldForSearch(given) : null;
      if (typeof given === 'boolean') return { value: given };
      if (words === 'true' || words === 'yes') return { value: true };
      if (words === 'false' || words === 'no') return { value: false };
      return { refused: how.words.assistNotRead };
    }
    case 'selection':
      return readChoice(def, given, path, how);
    case 'date':
      return typeof given === 'string' && DAY.test(given) ? { value: given.slice(0, 10) } : { refused: how.words.assistNotRead };
    case 'datetime':
      return typeof given === 'string' && DAY.test(given) && !Number.isNaN(Date.parse(given)) ? { value: new Date(given).toISOString() } : { refused: how.words.assistNotRead };
    case 'many2one':
      return readLink(given, path, how);
    case 'many2many': {
      const items = Array.isArray(given) ? given : [given];
      const read = await Promise.all(items.map((item) => readLink(item, path, how)));
      const refused = read.find((one): one is { refused: string } => 'refused' in one);
      if (refused) return refused;
      const links = (read as { value: RelatedRecord }[]).map((one) => one.value);
      return { value: links.filter((link, i) => links.findIndex((other) => String(other.id) === String(link.id)) === i) };
    }
    default:
      return { refused: how.words.assistNotRead };
  }
}

/** A table's lines proposed, each line's values read by its fields: the lines that read, and why the rest did not. */
export async function readLines(def: Field | LineField, given: unknown, path: string, how: ReadHow): Promise<{ lines: Values[]; refused: string[] }> {
  const fields = (def as { fields?: Record<string, LineField> }).fields ?? {};
  const items = Array.isArray(given) ? given : [];
  const lines: Values[] = [];
  const refused: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    // A line as its values, or as a line is kept ({ key, values }).
    const inner = (item as { values?: unknown }).values;
    const own = inner && typeof inner === 'object' && !Array.isArray(inner) ? (inner as Record<string, unknown>) : (item as Record<string, unknown>);
    const values: Values = {};
    for (const [name, value] of Object.entries(own)) {
      const sub = fields[name];
      if (!sub || sub.type === 'one2many') continue;
      const read = await readProposed(sub, value, `${path}.${name}`, how);
      if ('value' in read) values[name] = read.value;
      else refused.push(`${sub.label}: ${read.refused}`);
    }
    // A line with nothing in it is no line to add.
    if (Object.entries(values).some(([name, value]) => !isEmpty(fields[name], value))) lines.push(values);
  }
  return { lines, refused };
}

/** Two values the same as a field holds them: a link by its record, a list of links by theirs, the rest as written. */
export function sameValue(a: Value | undefined, b: Value | undefined): boolean {
  const key = (value: Value | undefined): string => {
    if (value === undefined || value === null || value === '') return 'null';
    if (Array.isArray(value)) return `[${value.map((item) => key(item as Value)).join(',')}]`;
    if (typeof value === 'object' && 'id' in value) return `#${String((value as { id: unknown }).id)}`;
    return JSON.stringify(value);
  };
  return key(a) === key(b);
}
