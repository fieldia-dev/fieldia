/**
 * Where JSON goes wrong: the first character that cannot be there, as an
 * offset and as a line and column a person can find (both from 1), and why,
 * in a person's terms: a comma with nothing after it, curly quotes (as a word
 * processor types them), digits that are not 0-9 (Arabic ones), another
 * character that cannot be there, or the end come too soon. Read here, not
 * from JSON.parse's message, which every browser words its own way and some
 * say no place at all; or a number JSON.parse would not keep as written
 * (`number`). Null when the text is valid JSON (RFC 8259, as JSON.parse
 * reads it) whose every number is kept as written.
 */
export interface JsonProblem {
  offset: number;
  line: number;
  column: number;
  reason: 'comma' | 'quotes' | 'digits' | 'char' | 'end' | 'number';
  /** The character that cannot be there, for `char`; the number as written, for `number`. */
  char?: string;
}

/** A number as its sign, its significant digits and its power of ten: "1.50e2" and "150" alike, "0" for any zero. */
function exactly(written: string): string {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(written);
  if (!m) return written;
  const [, sign, whole, fraction = '', power = '0'] = m;
  let digits = (whole + fraction).replace(/^0+/, '');
  let exponent = Number(power) - fraction.length;
  if (!digits) return '0';
  const trailing = /0+$/.exec(digits)?.[0].length ?? 0;
  digits = digits.slice(0, digits.length - trailing);
  exponent += trailing;
  return `${sign}${digits}e${exponent}`;
}

/**
 * Whether JSON.parse keeps a number as it is written: one past what a double holds (1e400) becomes Infinity, which a
 * save writes as null; one with more digits than a double keeps (an id of 20, 12345678901234567890) becomes another.
 */
export function keptExactly(written: string): boolean {
  const value = Number(written);
  return Number.isFinite(value) && exactly(String(value)) === exactly(written);
}

/** Text that may hold a number JSON.parse does not keep as written: a long run of digits, a big power of ten. */
const MAYBE_CHANGED = /\d{16}|[eE][+-]?\d{3}/;

/**
 * Text as JSON, `null` for nothing, or `undefined` when it is not JSON as written — a number JSON.parse would change
 * (`keptExactly`) among it too, never kept as another in silence. Every box JSON is typed in reads it so.
 */
export function readJson(text: string): unknown {
  if (text.trim() === '') return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  return MAYBE_CHANGED.test(text) && jsonProblem(text) ? undefined : value;
}

/** Quotes a word processor or a phone's keyboard types in place of a straight one. */
const CURLY = /^[\u2018-\u201f\u00ab\u00bb\u2039\u203a]/u;

/** Why JSON breaks at `offset`. */
function reasonAt(text: string, offset: number): Pick<JsonProblem, 'reason' | 'char'> {
  if (offset >= text.length) return { reason: 'end' };
  const char = String.fromCodePoint(text.codePointAt(offset) as number);
  if (CURLY.test(char)) return { reason: 'quotes' };
  if ((/\p{Nd}/u.test(char) && !/[0-9]/.test(char)) || char === '\u066b' || char === '\u066c') return { reason: 'digits' };
  if ((char === '}' || char === ']') && /,\s*$/.test(text.slice(0, offset))) return { reason: 'comma' };
  return { reason: 'char', char };
}

export function jsonProblem(text: string): JsonProblem | null {
  let at = 0;
  /** A number JSON.parse would not keep as written, and where it starts. */
  let changed: { at: number; written: string } | null = null;
  const fail = (): never => {
    throw at;
  };
  const space = () => {
    while (at < text.length && ' \t\n\r'.includes(text[at])) at++;
  };
  const expect = (char: string) => (text[at] === char ? at++ : fail());
  const word = (literal: string) => {
    for (const char of literal) expect(char);
  };
  const digits = () => {
    if (!/[0-9]/.test(text[at] ?? '')) fail();
    while (/[0-9]/.test(text[at] ?? '')) at++;
  };
  function string() {
    expect('"');
    while (text[at] !== '"') {
      if (at >= text.length || text.charCodeAt(at) < 0x20) fail();
      if (text[at] === '\\') {
        at++;
        if ('"\\/bfnrt'.includes(text[at] ?? 'x')) at++;
        else if (text[at] === 'u') {
          at++;
          for (let i = 0; i < 4; i++) {
            if (!/[0-9a-fA-F]/.test(text[at] ?? '')) fail();
            at++;
          }
        } else fail();
      } else at++;
    }
    at++;
  }
  function number() {
    const start = at;
    if (text[at] === '-') at++;
    if (text[at] === '0') at++;
    else digits();
    if (text[at] === '.') {
      at++;
      digits();
    }
    if (text[at] === 'e' || text[at] === 'E') {
      at++;
      if (text[at] === '+' || text[at] === '-') at++;
      digits();
    }
    // Valid, but not kept as written: said where it starts, never changed in silence.
    if (!keptExactly(text.slice(start, at))) {
      changed = { at: start, written: text.slice(start, at) };
      throw start;
    }
  }
  function value(): void {
    space();
    const char = text[at];
    if (char === '{') {
      at++;
      space();
      if (text[at] === '}') {
        at++;
        return;
      }
      for (;;) {
        space();
        string();
        space();
        expect(':');
        value();
        space();
        if (text[at] === ',') at++;
        else return void expect('}');
      }
    }
    if (char === '[') {
      at++;
      space();
      if (text[at] === ']') {
        at++;
        return;
      }
      for (;;) {
        value();
        space();
        if (text[at] === ',') at++;
        else return void expect(']');
      }
    }
    if (char === '"') return string();
    if (char === '-' || /[0-9]/.test(char ?? '')) return number();
    if (char === 't') return word('true');
    if (char === 'f') return word('false');
    if (char === 'n') return word('null');
    fail();
  }
  try {
    value();
    space();
    if (at < text.length) fail();
    return null;
  } catch (offset) {
    if (typeof offset !== 'number') throw offset;
    const before = text.slice(0, offset).split('\n');
    // Set inside number(), which the compiler does not follow here.
    const found = changed as { at: number; written: string } | null;
    const reason = found?.at === offset ? { reason: 'number' as const, char: found.written } : reasonAt(text, offset);
    return { offset, line: before.length, column: before[before.length - 1].length + 1, ...reason };
  }
}
