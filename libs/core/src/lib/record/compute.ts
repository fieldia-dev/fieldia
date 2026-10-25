import type { Field, LineField } from '../format/field';
import type { Page } from '../format/page';
import { compileExpression, type CompiledExpression, type ExpressionEnv } from '../expression/expression';
import { steadyCalls, type FunctionTable } from '../expression/functions';
import { isNumber, roundTo, truthy } from '../expression/operations';
import { dependencyOrder } from '../expression/order';
import { expressionEnv, lineContext, parentReads, readOf, recordContext, sameReads, type About, type AppReads } from './env';
import { expressionContext, lineKind, sameValue, type Line, type Value, type Values } from './values';
import { recomputeInFull, workCounts } from './work';

/**
 * Values worked out from others: a field's `compute`. A page's own fields are
 * worked out in the order they read each other; a one2many's line fields from
 * the fields of the same line, before the page's own, so a page's sum reads
 * lines already worked out. What does not change keeps its identity, so a
 * form redraws only what did.
 */
export interface Computed {
  /**
   * The values with every worked-out field brought up to date. `asked`, when given, is told each worked out from an
   * app's function that asks and has no answer yet, by its path (a line's `field.lineKey.subfield`): waiting for
   * it (`{}`), or why it did not come (`failed`). Such a value is empty meanwhile.
   */
  apply(values: Values, asked?: Map<string, AskedFor>): Values;
  /** One line of a one2many on the record `values`, with its worked-out fields brought up to date. */
  line(field: string, line: Values, values: Values): Values;
}

/** A value worked out from an app's function that asks, with no answer yet: waiting for it, or why it did not come. */
export interface AskedFor {
  failed?: string;
}

/** What waits at a path, or inside it (a table's lines' cells): undefined when nothing does. */
function waitsIn(asked: ReadonlyMap<string, AskedFor>, path: string): AskedFor | undefined {
  const own = asked.get(path);
  if (own) return own;
  for (const [key, found] of asked) if (key.startsWith(`${path}.`)) return found;
  return undefined;
}

type Step = [name: string, expression: CompiledExpression, def: Field | LineField];

/** The worked-out fields among `fields`, each read once, in the order to work them out. */
function steps(fields: Record<string, Field | LineField>, functions?: FunctionTable): Step[] {
  const compiled = new Map<string, CompiledExpression>();
  for (const [name, def] of Object.entries(fields)) if (def.compute !== undefined) compiled.set(name, compileExpression(def.compute, functions));
  const { order } = dependencyOrder(new Map([...compiled].map(([name, expression]) => [name, expression.fields])));
  return order.map((name) => [name, compiled.get(name) as CompiledExpression, fields[name]]);
}

/**
 * The most a value worked out by the page (`compute`, a step's `set`, `setWhen`) may hold: characters of text, items of
 * a list. Past them, none — a page whose values each double the one before (24 of them made 33.5 million characters of
 * one letter typed) stops there, and the next worked out from it holds none too.
 */
export const COMPUTED_MOST = { text: 100_000, items: 10_000 };

/**
 * A worked-out value as its field holds it: a whole number rounded, a number
 * to the field's decimals, a number as text in a text field, yes or no by
 * Python's idea of true, and null for what the field cannot hold — or for more
 * than a page may work out (`COMPUTED_MOST`).
 */
