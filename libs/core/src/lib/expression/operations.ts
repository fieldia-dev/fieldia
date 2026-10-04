/**
 * What the language's operators do to values, the way a form needs it:
 * arithmetic on numbers only, text joined with +, and null — never an error —
 * for what cannot be worked out, such as a sum with an empty field in it or a
 * division by zero.
 */

/** A number that can be counted with: not NaN, not infinite. */
export const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * A result without the noise of binary fractions, so 0.1 + 0.2 is 0.3 and
 * money adds up; null when it is not a finite number (a division by zero).
 */
export function tidy(value: number): number | null {
  return Number.isFinite(value) ? Number(value.toPrecision(15)) : null;
}

/** `+ - * / %` on two values. `+` joins text when either side is text; an empty value joins as nothing. */
export function arithmetic(operator: string, left: unknown, right: unknown): unknown {
  if (operator === '+' && (typeof left === 'string' || typeof right === 'string')) {
    const l = joinable(left);
    const r = joinable(right);
    return l === null || r === null ? null : l + r;
  }
  if (!isNumber(left) || !isNumber(right)) return null;
  switch (operator) {
    case '+':
      return tidy(left + right);
    case '-':
      return tidy(left - right);
    case '*':
      return tidy(left * right);
    case '/':
      return tidy(left / right);
    case '%':
      // Python's remainder takes the divisor's sign: -7 % 3 is 2.
      return tidy(left - right * Math.floor(left / right));
    default:
      return null;
  }
}

/** A value as it reads inside joined text: text and numbers as written, an empty value as nothing. */
function joinable(value: unknown): string | null {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return isNumber(value) ? String(value) : null;
}

/** A number with its sign turned, or null for anything else. */
export function negate(value: unknown): number | null {
  return isNumber(value) ? tidy(-value) : null;
}

/** Python's truth test: empty lists, strings and objects, 0 and None are false. */
export function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value !== null && typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

/**
 * A number rounded to so many digits after the point (before it, when
 * negative), half away from zero as people and invoices round: 2.5 is 3,
 * -2.5 is -3, and 1.005 to two digits is 1.01.
 */
export function roundTo(value: number, digits: number): number | null {
  const scale = 10 ** Math.trunc(digits);
  // Tidied first, so 1.005 × 100 is 100.5 and not 100.49999999999999.
  const scaled = Number((Math.abs(value) * scale).toPrecision(15));
  return tidy((Math.sign(value) * Math.round(scaled)) / scale);
}
