import type { Field, FieldNode, Page, SetWhen } from '@fieldia/core';
import { readCondition, readHolds, type Condition } from './conditions';
import { findHeaderPart } from './header-commands';
import { storedAs } from './kinds';
import { findContainer, findNode, shownFields } from './page-tree';
import type { PageCheck } from './page-checks';
import { cannotHold } from './rules-commands';
import { formulaProblem, problemWords, wouldCircle } from './rules-formula';
import { asksNotFitting, pageRules, ruleAsks, type RuleEntry, type RuleKind } from './rules-words';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * What would trip people up in a page's rules, each with a fix: a rule
 * reading a field no longer on the page, or waiting for a choice the field
 * no longer offers; a formula that no longer reads; an answer rule that
 * checks nothing; a value set that its field cannot hold. The page's own
 * check says some of these in its words; these say them in a person's, and
 * the same thing is not said twice.
 */

/** Take a rule away, or the parts of its condition that cannot hold. */
export interface RuleFix {
  kind: 'remove-rule';
  /** The part the rule acts on. */
  id: string;
  rule: RuleKind;
  /** Which answer rule, or value set. */
  index?: number;
  /** Only these fields' parts of a condition; none takes the whole rule. */
  fields?: string[];
  /** Only these parts of a condition, by place. */
  parts?: number[];
}

/** What a fix needs of the designer. */
export interface RuleFixer {
  getPage(): Page;
  setCondition(id: string, condition: Condition | null): boolean;
  setRule(id: string, which: 'required' | 'readonly', condition: Condition | null): boolean;
  setCompute(id: string, expression: string | null): boolean;
  setSetWhen(id: string, items: SetWhen[] | null): boolean;
  removeAnswerRule(id: string, index: number): boolean;
}


/** Where each part sits in the page, as the page's own check names it: `layout.children[0].children[3]`. */
function nodePaths(page: Page): Map<string, string> {
  const paths = new Map<string, string>();
  const walk = (node: { id?: string; children?: unknown[] }, path: string) => {
    if (node.id) paths.set(node.id, path);
    node.children?.forEach((child, i) => walk(child as { id?: string; children?: unknown[] }, `${path}.children[${i}]`));
  };
  walk(page.layout as { id?: string; children?: unknown[] }, 'layout');
  return paths;
}

const CONDITION_KEY: Partial<Record<RuleKind, string>> = { shows: 'invisible', required: 'required', readonly: 'readonly' };

/** The rules' checks, and whether the page's own check said one of the same things at a path. */
export function ruleChecks(page: Page, words: DesignerWords = en): { checks: PageCheck[]; covers(path: string): boolean } {
  const w = words.checks;
  const checks: PageCheck[] = [];
  const covered: string[] = [];
  if (page.layout.type === 'list') return { checks, covers: () => false };
  const shown = shownFields(page);
  const paths = nodePaths(page);
  const label = (name: string) => page.fields[name]?.label || name;
  /** Where the page's own check would name this rule. */
  const pathOf = (rule: RuleEntry) => {
    if (rule.kind === 'compute') return `fields.${rule.field}.compute`;
    if (rule.kind === 'set') return `fields.${rule.field}.setWhen[${rule.index}]`;
    const at = rule.part ? paths.get(rule.part) : undefined;
    if (!at) return null;
    return rule.kind === 'answer' ? `${at}.validate[${rule.index}]` : `${at}.${CONDITION_KEY[rule.kind]}`;
  };
  const say = (rule: RuleEntry, severity: PageCheck['severity'], text: string, fix: string, extra: Partial<RuleFix> = {}) => {
    if (!rule.part) return;
    checks.push({ at: rule.part, severity, text, fix: { label: fix, action: { kind: 'remove-rule', id: rule.part, rule: rule.kind, ...(rule.index !== undefined ? { index: rule.index } : {}), ...extra } } });
    const path = pathOf(rule);
    if (path) covered.push(path);
  };

  for (const rule of pageRules(page, words)) {
    // A field it reads that no one can fill in here any more.
    const gone = rule.reads.filter((name) => !shown.has(name));
    if (gone.length) {
      // In a survey nothing else fills it in, and a field not even defined cannot be read; a record may still hold one defined.
      const severity = page.data.kind === 'responses' || gone.some((name) => !page.fields[name]) ? 'must' : 'should';
      say(rule, severity, w.readsGone(rule.name, rule.sentence, gone.map(label)), w.removeTheRule, { fields: gone });
      continue;
    }
    const def = rule.field ? page.fields[rule.field] : undefined;
    if (rule.kind === 'compute' && def?.compute !== undefined && rule.field) {
      const problem = formulaProblem(page, def.compute, words);
      const said = problem ? problemWords(problem, words) : wouldCircle(page, rule.field, def.compute, words);
      if (said) say(rule, 'must', w.formulaBroken(rule.name, said), w.removeTheFormula);
      continue;
    }
    if (rule.kind === 'set' && def?.setWhen && rule.index !== undefined) {
      const item = def.setWhen[rule.index];
      const problem = formulaProblem(page, item.when, words) ?? formulaProblem(page, item.value, words);
      if (problem) {
        say(rule, 'must', w.setBroken(rule.name, rule.sentence, problemWords(problem, words)), w.removeIt);
        continue;
      }
      const wrong = cannotHold(def, rule.name, item.value, words);
      if (wrong) {
        say(rule, 'must', w.setCannotHold(rule.name, rule.sentence, wrong), w.removeIt);
        continue;
      }
    }
    if (rule.kind === 'answer' && rule.index !== undefined && rule.part) {
      const node = findNode(page, rule.part)?.node as FieldNode | undefined;
      const answer = node?.validate?.[rule.index];
      const field = node ? page.fields[node.field] : undefined;
      if (answer && field && answerCheck(rule, answer, field, say, words)) continue;
    }
    // A condition waiting for a choice no longer offered (when a part shows is the page's older check's).
    if (rule.kind !== 'shows' && rule.kind !== 'compute' && rule.part) choiceGone(page, rule, say, words);
  }
  // A path names the rule itself, or something inside it: its pattern, its condition.
  return { checks, covers: (path) => covered.some((at) => path === at || path.startsWith(`${at}.`)) };
}

