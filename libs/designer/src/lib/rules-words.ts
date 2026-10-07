import type { AnswerRule, Field, Page, SetWhen } from '@fieldia/core';
import { readCondition, readHolds, type Condition } from './conditions';
import { nameOf } from './layout-tree';
import { fieldsReadBy, formulaInWords, literalOf, valueInWords } from './rules-formula';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * Every rule on a page as a sentence a person reads — "Shows when Status is
 * Active", "Worked out from Price × Quantity", "Ends with @acme.com — only
 * warns" — and which answer rules fit which kind of field. The overview, the
 * marks on the canvas, the checks and the words before publishing all read
 * rules through here, so a rule is said the same way everywhere.
 */

// ---- answer rules -------------------------------------------------------------------------------

/** What a rule can ask of an answer, in the order a rule is checked. */
export const ASKS = ['minLength', 'maxLength', 'pattern', 'endsWith', 'min', 'max', 'atLeast', 'atMost', 'date', 'holds'] as const;
export type Ask = (typeof ASKS)[number];

/** What a rule asks for, in order: nothing when it only has a message, a level or a condition. */
export function ruleAsks(rule: AnswerRule): Ask[] {
  return ASKS.filter((ask) => rule[ask] !== undefined);
}

const TEXT = ['char', 'text', 'html'];
const NUMBER = ['integer', 'float', 'monetary'];
/** What a rule across fields is put on: text, a number or a date, compared with other answers. */
const ACROSS = [...TEXT, ...NUMBER, 'date', 'datetime'];

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
  holds: (f) => ACROSS.includes(f.type),
};

/** The asks of a rule its field cannot be checked by: a length of a number. */
export function asksNotFitting(field: Field, rule: AnswerRule): Ask[] {
  return ruleAsks(rule).filter((ask) => !FITS[ask](field));
}

/** A kind of rule as "Add a rule" offers it, and the rule it starts as; none for one begun empty and kept once it reads. */
export interface AnswerRuleKind {
  id: 'length' | 'ending' | 'pattern' | 'range' | 'count' | 'past' | 'future' | 'across';
  /** Its name in English; `words.rules.kinds[id]` in the designer's language. */
  label: string;
  start: AnswerRule | null;
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
  { id: 'across', label: 'A rule across fields', start: null, fits: FITS.holds },
];

export const answerRuleKinds = (): readonly AnswerRuleKind[] => KINDS;

/** The kinds "Add a rule" offers for a field: only those that fit what it holds. */
export function kindsFitting(field: Field): AnswerRuleKind[] {
  return KINDS.filter((kind) => kind.fits(field));
}

/** The patterns people pick by name, by `id` in the designer's words (`words.rules.patterns`); any other is said as written. */
export const NAMED_PATTERNS: { id: 'letters' | 'digits' | 'lettersAndDigits'; pattern: string; words: string }[] = [
  { id: 'letters', pattern: '[A-Za-z ]+', words: 'Letters only' },
  { id: 'digits', pattern: '\\d+', words: 'Digits only' },
  { id: 'lettersAndDigits', pattern: '[A-Za-z0-9]+', words: 'Letters and digits only' },
];

