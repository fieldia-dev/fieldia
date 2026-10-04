import type { AnswerRule, Field, Page } from '@fieldia/core';
import { readCondition, readHolds, type Condition } from './conditions';
import { nameOf } from './layout-tree';
import { fieldsReadBy, formulaInWords, literalOf, valueInWords } from './rules-formula';

/**
 * Every rule on a page as a sentence a person reads — "Shows when Status is
 * Active", "Worked out from Price × Quantity", "Ends with @acme.com — only
 * warns" — and which answer rules fit which kind of field. The overview, the
 * marks on the canvas, the checks and the words before publishing all read
 * rules through here, so a rule is said the same way everywhere.
 */

// ---- answer rules -------------------------------------------------------------------------------

/** What a rule can ask of an answer, in the order a rule is checked. */
export const ASKS = ['minLength', 'maxLength', 'pattern', 'endsWith', 'min', 'max', 'atLeast', 'atMost', 'date'] as const;
export type Ask = (typeof ASKS)[number];

/** What a rule asks for, in order: nothing when it only has a message, a level or a condition. */
export function ruleAsks(rule: AnswerRule): Ask[] {
  return ASKS.filter((ask) => rule[ask] !== undefined);
}

const TEXT = ['char', 'text', 'html'];
const NUMBER = ['integer', 'float', 'monetary'];

/** The kinds of field each ask makes sense for: a length of text, a range of a number, a count of choices ticked. */
const FITS: Record<Ask, (field: Field) => boolean> = {
  minLength: (f) => TEXT.includes(f.type),
  maxLength: (f) => TEXT.includes(f.type),
  endsWith: (f) => TEXT.includes(f.type),
  pattern: (f) => TEXT.includes(f.type) || NUMBER.includes(f.type),
  min: (f) => NUMBER.includes(f.type),
  max: (f) => NUMBER.includes(f.type),
  atLeast: (f) => (f.type === 'selection' && f.multiple === true) || f.type === 'many2many',
  atMost: (f) => (f.type === 'selection' && f.multiple === true) || f.type === 'many2many',
  date: (f) => f.type === 'date' || f.type === 'datetime',
};

/** The asks of a rule its field cannot be checked by: a length of a number. */
export function asksNotFitting(field: Field, rule: AnswerRule): Ask[] {
  return ruleAsks(rule).filter((ask) => !FITS[ask](field));
}

/** A kind of rule as "Add a rule" offers it, and the rule it starts as. */
export interface AnswerRuleKind {
  id: 'length' | 'ending' | 'pattern' | 'range' | 'count' | 'past' | 'future';
  label: string;
  start: AnswerRule;
  fits(field: Field): boolean;
}

const KINDS: AnswerRuleKind[] = [
  { id: 'length', label: 'A length', start: { minLength: 2 }, fits: FITS.minLength },
  { id: 'ending', label: 'An ending', start: { endsWith: '.com' }, fits: FITS.endsWith },
  { id: 'pattern', label: 'A pattern', start: { pattern: '[A-Za-z ]+' }, fits: (f) => TEXT.includes(f.type) },
  { id: 'range', label: 'A range', start: { min: 1, max: 10 }, fits: FITS.min },
  { id: 'count', label: 'How many are ticked', start: { atLeast: 1 }, fits: FITS.atLeast },
  { id: 'past', label: 'A date in the past', start: { date: 'past' }, fits: FITS.date },
  { id: 'future', label: 'A date in the future', start: { date: 'future' }, fits: FITS.date },
];

export const answerRuleKinds = (): readonly AnswerRuleKind[] => KINDS;

/** The kinds "Add a rule" offers for a field: only those that fit what it holds. */
export function kindsFitting(field: Field): AnswerRuleKind[] {
  return KINDS.filter((kind) => kind.fits(field));
}

/** The patterns people pick by name; any other is said as written. */
export const NAMED_PATTERNS: { pattern: string; words: string }[] = [
  { pattern: '[A-Za-z ]+', words: 'Letters only' },
  { pattern: '\\d+', words: 'Digits only' },
  { pattern: '[A-Za-z0-9]+', words: 'Letters and digits only' },
];

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const lower = (words: string) => words.charAt(0).toLowerCase() + words.slice(1);

