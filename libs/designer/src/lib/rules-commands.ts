import type { AnswerRule, Field, FieldNode, Page, SetWhen } from '@fieldia/core';
import { storedAs } from './kinds';
import { findNode } from './page-tree';
import { Refusal } from './refusal';
import { formulaProblem, literalOf, problemWords, wouldCircle } from './rules-formula';
import { asksNotFitting, ruleAsks } from './rules-words';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * The store's rules: a field's value worked out from others ("Worked out
 * from"), values set when something holds ("Set when…"), and the rules an
 * answer must keep. Each goes through the designer's `apply`, so it is one
 * undo step, checked before it is kept and saved like every other edit; and
 * typing in one box is one step, through the merge key. What cannot be done
 * is refused in words, with the place in a formula where it stops.
 */

/** A change to an answer rule: a value sets that ask, `null` takes it away. */
export type AnswerRulePatch = { [K in keyof AnswerRule]?: AnswerRule[K] | null };

export interface RulesCommands {
  /** A field's value worked out from others, such as `price * qty`; `null` makes it a field to fill in again. */
  setCompute(id: string, expression: string | null): boolean;
  /** Values set when a condition starts to hold, in order; `null` or none takes them all away. */
  setSetWhen(id: string, items: SetWhen[] | null): boolean;
  /** A rule the answer must keep, after the others. */
  addAnswerRule(id: string, rule: AnswerRule): boolean;
  /** One rule changed: a value sets what it asks, `null` takes that away. Typing in one box is one undo step. */
  updateAnswerRule(id: string, index: number, patch: AnswerRulePatch): boolean;
  removeAnswerRule(id: string, index: number): boolean;
  /** A field's first value on a new record (or line), worked out: `user` for the person using the form; `null` takes it away. Typing it is one undo step. */
  setDefaultFrom(id: string, expression: string | null): boolean;
  /** A table of lines: what each new line starts with, line field by line field, read from the record; `null` or none takes it away. */
  setLineDefaults(id: string, values: Record<string, string> | null): boolean;
  /** A link: what a record made from it starts with besides its name; `null` or none takes it away. */
  setCreateValues(id: string, values: Record<string, string> | null): boolean;
}

export interface RulesCommandsDeps {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
  getPage(): Page;
  /** Whether a field is the backend's, whose definition the page does not change. */
  fromModel(name: string): boolean;
}

/** The kinds of field a formula can give a value to, as the page format allows. */
const WORKED_OUT = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'json']);

function fieldNode(draft: Page, id: string): FieldNode {
  const found = findNode(draft, id);
  if (!found || found.node.type !== 'field') throw new Refusal((w) => w.refusals.noField(id));
  return found.node;
}

const labelOf = (draft: Page, node: FieldNode) => node.label ?? draft.fields[node.field]?.label ?? node.field;

/** A formula's problem on this page, in words, led by which box it is in when there are several. */
function refuseFormula(draft: Page, source: string, lead: (w: DesignerWords, problem: string) => string = (_w, problem) => problem): void {
  if (formulaProblem(draft, source)) throw new Refusal((w) => lead(w, problemWords(formulaProblem(draft, source, w), w)));
}

/** What is wrong with setting this value on this field, in words; null when it can hold it, or it is worked out as it goes. */
export function cannotHold(field: Field, label: string, value: string, words: DesignerWords = en): string | null {
  const w = words.rules;
  const literal = literalOf(value);
  if (!literal || literal.value === null) return null;
  const v = literal.value;
  const said = typeof v === 'string' ? w.text(v) : typeof v === 'boolean' ? (v ? w.yes : w.no) : String(v);
  const not = () => w.holdsNot(label, storedAs(field, words), said);
  switch (field.type) {
    case 'integer':
      return typeof v === 'number' && Number.isInteger(v) ? null : not();
    case 'float':
    case 'monetary':
      return typeof v === 'number' ? null : not();
    case 'boolean':
      return typeof v === 'boolean' ? null : not();
    case 'date':
    case 'datetime':
      return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? null : not();
    case 'char':
    case 'text':
    case 'html':
      return typeof v === 'boolean' ? not() : null;
    case 'selection': {
      if (field.options.some((o) => o.value === v) || (field.other && typeof v === 'string')) return null;
      return w.offersNot(label, field.options.map((o) => o.label), said);
    }
    default:
      return null;
  }
}

