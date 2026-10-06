import type { Field, LineField } from '../format/field';
import type { ExpressionEnv } from '../expression/functions';
import { expressionContext, lineKind, type Line, type RecordId, type Values } from './values';

/**
 * What expressions read besides a record's fields: `id`, the record's id
 * (null while it is new), and `user`, the person using the form (`id`,
 * `name`, `roles`). A page's own field of the same name comes first.
 */
export function builtIns(fields: Record<string, unknown>, recordId: RecordId | null, user: { id: RecordId | null; name?: string; roles?: readonly string[] } | undefined): Record<string, unknown> {
  const names: Record<string, unknown> = {
    id: recordId ?? null,
    user: { id: user?.id ?? null, name: user?.name ?? null, roles: [...(user?.roles ?? [])] },
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
}

/** The record as expressions read it: its values, its `id` and `user`. What a line reads as `parent`. */
export function recordContext(values: Values, fields: Record<string, Field | LineField>, about: About): Record<string, unknown> {
  return { ...builtIns(fields, about.recordId, about.user), ...expressionContext(values, fields) };
}

/**
 * A line as its expressions read it: its values, `parent` — the record it is
 * on, as that record's expressions read it — and `user`. A line field of the
 * same name comes first.
 */
export function lineContext(values: Values, fields: Record<string, LineField>, parent: Record<string, unknown>): Record<string, unknown> {
  const names: Record<string, unknown> = { parent, user: parent['user'] ?? builtIns({}, null, undefined)['user'] };
  for (const name of Object.keys(names)) if (name in fields) delete names[name];
  return { ...names, ...expressionContext(values, fields) };
}

export function expressionEnv(values: Values, fields: Record<string, Field | LineField>, today: () => string): ExpressionEnv {
  const rows = new Map<string, Record<string, unknown>[]>();
  return {
    today,
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
