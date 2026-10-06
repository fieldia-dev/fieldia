import type { Field, LineField } from '../format/field';
import { FIELD_NAME } from '../format/names';
import { compileExpression, type CompiledExpression } from '../expression/expression';
import type { ExpressionEnv } from '../expression/functions';
import { fitTo } from './compute';
import { structuredCopy, type RecordId, type RelatedRecord, type Value, type Values } from './values';

/**
 * Where a value map — a new line's values, a field's first value, what a
 * record made from a link starts with — is read: the values it reads, as
 * they are and as expressions read them, the record above a line, and the
 * person.
 */
export interface MapScope {
  values: Values;
  fields: Record<string, Field | LineField>;
  /** The values as expressions read them: `id`, `user`, and on a line `parent`. */
  context: Record<string, unknown>;
  env: ExpressionEnv;
  /** On a line, its record's values as they are, for `parent.x` taken whole. */
  parent?: { values: Values; fields: Record<string, Field | LineField> };
  user?: { id: RecordId | null; name?: string };
  /** The name the form knows a record of `relation` by. */
  labelOf?(relation: string, id: RecordId): string | undefined;
}

const expressions = new Map<string, CompiledExpression>();
function expression(source: string): CompiledExpression {
  let found = expressions.get(source);
  if (!found) expressions.set(source, (found = compileExpression(source)));
  return found;
}

/**
 * One value read: a field named alone taken whole — a link with its name,
 * the lines themselves — `parent.x` the record's field whole, `user` the
 * person as a link, anything else the expression's value.
 */
export function readSource(source: string, scope: MapScope): unknown {
  const name = source.trim();
  if (FIELD_NAME.test(name) && name in scope.fields) return structuredCopy(scope.values[name]);
  if (name === 'user' && !('user' in scope.fields)) return scope.user?.id == null ? null : { id: scope.user.id, label: scope.user.name ?? String(scope.user.id) };
  const above = /^parent\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(name);
  if (above && scope.parent && above[1] in scope.parent.fields) return structuredCopy(scope.parent.values[above[1]]);
  return expression(source).evaluate(scope.context, scope.env);
}

/** A value read for a field: a link from a record or an id, named as the form knows it; anything else fitted to the field. */
export function fitValue(def: Field | LineField, raw: unknown, scope: MapScope): Value {
  if (def.type !== 'many2one' && def.type !== 'many2many') return fitTo(def, raw);
  const link = (item: unknown): RelatedRecord | null => {
    if (item === null || item === undefined || item === false || item === '') return null;
    if (typeof item === 'number' || typeof item === 'string') return { id: item, label: scope.labelOf?.(def.relation, item) ?? String(item) };
    if (typeof item === 'object' && !Array.isArray(item) && 'id' in item) {
      const record = item as { id: RecordId; label?: unknown };
      return { id: record.id, label: typeof record.label === 'string' ? record.label : (scope.labelOf?.(def.relation, record.id) ?? String(record.id)) };
    }
    return null;
  };
  if (def.type === 'many2one') return link(Array.isArray(raw) ? raw[0] : raw);
  return (Array.isArray(raw) ? raw : [raw]).map(link).filter((record): record is RelatedRecord => record !== null);
}

/** A map read for fields it fills: each value fitted to its field. */
export function readValueMap(map: Record<string, string>, into: Record<string, Field | LineField>, scope: MapScope): Values {
  const values: Values = {};
  for (const [name, source] of Object.entries(map)) {
    const def = into[name];
    if (def) values[name] = fitValue(def, readSource(source, scope), scope);
  }
  return values;
}

/** A map read for another page's fields, unknown here: each value as read, plain JSON. */
export function readLooseMap(map: Record<string, string>, scope: MapScope): Values {
  const values: Values = {};
  for (const [name, source] of Object.entries(map)) values[name] = (readSource(source, scope) ?? null) as Value;
  return values;
}

/** The fields among `fields` that start with a worked-out value, read for a new record or line. */
export function firstValues(fields: Record<string, Field | LineField>, scope: MapScope): Values {
  const values: Values = {};
  for (const [name, def] of Object.entries(fields)) {
    if (def.defaultFrom !== undefined) values[name] = fitValue(def, readSource(def.defaultFrom, scope), scope);
  }
  return values;
}