/** Each ask of a rule in words, as it reads alone: "At least 2 letters", "Ends with .com", "Must hold: Paid ≤ Total". */
function askWords(page: Page, rule: AnswerRule, words: DesignerWords): { say: string; must: string }[] {
  const w = words.rules;
  const out: { say: string; must: string }[] = [];
  const { minLength: shortest, maxLength: longest, min, max, atLeast, atMost } = rule;
  if (shortest !== undefined && longest !== undefined) {
    out.push(shortest === longest ? { say: w.exactlyLetters(shortest), must: w.mustExactlyLetters(shortest) } : { say: w.betweenLetters(shortest, longest), must: w.mustBetweenLetters(shortest, longest) });
  } else if (shortest !== undefined) out.push({ say: w.atLeastLetters(shortest), must: w.mustAtLeastLetters(shortest) });
  else if (longest !== undefined) out.push({ say: w.atMostLetters(longest), must: w.mustAtMostLetters(longest) });
  if (rule.pattern !== undefined) {
    const named = NAMED_PATTERNS.find((p) => p.pattern === rule.pattern);
    out.push(named ? { say: w.patterns[named.id], must: w.mustNamed[named.id] } : { say: w.matches(rule.pattern), must: w.mustMatch(rule.pattern) });
  }
  if (rule.endsWith !== undefined) out.push({ say: w.endsWith(rule.endsWith), must: w.mustEndWith(rule.endsWith) });
  if (min !== undefined && max !== undefined) out.push(min === max ? { say: w.exactly(min), must: w.mustExactly(min) } : { say: w.between(min, max), must: w.mustBetween(min, max) });
  else if (min !== undefined) out.push({ say: w.atLeast(min), must: w.mustAtLeast(min) });
  else if (max !== undefined) out.push({ say: w.atMost(max), must: w.mustAtMost(max) });
  if (atLeast !== undefined && atMost !== undefined) out.push({ say: w.tickBetween(atLeast, atMost), must: w.mustTickBetween(atLeast, atMost) });
  else if (atLeast !== undefined) out.push({ say: w.tickAtLeast(atLeast), must: w.mustTickAtLeast(atLeast) });
  else if (atMost !== undefined) out.push({ say: w.tickAtMost(atMost), must: w.mustTickAtMost(atMost) });
  if (rule.date !== undefined) out.push(rule.date === 'past' ? { say: w.past, must: w.mustPast } : { say: w.future, must: w.mustFuture });
  if (rule.holds !== undefined) {
    const say = w.mustHold(rule.holds.trim() ? formulaInWords(page, rule.holds, words) : '…');
    out.push({ say, must: say });
  }
  return out;
}

/**
 * When a rule holds, in words: "Status is Active" — a condition the designer
 * builds reads the same through the formula's words, `==` as "is" and a
 * choice by its label. Empty when it always holds.
 */
/** When a value set by a rule is set, in words: its condition, or the fields it is on changing — "“Certification” changes, if Certification". */
export function setWhenPhrase(page: Page, item: SetWhen, words: DesignerWords = en): string {
  const condition = item.when === undefined ? '' : whenWords(page, item.when, words) || item.when;
  return item.on ? words.rules.onChange(item.on.map((name) => page.fields[name]?.label || name), condition) : condition;
}

function whenWords(page: Page, when: AnswerRule['when'], words: DesignerWords): string {
  return typeof when === 'string' ? formulaInWords(page, when, words) : '';
}

/** What is said after a rule's asks: that it only warns, and when it is checked. */
function notesOf(page: Page, rule: AnswerRule, words: DesignerWords): string[] {
  const w = words.rules;
  const notes = rule.level === 'warning' ? [w.onlyWarns] : [];
  if (rule.when === false) notes.push(w.neverChecked);
  else if (whenWords(page, rule.when, words)) notes.push(w.onlyWhen(whenWords(page, rule.when, words)));
  return notes;
}

/** An answer rule as it reads in a list: "Ends with @acme.com — only warns, only when VIP is Yes". */
export function answerRuleSentence(page: Page, rule: AnswerRule, words: DesignerWords = en): string {
  const asks = askWords(page, rule, words);
  if (!asks.length) return words.rules.asksNothingYet;
  return words.rules.sentence(words.rules.joinAsks(asks.map((a) => a.say)), notesOf(page, rule, words));
}

/** What an answer rule makes the answer be, for the words before publishing: "Must end with @acme.com (only warns)". */
export function answerRuleMust(page: Page, rule: AnswerRule, words: DesignerWords = en): string {
  const asks = askWords(page, rule, words);
  if (!asks.length) return words.rules.asksNothing;
  return words.rules.must(words.rules.joinAsks(asks.map((a) => a.must)), notesOf(page, rule, words));
}

// ---- conditions and values ------------------------------------------------------------------------

/** A condition the designer builds, in words: "Status is Active and VIP is not Yes". */
export function conditionInWords(page: Page, condition: Condition, words: DesignerWords = en): string {
  const w = words.rules;
  const each = condition.rules.map((rule) => {
    const field = page.fields[rule.field];
    return w.test(field?.label || rule.field, rule.op === 'is' ? w.is : w.isNot, valueInWords(field, rule.value, words));
  });
  return condition.join === 'all' ? w.allOf(each) : w.anyOf(each);
}

