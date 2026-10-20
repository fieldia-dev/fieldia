import type { ASTNode } from './parser';
import { isNumber, roundTo, tidy, truthy } from './operations';
import { lazyPart, type Part } from '../parts';
import type * as FunctionsModule from './functions-part';

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
export function listOf(call: Call): unknown {
  const first = call.args[0];
  const rows = first.type === 'Identifier' ? call.env.lines?.(first.name) : undefined;
  return rows ?? call.value(first);
}

/** A condition given in quotes as the value at `at`: refused when it is anything else. */
export function conditionAt(args: readonly ASTNode[], at: number, name: string, example: string): string | undefined {
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
export function numbersOf(call: Call, list: unknown[]): number[] {
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
export function opened(call: Call, args: readonly ASTNode[] = call.args): unknown[] {
  return args.flatMap((arg) => {
    const value = call.value(arg);
    return Array.isArray(value) ? value : [value];
  }).filter((value) => value !== null && value !== undefined);
}

/** The smallest or largest of the values, lists opened: empty ones left out, numbers or text but not both. */
function extreme(call: Call, smaller: boolean): unknown {
  const items = opened(call);
  if (!items.length) return null;
  if (!items.every(isNumber) && !items.every((value) => typeof value === 'string')) return null;
  const ordered = items as (number | string)[];
  return ordered.reduce((best, value) => ((smaller ? value < best : value > best) ? value : best));
}

/** The functions part: the bodies of Fieldia's functions beyond the plain ones (more-functions.ts). */
export type FunctionsPart = typeof FunctionsModule;

/**
 * The bodies of Fieldia's functions beyond the plain ones — a person's age, days and months added, text tested and
 * joined, an average, money rounded to its currency, the first that is not empty — and the calls of the app's own
 * (`functions`, app-functions.ts): loaded before a page that calls one of Fieldia's is drawn (`callsPartFunctions`), or
 * a viewer given the app's: a page that calls none never downloads them. Their names, and what each takes, are known
 * without it, so a page is read and checked as ever.
 */
export const functionsPart: Part<FunctionsPart> = lazyPart('functions', () => import('./functions-part'));

/** The key the functions part is asked by, as an app's function that asks is (`ExpressionEnv.answer`). */
const PART_ASKED = 'fieldia:functions';

/**
 * One of Fieldia's functions whose body is in the functions part. Before the part has come, a value worked out from it
 * waits for it as for an app's function that asks — shown as asked, a condition reading it not holding, a save waiting
 * for it — and is worked out as it comes; where nothing can wait (no form), it gives nothing meanwhile, the part asked
 * for.
 */
function inPart(name: string, takes: readonly [number, number], check?: ExpressionFunction['check']): ExpressionFunction {
  return { takes, ...(check ? { check } : {}), call: (call) => (functionsPart.loaded ? functionsPart.loaded.functionBody(name)(call) : partComing(call)) };
}

/**
 * A call of a function the functions part works out — one of Fieldia's beyond the plain ones, or the app's own — made
 * before the part has come: it waits for it, as an app's function that asks does, or — where nothing can wait (no
 * form) — gives nothing meanwhile, the part asked for.
 */
export function partComing(call: Call): null {
  const coming = functionsPart.load();
  const asked = call.env.answer?.(PART_ASKED, coming);
  if (asked === 'asking') throw new Asking();
  if (!call.env.answer) coming.catch(() => undefined);
  return null;
}

/** The functions whose bodies are in the functions part, each with how many values it takes: at least, at most. */
const IN_PART: [string, number, number][] = [
  ['age', 1, 2],
  ['years', 2, 2],
  ['months', 2, 2],
  ['addDays', 2, 2],
  ['addMonths', 2, 2],
  ['addYears', 2, 2],
  ['contains', 2, 2],
  ['startsWith', 2, 2],
  ['endsWith', 2, 2],
  ['upper', 1, 1],
  ['lower', 1, 1],
  ['join', 2, Infinity],
  ['average', 1, Infinity],
  ['roundMoney', 2, 2],
  ['empty', 1, 1],
  ['firstOf', 1, Infinity],
];

/** What is wrong with the values `average` is given, found as the expression is read: of the lines, a field and a condition. */
function averageCheck(args: readonly ASTNode[]): string | undefined {
  if (!(args[1]?.type === 'Literal' && typeof args[1].value === 'string')) return undefined;
  if (args.length > 3) return `average of the lines takes the lines, a field and a condition: average(lines, 'price', "qty > 0")`;
  return conditionAt(args, 2, 'average', `average(lines, 'price', "qty > 0")`);
}

/** A call of one of these functions. */
const callOf = (names: readonly string[]) => new RegExp(`\\b(${names.join('|')})\\s*\\(`);
const CALLS_IN_PART = callOf(IN_PART.map(([name]) => name));

/**
 * Whether a page (or any part of one) calls a function the functions part works out — one of Fieldia's beyond the
 * plain ones, or one of the app's own named in `app` — its formulas name one. Read over the whole page, so words that
 * look like a call ("Your age (in years)") ask for the part too, which is no harm; one never missed.
 */
export function callsPartFunctions(page: unknown, app: readonly string[] = []): boolean {
  const words = JSON.stringify(page) ?? '';
  return CALLS_IN_PART.test(words) || (app.length > 0 && callOf(app).test(words));
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
  // Fieldia's functions beyond the plain ones: their bodies in the functions part, loaded for a page that calls them.
  ...IN_PART.map(([name, least, most]): [string, ExpressionFunction] => [name, inPart(name, [least, most], name === 'average' ? averageCheck : undefined)]),
]);

/** How many values a function takes, in words: "round takes 1 or 2 values". */
export function takesInWords(name: string, [least, most]: readonly [number, number]): string {
  if (most === 0) return `${name} takes no values`;
  if (least === most) return `${name} takes ${least} value${least === 1 ? '' : 's'}`;
  if (most === Infinity) return `${name} takes ${least} or more values`;
  return `${name} takes ${least} or ${most} values`;
}
