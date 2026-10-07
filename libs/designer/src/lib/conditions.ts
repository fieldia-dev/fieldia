/**
 * When a page or a question shows, as the designer builds it: rules on
 * earlier answers, all of them or any of them. The page format says when a
 * node is *hidden*, so a condition is written as its opposite, without
 * brackets: "show when A and B" hides when not A or not B. Only that shape is
 * read back; a condition written by hand is left as it is.
 */

export interface ConditionRule {
  field: string;
  op: 'is' | 'is not';
  value: string | number | boolean;
}

export interface Condition {
  join: 'all' | 'any';
  rules: ConditionRule[];
}

/** A value as the expression language writes it. A quote cannot sit inside a string there, so it is left out. */
function literal(value: ConditionRule['value']): string {
  if (typeof value === 'string') return `'${value.replace(/'/g, '')}'`;
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return String(value);
}

/** The `invisible` expression that hides a node unless the condition holds. */
export function conditionToHide(condition: Condition): string {
  // Each rule turned round, and the join with it: all → or, any → and.
  const parts = condition.rules.map((rule) => `${rule.field} ${rule.op === 'is' ? '!=' : '=='} ${literal(rule.value)}`);
  return parts.join(condition.join === 'all' ? ' or ' : ' and ');
}

const RULE = /^\s*([A-Za-z_]\w*)\s*(==|!=)\s*('[^']*'|True|False|-?\d+(?:\.\d+)?)\s*/;

/** When a part shows of a record's being edited: always, only while it is edited (Flectra's oe_edit_only), or only while it is read. */
export type ShownWhile = 'always' | 'editing' | 'reading';

/**
 * A part's `invisible` cut in two: when it shows of the record's being edited
 * — the `not editing` or `editing` the designer puts last — and the rest.
 */
export function splitShownWhile(invisible: unknown): { mode: ShownWhile; rest: unknown } {
  if (typeof invisible !== 'string') return { mode: 'always', rest: invisible };
  const found = /^(?:(.+) or )?(not )?editing$/.exec(invisible.trim());
  if (!found) return { mode: 'always', rest: invisible };
  const rest = found[1]?.replace(/^\((.*)\)$/, '$1');
  return { mode: found[2] ? 'editing' : 'reading', rest: rest || undefined };
}

/** A part's `invisible` again, from the rest and when it shows of the record's being edited. */
export function withShownWhile(rest: string | undefined, mode: ShownWhile): string | undefined {
  const clause = mode === 'editing' ? 'not editing' : mode === 'reading' ? 'editing' : '';
  if (!clause) return rest || undefined;
  return rest ? `(${rest}) or ${clause}` : clause;
}

/** The condition a node's `invisible` holds: null when it always shows, `custom` when it was written another way. When it shows of the record's being edited is said apart. */
export function readCondition(shown: unknown): Condition | null | 'custom' {
  const invisible = splitShownWhile(shown).rest;
  if (invisible === undefined || invisible === null || invisible === '' || invisible === false) return null;
  if (typeof invisible !== 'string') return 'custom';
  const rules: ConditionRule[] = [];
  const joins = new Set<string>();
  let rest = invisible;
  for (;;) {
    const match = RULE.exec(rest);
    if (!match) return 'custom';
    const raw = match[3];
    const value = raw.startsWith("'") ? raw.slice(1, -1) : raw === 'True' ? true : raw === 'False' ? false : Number(raw);
    rules.push({ field: match[1], op: match[2] === '!=' ? 'is' : 'is not', value });
    rest = rest.slice(match[0].length);
    if (!rest) break;
    const join = /^(and|or)\s+/.exec(rest);
    if (!join) return 'custom';
    joins.add(join[1]);
    rest = rest.slice(join[0].length);
  }
  // Both joins at once would need brackets the designer never writes.
  if (joins.size > 1) return 'custom';
  return { join: joins.has('and') ? 'any' : 'all', rules };
}

/**
 * A rule as it holds — "required when", "read-only when" — rather than its
 * opposite: "state is Blocked" is `state == 'blocked'`.
 */
export function conditionToHold(condition: Condition): string {
  const parts = condition.rules.map((rule) => `${rule.field} ${rule.op === 'is' ? '==' : '!='} ${literal(rule.value)}`);
  return parts.join(condition.join === 'all' ? ' and ' : ' or ');
}

/** A rule written as it holds, read back: `always` for `true`, null for none, `custom` when written another way. */
export function readHolds(value: unknown): Condition | null | 'custom' | 'always' {
  if (value === true) return 'always';
  // The same words as a hiding rule, each turned round: a rule that hides is the opposite of one that holds.
  const opposite = readCondition(value);
  if (!opposite || opposite === 'custom') return opposite;
  return { join: opposite.join === 'all' ? 'any' : 'all', rules: opposite.rules.map((rule) => ({ ...rule, op: rule.op === 'is' ? 'is not' : 'is' })) };
}