/** What is wrong with an answer rule on this field, in words; null when it can be kept. */
export function ruleRefusal(draft: Page, node: FieldNode, rule: AnswerRule, words: DesignerWords = en): string | null {
  const w = words.rules;
  const field = draft.fields[node.field];
  const label = labelOf(draft, node);
  const asks = ruleAsks(rule);
  if (!asks.length) return w.askSomething;
  const misfit = asksNotFitting(field, rule);
  if (misfit.length) return w.askMisfit(label, storedAs(field, words), w.asks[misfit[0]]);
  if (rule.pattern !== undefined) {
    try {
      new RegExp(`^(?:${rule.pattern})$`);
    } catch {
      return w.patternUnreadable(rule.pattern);
    }
  }
  for (const key of ['minLength', 'maxLength', 'atLeast', 'atMost'] as const) {
    const n = rule[key];
    if (n !== undefined && !(Number.isInteger(n) && n >= (key === 'minLength' || key === 'atLeast' ? 0 : 1))) return key.endsWith('Length') ? w.lengthWhole : w.tickedWhole;
  }
  for (const key of ['min', 'max'] as const) if (rule[key] !== undefined && !Number.isFinite(rule[key])) return w.rangeNumbers;
  if (rule.minLength !== undefined && rule.maxLength !== undefined && rule.minLength > rule.maxLength) return w.shortestLonger(rule.minLength, rule.maxLength);
  if (rule.min !== undefined && rule.max !== undefined && rule.min > rule.max) return w.smallestMore(rule.min, rule.max);
  if (rule.atLeast !== undefined && rule.atMost !== undefined && rule.atLeast > rule.atMost) return w.atLeastMore(rule.atLeast, rule.atMost);
  if (rule.holds !== undefined) {
    const problem = formulaProblem(draft, rule.holds, words);
    if (problem) return w.inMustHold(problemWords(problem, words));
  }
  if (typeof rule.when === 'string') {
    const problem = formulaProblem(draft, rule.when, words);
    if (problem) return w.inOnlyWhen(problemWords(problem, words));
  }
  return null;
}

/** Which box of the values set by a rule changed, when only one did: typing in it is one undo step. */
function setWhenBox(before: SetWhen[] | undefined, after: SetWhen[]): string | null {
  if (!before || before.length !== after.length) return null;
  const changed = after.flatMap((item, i) => (['when', 'value'] as const).filter((part) => item[part] !== before[i][part]).map((part) => `${i}:${part}`));
  return changed.length === 1 ? changed[0] : null;
}

/** A map kept as typed: names and formulas trimmed, empty ones left out; null when none is left. */
function tidyMap(values: Record<string, string> | null): Record<string, string> | null {
  const kept = Object.entries(values ?? {}).map(([name, source]) => [name.trim(), source.trim()] as const).filter(([name, source]) => name && source);
  return kept.length ? Object.fromEntries(kept) : null;
}

