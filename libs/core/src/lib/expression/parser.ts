/**
 * Expression parser, ported from the React form engine and grown arithmetic
 * and functions.
 *
 * Recursive descent parser that converts tokens into an Abstract Syntax Tree (AST).
 * Implements Python-like operator precedence:
 *   1. OR (lowest precedence)
 *   2. AND
 *   3. NOT
 *   4. Comparison operators (==, !=, <, >, <=, >=, in, not in)
 *   5. + and -
 *   6. *, / and %
 *   7. A minus sign before a value
 *   8. Values, identifiers and function calls (highest precedence)
 */

import { CONSTANTS, type Token } from './tokenizer';
import { FUNCTIONS, takesInWords } from './functions';

/**
 * AST Node Types
 */
export type ASTNode = BinaryOpNode | UnaryOpNode | LiteralNode | IdentifierNode | CallNode;

export interface BinaryOpNode {
  type: 'BinaryOp';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOpNode {
  type: 'UnaryOp';
  operator: string;
  operand: ASTNode;
}

export interface LiteralNode {
  type: 'Literal';
  value: unknown;
}

export interface IdentifierNode {
  type: 'Identifier';
  name: string;
}

/** A function called with its values: `round(price * qty, 2)`. */
export interface CallNode {
  type: 'Call';
  name: string;
  args: ASTNode[];
}

/**
 * Recursive Descent Expression Parser
 */
export class ExpressionParser {
  private tokens: Token[];
  private position: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Parse tokens into an AST
   */
  parse(): ASTNode {
    if (this.tokens.length === 0) {
      throw new Error('Cannot parse empty expression');
    }

    const ast = this.parseOr();

    // Ensure all tokens were consumed
    if (!this.isAtEnd()) {
      throw new Error(`Unexpected token at position ${this.position}: ${this.peek()?.value}`);
    }

    return ast;
  }

