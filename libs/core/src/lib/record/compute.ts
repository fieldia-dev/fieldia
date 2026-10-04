import type { Field, LineField } from '../format/field';
import type { Page } from '../format/page';
import { compileExpression, type CompiledExpression, type ExpressionEnv } from '../expression/expression';
import { isNumber, roundTo, truthy } from '../expression/operations';
import { dependencyOrder } from '../expression/order';
import { expressionEnv } from './env';
import { expressionContext, lineKind, type Line, type Value, type Values } from './values';

/**
 * Values worked out from others: a field's `compute`. A page's own fields are
 * worked out in the order they read each other; a one2many's line fields from
 * the fields of the same line, before the page's own, so a page's sum reads
 * lines already worked out. What does not change keeps its identity, so a
 * form redraws only what did.
 */
export interface Computed {
  /** The values with every worked-out field brought up to date. */
  apply(values: Values): Values;
  /** One line of a one2many with its worked-out fields brought up to date. */
  line(field: string, values: Values): Values;
}

type Step = [name: string, expression: CompiledExpression, def: Field | LineField];

/** The worked-out fields among `fields`, each read once, in the order to work them out. */
function steps(fields: Record<string, Field | LineField>): Step[] {
  const compiled = new Map<string, CompiledExpression>();
  for (const [name, def] of Object.entries(fields)) if (def.compute !== undefined) compiled.set(name, compileExpression(def.compute));
  const { order } = dependencyOrder(new Map([...compiled].map(([name, expression]) => [name, expression.fields])));
  return order.map((name) => [name, compiled.get(name) as CompiledExpression, fields[name]]);
}

/** Whether two values are the same, as they would be saved. */
const same = (a: Value | undefined, b: Value | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * A worked-out value as its field holds it: a whole number rounded, a number
 * to the field's decimals, a number as text in a text field, yes or no by
 * Python's idea of true, and null for what the field cannot hold.
 */
export function fitTo(def: Field | LineField, value: unknown): Value {
  if (def.type === 'boolean') return truthy(value);
  if (value === null || value === undefined) return null;
  switch (def.type) {
    case 'integer':
      return isNumber(value) ? roundTo(value, 0) : null;
    case 'float':
    case 'monetary':
      if (!isNumber(value)) return null;
      return def.digits ? roundTo(value, def.digits[1]) : value;
    case 'char':
    case 'text':
    case 'html':
      return typeof value === 'string' ? value : isNumber(value) ? String(value) : null;
    case 'date':
    case 'datetime':
      return typeof value === 'string' ? value : null;
    default:
      return value as Value;
  }
}

/** Read every `compute` of a page once. `today` is the day `today()` gives. */
export function compileComputed(page: Page, today: () => string): Computed {
  const own = steps(page.fields);
  const lineSteps = new Map<string, { def: Extract<Field, { type: 'one2many' }>; steps: Step[] }>();
  for (const [name, def] of Object.entries(page.fields)) {
    if (def.type !== 'one2many') continue;
    const found = steps(def.fields);
    if (found.length) lineSteps.set(name, { def, steps: found });
  }
  // Lines hold no lines of their own: inside one, only today() needs the env.
  const lineEnv: ExpressionEnv = { today };

  /** Work out the steps on these values, writing each change into a copy. */
  function run(values: Values, list: Step[], fields: Record<string, Field | LineField>, env: ExpressionEnv): Values {
    let next = values;
    const context = expressionContext(values, fields);
    for (const [name, expression, def] of list) {
      const value = fitTo(def, expression.evaluate(context, env));
      if (same(value, next[name])) continue;
      next = { ...next, [name]: value };
      // What comes after reads this value as it is now.
      Object.assign(context, expressionContext({ [name]: value }, fields));
    }
    return next;
  }

  function line(field: string, values: Values): Values {
    const found = lineSteps.get(field);
    // A section or a note has nothing to work out.
    if (!found || lineKind(found.def, values) !== null) return values;
    return run(values, found.steps, found.def.fields, lineEnv);
  }

  return {
    line,
    apply(values) {
      let next = values;
      for (const field of lineSteps.keys()) {
        const current = next[field];
        if (!Array.isArray(current)) continue;
        let changed = false;
        const updated = (current as Line[]).map((l) => {
          const worked = line(field, l.values);
          if (worked === l.values) return l;
          changed = true;
          return { ...l, values: worked };
        });
        if (changed) next = { ...next, [field]: updated };
      }
      if (!own.length) return next;
      return run(next, own, page.fields, expressionEnv(next, page.fields, today));
    },
  };
}
