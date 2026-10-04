/**
 * Tokenizer for expressions: modifiers, and values worked out from others.
 *
 * Ported from the React form engine, with one change in behaviour: a
 * character the language does not know is an error, not something to skip.
 * The React version dropped it silently, so `amount > -5` read as
 * `amount > 5` and `a && b` read as `a b`. A minus sign is a token of its
 * own, so `a-5` is a subtraction; the parser reads `-5` as a negative number.
 */

export type TokenType =
  | 'IDENTIFIER'  // Field names, including dotted notation (e.g., partner_id.country_id)
  | 'NUMBER'      // Integer or float (e.g., 42, 3.14)
  | 'STRING'      // Single or double quoted string (e.g., 'draft', "draft")
  | 'LIST'        // List literal (e.g., ['draft', 'sent'])
  | 'OPERATOR'    // Comparison operators (==, !=, <>, <, >, <=, >=, in, not in)
  | 'LOGICAL'     // Logical operators (and, or, not)
  | 'CONSTANT'    // True, False, None (and true, false, null)
  | 'ARITHMETIC'  // + - * / %
  | 'COMMA'       // Between the values a function takes
  | 'PAREN';      // Parentheses ( )

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

/** The words that are values, not field names. */
export const CONSTANTS: ReadonlyMap<string, boolean | null> = new Map<string, boolean | null>([
  ['True', true],
  ['False', false],
  ['None', null],
  ['true', true],
  ['false', false],
  ['null', null],
]);

/** The operators that work out numbers, and join text. */
const ARITHMETIC = new Set(['+', '-', '*', '/', '%']);

/**
 * Tokenizes an expression: a Flectra modifier, or a value worked out from others.
 *
 * @param expr - The expression string to tokenize
 * @returns Array of tokens
 *
 * @example
 * tokenize("state == 'draft'")
 * // Returns: [
 * //   { type: 'IDENTIFIER', value: 'state', position: 0 },
 * //   { type: 'OPERATOR', value: '==', position: 1 },
 * //   { type: 'STRING', value: "'draft'", position: 2 }
 * // ]
 */
export function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  if (!expr) return tokens;

  // Alternatives in priority order: "not in" before "not", operators of two
  // characters before one, a number before anything else that could start
  // with a digit. Sticky (`y`), so a position nothing matches is an error
  // instead of a gap.
  const token =
    /(\(|\)|,|==|!=|<=|>=|<>|<|>|[-+*/%]|not\s+in\b|in\b|and\b|or\b|not\b|\[[^\]]*\]|'[^']*'|"[^"]*"|\d+\.?\d*|\w+(?:\.\w+)*)/iy;
  const space = /\s*/y;
  let at = 0;

  for (;;) {
    space.lastIndex = at;
    space.exec(expr);
    at = space.lastIndex;
    if (at >= expr.length) return tokens;

    token.lastIndex = at;
    const match = token.exec(expr);
    if (!match) {
      throw new Error(`Unexpected "${expr[at]}" at character ${at + 1} of: ${expr}`);
    }
    tokens.push({ type: getTokenType(match[0]), value: match[0], position: tokens.length });
    at = token.lastIndex;
  }
}

/**
 * Determines the type of a token based on its text value.
 */
function getTokenType(text: string): TokenType {
  const lowerText = text.toLowerCase().trim();

  // Python's constants, and their JSON spellings
  if (CONSTANTS.has(text)) {
    return 'CONSTANT';
  }

  // Logical operators (case-insensitive)
  if (lowerText === 'and' || lowerText === 'or' || lowerText === 'not') {
    return 'LOGICAL';
  }

  // Comparison operators (case-insensitive for word operators)
  if (
    ['==', '!=', '<>', '<', '>', '<=', '>='].includes(text) ||
    lowerText === 'in' ||
    lowerText === 'not in'
  ) {
    return 'OPERATOR';
  }

  // Parentheses
  if (text === '(' || text === ')') {
    return 'PAREN';
  }

  // Arithmetic, and the comma between a function's values
  if (ARITHMETIC.has(text)) {
    return 'ARITHMETIC';
  }
  if (text === ',') {
    return 'COMMA';
  }

  // Lists (start with '[')
  if (text.startsWith('[')) {
    return 'LIST';
  }

  // Strings (start with ' or ")
  if (text.startsWith("'") || text.startsWith('"')) {
    return 'STRING';
  }

  // Numbers (integer or float; a minus sign before one is its own token)
  if (/^\d+\.?\d*$/.test(text)) {
    return 'NUMBER';
  }

  // Default to identifier
  return 'IDENTIFIER';
}
