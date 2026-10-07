import type { Field } from '../format/field';
import type { AnswerRule } from '../format/layout';
import type { ExpressionEnv } from '../expression/functions';
import { localDay } from '../expression/functions';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import { isNumber } from '../expression/operations';
import { fill, type Messages } from './messages';
import { isEmpty, lineKind, type Line, type RelatedRecord, type Value } from './values';

/**
 * Answer rules: what a field node's `validate` asks of an answer, besides its
 * field's own rules. An empty answer passes every rule (`required` decides
 * whether one is needed), a rule applies only while its `when` holds, and an
 * ask that does not fit the answer — a length of a number — is not broken. A
 * rule across fields (`holds`) waits until every field it reads is filled in.
 */

/** A rule read once: its condition and its rule across fields parsed, its pattern made whole. */
export interface CompiledRule {
  readonly rule: AnswerRule;
  readonly when: CompiledModifier;
  readonly pattern: RegExp | null;
  readonly holds: CompiledModifier | null;
}

export function compileRules(rules: readonly AnswerRule[] | undefined): CompiledRule[] {
  return (rules ?? []).map((rule) => ({
    rule,
    when: compileModifier(rule.when ?? true),
    // A pattern is about the whole answer, not a part of it.
    pattern: rule.pattern === undefined ? null : new RegExp(`^(?:${rule.pattern})$`),
    holds: rule.holds === undefined ? null : compileModifier(rule.holds),
  }));
}

/** What a rule is checked with: the record as expressions read it, the clock, and the words to say. */
export interface RuleContext {
  context: Record<string, unknown>;
  env: ExpressionEnv;
  now: Date;
  messages: Messages;
}

/** The first broken error rule's message and the first broken warning rule's, for one answer. */
export function checkRules(
  field: Field,
  label: string,
  value: Value | undefined,
  rules: readonly CompiledRule[],
  at: RuleContext
): { error?: string; warning?: string } {
  const found: { error?: string; warning?: string } = {};
  if (!rules.length || isEmpty(field, value)) return found;
  for (const compiled of rules) {
    const level = compiled.rule.level ?? 'error';
    if (found[level] !== undefined || !compiled.when.evaluate(at.context, at.env)) continue;
    const broken = brokenAsk(compiled, field, value as Value, at.now) ?? brokenAcross(compiled, at);
    if (broken) found[level] = compiled.rule.message ?? fill(at.messages[broken.say], { label, ...broken.values });
  }
  return found;
}

type Broken = { say: keyof Messages; values?: Record<string, string | number> };

/** The first thing a rule asks that the answer does not keep, in the order a rule lists them. */
function brokenAsk({ rule, pattern }: CompiledRule, field: Field, value: Value, now: Date): Broken | undefined {
  const text = typeof value === 'string' ? value : null;
  if (text !== null && rule.minLength !== undefined && text.length < rule.minLength) return { say: 'minLength', values: { min: rule.minLength } };
  if (text !== null && rule.maxLength !== undefined && text.length > rule.maxLength) return { say: 'maxLength', values: { max: rule.maxLength } };
  if (pattern && (text !== null || isNumber(value)) && !pattern.test(String(value))) return { say: 'pattern' };
  if (text !== null && rule.endsWith !== undefined && !text.trim().toLowerCase().endsWith(rule.endsWith.toLowerCase())) {
    return { say: 'endsWith', values: { ending: rule.endsWith } };
  }
  if (isNumber(value) && rule.min !== undefined && value < rule.min) return { say: 'min', values: { min: rule.min } };
  if (isNumber(value) && rule.max !== undefined && value > rule.max) return { say: 'max', values: { max: rule.max } };
  const count = Array.isArray(value) ? value.length : null;
  if (count !== null && rule.atLeast !== undefined && count < rule.atLeast) return { say: 'atLeast', values: { min: rule.atLeast } };
  if (count !== null && rule.atMost !== undefined && count > rule.atMost) return { say: 'atMost', values: { max: rule.atMost } };
  if (rule.distinct !== undefined && field.type === 'one2many' && Array.isArray(value)) {
    const twice = sharedValue(field, value as Line[], rule.distinct);
    if (twice !== null) return { say: 'distinct', values: { column: field.fields[rule.distinct]?.label ?? rule.distinct, value: twice } };
  }
  if (text !== null && rule.date !== undefined) {
    const side = whenIs(field, text, now);
    if (rule.date === 'past' && side >= 0) return { say: 'datePast' };
    if (rule.date === 'future' && side <= 0) return { say: 'dateFuture' };
  }
  return undefined;
}

/** The first value of a column two of a table's items share, as a person reads it; null when each is there once. Empty cells, sections and notes are left out. */
function sharedValue(field: Extract<Field, { type: 'one2many' }>, lines: readonly Line[], column: string): string | null {
  const def = field.fields[column];
  const seen = new Set<string>();
  for (const line of lines) {
    if (lineKind(field, line.values) !== null) continue;
    const value = line.values[column];
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) continue;
    // A link by its id; anything else as it is.
    const link = typeof value === 'object' && !Array.isArray(value) && 'id' in value ? (value as RelatedRecord) : null;
    const key = JSON.stringify(link ? link.id : value);
    if (!seen.has(key)) {
      seen.add(key);
      continue;
    }
    if (link) return link.label;
    if (def?.type === 'selection') return def.options.find((o) => o.value === value)?.label ?? String(value);
    return String(value);
  }
  return null;
}

/** Nothing to compare with yet: an empty value, as expressions read it. */
const blank = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length);

/** A rule across fields, once every field it reads is filled in: broken when it does not hold. */
function brokenAcross({ holds }: CompiledRule, at: RuleContext): Broken | undefined {
  if (!holds || holds.fields.some((name) => blank(at.context[name]))) return undefined;
  return holds.evaluate(at.context, at.env) ? undefined : { say: 'holds' };
}

/**
 * Whether an answer is before (-1) or after (1) now, or is now (0): a day
 * against today, a date and time against the clock itself. A date and time
 * that cannot be read is neither (NaN): the field's own rules name it.
 */
function whenIs(field: Field, text: string, now: Date): number {
  if (field.type === 'datetime') return Math.sign(Date.parse(text) - now.getTime());
  const today = localDay(now);
  return text < today ? -1 : text > today ? 1 : 0;
}