/** A value set by a rule, in words: a choice by its label, text in quotes, anything worked out as its formula. */
export function setValueInWords(page: Page, field: Field | undefined, value: string, words: DesignerWords = en): string {
  const literal = literalOf(value);
  if (!literal) return formulaInWords(page, value, words);
  if (typeof literal.value === 'string' && field?.type !== 'selection') return words.rules.text(literal.value);
  return valueInWords(field, literal.value, words);
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

function shows(page: Page, invisible: unknown, words: DesignerWords): string {
  const condition = readCondition(invisible);
  if (!condition) return '';
  if (condition === 'custom') return invisible === true ? words.rules.alwaysHidden : words.rules.hiddenWhen(formulaInWords(page, String(invisible), words));
  return words.rules.showsWhen(conditionInWords(page, condition, words));
}

/** A rule written as it holds — required when, read-only when — in words; written by hand or by the designer, it reads the same. */
function holds(page: Page, lead: (formula: string) => string, value: unknown, words: DesignerWords): string {
  const held = readHolds(value);
  return !held || held === 'always' ? '' : lead(formulaInWords(page, String(value), words));
}

const reads = (value: unknown) => fieldsReadBy(typeof value === 'string' ? value : undefined);

/** Every rule on the page, in reading order, each said once: a field's worked-out value and values set where it first shows. */
export function pageRules(page: Page, words: DesignerWords = en): RuleEntry[] {
  const w = words.rules;
  const out: RuleEntry[] = [];
  const done = new Set<string>();
  const ofField = (name: string, part: string | null, label: string) => {
    if (done.has(name)) return;
    done.add(name);
    const def = page.fields[name];
    if (!def) return;
    if (def.compute !== undefined) out.push({ kind: 'compute', part, field: name, name: label, sentence: w.workedOutFrom(formulaInWords(page, def.compute, words)), reads: reads(def.compute) });
    def.setWhen?.forEach((item, index) =>
      out.push({ kind: 'set', part, field: name, index, name: label, sentence: w.setTo(setValueInWords(page, def, item.value, words), setWhenPhrase(page, item, words)), reads: [...new Set([...reads(item.when), ...reads(item.value), ...(item.on ?? [])])] })
    );
  };
  const visit = (node: Visited) => {
    const name = node.type === 'step' ? node.label || w.untitledPage : nameOf(page, node as never, words) || node.label || '';
    const hidden = shows(page, node.invisible, words);
    if (hidden) out.push({ kind: 'shows', part: node.id, name, sentence: hidden, reads: reads(node.invisible) });
    if (node.type === 'field' && node.field) {
      const required = holds(page, w.requiredWhen, node.required, words);
      if (required) out.push({ kind: 'required', part: node.id, field: node.field, name, sentence: required, reads: reads(node.required) });
      const readonly = holds(page, w.readonlyWhen, node.readonly, words);
      if (readonly) out.push({ kind: 'readonly', part: node.id, field: node.field, name, sentence: readonly, reads: reads(node.readonly) });
      ofField(node.field, node.id, name);
      node.validate?.forEach((rule, index) => out.push({ kind: 'answer', part: node.id, field: node.field, index, name, sentence: answerRuleSentence(page, rule, words), reads: [...new Set([...reads(rule.when), ...reads(rule.holds)])] }));
    } else if (node.type === 'section') {
      // Every field inside a group is read-only while its rule holds.
      const readonly = holds(page, w.readonlyWhen, node.readonly, words);
      if (readonly) out.push({ kind: 'readonly', part: node.id, name, sentence: readonly, reads: reads(node.readonly) });
    }
    for (const child of (node.children ?? []) as Visited[]) visit(child);
  };
  const root = page.layout;
  if (root.type === 'sheet') {
    for (const part of [...(root.buttons ?? []), ...(root.statButtons ?? []), ...(root.badges ?? []), ...(root.alerts ?? []), ...(root.ribbon ? [root.ribbon] : [])] as { id: string; label?: string; message?: string; invisible?: unknown }[]) {
      const hidden = shows(page, part.invisible, words);
      if (hidden) out.push({ kind: 'shows', part: part.id, name: part.label ?? part.message ?? '', sentence: hidden, reads: reads(part.invisible) });
    }
  }
  if (root.type !== 'list') for (const child of root.children as Visited[]) visit(child);
  // Fields worked out that the page no longer shows: their rules still stand.
  for (const [name, def] of Object.entries(page.fields)) ofField(name, null, def.label);
  return out;
}
