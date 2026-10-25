import type { Field, LineField, SetWhen } from '../format/field';
import type { Page } from '../format/page';
import { compileExpression, type CompiledExpression, type ExpressionEnv } from '../expression/expression';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import { fitTo } from './compute';
import { expressionEnv, lineContext, parentReads, readOf, recordContext, sameReads, type About, type AppReads } from './env';
import { steadyCalls, type FunctionTable } from '../expression/functions';
import { lineKind, sameValue, type Line, type Value, type Values } from './values';
import { recomputeInFull, workCounts } from './work';

/**
 * Values set when a condition starts to hold: a field's `setWhen`. A rule acts
 * only as its condition goes from not holding to holding — so people may
 * still change the value afterwards — and rules act in the order the field
 * lists them. Each rule is known by a key (`discount#0`, or in a line
 * `lines.<line key>.pallet#0`), so what held before can be remembered. A
 * rule `on` fields acts as one of them changes instead: its key carries their
 * values, so a key not held before is a change.
 */
export interface SetWhenRules {
  /** The keys of the conditions holding for these values: a starting point, where nothing is set. */
  holding(values: Values): Set<string>;
  /**
   * The values with each field whose condition holds now, and did not in
   * `before`, set to its value; and the conditions holding now. The values
   * come back as they were when nothing was set.
   */
  apply(values: Values, before: ReadonlySet<string>): { values: Values; holding: Set<string> };
}

interface Rule {
  key: string;
  name: string;
  def: Field | LineField;
  when: CompiledModifier;
  value: CompiledExpression;
  /** The fields whose change sets it, when it is set on a change rather than as its condition starts to hold. */
  on?: readonly string[];
  /** What it reads by name: its condition's fields, its value's, and those it is set on. */
  reads: readonly string[];
}

/** A rule as it was last read: what it read then, its key, whether its condition held and its value, once asked for. */
interface Read {
  reads: unknown[];
  key: string;
  holds?: boolean;
  value?: Value;
}

function rules(fields: Record<string, Field | LineField>, functions?: FunctionTable): Rule[] {
  return Object.entries(fields).flatMap(([name, def]) =>
    (def.setWhen ?? []).map((rule: SetWhen, i): Rule => {
      const when = compileModifier(rule.when ?? true, functions);
      const value = compileExpression(rule.value, functions);
      return { key: `${name}#${i}`, name, def, when, value, ...(rule.on ? { on: rule.on } : {}), reads: [...new Set([...when.fields, ...value.fields, ...(rule.on ?? [])])] };
    })
  );
}

/** Before anything was known: every condition counts as holding, so none starts. */
const EVERYTHING: ReadonlySet<string> = { has: () => true } as unknown as ReadonlySet<string>;

