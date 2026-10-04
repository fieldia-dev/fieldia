import type { ASTNode } from './parser';
import { isNumber, roundTo, tidy, truthy } from './operations';

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
}

/** One call, as a function sees it: its values unread, a way to read each, and the env. */
interface Call {
  args: readonly ASTNode[];
  value(node: ASTNode): unknown;
  env: ExpressionEnv;
}

interface ExpressionFunction {
  /** How many values it takes: at least, at most. */
  readonly takes: readonly [number, number];
  /** What is wrong with the values it was given, found as the expression is read. */
  check?(args: readonly ASTNode[]): string | undefined;
  call(call: Call): unknown;
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

/** The smallest or largest of the values, lists opened: empty ones left out, numbers or text but not both. */
function extreme(call: Call, smaller: boolean): unknown {
  const items = call.args
    .flatMap((arg) => {
      const value = call.value(arg);
      return Array.isArray(value) ? value : [value];
    })
    .filter((value) => value !== null && value !== undefined);
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
      takes: [1, 2],
      check(args) {
        const field = args[1];
        if (field && !(field.type === 'Literal' && typeof field.value === 'string')) {
          return "sum takes the name of a field, in quotes, after the lines: sum(lines, 'subtotal')";
        }
        return undefined;
      },
      call(call) {
        const list = listOf(call);
        if (list === null || list === undefined) return 0;
        if (!Array.isArray(list)) return null;
        const field = call.args[1]?.type === 'Literal' ? (call.args[1].value as string) : undefined;
        let total = 0;
        for (const item of list) {
          const n = field === undefined ? item : (item as Record<string, unknown> | null)?.[field];
          if (isNumber(n)) total += n;
        }
        return tidy(total);
      },
    },
  ],
  [
    'count',
    {
      takes: [1, 1],
      call(call) {
        const list = listOf(call);
        if (list === null || list === undefined) return 0;
        return Array.isArray(list) ? list.length : null;
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
]);

/** How many values a function takes, in words: "round takes 1 or 2 values". */
export function takesInWords(name: string, [least, most]: readonly [number, number]): string {
  if (most === 0) return `${name} takes no values`;
  if (least === most) return `${name} takes ${least} value${least === 1 ? '' : 's'}`;
  if (most === Infinity) return `${name} takes ${least} or more values`;
  return `${name} takes ${least} or ${most} values`;
}
