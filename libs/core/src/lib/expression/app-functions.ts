import { FUNCTIONS, functionsPart, partComing, type ExpressionFunction, type FunctionTable } from './functions';
import { CONSTANTS } from './tokenizer';

/**
 * The app's own functions, for a page's expressions beside Fieldia's: given as `functions` to the form, the viewer
 * and its wrappers, the page's checks and the designer. A function that asks the app's server gives a promise: the
 * value worked out from it waits while it is asked (`ExpressionEnv.answer`), and its answer is laid only on the
 * record it was asked for.
 */

/** The kinds of value a function takes and gives, as the page's checks and the designer read them. */
export type ValueKind = 'number' | 'text' | 'date' | 'boolean' | 'list' | 'any';

/** What the page's checks and the designer know of an app's function: all but its call. */
export interface FunctionInfo {
  /** How many values it takes: at least, at most (Infinity for any number). Any number when left out. */
  takes?: readonly [number, number];
  /** The kind of each value it takes, in order, the last standing for any after it. Any kind when left out. */
  values?: readonly ValueKind[];
  /** The kind of value it gives. Any when left out. */
  gives?: ValueKind;
  /** What it does, in words, with an example as a formula is written: the designer shows it. */
  tip?: string;
  /** It asks the app's server, its call giving a promise. Found out at its first call when left out. */
  asks?: boolean;
}

/** One of the app's own functions. */
export interface AppFunction extends FunctionInfo {
  /** Its value from the values it is given, in order: a value, or — when it asks the app's server — a promise of one. */
  call(...values: never[]): unknown;
}

/** A function the app gives, by the name a page calls it by: an `AppFunction`, or a plain function. */
export type AppFunctions = Readonly<Record<string, AppFunction | ((...values: never[]) => unknown)>>;

/** The app's functions as the page's checks and the designer take them: what is known of each, with its call or without. */
export type FunctionsKnown = Readonly<Record<string, FunctionInfo | AppFunction | ((...values: never[]) => unknown)>>;

/** The language's own words, which no function may be called. */
const WORDS = new Set(['and', 'or', 'not', 'in']);
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** What is wrong with a name an app gives a function, or undefined when a page may call it so. */
export function functionNameProblem(name: string): string | undefined {
  if (!NAME.test(name)) return `"${name}" cannot name a function: letters, digits and _, not starting with a digit`;
  if (WORDS.has(name.toLowerCase()) || CONSTANTS.has(name)) return `"${name}" is a word of the formula language, not a function's name`;
  if (FUNCTIONS.has(name)) return `"${name}" is Fieldia's own function: give the app's another name`;
  return undefined;
}

/** A function no table names, read where any may be called: it gives nothing. */
const UNKNOWN: ExpressionFunction = { takes: [0, Infinity], call: () => null };

/**
 * A table reading a call of any function: for what reads a page's conditions apart from its form — the fields an
 * amount's look reads, a designer's outline — where the app's functions are not at hand. A call of one gives
 * nothing there; the page's checks, given the app's functions, say which are not.
 */
export const ANY_FUNCTION = { get: (name: string) => (FUNCTIONS.has(name) ? undefined : UNKNOWN), keys: () => [][Symbol.iterator]() } as unknown as FunctionTable;

const tables = new WeakMap<object, FunctionTable>();

/**
 * The table a page's expressions call the app's functions through, read once for each `functions` object. Throws
 * for a name a page cannot call (a word of the language, Fieldia's own function, not a name), so a mistake is said
 * as the form is made. Undefined for none.
 */
export function functionTable(given: FunctionsKnown | undefined): FunctionTable | undefined {
  if (!given) return undefined;
  const found = tables.get(given);
  if (found) return found;
  const table = new Map<string, ExpressionFunction>();
  for (const [name, entry] of Object.entries(given)) {
    const problem = functionNameProblem(name);
    if (problem) throw new Error(`functions: ${problem}`);
    table.set(name, appFunction(name, entry));
  }
  tables.set(given, table);
  return table;
}

/** What is known of an entry: a plain function is one taking any number of values. */
export function functionInfo(entry: FunctionInfo | AppFunction | ((...values: never[]) => unknown)): FunctionInfo {
  return typeof entry === 'function' ? {} : entry;
}

/**
 * One of the app's functions as the page's expressions call it: what it takes known at once, its call made by the
 * functions part (more-functions.ts, `appCall`) — a value worked out from it waiting for the part, as for an answer, until
 * it has come.
 */
function appFunction(name: string, entry: FunctionInfo | AppFunction | ((...values: never[]) => unknown)): ExpressionFunction {
  return { takes: functionInfo(entry).takes ?? [0, Infinity], call: (call) => (functionsPart.loaded ? functionsPart.loaded.appCall(name, entry)(call) : partComing(call)) };
}
