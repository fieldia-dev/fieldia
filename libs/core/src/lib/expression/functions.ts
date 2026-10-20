import type { ASTNode } from './parser';
import { isNumber, roundTo, tidy, truthy } from './operations';
import { addDays, addMonths, monthsBetween } from './dates';
import { placesOfCurrency } from '../record/input-rules';

/**
 * The functions an expression may call. Each says how many values it takes,
 * so a call with too many or too few is refused when the page is read; and
 * each gives null rather than failing when what it is handed does not fit.
 */

/** What an expression is worked out with, besides the record's values. */
export interface ExpressionEnv {
  /**
   * The lines of a one2many, as rows of their values, for `sum` and `count`:
   * the values hold only the lines' keys. Sections and notes are left out.
   */
  lines?(field: string): readonly Readonly<Record<string, unknown>>[] | undefined;
  /** Today, as YYYY-MM-DD. The computer's own clock when left out. */
  today?(): string;
  /** The app's own functions, by name, besides Fieldia's (`functions` on the form, the viewer and its wrappers). */
  functions?: FunctionTable;
  /**
   * The answer an app's function that asks (its call a promise) gave for these values, by its key — the function
   * and its values: `{ value }`, or `'asking'` while it is on its way. Handed the promise the first time, the form
   * keeps the answer for the record shown, and works its values out again as it comes. Left out, such a function
   * gives null and is not asked.
   */
  answer?(key: string, asked?: PromiseLike<unknown>): Answered | 'asking' | undefined;
  /** The name of the record a link field holds (`currency_id`: "EGP"), for what reads a record by its name. */
  nameOf?(field: string): string | undefined;
}

/** What an app's function that asks answered: its value, or — empty — why it did not come (`failed`). */
export interface Answered {
  value: unknown;
  failed?: string;
}

/** One call, as a function sees it: its values unread, a way to read each, and the env. */
export interface Call {
  args: readonly ASTNode[];
  value(node: ASTNode): unknown;
  env: ExpressionEnv;
  /** Whether a condition, written in quotes, holds for one line's values. */
  holds(condition: string, row: Readonly<Record<string, unknown>>): boolean;
}

/** A function an expression may call: Fieldia's own, or the app's (`FunctionTable`). */
export interface ExpressionFunction {
  /** How many values it takes: at least, at most. */
  readonly takes: readonly [number, number];
  /** What is wrong with the values it was given, found as the expression is read. */
  check?(args: readonly ASTNode[]): string | undefined;
  call(call: Call): unknown;
}

/** The functions an expression may call besides Fieldia's own, by name: the app's (`functionTable`). */
export type FunctionTable = ReadonlyMap<string, ExpressionFunction>;

/**
 * Thrown while an app's function that asks is waiting for its answer: the expression has no value yet. A value
 * worked out from it waits (null meanwhile), a condition reading it does not hold yet.
 */
export class Asking extends Error {
  constructor() {
    super('waiting for an answer');
  }
}

/** A day as YYYY-MM-DD, in the computer's own time zone. */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The list a function counts or adds up: the rows of a one2many named by its field, or any list. */
function listOf(call: Call): unknown {
  const first = call.args[0];
  const rows = first.type === 'Identifier' ? call.env.lines?.(first.name) : undefined;
  return rows ?? call.value(first);
}

/** A condition given in quotes as the value at `at`: refused when it is anything else. */
function conditionAt(args: readonly ASTNode[], at: number, name: string, example: string): string | undefined {
  const arg = args[at];
  return arg && !(arg.type === 'Literal' && typeof arg.value === 'string') ? `${name} takes a condition, in quotes, on the lines: ${example}` : undefined;
}

/** The rows a function counts or adds up, only those where the condition at `at` holds when there is one. */
function rowsWhere(call: Call, list: unknown[], at: number): unknown[] {
  const condition = call.args[at];
  if (condition?.type !== 'Literal' || typeof condition.value !== 'string') return list;
  const source = condition.value;
  return list.filter((row) => row !== null && typeof row === 'object' && call.holds(source, row as Record<string, unknown>));
}

/** The numbers of a list a function adds up: its items, or a field of its rows (`sum(lines, 'x')`), where a condition holds. */
function numbersOf(call: Call, list: unknown[]): number[] {
  const field = call.args[1]?.type === 'Literal' ? (call.args[1].value as string) : undefined;
  return rowsWhere(call, list, 2)
    .map((item) => (field === undefined ? item : (item as Record<string, unknown> | null)?.[field]))
    .filter(isNumber);
}

/** A day from a date or a datetime, as days since 1970: null when it is not one. */
function dayNumber(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000 : null;
}

