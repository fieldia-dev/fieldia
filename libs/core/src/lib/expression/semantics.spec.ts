import { tokenize } from './tokenizer';
import { evaluateModifier, isModifierValid } from './evaluateModifier';

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
