import type { Modifier } from '../format/layout';
import { evaluate, truthy } from './evaluator';
import type { ExpressionEnv } from './functions';
import { ExpressionParser } from './parser';
import { fieldsRead, pathsRead, wheresRead } from './reads';
import { tokenize } from './tokenizer';

/** A modifier read once, ready to evaluate against a record's values. */
export interface CompiledModifier {
  readonly source: Modifier | undefined;
  /** The fields it reads, by their first name, in order of appearance. */
  readonly fields: readonly string[];
  /** The names it reads, whole: `user.roles`, `partner_id.country_id`. */
  readonly paths: readonly string[];
  /** The conditions on lines it counts or adds up by. */
  readonly wheres: readonly { lines: string; condition: string }[];
  /** Whether it holds for these values; `env` gives `sum` and `count` the lines, and `today()` its day. */
  evaluate(values: Readonly<Record<string, unknown>>, env?: ExpressionEnv): boolean;
}

/**
 * Read a modifier. `true`, `false` and a missing modifier become constants;
 * an expression is parsed now, so a mistake surfaces here and not on the
 * first keystroke. Throws when the expression cannot be read.
 */
export function compileModifier(modifier: Modifier | undefined): CompiledModifier {
  if (typeof modifier !== 'string') {
    const value = modifier === true;
    return { source: modifier, fields: [], paths: [], wheres: [], evaluate: () => value };
  }
  const ast = new ExpressionParser(tokenize(modifier)).parse();
  return {
    source: modifier,
    fields: fieldsRead(ast),
    paths: pathsRead(ast),
    wheres: wheresRead(ast),
    evaluate(values, env) {
      try {
        return truthy(evaluate(ast, values, env));
      } catch {
        return false;
      }
    },
  };
}
