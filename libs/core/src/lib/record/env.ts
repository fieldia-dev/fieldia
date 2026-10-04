import type { Field, LineField } from '../format/field';
import type { ExpressionEnv } from '../expression/functions';
import { expressionContext, lineKind, type Line, type Values } from './values';

/**
 * What an expression on a record is worked out with besides its values: the
 * rows of each one2many for `sum` and `count` — the items, not the sections
 * and notes between them — and today's date for `today()`.
 */
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