/** Each ask of a rule in words, as it reads alone: "At least 2 letters", "Ends with .com". */
function askWords(rule: AnswerRule): { say: string; must: string }[] {
  const out: { say: string; must: string }[] = [];
  const { minLength: shortest, maxLength: longest, min, max, atLeast, atMost } = rule;
  if (shortest !== undefined && longest !== undefined) {
    const say = shortest === longest ? `Exactly ${plural(shortest, 'letter')}` : `Between ${shortest} and ${plural(longest, 'letter')}`;
    out.push({ say, must: `Must be ${lower(say)}` });
  } else if (shortest !== undefined) out.push({ say: `At least ${plural(shortest, 'letter')}`, must: `Must be at least ${plural(shortest, 'letter')}` });
  else if (longest !== undefined) out.push({ say: `At most ${plural(longest, 'letter')}`, must: `Must be at most ${plural(longest, 'letter')}` });
  if (rule.pattern !== undefined) {
    const named = NAMED_PATTERNS.find((p) => p.pattern === rule.pattern);
    out.push(named ? { say: named.words, must: `Must be ${lower(named.words)}` } : { say: `Matches the pattern ${rule.pattern}`, must: `Must match the pattern ${rule.pattern}` });
  }
  if (rule.endsWith !== undefined) out.push({ say: `Ends with ${rule.endsWith}`, must: `Must end with ${rule.endsWith}` });
  if (min !== undefined && max !== undefined) out.push({ say: min === max ? `Exactly ${min}` : `Between ${min} and ${max}`, must: min === max ? `Must be exactly ${min}` : `Must be between ${min} and ${max}` });
  else if (min !== undefined) out.push({ say: `At least ${min}`, must: `Must be at least ${min}` });
  else if (max !== undefined) out.push({ say: `At most ${max}`, must: `Must be at most ${max}` });
  if (atLeast !== undefined && atMost !== undefined) out.push({ say: `Tick between ${atLeast} and ${atMost}`, must: `Must tick between ${atLeast} and ${atMost}` });
  else if (atLeast !== undefined) out.push({ say: `Tick at least ${atLeast}`, must: `Must tick at least ${atLeast}` });
  else if (atMost !== undefined) out.push({ say: `Tick at most ${atMost}`, must: `Must tick at most ${atMost}` });
  if (rule.date !== undefined) {
    const say = rule.date === 'past' ? 'A date in the past' : 'A date in the future';
    out.push({ say, must: `Must be ${lower(say)}` });
  }
  return out;
}

/**
 * When a rule holds, in words: "Status is Active" — a condition the designer
 * builds reads the same through the formula's words, `==` as "is" and a
 * choice by its label. Empty when it always holds.
 */
function whenWords(page: Page, when: AnswerRule['when']): string {
  return typeof when === 'string' ? formulaInWords(page, when) : '';
}

/** What is said after a rule's asks: that it only warns, and when it is checked. */
function notesOf(page: Page, rule: AnswerRule): string[] {
  const notes = rule.level === 'warning' ? ['only warns'] : [];
  if (rule.when === false) notes.push('never checked');
  else if (whenWords(page, rule.when)) notes.push(`only when ${whenWords(page, rule.when)}`);
  return notes;
}

/** An answer rule as it reads in a list: "Ends with @acme.com — only warns, only when VIP is Yes". */
export function answerRuleSentence(page: Page, rule: AnswerRule): string {
  const asks = askWords(rule);
  if (!asks.length) return 'Asks for nothing yet';
  const said = [asks[0].say, ...asks.slice(1).map((a) => lower(a.say))].join(', ');
  const notes = notesOf(page, rule);
  return notes.length ? `${said} — ${notes.join(', ')}` : said;
}

/** What an answer rule makes the answer be, for the words before publishing: "Must end with @acme.com (only warns)". */
export function answerRuleMust(page: Page, rule: AnswerRule): string {
  const asks = askWords(rule);
  if (!asks.length) return 'Asks for nothing';
  const said = [asks[0].must, ...asks.slice(1).map((a) => lower(a.must))].join(', ');
  const notes = notesOf(page, rule);
  return notes.length ? `${said} (${notes.join(', ')})` : said;
}

// ---- conditions and values ------------------------------------------------------------------------

/** A condition the designer builds, in words: "Status is Active and VIP is not Yes". */
export function conditionInWords(page: Page, condition: Condition): string {
  const each = condition.rules.map((rule) => {
    const field = page.fields[rule.field];
    return `${field?.label || rule.field} ${rule.op} ${valueInWords(field, rule.value)}`;
  });
  return each.join(condition.join === 'all' ? ' and ' : ' or ');
}

/** A value set by a rule, in words: a choice by its label, text in quotes, anything worked out as its formula. */
export function setValueInWords(page: Page, field: Field | undefined, value: string): string {
  const literal = literalOf(value);
  if (!literal) return formulaInWords(page, value);
  if (typeof literal.value === 'string' && field?.type !== 'selection') return `“${literal.value}”`;
  return valueInWords(field, literal.value);
}

// ---- every rule on the page -----------------------------------------------------------------------

