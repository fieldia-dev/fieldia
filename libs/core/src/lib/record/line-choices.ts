import type { Field, LineField, Option } from '../format/field';
import { optionsList } from '../format/choice-options';
import type { Value, Values } from './values';

/**
 * A table line's choices from one of the app's lists (`optionsFrom` on a line's selection): which columns have them,
 * what each line's are asked by, and what a line holds that they no longer offer. The form keeps them by the cell's
 * path (`table.key.column`), as it keeps a cell's problems.
 */

/** A table's column whose choices are one of the app's lists. */
export interface ListedColumn {
  table: string;
  column: string;
  def: LineField;
  list: string;
  /** The line's columns its choices change with. */
  own: readonly string[];
  /** The fields of the record the line is on they change with (`parent.` in `dependsOn`). */
  parent: readonly string[];
}

type Choice = Extract<LineField, { type: 'selection' }>;

/** Every table's column whose choices are the app's: none on most pages, and nothing is followed there. */
export function listedColumns(fields: Readonly<Record<string, Field>>): ListedColumn[] {
  const found: ListedColumn[] = [];
  for (const [table, def] of Object.entries(fields)) {
    if (def.type !== 'one2many') continue;
    for (const [column, sub] of Object.entries(def.fields)) {
      const from = sub.type === 'selection' ? optionsList(sub.optionsFrom) : undefined;
      if (!from) continue;
      const on = from.dependsOn ?? [];
      found.push({ table, column, def: sub, list: from.list, own: on.filter((name) => !name.startsWith('parent.')), parent: on.filter((name) => name.startsWith('parent.')).map((name) => name.slice(7)) });
    }
  }
  return found;
}

/** A value as the choices change with it: a link by its id (and model), whatever its name says. */
const keyOf = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(keyOf) : value !== null && typeof value === 'object' && 'id' in value ? [(value as { model?: unknown }).model ?? null, (value as { id: unknown }).id] : (value ?? null);

/** What a line's choices are asked by: its column and the values they change with. Lines with the same share one answer. */
export function askKey(listed: ListedColumn, line: Readonly<Values>, record: Readonly<Values>): string {
  return JSON.stringify([listed.table, listed.column, listed.own.map((name) => keyOf(line[name])), listed.parent.map((name) => keyOf(record[name]))]);
}

/** A line cell's path (`table.key.column`) in its parts — a line's key may hold dots — or null for a field's own name. */
export function cellOf(path: string): { table: string; key: string; column: string } | null {
  const parts = path.split('.');
  return parts.length < 3 ? null : { table: parts[0], key: parts.slice(1, -1).join('.'), column: parts[parts.length - 1] };
}

/** What a choice holds that these options do not offer, an answer of one's own aside where it takes them. */
export function notOffered(def: LineField, value: Value | undefined, options: readonly Option[]): Value[] {
  const choice = def as Choice;
  const offered = new Set(options.map((option) => option.value));
  const own = (v: unknown) => (choice.other === true || choice.ownAnswers === true) && typeof v === 'string' && v.trim() !== '';
  return ([value].flat() as unknown[]).filter((v) => v !== null && v !== undefined && v !== '' && !offered.has(v as string | number) && !own(v)) as Value[];
}
