/**
 * AST evaluator for expressions, ported from the React form engine.
 *
 * Python semantics where the React version used JavaScript's: an empty list
 * or string is false, and an empty value is never smaller or larger than
 * anything — modifiers come from backends that think in Python. Arithmetic
 * and functions give null for what they cannot work out, never an error.
 */

import type { ASTNode, BinaryOpNode, CallNode, UnaryOpNode } from './parser';
import { FUNCTIONS, type ExpressionEnv } from './functions';
import { arithmetic, negate, truthy } from './operations';

export { truthy } from './operations';

/**
 * Evaluate an AST node against a context object
 *
 * @param ast - The AST node to evaluate
 * @param context - Object containing field values
 * @returns The result of evaluation
 *
 * @example
 * const ast = { type: 'BinaryOp', operator: '==', left: {...}, right: {...} };
 * const context = { state: 'draft', amount: 100 };
 * evaluate(ast, context); // Returns boolean result
 */
export function evaluate(ast: ASTNode, context: Record<string, unknown>, env: ExpressionEnv = {}): unknown {
  switch (ast.type) {
    case 'BinaryOp':
      return evaluateBinaryOp(ast, context, env);

    case 'UnaryOp':
      return evaluateUnaryOp(ast, context, env);

    case 'Call':
      return evaluateCall(ast, context, env);

    case 'Literal':
      return ast.value;

    case 'Identifier':
      return getNestedValue(context, ast.name);

    default:
      throw new Error(`Unknown AST node type: ${(ast as { type: string }).type}`);
  }
}

/**
 * Evaluate binary operations
 */
function evaluateBinaryOp(node: BinaryOpNode, context: Record<string, unknown>, env: ExpressionEnv): unknown {
  const operator = node.operator.toLowerCase();
  // As Python's: the value that decided, so `discount or 0` gives a number; the right side read only when needed.
  if (operator === 'and' || operator === 'or') {
    const first = normalize(evaluate(node.left, context, env));
    return truthy(first) === (operator === 'or') ? first : normalize(evaluate(node.right, context, env));
  }
  const left = normalize(evaluate(node.left, context, env));
  const right = normalize(evaluate(node.right, context, env));
  const ordered = left !== null && right !== null;

  switch (operator) {
    // Comparison operators
    case '==':
      return left === right;

    case '!=':
    case '<>':
      return left !== right;

    case '<':
      return ordered && (left as Comparable) < (right as Comparable);

    case '>':
      return ordered && (left as Comparable) > (right as Comparable);

    case '<=':
      return ordered && (left as Comparable) <= (right as Comparable);

    case '>=':
      return ordered && (left as Comparable) >= (right as Comparable);

    // In operators
    case 'in':
      return Array.isArray(right) && right.includes(left);

    case 'not in':
      return Array.isArray(right) && !right.includes(left);

    // Arithmetic, and + joining text
    case '+':
    case '-':
    case '*':
    case '/':
    case '%':
      return arithmetic(operator, left, right);

    default:
      throw new Error(`Unknown binary operator: ${node.operator}`);
  }
}

/**
 * Evaluate unary operations
 */
function evaluateUnaryOp(node: UnaryOpNode, context: Record<string, unknown>, env: ExpressionEnv): unknown {
  const operand = evaluate(node.operand, context, env);
  const operator = node.operator.toLowerCase();

  switch (operator) {
    case 'not':
      return !truthy(operand);

    case '-':
      return negate(operand);

    default:
      throw new Error(`Unknown unary operator: ${node.operator}`);
  }
}

/** A function called with its values, each read only when the function asks for it. */
function evaluateCall(node: CallNode, context: Record<string, unknown>, env: ExpressionEnv): unknown {
  const fn = FUNCTIONS.get(node.name);
  if (!fn) throw new Error(`Unknown function: ${node.name}`);
  return fn.call({ args: node.args, value: (arg) => evaluate(arg, context, env), env });
}

/** What `<` and `>` order: numbers with numbers, strings with strings. */
type Comparable = number | string;

/** A missing value compares like None. */
function normalize(value: unknown): unknown {
  return value === undefined ? null : value;
}

/**
 * Get a nested value from an object using dot notation
 *
 * @param obj - The object to traverse
 * @param path - Dot-separated path (e.g., 'partner_id.country_id.name')
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * getNestedValue({ a: { b: { c: 5 } } }, 'a.b.c') // Returns 5
 * getNestedValue({ a: null }, 'a.b.c') // Returns undefined
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
