import { compileModifier } from './modifier';

describe('compileModifier', () => {
  it('turns a fixed modifier into a constant that reads no fields', () => {
    for (const value of [true, false, undefined]) {
      const compiled = compileModifier(value);
      expect(compiled.fields).toEqual([]);
      expect(compiled.evaluate({})).toBe(value === true);
    }
  });

  it('reads an expression once and evaluates it many times', () => {
    const compiled = compileModifier("state == 'draft' and amount > 100");
    expect(compiled.fields).toEqual(['state', 'amount']);
    expect(compiled.evaluate({ state: 'draft', amount: 150 })).toBe(true);
    expect(compiled.evaluate({ state: 'draft', amount: 50 })).toBe(false);
    expect(compiled.evaluate({ state: 'done', amount: 150 })).toBe(false);
  });

  it('lists only the first part of a dotted read, once', () => {
    expect(compileModifier('partner_id.country_id == 5 or not partner_id').fields).toEqual(['partner_id']);
  });

  it('refuses an expression it cannot read, saying where', () => {
    expect(() => compileModifier('state == "draft" && x')).toThrow(/Unexpected "&" at character 18/);
    expect(() => compileModifier('(state')).toThrow(/closing parenthesis/);
  });
});
