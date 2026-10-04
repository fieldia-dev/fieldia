import type { AnswerRule, Field, FieldNode, Page, SetWhen } from '@fieldia/core';
import { storedAs } from './kinds';
import { findNode } from './page-tree';
import { Refusal } from './refusal';
import { formulaProblem, literalOf, problemWords, wouldCircle } from './rules-formula';
import { asksNotFitting, ruleAsks, type Ask } from './rules-words';

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
}

export interface RulesCommandsDeps {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
  getPage(): Page;
  /** Whether a field is the backend's, whose definition the page does not change. */
  fromModel(name: string): boolean;
}

/** The kinds of field a formula can give a value to, as the page format allows. */
const WORKED_OUT = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'json']);

const ASK_WORDS: Record<Ask, string> = {
  minLength: 'a length',
  maxLength: 'a length',
  endsWith: 'an ending',
  pattern: 'a pattern',
  min: 'a range',
  max: 'a range',
  atLeast: 'how many are ticked',
  atMost: 'how many are ticked',
  date: 'a date in the past or the future',
};

function fieldNode(draft: Page, id: string): FieldNode {
  const found = findNode(draft, id);
  if (!found || found.node.type !== 'field') throw new Refusal(`There is no field "${id}"`);
  return found.node;
}

const labelOf = (draft: Page, node: FieldNode) => node.label ?? draft.fields[node.field]?.label ?? node.field;

/** A formula's problem on this page, in words, led by which box it is in when there are several. */
function refuseFormula(draft: Page, source: string, lead = ''): void {
  const problem = formulaProblem(draft, source);
  if (problem) throw new Refusal(`${lead}${problemWords(problem)}`);
}

/** What is wrong with setting this value on this field, in words; null when it can hold it, or it is worked out as it goes. */
export function cannotHold(field: Field, label: string, value: string): string | null {
  const literal = literalOf(value);
  if (!literal || literal.value === null) return null;
  const v = literal.value;
  const said = typeof v === 'string' ? `“${v}”` : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
  const not = () => `“${label}” holds ${storedAs(field)}, not ${said}`;
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
      const labels = field.options.map((o) => o.label);
      const offered = labels.length < 2 ? labels.join('') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
      return `“${label}” offers ${offered}, not ${said}`;
    }
    default:
      return null;
  }
}

/** What is wrong with an answer rule on this field, in words; null when it can be kept. */
export function ruleRefusal(draft: Page, node: FieldNode, rule: AnswerRule): string | null {
  const field = draft.fields[node.field];
  const label = labelOf(draft, node);
  const asks = ruleAsks(rule);
  if (!asks.length) return 'A rule asks for something: a length, an ending, a pattern, a range, how many are ticked or a date';
  const misfit = asksNotFitting(field, rule);
  if (misfit.length) return `“${label}” holds ${storedAs(field)}: ${ASK_WORDS[misfit[0]]} does not fit it`;
  if (rule.pattern !== undefined) {
    try {
      new RegExp(`^(?:${rule.pattern})$`);
    } catch {
      return `The pattern “${rule.pattern}” cannot be read`;
    }
  }
  for (const key of ['minLength', 'maxLength', 'atLeast', 'atMost'] as const) {
    const n = rule[key];
    if (n !== undefined && !(Number.isInteger(n) && n >= (key === 'minLength' || key === 'atLeast' ? 0 : 1))) return key.endsWith('Length') ? 'A length is a whole number of letters' : 'How many are ticked is a whole number';
  }
  for (const key of ['min', 'max'] as const) if (rule[key] !== undefined && !Number.isFinite(rule[key])) return 'A range runs between numbers';
  if (rule.minLength !== undefined && rule.maxLength !== undefined && rule.minLength > rule.maxLength) return `The shortest, ${rule.minLength}, is longer than the longest, ${rule.maxLength}`;
  if (rule.min !== undefined && rule.max !== undefined && rule.min > rule.max) return `The smallest, ${rule.min}, is more than the largest, ${rule.max}`;
  if (rule.atLeast !== undefined && rule.atMost !== undefined && rule.atLeast > rule.atMost) return `At least ${rule.atLeast} is more than at most ${rule.atMost}`;
  if (typeof rule.when === 'string') {
    const problem = formulaProblem(draft, rule.when);
    if (problem) return `Only when: ${problemWords(problem)}`;
  }
  return null;
}

/** Which box of the values set by a rule changed, when only one did: typing in it is one undo step. */
function setWhenBox(before: SetWhen[] | undefined, after: SetWhen[]): string | null {
  if (!before || before.length !== after.length) return null;
  const changed = after.flatMap((item, i) => (['when', 'value'] as const).filter((part) => item[part] !== before[i][part]).map((part) => `${i}:${part}`));
  return changed.length === 1 ? changed[0] : null;
}

export function rulesCommands({ apply, getPage, fromModel }: RulesCommandsDeps): RulesCommands {
  return {
    setCompute(id, expression) {
      return apply(
        (draft) => {
          const node = fieldNode(draft, id);
          const field = draft.fields[node.field];
          const label = labelOf(draft, node);
          if (fromModel(node.field)) throw new Refusal(`How “${label}” is worked out comes from the model`);
          const source = expression?.trim() ?? '';
          if (!source) {
            delete field.compute;
            return;
          }
          if (!WORKED_OUT.has(field.type)) throw new Refusal(`“${label}” holds ${storedAs(field)}, which cannot be worked out from other fields`);
          refuseFormula(draft, source);
          const circle = wouldCircle(draft, node.field, source);
          if (circle) throw new Refusal(circle);
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
          if (fromModel(node.field)) throw new Refusal(`What sets “${label}” comes from the model`);
          if (!list.length) {
            delete field.setWhen;
            return;
          }
          if (!WORKED_OUT.has(field.type)) throw new Refusal(`“${label}” holds ${storedAs(field)}, which cannot be set by a rule`);
          for (const item of list) {
            refuseFormula(draft, item.when, 'When: ');
            refuseFormula(draft, item.value, 'Set to: ');
            const wrong = cannotHold(field, label, item.value);
            if (wrong) throw new Refusal(wrong);
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
        const refusal = ruleRefusal(draft, node, tidy);
        if (refusal) throw new Refusal(refusal);
        node.validate = [...(node.validate ?? []), tidy];
      });
    },

    updateAnswerRule(id, index, patch) {
      return apply(
        (draft) => {
          const node = fieldNode(draft, id);
          const rule = node.validate?.[index];
          if (!rule) throw new Refusal(`“${labelOf(draft, node)}” has no rule ${index + 1}`);
          const next = withoutEmpty({ ...rule, ...patch } as AnswerRulePatch);
          const refusal = ruleRefusal(draft, node, next);
          if (refusal) throw new Refusal(refusal);
          (node.validate as AnswerRule[])[index] = next;
        },
        `answer-rule:${id}:${index}:${Object.keys(patch).sort().join(',')}`
      );
    },

    removeAnswerRule(id, index) {
      return apply((draft) => {
        const node = fieldNode(draft, id);
        if (!node.validate?.[index]) throw new Refusal(`“${labelOf(draft, node)}” has no rule ${index + 1}`);
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
