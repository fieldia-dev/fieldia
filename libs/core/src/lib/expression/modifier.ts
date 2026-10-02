import type { Modifier } from '../format/layout';
import { evaluate, truthy } from './evaluator';
import { ExpressionParser, type ASTNode } from './parser';
import { tokenize } from './tokenizer';

/** A modifier read once, ready to evaluate against a record's values. */
export interface CompiledModifier {
  readonly source: Modifier | undefined;
  /** The fields it reads, by their first name, in order of appearance. */
  readonly fields: readonly string[];
  evaluate(values: Readonly<Record<string, unknown>>): boolean;
}

/**
 * Read a modifier. `true`, `false` and a missing modifier become constants;
 * an expression is parsed now, so a mistake surfaces here and not on the
 * first keystroke. Throws when the expression cannot be read.
 */
export function compileModifier(modifier: Modifier | undefined): CompiledModifier {
  if (typeof modifier !== 'string') {
    const value = modifier === true;
    return { source: modifier, fields: [], evaluate: () => value };
  }
  const ast = new ExpressionParser(tokenize(modifier)).parse();
  return {
    source: modifier,
    fields: fieldsRead(ast),
    evaluate(values) {
      try {
        return truthy(evaluate(ast, values));
      } catch {
        return false;
      }
    },
  };
}

function fieldsRead(ast: ASTNode): string[] {
  const names: string[] = [];
  const visit = (node: ASTNode): void => {
    switch (node.type) {
      case 'Identifier': {
        const root = node.name.split('.')[0];
        if (!names.includes(root)) names.push(root);
        return;
      }
      case 'BinaryOp':
        visit(node.left);
        visit(node.right);
        return;
      case 'UnaryOp':
        visit(node.operand);
        return;
      default:
        return;
    }
  };
  visit(ast);
  return names;
}
