import { tokenize } from './tokenizer';
import { evaluateModifier, isModifierValid } from './evaluateModifier';
import { compileExpression } from './expression';
import { compileModifier } from './modifier';

/**
 * Where Fieldia's expressions deliberately differ from the React engine they
 * were ported from. Each case was a silent wrong answer there.
 */
describe('expressions — nothing is silently dropped', () => {
  it.each(['state == "a" && x', 'amount ! 3', 'a = 1', 'x @ y', 'price > $5'])(
    'refuses %s instead of skipping the characters it does not know',
    (expr) => {
      expect(() => tokenize(expr)).toThrow(/unexpected/i);
      expect(isModifierValid(expr)).toBe(false);
    }
  );

  it('reads negative numbers, where the React engine read "-5" as 5', () => {
    expect(evaluateModifier('amount > -5', { amount: 0 })).toBe(true);
    expect(evaluateModifier('amount > -5', { amount: -10 })).toBe(false);
    expect(evaluateModifier('delta == -2.5', { delta: -2.5 })).toBe(true);
  });
});

describe('expressions — Python truthiness, like the backends they come from', () => {
  it('treats an empty list as false', () => {
    expect(evaluateModifier('not tag_ids', { tag_ids: [] })).toBe(true);
    expect(evaluateModifier('tag_ids', { tag_ids: [] })).toBe(false);
    expect(evaluateModifier('tag_ids', { tag_ids: [3] })).toBe(true);
  });

  it('treats an empty string, zero, null and a missing value as false', () => {
    for (const value of ['', 0, null, undefined]) {
      expect(evaluateModifier('name', { name: value })).toBe(false);
      expect(evaluateModifier('not name', { name: value })).toBe(true);
    }
  });

  it('reads True, False and None as values, not field names', () => {
    expect(evaluateModifier('active == True', { active: true })).toBe(true);
    expect(evaluateModifier('active == False', { active: false })).toBe(true);
    expect(evaluateModifier('partner_id == None', { partner_id: null })).toBe(true);
    expect(evaluateModifier('True', {})).toBe(true);
    expect(evaluateModifier('not None', {})).toBe(true);
  });

  it('never orders an empty value before a number', () => {
    expect(evaluateModifier('amount < 5', { amount: null })).toBe(false);
    expect(evaluateModifier('amount >= 0', { amount: undefined })).toBe(false);
    expect(evaluateModifier('amount <= 5', {})).toBe(false);
  });
});

describe('expressions — and / or give back a value, as Python’s do', () => {
  it('gives the first true value of an or, else the last', () => {
    expect(compileExpression('discount or 0').evaluate({ discount: null })).toBe(0);
    expect(compileExpression('discount or 0').evaluate({ discount: 15 })).toBe(15);
    expect(compileExpression("note or ''").evaluate({ note: 'Call first' })).toBe('Call first');
    expect(compileExpression('price * (100 - (discount or 0)) / 100').evaluate({ price: 200, discount: null })).toBe(200);
  });

  it('gives the first false value of an and, else the last', () => {
    expect(compileExpression('qty and price').evaluate({ qty: 0, price: 5 })).toBe(0);
    expect(compileExpression('qty and price').evaluate({ qty: 2, price: 5 })).toBe(5);
  });

  it('decides a condition as before: by whether the value is true', () => {
    expect(compileModifier("not id or state == 'draft'").evaluate({ id: null, state: 'sale' })).toBe(true);
    expect(compileModifier('partner_id and amount').evaluate({ partner_id: 4, amount: 0 })).toBe(false);
  });
});

describe('a worked-out yes-or-no from and / or', () => {
  it('stays a boolean', async () => {
    const { fitTo } = await import('../record/compute');
    expect(fitTo({ type: 'boolean', label: 'Ready' }, compileExpression('qty and price').evaluate({ qty: 2, price: 5 }))).toBe(true);
    expect(fitTo({ type: 'boolean', label: 'Ready' }, compileExpression('qty and price').evaluate({ qty: 0, price: 5 }))).toBe(false);
  });
});