export function rulesCommands({ apply, getPage, fromModel }: RulesCommandsDeps): RulesCommands {
  return {
    setDefaultFrom(id, expression) {
      return apply(
        (draft) => {
          const node = fieldNode(draft, id);
          const field = draft.fields[node.field];
          const source = expression?.trim() ?? '';
          if (!source) {
            delete field.defaultFrom;
            return;
          }
          refuseFormula(draft, source);
          field.defaultFrom = source;
        },
        expression?.trim() ? `default-from:${id}` : null
      );
    },

    setLineDefaults(id, values) {
      const map = tidyMap(values);
      return apply((draft) => {
        const node = fieldNode(draft, id);
        const field = draft.fields[node.field];
        if (field.type !== 'one2many') throw new Refusal((w) => w.refusals.noField(id));
        if (!map) {
          delete field.lineDefaults;
          return;
        }
        for (const [name, source] of Object.entries(map)) {
          if (!field.fields[name]) throw new Refusal((w) => w.rules.notALineField(name, labelOf(draft, node)));
          refuseFormula(draft, source);
        }
        field.lineDefaults = map;
      }, map ? `line-defaults:${id}` : null);
    },

    setCreateValues(id, values) {
      const map = tidyMap(values);
      return apply((draft) => {
        const node = fieldNode(draft, id);
        const field = draft.fields[node.field];
        if (field.type !== 'many2one' && field.type !== 'many2many') throw new Refusal((w) => w.refusals.noField(id));
        if (!map) {
          delete field.createValues;
          return;
        }
        for (const source of Object.values(map)) refuseFormula(draft, source);
        field.createValues = map;
      }, map ? `create-values:${id}` : null);
    },

    setCompute(id, expression) {
      return apply(
        (draft) => {
          const node = fieldNode(draft, id);
          const field = draft.fields[node.field];
          const label = labelOf(draft, node);
          if (fromModel(node.field)) throw new Refusal((w) => w.rules.computeFromModel(label));
          const source = expression?.trim() ?? '';
          if (!source) {
            delete field.compute;
            return;
          }
          if (!WORKED_OUT.has(field.type)) throw new Refusal((w) => w.rules.cannotBeWorkedOut(label, storedAs(field, w)));
          refuseFormula(draft, source);
          if (wouldCircle(draft, node.field, source)) throw new Refusal((w) => wouldCircle(draft, node.field, source, w) as string);
          field.compute = source;
        },
        // Typing a formula is one step; taking it away is a step of its own.
        expression?.trim() ? `compute:${id}` : null
      );
    },

    setSetWhen(id, items) {
      const list = (items ?? []).map((item) => ({ when: item.when.trim(), value: item.value.trim() }));
      // Typing in one box — a value, or when — is one undo step; another box is another.
      const now = findNode(getPage(), id)?.node;
      const box = now?.type === 'field' ? setWhenBox(getPage().fields[now.field]?.setWhen, list) : null;
      return apply(
        (draft) => {
          const node = fieldNode(draft, id);
          const field = draft.fields[node.field];
          const label = labelOf(draft, node);
          if (fromModel(node.field)) throw new Refusal((w) => w.rules.setFromModel(label));
          if (!list.length) {
            delete field.setWhen;
            return;
          }
          if (!WORKED_OUT.has(field.type)) throw new Refusal((w) => w.rules.cannotBeSet(label, storedAs(field, w)));
          for (const item of list) {
            refuseFormula(draft, item.when, (w, problem) => w.rules.inWhen(problem));
            refuseFormula(draft, item.value, (w, problem) => w.rules.inSetTo(problem));
            if (cannotHold(field, label, item.value)) throw new Refusal((w) => cannotHold(field, label, item.value, w) as string);
          }
          field.setWhen = list;
        },
        box ? `set-when:${id}:${box}` : null
      );
    },

    addAnswerRule(id, rule) {
      return apply((draft) => {
        const node = fieldNode(draft, id);
        const tidy = withoutEmpty(rule);
        if (ruleRefusal(draft, node, tidy)) throw new Refusal((w) => ruleRefusal(draft, node, tidy, w) as string);
        node.validate = [...(node.validate ?? []), tidy];
      });
    },

    updateAnswerRule(id, index, patch) {
      return apply(
        (draft) => {
          const node = fieldNode(draft, id);
          const rule = node.validate?.[index];
          if (!rule) throw new Refusal((w) => w.rules.noRule(labelOf(draft, node), index + 1));
          const next = withoutEmpty({ ...rule, ...patch } as AnswerRulePatch);
          if (ruleRefusal(draft, node, next)) throw new Refusal((w) => ruleRefusal(draft, node, next, w) as string);
          (node.validate as AnswerRule[])[index] = next;
        },
        `answer-rule:${id}:${index}:${Object.keys(patch).sort().join(',')}`
      );
    },

    removeAnswerRule(id, index) {
      return apply((draft) => {
        const node = fieldNode(draft, id);
        if (!node.validate?.[index]) throw new Refusal((w) => w.rules.noRule(labelOf(draft, node), index + 1));
        node.validate.splice(index, 1);
        if (!node.validate.length) delete node.validate;
      });
    },
  };
}

/** A rule with what was taken away left out: `null`, and an empty message. */
function withoutEmpty(rule: AnswerRulePatch): AnswerRule {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rule)) if (value !== null && value !== undefined && !(key === 'message' && value === '')) out[key] = value;
  return out as AnswerRule;
}
