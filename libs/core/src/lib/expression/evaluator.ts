/**
 * AST evaluator for modifiers, ported from the React form engine.
 *
 * Python semantics where the React version used JavaScript's: an empty list
 * or string is false, and an empty value is never smaller or larger than
 * anything — modifiers come from backends that think in Python.
 */

import type { ASTNode, BinaryOpNode, UnaryOpNode } from './parser';

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
export function evaluate(ast: ASTNode, context: Record<string, unknown>): unknown {
  switch (ast.type) {
    case 'BinaryOp':
      return evaluateBinaryOp(ast, context);

    case 'UnaryOp':
      return evaluateUnaryOp(ast, context);

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
function evaluateBinaryOp(node: BinaryOpNode, context: Record<string, unknown>): unknown {
  const left = normalize(evaluate(node.left, context));
  const right = normalize(evaluate(node.right, context));
  const operator = node.operator.toLowerCase();
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

    // Logical operators (use truthiness)
    case 'and':
      return truthy(left) && truthy(right);

    case 'or':
      return truthy(left) || truthy(right);

    default:
      throw new Error(`Unknown binary operator: ${node.operator}`);
  }
}

/**
 * Evaluate unary operations
 */
function evaluateUnaryOp(node: UnaryOpNode, context: Record<string, unknown>): unknown {
  const operand = evaluate(node.operand, context);
  const operator = node.operator.toLowerCase();

  switch (operator) {
    case 'not':
      return !truthy(operand);

    default:
      throw new Error(`Unknown unary operator: ${node.operator}`);
  }
}

/** What `<` and `>` order: numbers with numbers, strings with strings. */
type Comparable = number | string;

/** A missing value compares like None. */
function normalize(value: unknown): unknown {
  return value === undefined ? null : value;
}

/** Python's truth test: empty lists, strings and objects, 0 and None are false. */
export function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value !== null && typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
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