type Say = (rule: RuleEntry, severity: PageCheck['severity'], text: string, fix: string, extra?: Partial<RuleFix>) => void;

/** An answer rule that checks nothing, or cannot be read: said, and true. */
function answerCheck(rule: RuleEntry, answer: NonNullable<FieldNode['validate']>[number], field: Field, say: Say, words: DesignerWords): boolean {
  const w = words.checks;
  if (answer.pattern !== undefined) {
    try {
      new RegExp(answer.pattern);
    } catch {
      say(rule, 'must', w.patternBroken(rule.name, answer.pattern), w.removeTheRule);
      return true;
    }
  }
  const asks = ruleAsks(answer);
  if (!asks.length) {
    say(rule, 'should', w.asksNothing(rule.name), w.removeTheRule);
    return true;
  }
  if (asksNotFitting(field, answer).length === asks.length) {
    say(rule, 'should', w.checksNothing(rule.name, rule.sentence, storedAs(field, words)), w.removeTheRule);
    return true;
  }
  return false;
}

/** The condition a rule holds by, as the designer builds it; null for one written another way, or none. */
function conditionOf(page: Page, rule: RuleEntry): Condition | null {
  const value = conditionValue(page, rule);
  const held = rule.kind === 'shows' ? readCondition(value) : readHolds(value);
  return held && held !== 'custom' && held !== 'always' ? held : null;
}

/** What a rule's condition is written as, where it is kept. */
function conditionValue(page: Page, rule: RuleEntry): unknown {
  if (!rule.part) return undefined;
  const node = (findNode(page, rule.part)?.node ?? findContainer(page, rule.part) ?? findHeaderPart(page, rule.part)?.part) as Record<string, unknown> | undefined;
  if (rule.kind === 'answer') return (node?.['validate'] as { when?: unknown }[] | undefined)?.[rule.index ?? 0]?.when;
  if (rule.kind === 'set') return rule.field ? page.fields[rule.field]?.setWhen?.[rule.index ?? 0]?.when : undefined;
  const key = CONDITION_KEY[rule.kind];
  return key ? node?.[key] : undefined;
}

function choiceGone(page: Page, rule: RuleEntry, say: Say, words: DesignerWords) {
  // A group's read-only rule is written by hand: there is nothing here to take part of it away with.
  if (!rule.field) return;
  const condition = conditionOf(page, rule);
  condition?.rules.forEach((part, index) => {
    const tested = page.fields[part.field];
    if (part.op !== 'is' || tested?.type !== 'selection' || typeof part.value !== 'string' || tested.options.some((o) => o.value === part.value)) return;
    // A field's own rule loses only that part; an answer rule or a value set goes whole (the fix takes those whole).
    say(rule, 'should', words.checks.neverHolds(rule.name, tested.label, part.value), words.checks.removeTheRule, { parts: [index] });
  });
}

/** Do a rule check's fix. */
export function fixRuleCheck(designer: RuleFixer, fix: RuleFix): boolean {
  const page = designer.getPage();
  const rule = pageRules(page).find((r) => r.part === fix.id && r.kind === fix.rule && (fix.index === undefined || r.index === fix.index));
  if (!rule) return false;
  switch (fix.rule) {
    case 'compute':
      return designer.setCompute(fix.id, null);
    case 'set': {
      const items = (rule.field ? page.fields[rule.field]?.setWhen : undefined) ?? [];
      const left = items.filter((_, i) => i !== fix.index);
      return designer.setSetWhen(fix.id, left.length ? left : null);
    }
    case 'answer':
      return designer.removeAnswerRule(fix.id, fix.index ?? 0);
    default: {
      // A condition: only the parts that cannot hold go, when it is one the designer builds.
      const condition = conditionOf(page, rule);
      const keep = condition && (fix.fields || fix.parts) ? condition.rules.filter((part, i) => !fix.fields?.includes(part.field) && !fix.parts?.includes(i)) : [];
      const next = keep.length && condition ? { join: condition.join, rules: keep } : null;
      return fix.rule === 'shows' ? designer.setCondition(fix.id, next) : designer.setRule(fix.id, fix.rule, next);
    }
  }
}