/** The values given, lists opened, empty ones left out. */
function opened(call: Call, args: readonly ASTNode[] = call.args): unknown[] {
  return args.flatMap((arg) => {
    const value = call.value(arg);
    return Array.isArray(value) ? value : [value];
  }).filter((value) => value !== null && value !== undefined);
}

/** Empty as a person sees it: nothing, text of only spaces, an empty list or object. Zero and no are values. */
export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === 'object' && Object.keys(value).length === 0;
}

/** Text as compared whatever its case. */
const folded = (text: string) => text.toLowerCase();

/** A test on text whatever its case: false for empty text, null for what is not text. */
function textTest(test: (text: string, part: string) => boolean): ExpressionFunction {
  return {
    takes: [2, 2],
    call({ args, value }) {
      const text = value(args[0]);
      const part = value(args[1]);
      if (text === null || text === undefined || text === '') return false;
      if (typeof text !== 'string' || (typeof part !== 'string' && !isNumber(part))) return null;
      return test(folded(text), folded(String(part)));
    },
  };
}

/** Text in capitals or small letters; null for what is not text. */
function textCase(upper: boolean): ExpressionFunction {
  return {
    takes: [1, 1],
    call({ args, value }) {
      const text = value(args[0]);
      return typeof text === 'string' ? (upper ? text.toUpperCase() : text.toLowerCase()) : null;
    },
  };
}

/** A day moved by a whole number of days, months or years. */
function moveDay(move: (day: unknown, n: number) => string | null, times = 1): ExpressionFunction {
  return {
    takes: [2, 2],
    call({ args, value }) {
      const n = value(args[1]);
      return isNumber(n) ? move(value(args[0]), Math.trunc(n) * times) : null;
    },
  };
}

/** Whole months, or years, from one day to another. */
function between(per: number): ExpressionFunction {
  return {
    takes: [2, 2],
    call({ args, value }) {
      const months = monthsBetween(value(args[0]), value(args[1]));
      return months === null ? null : Math.trunc(months / per);
    },
  };
}

/** The smallest or largest of the values, lists opened: empty ones left out, numbers or text but not both. */
function extreme(call: Call, smaller: boolean): unknown {
  const items = opened(call);
  if (!items.length) return null;
  if (!items.every(isNumber) && !items.every((value) => typeof value === 'string')) return null;
  const ordered = items as (number | string)[];
  return ordered.reduce((best, value) => ((smaller ? value < best : value > best) ? value : best));
}