export function fitTo(def: Field | LineField, value: unknown): Value {
  if (def.type === 'boolean') return truthy(value);
  if (value === null || value === undefined) return null;
  if ((typeof value === 'string' && value.length > COMPUTED_MOST.text) || (Array.isArray(value) && value.length > COMPUTED_MOST.items)) return null;
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

/**
 * Read every `compute` of a page once. `today` is the day `today()` gives; `about`, the record's id and the person, as
 * lines read them on `parent`; `app`, the app's functions and the answers of those that ask.
 */
export function compileComputed(page: Page, today: () => string, about: () => About = () => ({ recordId: null }), app: AppReads = {}): Computed {
  const own = steps(page.fields, app.functions);
  const lineSteps = new Map<string, { def: Extract<Field, { type: 'one2many' }>; steps: Step[] }>();
  for (const [name, def] of Object.entries(page.fields)) {
    if (def.type !== 'one2many') continue;
    const found = steps(def.fields, app.functions);
    if (found.length) lineSteps.set(name, { def, steps: found });
  }
  // Lines hold no lines of their own: inside one, only today() and the app's functions need the env.
  const lineEnv: ExpressionEnv = { ...app, today };
  /** Whether each change is worked out in full (`recomputeInFull`), as the form was made: nothing kept below. */
  const full = recomputeInFull();
  /** What each of the record's own worked-out values was last worked out from — the values it reads — and what it held after. */
  const last = new Map<Step, { reads: unknown[]; value: Value }>();
  /**
   * Lines whose values are worked out already, each with what its expressions read of its record then: worked out
   * again, they give the same object. Only for a table whose every value is worked out from its fields alone (`steady`).
   */
  const settledLines = new WeakMap<Values, unknown[]>();
  /** What each table's lines read of their record (`parent.x`), by name; null where one reads it whole. */
  const linesRead = new Map<string, string[] | null>();
  for (const [name, { steps: list }] of lineSteps) linesRead.set(name, list.some(([, expression]) => parentReads(expression.paths) === null) ? null : [...new Set(list.flatMap(([, expression]) => parentReads(expression.paths) ?? []))]);
  /** Whether every step of a list gives the same for the same values it reads: none calling today(), the app's own… */
  const steady = (list: Step[]) => list.every(([, expression]) => steadyCalls(expression.calls));

  /** A value worked out, and whether it waits for an app's answer, or why that did not come. */
  function worked(expression: CompiledExpression, context: Record<string, unknown>, env: ExpressionEnv): { value: unknown; asked?: AskedFor } {
    const answer = env.answer;
    if (!answer) return { value: expression.evaluate(context, env) };
    let asked: AskedFor | undefined;
    const value = expression.evaluate(context, {
      ...env,
      answer(key, promise) {
        const found = answer(key, promise);
        if (found === 'asking') asked ??= {};
        else if (found?.failed !== undefined) asked = { failed: found.failed };
        return found;
      },
    });
    return asked ? { value, asked } : { value };
  }

  /**
   * Work out the steps on these values, writing each change into a copy; `read` gives the values as expressions read
   * them; `at`, the path a value's waiting is told by (a line's `field.lineKey.`). `reads`, for the record's own: what a
   * step reads by name, so one whose reads are those it was last worked out from, and that holds what it gave then, is
   * not worked out again — it would give the same.
   */
  function run(values: Values, list: Step[], fields: Record<string, Field | LineField>, env: () => ExpressionEnv, read: (values: Values) => Record<string, unknown>, asked?: Map<string, AskedFor>, at = '', reads?: (values: Values, name: string) => unknown): Values {
    let next = values;
    // Made as the first step is worked out: the values as expressions read them, kept up to date as steps change them.
    let context: Record<string, unknown> | null = null;
    let envNow: ExpressionEnv | null = null;
    for (const step of list) {
      const [name, expression, def] = step;
      // Worked out from a value that waits — a field, or a table's line — it waits as that one does.
      const from = asked?.size ? expression.fields.map((field) => waitsIn(asked, at + field)).find((one) => one !== undefined) : undefined;
      const keeps = !full && reads && steadyCalls(expression.calls);
      if (keeps) {
        const kept = last.get(step);
        if (kept && kept.value === next[name] && sameReads(kept.reads, expression.fields.map((field) => reads(next, field)))) {
          // Nothing it reads changed, and it holds what it gave: it would give the same, and wait as it did — for what it reads.
          if (from) asked?.set(at + name, from);
          continue;
        }
      }
      context ??= read(next);
      envNow ??= env();
      workCounts.computes++;
      const found = worked(expression, context, envNow);
      const waits = found.asked ?? from;
      if (waits) asked?.set(at + name, waits);
      const value = fitTo(def, found.value);
      const same = sameValue(value, next[name]);
      if (keeps && reads) last.set(step, { reads: expression.fields.map((field) => reads(next, field)), value: same ? (next[name] as Value) : value });
      if (same) continue;
      next = { ...next, [name]: value };
      // What comes after reads this value as it is now.
      Object.assign(context, expressionContext({ [name]: value }, fields));
    }
    return next;
  }

  function line(field: string, values: Values, parent: () => Record<string, unknown>, asked?: Map<string, AskedFor>, at = ''): Values {
    const found = lineSteps.get(field);
    // A section or a note has nothing to work out.
    if (!found || lineKind(found.def, values) !== null) return values;
    return run(values, found.steps, found.def.fields, () => lineEnv, (v) => lineContext(v, found.def.fields, parent()), asked, at);
  }

  return {
    line: (field, values, record) => line(field, values, () => recordContext(record, page.fields, about())),
    apply(values, asked) {
      let next = values;
      // The record as its lines read it, and what of it each table's lines read: made once a line asks for them.
      let parent: Record<string, unknown> | null = null;
      let aboutNow: About | null = null;
      const aboutOnce = () => (aboutNow ??= about());
      const record = () => (parent ??= recordContext(values, page.fields, aboutOnce()));
      for (const field of lineSteps.keys()) {
        const current = next[field];
        if (!Array.isArray(current)) continue;
        const names = linesRead.get(field);
        // A line worked out already, its record read alike, gives the same object: it is not worked out again.
        const keeps = !full && names !== null && names !== undefined && steady(lineSteps.get(field)!.steps);
        const reads = keeps ? names.map((name) => readOf(values, page.fields, name, aboutOnce)) : [];
        let changed = false;
        const updated = (current as Line[]).map((l) => {
          const kept = keeps ? settledLines.get(l.values) : undefined;
          if (kept && sameReads(kept, reads)) return l;
          const worked = line(field, l.values, record, asked, `${field}.${l.key}.`);
          if (keeps) settledLines.set(worked, reads);
          if (worked === l.values) return l;
          changed = true;
          return { ...l, values: worked };
        });
        if (changed) next = { ...next, [field]: updated };
      }
      if (!own.length) return next;
      const start = next;
      return run(next, own, page.fields, () => expressionEnv(start, page.fields, today, app), (v) => recordContext(v, page.fields, aboutOnce()), asked, '', (v, name) => readOf(v, page.fields, name, aboutOnce));
    },
  };
}
