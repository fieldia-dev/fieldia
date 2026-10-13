import { compileExpression } from './expression';
import { tokenize } from './tokenizer';

/**
 * A formula's numbers are read as every box of Fieldia reads them (FIELDIA
 * INPUT RULES, 3): Arabic-Indic (٠-٩) and Persian (۰-۹) digits as 0-9, and the
 * Arabic decimal separator (٫) as a point. A comma is never a decimal mark in a
 * formula: it parts the values a function takes.
 */

const value = (source: string, values: Record<string, unknown> = {}) => compileExpression(source).evaluate(values);

describe('numbers in a formula', () => {
  it.each([
    ['qty * ٢', 8],
    ['qty * ۲', 8],
    ['qty * ١٫٥', 6],
    ['qty * 1٫5', 6],
    ['٢٠ + qty', 24],
    ['qty > ٣', true],
  ])('%s is %s', (source, expected) => {
    expect(value(source, { qty: 4 })).toBe(expected);
  });

  it('are tokens of 0-9 and a point, whatever their script', () => {
    expect(tokenize('١٢٫٥').map((t) => [t.type, t.value])).toEqual([['NUMBER', '12.5']]);
    expect(tokenize('round(۱۲, ۲)').map((t) => t.value)).toEqual(['round', '(', '12', ',', '2', ')']);
  });

  it('never read a comma as a decimal mark', () => {
    expect(() => value('qty * 1,5', { qty: 4 })).toThrow();
  });
});
