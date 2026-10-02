/**
 * evaluateModifier - Evaluate modifier expressions with form context
 *
 * Phase 2 implementation with full expression parser.
 * Supports Python-like expressions used in Flectra modifiers.
 *
 * Structura Reference:
 * - DynBehaviorManager.evaluateCondition() method
 * - Supports Python-like expressions: "state == 'draft' and amount > 100"
 *
 * Supported features:
 * - Comparison operators: ==, !=, <>, <, >, <=, >=
 * - In operators: in, not in
 * - Logical operators: and, or, not
 * - Parentheses for precedence
 * - Nested field access: partner_id.country_id.name
 * - Truthiness checks: partner_id (true if partner_id has value)
 *
 * @param expression - The modifier expression to evaluate
 * @param context - Current form values
 * @returns Boolean result of evaluation
 *
 * @example
 * ```typescript
 * // Simple boolean
 * evaluateModifier(true, {}) // => true
 *
 * // String boolean
 * evaluateModifier('1', {}) // => true
 * evaluateModifier('True', {}) // => true
 *
 * // Field truthiness
 * evaluateModifier('is_company', { is_company: true }) // => true
 * evaluateModifier('partner_id', { partner_id: null }) // => false
 *
 * // Comparison expressions
 * evaluateModifier("state == 'done'", { state: 'done' }) // => true
 * evaluateModifier("amount > 100", { amount: 150 }) // => true
 *
 * // Logical expressions
 * evaluateModifier("state == 'draft' and amount > 100", { state: 'draft', amount: 150 }) // => true
 * evaluateModifier("state in ['draft', 'sent']", { state: 'draft' }) // => true
 *
 * // Nested field access
 * evaluateModifier("partner_id.country_id == 5", { partner_id: { country_id: 5 } }) // => true
 * ```
 */

import { tokenize } from './tokenizer';
import { ExpressionParser } from './parser';
import { evaluate, truthy } from './evaluator';

export function evaluateModifier(
  expression: string | boolean | undefined,
  context: Record<string, unknown>
): boolean {
  // Undefined modifier = false (field is not affected)
  if (expression === undefined) {
    return false;
  }

  // Direct boolean value
  if (typeof expression === 'boolean') {
    return expression;
  }

  // String representation of boolean
  if (expression === '1' || expression === 'True' || expression === 'true') {
    return true;
  }

  if (expression === '0' || expression === 'False' || expression === 'false') {
    return false;
  }

  // Empty string = false
  if (expression === '') {
    return false;
  }

  // Parse and evaluate complex expression
  try {
    const tokens = tokenize(expression);

    // Empty token list
    if (tokens.length === 0) {
      return false;
    }

    const parser = new ExpressionParser(tokens);
    const ast = parser.parse();
    const result = evaluate(ast, context);

    // Convert result to boolean
    return truthy(result);
  } catch {
    // A page is validated before it runs (validatePage reads every
    // expression), so this only guards pages that skipped validation.
    // Fail safely - return false so field is not hidden/disabled by broken modifier
    return false;
  }
}

/**
 * Check if a modifier expression is valid and can be parsed
 *
 * @param expression - The modifier expression to check
 * @returns true if expression is valid, false otherwise
 */
export function isModifierValid(expression: string | boolean | undefined): boolean {
  if (expression === undefined || typeof expression === 'boolean') {
    return true;
  }

  if (expression === '') {
    return true;
  }

  try {
    const tokens = tokenize(expression);
    if (tokens.length === 0) {
      return true;
    }
    const parser = new ExpressionParser(tokens);
    parser.parse();
    return true;
  } catch {
    return false;
  }
}
