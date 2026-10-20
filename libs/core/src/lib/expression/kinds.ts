import type { Field, LineField } from '../format/field';
import { infoOf, type FunctionsKnown, type ValueKind } from './app-functions';
import type { ASTNode } from './parser';

/**
 * What kind of value each part of an expression gives, where it can be known — a field's by its type, a literal's
 * by itself, a function's by what it gives — and the values handed to a function of a kind it does not take:
 * `age(notes)`, `upper(amount)`, `addDays(start, 'two')`. What cannot be known (a link's id, a value the app passes
 * in) is any kind, and never refused. Read where pages are made and checked (`validatePage`, the designer), not
 * where they are shown: a function given a value it does not take gives null, never an error.
 */

/** What a function takes, value by value — each one kind or several, the last standing for any after it — and gives. */
interface Kinds {
  values: readonly (ValueKind | readonly ValueKind[])[];
  gives: ValueKind;
}

const any: Kinds = { values: ['any'], gives: 'any' };
const n = (...values: (ValueKind | readonly ValueKind[])[]): Kinds['values'] => values;

/** Fieldia's own functions, by kind. */
const FUNCTION_KINDS: Readonly<Record<string, Kinds>> = {
  round: { values: n('number', 'number'), gives: 'number' },
  abs: { values: n('number'), gives: 'number' },
  min: any,
  max: any,
  len: { values: n(['text', 'list']), gives: 'number' },
  today: { values: [], gives: 'date' },
  sum: { values: n('list', 'text', 'text'), gives: 'number' },
  count: { values: n('list', 'text'), gives: 'number' },
  days: { values: n('date', 'date'), gives: 'number' },
  if: any,
  age: { values: n('date', 'date'), gives: 'number' },
  years: { values: n('date', 'date'), gives: 'number' },
  months: { values: n('date', 'date'), gives: 'number' },
  addDays: { values: n('date', 'number'), gives: 'date' },
  addMonths: { values: n('date', 'number'), gives: 'date' },
  addYears: { values: n('date', 'number'), gives: 'date' },
  contains: { values: n(['text', 'list'], 'any'), gives: 'boolean' },
  startsWith: { values: n('text', ['text', 'number']), gives: 'boolean' },
  endsWith: { values: n('text', ['text', 'number']), gives: 'boolean' },
  upper: { values: n('text'), gives: 'text' },
  lower: { values: n('text'), gives: 'text' },
  join: { values: n('text', 'any'), gives: 'text' },
  average: { values: n('any'), gives: 'number' },
  roundMoney: { values: n('number', 'text'), gives: 'number' },
  empty: { values: n('any'), gives: 'boolean' },
  firstOf: any,
};

/** The kind a field's value is, as expressions read it. */
export function fieldKind(def: Field | LineField | undefined): ValueKind {
  switch (def?.type) {
    case 'char':
    case 'text':
    case 'html':
      return 'text';
    case 'integer':
    case 'float':
    case 'monetary':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'datetime':
      return 'date';
    case 'many2many':
    case 'one2many':
      return 'list';
    case 'selection':
      if (def.multiple) return 'list';
      return def.options.length && def.options.every((o) => typeof o.value === 'string') ? 'text' : 'any';
    default:
      return 'any';
  }
}

/** A value handed to a function of a kind it does not take. */
export interface KindProblem {
  /** The function. */
  name: string;
  /** Which of its values, from 0. */
  at: number;
  /** The kinds it takes there. */
  wants: readonly ValueKind[];
  /** The kind it was given. */
  got: ValueKind;
  /** What was given, as written. */
  given: ASTNode;
}

/** Where an expression's names are found: its fields, and on a line the record it is on (`parent`). */
export interface KindScope {
  fields: Readonly<Record<string, Field | LineField>>;
  parent?: Readonly<Record<string, Field | LineField>>;
}

