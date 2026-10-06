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

  it('reads Python’s tuples as lists, as Flectra writes them', () => {
    const two = compileModifier("state in ('draft', 'sent')");
    expect(two.fields).toEqual(['state']);
    expect(two.evaluate({ state: 'sent' })).toBe(true);
    expect(two.evaluate({ state: 'sale' })).toBe(false);
    // One value needs its comma, as in Python; none is an empty tuple.
    expect(compileModifier("state not in ('cancel',)").evaluate({ state: 'draft' })).toBe(true);
    expect(compileModifier("state not in ('cancel',)").evaluate({ state: 'cancel' })).toBe(false);
    expect(compileModifier('state in ()').evaluate({ state: 'draft' })).toBe(false);
    expect(compileModifier('qty in (-1, 0, 2.5, None)').evaluate({ qty: -1 })).toBe(true);
    // Parentheses that only group keep meaning that.
    expect(compileModifier("(state == 'draft') and (qty > 1)").evaluate({ state: 'draft', qty: 2 })).toBe(true);
  });

  it('refuses a tuple holding more than values, as a list does', () => {
    expect(() => compileModifier('state in (a, b)')).toThrow(/a tuple holds values such as 'draft' or 3/);
  });

  it('refuses an expression it cannot read, saying where', () => {
    expect(() => compileModifier('state == "draft" && x')).toThrow(/Unexpected "&" at character 18/);
    expect(() => compileModifier('(state')).toThrow(/closing parenthesis/);
  });
});
