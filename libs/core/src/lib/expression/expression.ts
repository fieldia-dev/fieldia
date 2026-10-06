import { evaluate } from './evaluator';
import type { ExpressionEnv } from './functions';
import { ExpressionParser } from './parser';
import { fieldsRead, pathsRead, sumsRead } from './reads';
import { tokenize } from './tokenizer';

export type { ExpressionEnv } from './functions';

/** An expression read once, ready to work out a value from a record's values many times. */
export interface CompiledExpression {
  readonly source: string;
  /** The fields it reads, by their first name, in order of appearance. */
  readonly fields: readonly string[];
  /** The names it reads, whole: `user.roles`, `partner_id.country_id`. */
  readonly paths: readonly string[];
  /** The line fields it adds up, as `sum(lines, 'subtotal')` names them. */
  readonly sums: readonly { lines: string; field: string }[];
  /** The value, or null when it cannot be worked out. Never throws. */
  evaluate(values: Readonly<Record<string, unknown>>, env?: ExpressionEnv): unknown;
}

/**
 * Read an expression for a value, such as `price * qty` or
 * `if(total > 1000, 10, 0)`. It is parsed now, so a mistake surfaces when the
 * page is read and not on the first keystroke: throws when it cannot be read.
 */
export function compileExpression(source: string): CompiledExpression {
  const ast = new ExpressionParser(tokenize(source)).parse();
  return {
    source,
    fields: fieldsRead(ast),
    paths: pathsRead(ast),
    sums: sumsRead(ast),
    evaluate(values, env = {}) {
      try {
        return evaluate(ast, values as Record<string, unknown>, env) ?? null;
      } catch {
        return null;
      }
    },
  };
}
