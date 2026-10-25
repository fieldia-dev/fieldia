import type { Field, LineField } from '../format/field';
import type { ExpressionEnv } from '../expression/functions';
import type { JsonValue } from '../format/json';
import { expressionContext, lineKind, type Line, type RecordId, type Values } from './values';

/**
 * What expressions read besides a record's fields: `id`, the record's id
 * (null while it is new), `user`, the person using the form (`id`, `name`,
 * `roles`), `editing`, whether the record is being edited — false while
 * a view shows it locked, to be read, as Flectra's oe_edit_only and
 * oe_read_only — and `context`, the values the app passes in, as Flectra's
 * context. A page's own field of the same name comes first.
 */
export function builtIns(
  fields: Record<string, unknown>,
  recordId: RecordId | null,
  user: { id: RecordId | null; name?: string; roles?: readonly string[] } | undefined,
  editing = true,
  context: Readonly<Record<string, JsonValue>> = {},
  parent?: Record<string, unknown>
): Record<string, unknown> {
  const names: Record<string, unknown> = {
    id: recordId ?? null,
    user: { id: user?.id ?? null, name: user?.name ?? null, roles: [...(user?.roles ?? [])] },
    editing,
    context,
    // A line's own form reads the record the line is on, as a line does.
    ...(parent ? { parent } : {}),
  };
  for (const name of Object.keys(names)) if (name in fields) delete names[name];
  return names;
}

/**
 * What an expression on a record is worked out with besides its values: the
 * rows of each one2many for `sum` and `count` — the items, not the sections
 * and notes between them — and today's date for `today()`.
 */
/** The record's id and the person, for what is worked out away from the form. */
export interface About {
  recordId: RecordId | null;
  user?: { id: RecordId | null; name?: string; roles?: readonly string[] };
  /** Whether the record is being edited; true unless said. */
  editing?: boolean;
  /** The values the app passes in (the form's `context`). */
  context?: Readonly<Record<string, JsonValue>>;
  /** For a line's own form: the record the line is on, as expressions read it. */
  parent?: Record<string, unknown>;
}

/** The record as expressions read it: its values, its `id` and `user`. What a line reads as `parent`. */
export function recordContext(values: Values, fields: Record<string, Field | LineField>, about: About): Record<string, unknown> {
  return { ...builtIns(fields, about.recordId, about.user, about.editing, about.context, about.parent), ...expressionContext(values, fields) };
}

/**
 * A line as its expressions read it: its values, `parent` — the record it is
 * on, as that record's expressions read it — and `user`. A line field of the
 * same name comes first.
 */
export function lineContext(values: Values, fields: Record<string, LineField>, parent: Record<string, unknown>, id: RecordId | null = null): Record<string, unknown> {
  // The line's own id, empty until it is saved: Flectra's readonly="id" on a saved line.
  // The app's values a line reads are its record's.
  const names: Record<string, unknown> = { parent, user: parent['user'] ?? builtIns({}, null, undefined)['user'], id, context: parent['context'] ?? {} };
  for (const name of Object.keys(names)) if (name in fields) delete names[name];
  return { ...names, ...expressionContext(values, fields) };
}

/** What stays the same for a form's life among what an expression reads: the person, the app's context, a line's record. */
export const STILL: unique symbol = Symbol('still');

/**
 * What an expression on a record reads by a name it reads (its `fields`), as these values hold it: a field's value —
 * the same object while it is unchanged, as every write keeps the values it does not touch — or the built-in's (`id`,
 * `editing`); the rest is the same for the form's life (`STILL`). Two reads alike, the expression gives the same.
 */
export function readOf(values: Values, fields: Record<string, unknown>, name: string, about: () => About): unknown {
  if (name in fields || Object.prototype.hasOwnProperty.call(values, name)) return values[name];
  if (name === 'id') return about().recordId ?? null;
  if (name === 'editing') return about().editing ?? true;
  return STILL;
}

/**
 * What a line's expressions read of the record the line is on, by the paths they read (`parent.state`): its names'
 * values, as `readOf` gives them; null where one reads the record whole (`parent` alone), which nothing then keeps.
 */
export function parentReads(paths: readonly string[]): string[] | null {
  const names: string[] = [];
  for (const path of paths) {
    if (path === 'parent') return null;
    if (!path.startsWith('parent.')) continue;
    const name = path.split('.')[1];
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/** Whether two lists of what was read are the same, one by one. */
export function sameReads(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** What a form hands every expression of the app's own: its functions, and the answers of those that ask (`ExpressionEnv`). */
export type AppReads = Pick<ExpressionEnv, 'functions' | 'answer'>;

/** The name of the record a link field holds: a currency's "EGP". */
export function nameIn(values: Values, field: string): string | undefined {
  const value = values[field];
  return value !== null && typeof value === 'object' && !Array.isArray(value) && typeof (value as { label?: unknown }).label === 'string' ? (value as { label: string }).label : undefined;
}

export function expressionEnv(values: Values, fields: Record<string, Field | LineField>, today: () => string, app: AppReads = {}): ExpressionEnv {
  const rows = new Map<string, Record<string, unknown>[]>();
  return {
    ...app,
    today,
    nameOf: (field) => nameIn(values, field),
    lines(name) {
      const def = fields[name];
      if (def?.type !== 'one2many') return undefined;
      let found = rows.get(name);
      if (!found) {
        const items = ((values[name] as Line[] | null) ?? []).filter((line) => lineKind(def, line.values) === null);
        found = items.map((line) => expressionContext(line.values, def.fields));
        rows.set(name, found);
      }
      return found;
    },
  };
}