export const FUNCTIONS: ReadonlyMap<string, ExpressionFunction> = new Map<string, ExpressionFunction>([
  [
    'round',
    {
      takes: [1, 2],
      call({ args, value }) {
        const x = value(args[0]);
        const digits = args.length > 1 ? value(args[1]) : 0;
        return isNumber(x) && isNumber(digits) ? roundTo(x, digits) : null;
      },
    },
  ],
  [
    'abs',
    {
      takes: [1, 1],
      call({ args, value }) {
        const x = value(args[0]);
        return isNumber(x) ? Math.abs(x) : null;
      },
    },
  ],
  ['min', { takes: [1, Infinity], call: (call) => extreme(call, true) }],
  ['max', { takes: [1, Infinity], call: (call) => extreme(call, false) }],
  [
    'len',
    {
      takes: [1, 1],
      call({ args, value }) {
        const x = value(args[0]);
        if (x === null || x === undefined) return 0;
        return typeof x === 'string' || Array.isArray(x) ? x.length : null;
      },
    },
  ],
  ['today', { takes: [0, 0], call: ({ env }) => env.today?.() ?? localDay(new Date()) }],
  [
    'sum',
    {
      takes: [1, 3],
      check(args) {
        const field = args[1];
        if (field && !(field.type === 'Literal' && typeof field.value === 'string')) {
          return "sum takes the name of a field, in quotes, after the lines: sum(lines, 'subtotal')";
        }
        return conditionAt(args, 2, 'sum', `sum(lines, 'amount', "state == 'done'")`);
      },
      call(call) {
        const list = listOf(call);
        if (list === null || list === undefined) return 0;
        if (!Array.isArray(list)) return null;
        const numbers = numbersOf(call, list);
        return tidy(numbers.reduce((total, n) => total + n, 0));
      },
    },
  ],
  [
    'count',
    {
      takes: [1, 2],
      check: (args) => conditionAt(args, 1, 'count', `count(lines, "state == 'done'")`),
      call(call) {
        const list = listOf(call);
        if (list === null || list === undefined) return 0;
        return Array.isArray(list) ? rowsWhere(call, list, 1).length : null;
      },
    },
  ],
  [
    'days',
    {
      takes: [2, 2],
      // From one day to another: negative when the second comes first. A datetime counts by its day.
      call({ args, value }) {
        const from = dayNumber(value(args[0]));
        const to = dayNumber(value(args[1]));
        return from === null || to === null ? null : to - from;
      },
    },
  ],
  [
    'if',
    {
      takes: [3, 3],
      // Only the branch chosen is worked out.
      call: ({ args, value }) => (truthy(value(args[0])) ? value(args[1]) : value(args[2])),
    },
  ],
  [
    'age',
    {
      takes: [1, 2],
      // Whole years from a birth date to a day — today on the page's clock unless given — as years() counts them.
      call({ args, value, env }) {
        const months = monthsBetween(value(args[0]), args.length > 1 ? value(args[1]) : (env.today?.() ?? localDay(new Date())));
        return months === null ? null : Math.trunc(months / 12);
      },
    },
  ],
  ['years', between(12)],
  ['months', between(1)],
  ['addDays', moveDay(addDays)],
  ['addMonths', moveDay(addMonths)],
  ['addYears', moveDay(addMonths, 12)],
  [
    'contains',
    {
      takes: [2, 2],
      // Text holding words, whatever their case; a list (choices ticked, links) holding a value.
      call({ args, value }) {
        const where = value(args[0]);
        const what = value(args[1]);
        if (Array.isArray(where)) return where.includes(what);
        if (where === null || where === undefined || where === '') return false;
        if (typeof where !== 'string' || (typeof what !== 'string' && !isNumber(what))) return null;
        return folded(where).includes(folded(String(what)));
      },
    },
  ],
  ['startsWith', textTest((text, part) => text.startsWith(part))],
  ['endsWith', textTest((text, part) => text.endsWith(part))],
  ['upper', textCase(true)],
  ['lower', textCase(false)],
  [
    'join',
    {
      takes: [2, Infinity],
      // The values after the first, lists opened, empty ones left out, with the first between them: join(' ', first, last).
      call(call) {
        const between = call.value(call.args[0]);
        if (typeof between !== 'string') return null;
        const items = opened(call, call.args.slice(1)).filter((item) => !isBlank(item));
        if (!items.every((item) => typeof item === 'string' || isNumber(item))) return null;
        return items.map(String).join(between);
      },
    },
  ],
  [
    'average',
    {
      takes: [1, Infinity],
      // Of the values or a list — or, as sum takes them, a field of the lines where a condition holds — empty ones left out.
      check(args) {
        if (!(args[1]?.type === 'Literal' && typeof args[1].value === 'string')) return undefined;
        if (args.length > 3) return `average of the lines takes the lines, a field and a condition: average(lines, 'price', "qty > 0")`;
        return conditionAt(args, 2, 'average', `average(lines, 'price', "qty > 0")`);
      },
      call(call) {
        const lines = call.args[1]?.type === 'Literal' && typeof call.args[1].value === 'string';
        let numbers: unknown[];
        if (lines) {
          const list = listOf(call);
          if (list !== null && list !== undefined && !Array.isArray(list)) return null;
          numbers = numbersOf(call, (list as unknown[] | null) ?? []);
        } else {
          numbers = opened(call);
          if (!numbers.every(isNumber)) return null;
        }
        const all = numbers as number[];
        return all.length ? tidy(all.reduce((total, n) => total + n, 0) / all.length) : null;
      },
    },
  ],
  [
    'roundMoney',
    {
      takes: [2, 2],
      // Rounded to its currency's places: 3 for a Jordanian dinar, 0 for a yen, 2 for most. A link to a currency is read by its name.
      call({ args, value, env }) {
        const amount = value(args[0]);
        const named = args[1].type === 'Identifier' ? env.nameOf?.(args[1].name) : undefined;
        const currency = named ?? value(args[1]);
        if (!isNumber(amount) || typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency)) return null;
        return roundTo(amount, placesOfCurrency(currency.toUpperCase()));
      },
    },
  ],
  ['empty', { takes: [1, 1], call: ({ args, value }) => isBlank(value(args[0])) }],
  [
    'firstOf',
    {
      takes: [1, Infinity],
      // The first value that is not empty — zero and no are values — read only as far as it is found.
      call({ args, value }) {
        for (const arg of args) {
          const found = value(arg);
          if (!isBlank(found)) return found;
        }
        return null;
      },
    },
  ],
]);

/** How many values a function takes, in words: "round takes 1 or 2 values". */
export function takesInWords(name: string, [least, most]: readonly [number, number]): string {
  if (most === 0) return `${name} takes no values`;
  if (least === most) return `${name} takes ${least} value${least === 1 ? '' : 's'}`;
  if (most === Infinity) return `${name} takes ${least} or more values`;
  return `${name} takes ${least} or ${most} values`;
}
