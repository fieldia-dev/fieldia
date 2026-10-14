/**
 * Where JSON goes wrong: the first character that cannot be there, as an
 * offset and as a line and column a person can find (both from 1), and why,
 * in a person's terms: a comma with nothing after it, curly quotes (as a word
 * processor types them), digits that are not 0-9 (Arabic ones), another
 * character that cannot be there, or the end come too soon. Read here, not
 * from JSON.parse's message, which every browser words its own way and some
 * say no place at all. Null when the text is valid JSON (RFC 8259, as
 * JSON.parse reads it).
 */
export interface JsonProblem {
  offset: number;
  line: number;
  column: number;
  reason: 'comma' | 'quotes' | 'digits' | 'char' | 'end';
  /** The character that cannot be there, for `char`. */
  char?: string;
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
    return { offset, line: before.length, column: before[before.length - 1].length + 1, ...reasonAt(text, offset) };
  }
}
