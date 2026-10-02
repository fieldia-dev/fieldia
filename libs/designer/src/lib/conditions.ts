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

/** The condition a node's `invisible` holds: null when it always shows, `custom` when it was written another way. */
export function readCondition(invisible: unknown): Condition | null | 'custom' {
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
