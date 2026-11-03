import type { Field, LineField } from '../format/field';
import { expressionEnv, lineContext, recordContext } from './env';
import { firstValues, readValueMap, type MapScope } from './value-map';
import { initialValues, structuredCopy, type Line, type Values } from './values';

type AnyFields = Record<string, Field | LineField>;

/** Where a new record's first values are worked out: its values, as its expressions read them, on `today`. */
function scopeOf(values: Values, fields: AnyFields, today: string, parent?: MapScope['parent']): MapScope {
  const record = recordContext(parent?.values ?? values, parent?.fields ?? fields, { recordId: null });
  const context = parent ? lineContext(values, fields as Record<string, LineField>, record) : record;
  return { values, fields, context, env: expressionEnv(values, fields, () => today), ...(parent ? { parent } : {}) };
}

/** What a new record starts with, or a new line on `parent`: each field's default, then what its `defaultFrom` works out. */
function starting(fields: AnyFields, today: string, parent?: MapScope['parent']): Values {
  const values = initialValues(fields, today);
  return { ...values, ...firstValues(fields, scopeOf(values, fields, today, parent)) };
}

/** The fields among `fields` a copy does not keep (`copy: false`). */
const notKept = (fields: AnyFields) => Object.keys(fields).filter((name) => fields[name].copy === false);

/**
 * A record's values as its copy holds them (a data source's `copy`): every value kept, but a field's that says
 * `copy: false`, which starts as a new record's does — its `default`, or what its `defaultFrom` works out over a new
 * record's values, never the one copied — else empty; and in each line of a table, a line field that says it starts as
 * a new line's does on the copy, its record's `lineDefaults` too. The memory source copies so, as a server does with
 * Odoo's `copy=False`. `today`: the day a `"today"` default is. The values given are never changed.
 */
export function copiedValues(values: Values, fields: Record<string, Field>, today: string): Values {
  const copy = structuredCopy(values);
  const own = notKept(fields);
  if (own.length) {
    const fresh = starting(fields, today);
    for (const name of own) copy[name] = fresh[name] ?? null;
  }
  for (const [name, def] of Object.entries(fields)) {
    if (def.type !== 'one2many' || !Array.isArray(copy[name])) continue;
    const lineFields = def.fields as Record<string, LineField>;
    const lines = notKept(lineFields);
    if (!lines.length) continue;
    // A new line of the copy: its fields' first values, then what the record's lineDefaults work out over the copy.
    const parent = { values: copy, fields };
    const fresh = starting(lineFields, today, parent);
    if (def.lineDefaults) Object.assign(fresh, readValueMap(def.lineDefaults, lineFields, scopeOf(copy, fields, today)));
    copy[name] = (copy[name] as Line[]).map((line) => ({ ...line, values: { ...line.values, ...Object.fromEntries(lines.map((field) => [field, structuredCopy(fresh[field] ?? null)])) } }));
  }
  return copy;
}