  /**
   * Parse OR expressions (lowest precedence)
   * or_expr: and_expr ('or' and_expr)*
   */
  private parseOr(): ASTNode {
    let left = this.parseAnd();

    while (this.matchLogical('or')) {
      const operator = this.previous().value;
      const right = this.parseAnd();
      left = {
        type: 'BinaryOp',
        operator: operator.toLowerCase(),
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse AND expressions
   * and_expr: not_expr ('and' not_expr)*
   */
  private parseAnd(): ASTNode {
    let left = this.parseNot();

    while (this.matchLogical('and')) {
      const operator = this.previous().value;
      const right = this.parseNot();
      left = {
        type: 'BinaryOp',
        operator: operator.toLowerCase(),
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse NOT expressions
   * not_expr: 'not' comparison | comparison
   */
  private parseNot(): ASTNode {
    if (this.matchLogical('not')) {
      const operator = this.previous().value;
      const operand = this.parseComparison();
      return {
        type: 'UnaryOp',
        operator: operator.toLowerCase(),
        operand,
      };
    }

    return this.parseComparison();
  }

  /**
   * Parse comparison expressions
   * comparison: value (comp_op value)?
   * comp_op: '==' | '!=' | '<>' | '<' | '>' | '<=' | '>=' | 'in' | 'not in'
   */
  private parseComparison(): ASTNode {
    const left = this.parseSum();

    const compOperators = ['==', '!=', '<>', '<', '>', '<=', '>=', 'in', 'not in'];
    if (this.matchOperator(...compOperators)) {
      const operator = this.previous().value;
      const right = this.parseSum();
      return {
        type: 'BinaryOp',
        operator: operator.toLowerCase(),
        left,
        right,
      };
    }

    // If no comparison operator, return value as-is (truthiness check)
    return left;
  }

  /**
   * Adding and taking away, left to right
   * sum: product (('+' | '-') product)*
   */
  private parseSum(): ASTNode {
    let left = this.parseProduct();
    while (this.match('ARITHMETIC', '+', '-')) {
      const operator = this.previous().value;
      left = { type: 'BinaryOp', operator, left, right: this.parseProduct() };
    }
    return left;
  }

  /**
   * Multiplying, dividing and the remainder, left to right
   * product: unary (('*' | '/' | '%') unary)*
   */
  private parseProduct(): ASTNode {
    let left = this.parseUnary();
    while (this.match('ARITHMETIC', '*', '/', '%')) {
      const operator = this.previous().value;
      left = { type: 'BinaryOp', operator, left, right: this.parseUnary() };
    }
    return left;
  }

  /**
   * A minus sign before a value: -5, -price, -(a + b)
   * unary: '-' unary | value
   */
  private parseUnary(): ASTNode {
    if (this.match('ARITHMETIC', '-')) {
      return { type: 'UnaryOp', operator: '-', operand: this.parseUnary() };
    }
    return this.parseValue();
  }

  /**
   * A function's name, then its values in parentheses, separated by commas.
   * call: name '(' (or_expr (',' or_expr)*)? ')'
   */
  private parseCall(name: string): ASTNode {
    const fn = FUNCTIONS.get(name);
    if (!fn) throw new Error(`no function "${name}": the functions are ${[...FUNCTIONS.keys()].join(', ')}`);
    this.advance(); // (
    const args: ASTNode[] = [];
    if (!this.match('PAREN', ')')) {
      do {
        args.push(this.parseOr());
      } while (this.match('COMMA'));
      this.consume('PAREN', ')', `Expected "," or ")" after a value of ${name}(…)`);
    }
    const [least, most] = fn.takes;
    if (args.length < least || args.length > most) throw new Error(takesInWords(name, fn.takes));
    const problem = fn.check?.(args);
    if (problem) throw new Error(problem);
    return { type: 'Call', name, args };
  }

  /**
   * Parse value expressions (highest precedence)
   * value: '(' or_expr ')' | literal | call | identifier
   */
  private parseValue(): ASTNode {
    // Parenthesized expression
    if (this.match('PAREN', '(')) {
      const expr = this.parseOr();
      this.consume('PAREN', ')', 'Expected closing parenthesis');
      return expr;
    }

    // String literal
    if (this.check('STRING')) {
      const token = this.advance();
      // Remove quotes
      const value = token.value.slice(1, -1);
      return { type: 'Literal', value };
    }

    // True, False, None
    if (this.check('CONSTANT')) {
      const token = this.advance();
      return { type: 'Literal', value: CONSTANTS.get(token.value) ?? null };
    }

    // Number literal
    if (this.check('NUMBER')) {
      const token = this.advance();
      return { type: 'Literal', value: Number(token.value) };
    }

    // List literal
    if (this.check('LIST')) {
      const token = this.advance();
      const value = parseListLiteral(token.value);
      return { type: 'Literal', value };
    }

    // A function call, or an identifier
    if (this.check('IDENTIFIER')) {
      const token = this.advance();
      const next = this.peek();
      if (next?.type === 'PAREN' && next.value === '(') return this.parseCall(token.value);
      return { type: 'Identifier', name: token.value };
    }

    throw new Error(`Unexpected token: ${this.peek()?.value || 'EOF'}`);
  }

  // ========== Helper Methods ==========

  /**
   * Check if current token matches any of the given types/values
   */
  private match(type: string, ...values: string[]): boolean {
    if (this.check(type)) {
      if (values.length === 0) {
        this.advance();
        return true;
      }
      const token = this.peek();
      if (token && values.includes(token.value)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  /**
   * Match logical operators (case-insensitive)
   */
  private matchLogical(...operators: string[]): boolean {
    const token = this.peek();
    if (token && token.type === 'LOGICAL') {
      const lowerValue = token.value.toLowerCase();
      if (operators.map(op => op.toLowerCase()).includes(lowerValue)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  /**
   * Match comparison operators (case-insensitive)
   */
  private matchOperator(...operators: string[]): boolean {
    const token = this.peek();
    if (token && token.type === 'OPERATOR') {
      const lowerValue = token.value.toLowerCase();
      if (operators.map(op => op.toLowerCase()).includes(lowerValue)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  /**
   * Check if current token has given type
   */
  private check(type: string): boolean {
    const token = this.peek();
    return token?.type === type;
  }

  /**
   * Consume current token and advance
   */
  private advance(): Token {
    if (!this.isAtEnd()) {
      this.position++;
    }
    return this.previous();
  }

  /**
   * Get current token without advancing
   */
  private peek(): Token | null {
    if (this.isAtEnd()) {
      return null;
    }
    return this.tokens[this.position];
  }

  /**
   * Get previous token
   */
  private previous(): Token {
    return this.tokens[this.position - 1];
  }

  /**
   * Check if we've consumed all tokens
   */
  private isAtEnd(): boolean {
    return this.position >= this.tokens.length;
  }

  /**
   * Consume a token of specific type/value or throw error
   */
  private consume(type: string, value: string, message: string): Token {
    if (this.check(type)) {
      const token = this.peek();
      if (token && token.value === value) {
        return this.advance();
      }
    }
    throw new Error(message);
  }
}

/**
 * Parse a list literal string into an array
 * Example: "['draft', 'sent']" -> ['draft', 'sent']
 */
function parseListLiteral(listStr: string): unknown[] {
  try {
    // Remove brackets
    const content = listStr.slice(1, -1).trim();
    if (!content) {
      return [];
    }

    // Split by comma and parse each element
    const elements: unknown[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if ((char === "'" || char === '"') && (i === 0 || content[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }

      if (char === ',' && !inString) {
        elements.push(parseElement(current.trim()));
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      elements.push(parseElement(current.trim()));
    }

    return elements;
  } catch (error) {
    // A list that cannot be read is a syntax error, not an empty list.
    throw new Error(`Cannot read the list ${listStr}`, { cause: error });
  }
}

/**
 * Parse a single element from a list
 */
function parseElement(element: string): unknown {
  // String
  if ((element.startsWith("'") && element.endsWith("'")) ||
      (element.startsWith('"') && element.endsWith('"'))) {
    return element.slice(1, -1);
  }

  // Number
  if (!isNaN(Number(element))) {
    return Number(element);
  }

  // Boolean
  if (element.toLowerCase() === 'true') return true;
  if (element.toLowerCase() === 'false') return false;

  // Default to string
  return element;
}
