import { evaluate } from './evaluator';
import type { ExpressionEnv, FunctionTable } from './functions';
import { ExpressionParser, type ASTNode } from './parser';
import { callsRead, fieldsRead, pathsRead, sumsRead, wheresRead } from './reads';
import { tokenize } from './tokenizer';

export type { ExpressionEnv, FunctionTable } from './functions';

/** An expression read into its parts, as the page's checks read it: throws when it cannot be read. */
export function parseExpression(source: string, functions?: FunctionTable): ASTNode {
  return new ExpressionParser(tokenize(source), functions).parse();
}

/** An expression read once, ready to work out a value from a record's values many times. */
export interface CompiledExpression {
  readonly source: string;
  /** The fields it reads, by their first name, in order of appearance. */
  readonly fields: readonly string[];
  /** The names it reads, whole: `user.roles`, `partner_id.country_id`. */
  readonly paths: readonly string[];
  /** The conditions on lines it counts or adds up by. */
  readonly wheres: readonly { lines: string; condition: string }[];
  /** The line fields it adds up, as `sum(lines, 'subtotal')` names them. */
  readonly sums: readonly { lines: string; field: string }[];
  /** The functions it calls, by name: what says whether its value follows from the fields it reads alone (`steadyCalls`). */
  readonly calls: readonly string[];
  /** The value, or null when it cannot be worked out. Never throws. */
  evaluate(values: Readonly<Record<string, unknown>>, env?: ExpressionEnv): unknown;
}

/**
 * Read an expression for a value, such as `price * qty` or
 * `if(total > 1000, 10, 0)`. It is parsed now, so a mistake surfaces when the
 * page is read and not on the first keystroke: throws when it cannot be read.
 * `functions`, the app's own, which it may call besides Fieldia's.
 */
export function compileExpression(source: string, functions?: FunctionTable): CompiledExpression {
  const ast = new ExpressionParser(tokenize(source), functions).parse();
  return {
    source,
    fields: fieldsRead(ast),
    paths: pathsRead(ast),
    wheres: wheresRead(ast),
    sums: sumsRead(ast),
    calls: callsRead(ast),
    evaluate(values, env = {}) {
      try {
        return evaluate(ast, values as Record<string, unknown>, env) ?? null;
      } catch {
        return null;
      }
    },
  };
}