/** Whether a value of kind `got` may go where `wants` are taken: a date is text too. */
const takes = (wants: readonly ValueKind[], got: ValueKind) => got === 'any' || wants.includes('any') || wants.includes(got) || (got === 'date' && wants.includes('text'));

/** Every value in the expression handed to a function of a kind it does not take, the outer call first. */
export function kindProblems(ast: ASTNode, scope: KindScope, functions?: FunctionsKnown): KindProblem[] {
  const problems: KindProblem[] = [];
  const kindsOf = (name: string): Kinds | undefined => {
    if (FUNCTION_KINDS[name]) return FUNCTION_KINDS[name];
    const entry = functions?.[name];
    if (!entry) return undefined;
    const info = infoOf(entry);
    return { values: info.values ?? ['any'], gives: info.gives ?? 'any' };
  };
  const kind = (node: ASTNode): ValueKind => {
    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'number') return 'number';
        if (typeof node.value === 'boolean') return 'boolean';
        if (Array.isArray(node.value)) return 'list';
        if (typeof node.value === 'string') return /^\d{4}-\d{2}-\d{2}/.test(node.value) ? 'date' : 'text';
        return 'any';
      case 'Identifier': {
        const [root, part, ...more] = node.name.split('.');
        if (part === undefined) return fieldKind(scope.fields[root]);
        if (root === 'parent' && !more.length && scope.parent) return fieldKind(scope.parent[part]);
        return 'any';
      }
      case 'UnaryOp':
        kind(node.operand);
        return node.operator === 'not' ? 'boolean' : 'number';
      case 'BinaryOp': {
        const left = kind(node.left);
        const right = kind(node.right);
        if (node.operator === 'and' || node.operator === 'or') return left === right ? left : 'any';
        if (node.operator === '+') return left === 'text' || right === 'text' ? 'text' : left === 'number' && right === 'number' ? 'number' : 'any';
        return ['-', '*', '/', '%'].includes(node.operator) ? 'number' : 'boolean';
      }
      case 'Call': {
        const kinds = kindsOf(node.name);
        node.args.forEach((arg, at) => {
          const got = kind(arg);
          if (!kinds || !kinds.values.length) return;
          const wanted = kinds.values[Math.min(at, kinds.values.length - 1)];
          const wants = typeof wanted === 'string' ? [wanted] : wanted;
          // What a sum, a count or an average of lines is given is read by their own checks.
          if (node.name === 'sum' || node.name === 'count' || node.name === 'average') return;
          if (!takes(wants, got)) problems.push({ name: node.name, at, wants, got, given: arg });
        });
        return kinds?.gives ?? 'any';
      }
      default:
        return 'any';
    }
  };
  kind(ast);
  return problems;
}

const KIND_WORDS: Record<ValueKind, string> = { number: 'a number', text: 'text', date: 'a date', boolean: 'yes or no', list: 'a list', any: 'any value' };
const PLACES = ['first', 'second', 'third', 'fourth', 'fifth'];

/** A kind in English words, as a page's checks say them: "a number", "a date or text". */
export const kindWords = (kinds: readonly ValueKind[]) => kinds.map((k) => KIND_WORDS[k]).join(' or ');

/** A part of an expression as it is written, shortly: a field by its name, words in quotes, a call by its function. */
export function writtenAs(node: ASTNode): string {
  switch (node.type) {
    case 'Identifier':
      return `"${node.name}"`;
    case 'Literal':
      return typeof node.value === 'string' ? `'${node.value}'` : JSON.stringify(node.value);
    case 'Call':
      return `${node.name}(…)`;
    default:
      return 'what it is given';
  }
}

/** A problem in a page's check's words: `age takes a date as its first value; "notes" is text`. */
export function kindProblemWords(problem: KindProblem): string {
  const place = problem.at < PLACES.length ? `as its ${PLACES[problem.at]} value` : `as value ${problem.at + 1}`;
  return `${problem.name} takes ${kindWords(problem.wants)} ${place}; ${writtenAs(problem.given)} is ${KIND_WORDS[problem.got]}`;
}