/** Read every `setWhen` of a page once. `today` is the day `today()` gives; `app`, the app's functions and their answers. */
export function compileSetWhen(page: Page, today: () => string, about: () => About = () => ({ recordId: null }), app: AppReads = {}): SetWhenRules {
  const own = rules(page.fields, app.functions);
  const lineRules = new Map<string, { def: Extract<Field, { type: 'one2many' }>; rules: Rule[] }>();
  for (const [name, def] of Object.entries(page.fields)) {
    if (def.type !== 'one2many') continue;
    const found = rules(def.fields, app.functions);
    if (found.length) lineRules.set(name, { def, rules: found });
  }
  const lineEnv: ExpressionEnv = { ...app, today };
  /** Whether each change is worked out in full (`recomputeInFull`), as the form was made: nothing kept below. */
  const full = recomputeInFull();
  /** What each of the record's own rules read last, and what it found. */
  const lastRead = new Map<Rule, Read>();
  /** Each line's rules as last read, by its values — the same object while the line is unchanged — with its id and what they read of the record. */
  const linesLastRead = new WeakMap<Values, { key: string; id: unknown; parent: unknown[]; found: Read[] }>();
  /** What each table's lines' rules read of their record (`parent.x`), by name; null where one reads it whole. */
  const linesRead = new Map<string, string[] | null>();
  for (const [name, { rules: list }] of lineRules) {
    const paths = list.flatMap((rule) => [...rule.when.paths, ...rule.value.paths]);
    linesRead.set(name, parentReads(paths));
  }
  /** Whether a rule gives the same for the same values it reads: its condition and its value calling nothing that changes by itself. */
  const steady = (rule: Rule) => steadyCalls(rule.when.calls) && steadyCalls(rule.value.calls);

  /**
   * One set of values (the record's, or a line's): every rule read against them as they are, before any is set.
   * `context` and `env`, made once a rule is read; `reads`, for what a rule reads by name — one reading what it read
   * last is not read again; `found`, a line's rules as last read, given again (`kept`) while the line is unchanged.
   */
  function run(values: Values, list: Rule[], context: () => Record<string, unknown>, env: () => ExpressionEnv, prefix: string, before: ReadonlySet<string>, now: Set<string>, reads?: (name: string) => unknown, kept?: Read[]): { values: Values; found: Read[] } {
    let next = values;
    const found: Read[] = [];
    let ctx: Record<string, unknown> | null = null;
    let envNow: ExpressionEnv | null = null;
    const evaluate = <T>(read: (context: Record<string, unknown>, env: ExpressionEnv) => T) => read((ctx ??= context()), (envNow ??= env()));
    list.forEach((rule, i) => {
      // Steady: what it read last, read again only once a value it reads changed — its key with it. Any other rule is
      // read as ever, in its order: a condition calling the app's own function is asked only where it is read.
      const keeps = !full && steady(rule);
      const was = keeps ? (kept?.[i] ?? (reads ? lastRead.get(rule) : undefined)) : undefined;
      const readNow = keeps && reads ? rule.reads.map(reads) : [];
      let read = was && (kept || sameReads(was.reads, readNow)) ? was : undefined;
      if (!read) {
        workCounts.conditions++;
        // On a change: known by the values of the fields it is on, so a new key is a change of one of them.
        read = { reads: readNow, key: rule.on ? `${prefix}${rule.key}@${JSON.stringify(rule.on.map((name) => values[name] ?? null))}` : prefix + rule.key };
        if (keeps) read.holds = evaluate((c, e) => rule.when.evaluate(c, e));
        if (keeps && reads) lastRead.set(rule, read);
      }
      found.push(read);
      const holds = () => read.holds ?? evaluate((c, e) => rule.when.evaluate(c, e));
      if (rule.on) {
        now.add(read.key);
        if (before.has(read.key) || !holds()) return;
      } else {
        if (!holds()) return;
        now.add(read.key);
        if (before.has(read.key)) return;
      }
      if (read.value === undefined || !keeps) read.value = fitTo(rule.def, evaluate((c, e) => rule.value.evaluate(c, e)));
      if (!sameValue(read.value, next[rule.name])) next = { ...next, [rule.name]: read.value };
    });
    return { values: next, found };
  }

  function apply(values: Values, before: ReadonlySet<string>) {
    const now = new Set<string>();
    let aboutNow: About | null = null;
    const aboutOnce = () => (aboutNow ??= about());
    let record: Record<string, unknown> | null = null;
    const recordNow = () => (record ??= recordContext(values, page.fields, aboutOnce()));
    let next = own.length ? run(values, own, recordNow, () => expressionEnv(values, page.fields, today, app), '', before, now, (name) => readOf(values, page.fields, name, aboutOnce)).values : values;
    for (const [field, { def, rules: list }] of lineRules) {
      const current = values[field];
      if (!Array.isArray(current)) continue;
      const names = linesRead.get(field);
      // A line whose values are those its rules were last read on, its record read alike, finds what they found then.
      const keeps = !full && names !== null && names !== undefined && list.every(steady);
      const parent = keeps ? names.map((name) => readOf(values, page.fields, name, aboutOnce)) : [];
      let changed = false;
      const updated = (current as Line[]).map((line) => {
        // A section or a note has nothing to set.
        if (lineKind(def, line.values) !== null) return line;
        const was = keeps ? linesLastRead.get(line.values) : undefined;
        const kept = was && was.key === line.key && was.id === (line.id ?? null) && sameReads(was.parent, parent) ? was.found : undefined;
        const ran = run(line.values, list, () => lineContext(line.values, def.fields, recordNow(), line.id ?? null), () => lineEnv, `${field}.${line.key}.`, before, now, undefined, kept);
        if (keeps) linesLastRead.set(line.values, { key: line.key, id: line.id ?? null, parent, found: ran.found });
        if (ran.values === line.values) return line;
        changed = true;
        return { ...line, values: ran.values };
      });
      if (changed) next = { ...next, [field]: updated };
    }
    return { values: next, holding: now };
  }

  return { apply, holding: (values) => apply(values, EVERYTHING).holding };
}
