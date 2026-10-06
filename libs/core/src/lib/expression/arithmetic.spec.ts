import { compileExpression } from './expression';
import { evaluateModifier, isModifierValid } from './evaluateModifier';
import { tokenize } from './tokenizer';

/** Work an expression out against some values. */
const value = (source: string, values: Record<string, unknown> = {}) => compileExpression(source).evaluate(values);

describe('arithmetic: + - * / % with the usual precedence', () => {
  it.each([
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['10 - 4 - 3', 3],
    ['12 / 4 / 3', 1],
    ['2 * 3 % 4', 2],
    ['2 + 3 % 2', 3],
    ['7 - 2 * 3', 1],
    ['-2 * 3', -6],
    ['-(2 + 3)', -5],
    ['- -2', 2],
    ['3 - -2', 5],
    ['10 / 4', 2.5],
  ])('%s is %s', (source, expected) => {
    expect(value(source)).toBe(expected);
  });

  it('reads field names, with or without spaces around the operator', () => {
    expect(value('price * qty', { price: 19.5, qty: 4 })).toBe(78);
    expect(value('a-5', { a: 7 })).toBe(2);
    expect(value('a -5', { a: 7 })).toBe(2);
    expect(value('-a', { a: 7 })).toBe(-7);
  });

  it('takes the remainder the way Python does: its sign is the divisor’s', () => {
    expect(value('7 % 3')).toBe(1);
    expect(value('-7 % 3')).toBe(2);
    expect(value('7 % -3')).toBe(-2);
  });

  it('leaves out the noise of binary fractions, so money adds up', () => {
    expect(value('0.1 + 0.2')).toBe(0.3);
    expect(value('3 * 19.99')).toBe(59.97);
    expect(value('0.1 + 0.2 == 0.3')).toBe(true);
  });

  it('joins text with +, when either side is text', () => {
    expect(value("first + ' ' + last", { first: 'Sara', last: 'Ali' })).toBe('Sara Ali');
    expect(value("'No. ' + 7")).toBe('No. 7');
    expect(value("7 + 'th'")).toBe('7th');
    expect(value("'Dear ' + name", { name: null })).toBe('Dear ');
    // Only text and numbers join: not yes or no, not a list.
    expect(value("'a' + flag", { flag: true })).toBeNull();
    expect(value("tags + 'a'", { tags: [1] })).toBeNull();
  });

  it('gives null, never an error, for what cannot be worked out', () => {
    expect(value('1 / 0')).toBeNull();
    expect(value('5 % 0')).toBeNull();
    expect(value("'a' * 2")).toBeNull();
    expect(value("'a' - 'b'")).toBeNull();
    expect(value('qty * price', { qty: null, price: 3 })).toBeNull();
    expect(value('qty + 1', {})).toBeNull();
    expect(value('-name', { name: 'Sara' })).toBeNull();
    expect(value('flag + 1', { flag: true })).toBeNull();
    expect(value('tags + 1', { tags: [1] })).toBeNull();
  });

  it('works out arithmetic before comparing, and comparing before and/or', () => {
    expect(value('qty * price > 1000', { qty: 3, price: 400 })).toBe(true);
    expect(value('qty * price > 1000', { qty: 2, price: 400 })).toBe(false);
    expect(value('a + 1 in [2, 3]', { a: 1 })).toBe(true);
    expect(value('a == 1 + 1', { a: 2 })).toBe(true);
    expect(value('total > limit - 100', { total: 950, limit: 1000 })).toBe(true);
    expect(value('a + 1 == 2 and b - 1 == 0', { a: 1, b: 1 })).toBe(true);
    expect(value('not a + 1 == 2', { a: 1 })).toBe(false);
  });

  it('refuses an expression that cannot be read, saying so when it is read', () => {
    for (const source of ['1 +', '* 2', '(1 + 2', '1 2', '1 , 2', '+', 'a +* b']) {
      expect(() => compileExpression(source)).toThrow();
      expect(isModifierValid(source)).toBe(false);
    }
    // A comma in parentheses is Python's tuple: a list of values.
    expect(compileExpression('(1, 2)').evaluate({})).toEqual([1, 2]);
  });
});

describe('modifiers keep working with arithmetic in the language', () => {
  it('still reads negative numbers', () => {
    expect(evaluateModifier('amount > -5', { amount: 0 })).toBe(true);
    expect(evaluateModifier('amount > -5', { amount: -10 })).toBe(false);
    expect(evaluateModifier('delta == -2.5', { delta: -2.5 })).toBe(true);
  });

  it('works out sums inside a condition', () => {
    expect(evaluateModifier('qty * price > 100', { qty: 2, price: 60 })).toBe(true);
    expect(evaluateModifier('qty * price > 100', { qty: null, price: 60 })).toBe(false);
  });

  it('reads + - * / % and commas as their own tokens', () => {
    expect(tokenize('a-5').map((t) => [t.type, t.value])).toEqual([
      ['IDENTIFIER', 'a'],
      ['ARITHMETIC', '-'],
      ['NUMBER', '5'],
    ]);
    expect(tokenize('round(x, 2) % 3').map((t) => t.type)).toEqual(['IDENTIFIER', 'PAREN', 'IDENTIFIER', 'COMMA', 'NUMBER', 'PAREN', 'ARITHMETIC', 'NUMBER']);
    expect(tokenize('a + b * c / d').filter((t) => t.type === 'ARITHMETIC').map((t) => t.value)).toEqual(['+', '*', '/']);
  });
});

describe('compileExpression', () => {
  it('lists the fields an expression reads, by their first name, once, and not the functions it calls', () => {
    expect(compileExpression('round(price * qty, 2) + price').fields).toEqual(['price', 'qty']);
    expect(compileExpression("sum(lines, 'subtotal')").fields).toEqual(['lines']);
    expect(compileExpression('today()').fields).toEqual([]);
    expect(compileExpression('if(a > 1, b, -c)').fields).toEqual(['a', 'b', 'c']);
  });

  it('gives null, not undefined, for a field the values do not have', () => {
    expect(compileExpression('nope').evaluate({})).toBeNull();
  });

  it('keeps the source it was read from', () => {
    expect(compileExpression('1 + 1').source).toBe('1 + 1');
  });
});