export type RuleKind = 'shows' | 'required' | 'readonly' | 'compute' | 'set' | 'answer';

/** One rule on the page, as the overview lists it. */
export interface RuleEntry {
  kind: RuleKind;
  /** The part it acts on, by id: a field's place on the page, a group, a page of a survey; null for a field not on the page. */
  part: string | null;
  /** The field it is about, for a field's rules. */
  field?: string;
  /** Which of the field's answer rules, or of its values set by a rule. */
  index?: number;
  /** The part's name. */
  name: string;
  sentence: string;
  /** The fields it reads. */
  reads: string[];
}

/** A part of the layout as the walk sees it: any part, with what a field's place has when it is one. */
interface Visited {
  id: string;
  type: string;
  field?: string;
  label?: string;
  invisible?: unknown;
  required?: unknown;
  readonly?: unknown;
  validate?: AnswerRule[];
  children?: unknown[];
}

function shows(page: Page, invisible: unknown): string {
  const condition = readCondition(invisible);
  if (!condition) return '';
  if (condition === 'custom') return invisible === true ? 'Always hidden' : `Hidden when ${formulaInWords(page, String(invisible))}`;
  return `Shows when ${conditionInWords(page, condition)}`;
}

/** A rule written as it holds — required when, read-only when — in words; written by hand or by the designer, it reads the same. */
function holds(page: Page, lead: string, value: unknown): string {
  const held = readHolds(value);
  return !held || held === 'always' ? '' : `${lead} when ${formulaInWords(page, String(value))}`;
}

const reads = (value: unknown) => fieldsReadBy(typeof value === 'string' ? value : undefined);

/** Every rule on the page, in reading order, each said once: a field's worked-out value and values set where it first shows. */
export function pageRules(page: Page): RuleEntry[] {
  const out: RuleEntry[] = [];
  const done = new Set<string>();
  const ofField = (name: string, part: string | null, label: string) => {
    if (done.has(name)) return;
    done.add(name);
    const def = page.fields[name];
    if (!def) return;
    if (def.compute !== undefined) out.push({ kind: 'compute', part, field: name, name: label, sentence: `Worked out from ${formulaInWords(page, def.compute)}`, reads: reads(def.compute) });
    def.setWhen?.forEach((item, index) =>
      out.push({ kind: 'set', part, field: name, index, name: label, sentence: `Set to ${setValueInWords(page, def, item.value)} when ${whenWords(page, item.when) || item.when}`, reads: [...new Set([...reads(item.when), ...reads(item.value)])] })
    );
  };
  const visit = (node: Visited) => {
    const name = node.type === 'step' ? node.label || 'Untitled page' : nameOf(page, node as never) || node.label || '';
    const hidden = shows(page, node.invisible);
    if (hidden) out.push({ kind: 'shows', part: node.id, name, sentence: hidden, reads: reads(node.invisible) });
    if (node.type === 'field' && node.field) {
      const required = holds(page, 'Required', node.required);
      if (required) out.push({ kind: 'required', part: node.id, field: node.field, name, sentence: required, reads: reads(node.required) });
      const readonly = holds(page, 'Read-only', node.readonly);
      if (readonly) out.push({ kind: 'readonly', part: node.id, field: node.field, name, sentence: readonly, reads: reads(node.readonly) });
      ofField(node.field, node.id, name);
      node.validate?.forEach((rule, index) => out.push({ kind: 'answer', part: node.id, field: node.field, index, name, sentence: answerRuleSentence(page, rule), reads: reads(rule.when) }));
    } else if (node.type === 'section') {
      // Every field inside a group is read-only while its rule holds.
      const readonly = holds(page, 'Read-only', node.readonly);
      if (readonly) out.push({ kind: 'readonly', part: node.id, name, sentence: readonly, reads: reads(node.readonly) });
    }
    for (const child of (node.children ?? []) as Visited[]) visit(child);
  };
  const root = page.layout;
  if (root.type === 'sheet') {
    for (const part of [...(root.buttons ?? []), ...(root.statButtons ?? []), ...(root.badges ?? []), ...(root.alerts ?? []), ...(root.ribbon ? [root.ribbon] : [])] as { id: string; label?: string; message?: string; invisible?: unknown }[]) {
      const hidden = shows(page, part.invisible);
      if (hidden) out.push({ kind: 'shows', part: part.id, name: part.label ?? part.message ?? '', sentence: hidden, reads: reads(part.invisible) });
    }
  }
  if (root.type !== 'list') for (const child of root.children as Visited[]) visit(child);
  // Fields worked out that the page no longer shows: their rules still stand.
  for (const [name, def] of Object.entries(page.fields)) ofField(name, null, def.label);
  return out;
}
