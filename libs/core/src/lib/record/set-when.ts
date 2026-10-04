import type { Field, LineField, SetWhen } from '../format/field';
import type { Page } from '../format/page';
import { compileExpression, type CompiledExpression, type ExpressionEnv } from '../expression/expression';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import { fitTo } from './compute';
import { expressionEnv } from './env';
import { expressionContext, lineKind, sameValue, type Line, type Values } from './values';

/**
 * Values set when a condition starts to hold: a field's `setWhen`. A rule acts
 * only as its condition goes from not holding to holding — so people may
 * still change the value afterwards — and rules act in the order the field
 * lists them. Each rule is known by a key (`discount#0`, or in a line
 * `lines.<line key>.pallet#0`), so what held before can be remembered.
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
}

function rules(fields: Record<string, Field | LineField>): Rule[] {
  return Object.entries(fields).flatMap(([name, def]) =>
    (def.setWhen ?? []).map((rule: SetWhen, i): Rule => ({ key: `${name}#${i}`, name, def, when: compileModifier(rule.when), value: compileExpression(rule.value) }))
  );
}

/** Before anything was known: every condition counts as holding, so none starts. */
const EVERYTHING: ReadonlySet<string> = { has: () => true } as unknown as ReadonlySet<string>;

/** Read every `setWhen` of a page once. `today` is the day `today()` gives. */
export function compileSetWhen(page: Page, today: () => string): SetWhenRules {
  const own = rules(page.fields);
  const lineRules = new Map<string, { def: Extract<Field, { type: 'one2many' }>; rules: Rule[] }>();
  for (const [name, def] of Object.entries(page.fields)) {
    if (def.type !== 'one2many') continue;
    const found = rules(def.fields);
    if (found.length) lineRules.set(name, { def, rules: found });
  }
  const lineEnv: ExpressionEnv = { today };

  /** One set of values (the record's, or a line's): every rule read against them as they are, before any is set. */
  function run(values: Values, list: Rule[], fields: Record<string, Field | LineField>, env: ExpressionEnv, prefix: string, before: ReadonlySet<string>, now: Set<string>): Values {
    let next = values;
    const context = expressionContext(values, fields);
    for (const rule of list) {
      if (!rule.when.evaluate(context, env)) continue;
      const key = prefix + rule.key;
      now.add(key);
      if (before.has(key)) continue;
      const value = fitTo(rule.def, rule.value.evaluate(context, env));
      if (!sameValue(value, next[rule.name])) next = { ...next, [rule.name]: value };
    }
    return next;
  }

  function apply(values: Values, before: ReadonlySet<string>) {
    const now = new Set<string>();
    let next = own.length ? run(values, own, page.fields, expressionEnv(values, page.fields, today), '', before, now) : values;
    for (const [field, { def, rules: list }] of lineRules) {
      const current = values[field];
      if (!Array.isArray(current)) continue;
      let changed = false;
      const updated = (current as Line[]).map((line) => {
        // A section or a note has nothing to set.
        if (lineKind(def, line.values) !== null) return line;
        const set = run(line.values, list, def.fields, lineEnv, `${field}.${line.key}.`, before, now);
        if (set === line.values) return line;
        changed = true;
        return { ...line, values: set };
      });
      if (changed) next = { ...next, [field]: updated };
    }
    return { values: next, holding: now };
  }

  return { apply, holding: (values) => apply(values, EVERYTHING).holding };
}
