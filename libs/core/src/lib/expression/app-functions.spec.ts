import { functionTable, type AppFunctions } from './app-functions';
import { compileExpression } from './expression';
import type { ExpressionEnv } from './functions';
import { compileModifier } from './modifier';

/**
 * The app's own functions: called by a page's expressions beside Fieldia's,
 * each name checked as the form is made, and one that asks the server
 * waiting for its answer where something can wait.
 */

describe('the app’s functions', () => {
  const functions: AppFunctions = {
    vatRate: { takes: [1, 1], values: ['text'], gives: 'number', call: (country: string) => ({ EG: 14, DE: 19 })[country] ?? null },
    nights: (from: string, to: string) => (from && to ? 3 : null),
  };
  const table = functionTable(functions);

  it('are called by name, with the values in order', () => {
    const env: ExpressionEnv = { functions: table };
    expect(compileExpression('price * vatRate(country) / 100', table).evaluate({ price: 200, country: 'EG' }, env)).toBe(28);
    expect(compileExpression('nights(a, b) * rate', table).evaluate({ a: '2026-10-01', b: '2026-10-04', rate: 50 }, env)).toBe(150);
    expect(compileModifier("vatRate(country) > 15", table).evaluate({ country: 'DE' }, env)).toBe(true);
  });

  it('are read only where they are given: elsewhere the name is no function', () => {
    expect(() => compileExpression('vatRate(country)')).toThrow(/no function "vatRate"/);
    expect(() => compileExpression('vatRat(country)', table)).toThrow(/no function "vatRat": the functions are round, .*, vatRate, nights/);
  });

  it('are checked for how many values they take, when the app says so', () => {
    expect(() => compileExpression('vatRate(a, b)', table)).toThrow(/vatRate takes 1 value/);
    // A plain function takes any number.
    expect(() => compileExpression('nights()', table)).not.toThrow();
  });

  it('give numbers as Fieldia’s own arithmetic does: 110, never 110.00000000000001', async () => {
    const tax = functionTable({ withTax: (price: number) => price * 1.1, odd: () => Number.NaN, late: { asks: true, call: () => Promise.resolve(0.1 + 0.2) } });
    expect(compileExpression('withTax(price)', tax).evaluate({ price: 100 }, { functions: tax })).toBe(110);
    expect(compileExpression('odd()', tax).evaluate({}, { functions: tax })).toBeNull();
    let kept: { value: unknown } | 'asking' | undefined;
    const env: ExpressionEnv = { functions: tax, answer: (_key, promise) => (promise ? (promise.then((value) => (kept = { value })), (kept = 'asking')) : kept) };
    const late = compileExpression('late()', tax);
    expect(late.evaluate({}, env)).toBeNull();
    await Promise.resolve();
    expect(late.evaluate({}, env)).toBe(0.3);
  });

  it('give null for what they leave undefined, and when they fail', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const odd = functionTable({ nothing: () => undefined, broken: () => { throw new Error('down'); } });
    expect(compileExpression('nothing()', odd).evaluate({}, { functions: odd })).toBeNull();
    expect(compileExpression('broken()', odd).evaluate({}, { functions: odd })).toBeNull();
    expect(error).toHaveBeenCalledWith("Fieldia: the app's function broken() failed", expect.any(Error));
    error.mockRestore();
  });

  it('refuse a name a page cannot call, as the form is made', () => {
    expect(() => functionTable({ round: () => 1 })).toThrow(/"round" is Fieldia's own function/);
    expect(() => functionTable({ 'vat-rate': () => 1 })).toThrow(/cannot name a function/);
    expect(() => functionTable({ not: () => 1 })).toThrow(/a word of the formula language/);
    expect(() => functionTable({ True: () => 1 })).toThrow(/a word of the formula language/);
  });

  it('are read once for each object of them', () => {
    expect(functionTable(functions)).toBe(table);
    expect(functionTable(undefined)).toBeUndefined();
  });
});

describe('an app’s function that asks the server', () => {
  /** An env keeping answers as the form does: asked once per key, `asking` until the promise settles. */
  function keeper() {
    const kept = new Map<string, { value: unknown } | 'asking'>();
    const asked: string[] = [];
    const env: ExpressionEnv = {
      answer(key, promise) {
        if (kept.has(key)) return kept.get(key);
        if (!promise) return undefined;
        asked.push(key);
        kept.set(key, 'asking');
        promise.then((value) => kept.set(key, { value }));
        return 'asking';
      },
    };
    return { env, asked };
  }

  it('gives no value while asked, then its answer; the same values are asked once', async () => {
    let calls = 0;
    const table = functionTable({ rate: (night: string) => { calls++; return Promise.resolve(night === '2026-12-31' ? 300 : 120); } });
    const { env, asked } = keeper();
    const total = compileExpression("rate(night) * 2", table);
    const values = { night: '2026-12-31' };
    expect(total.evaluate(values, { ...env, functions: table })).toBeNull();
    expect(total.evaluate(values, { ...env, functions: table })).toBeNull();
    await Promise.resolve();
    expect(total.evaluate(values, { ...env, functions: table })).toBe(600);
    expect(calls).toBe(1);
    expect(asked).toEqual(['rate(["2026-12-31"])']);
  });

  it('makes a condition reading it not hold while it is asked', async () => {
    const table = functionTable({ eligible: { asks: true, call: () => Promise.resolve(true) } });
    const { env } = keeper();
    const condition = compileModifier('eligible(age)', table);
    expect(condition.evaluate({ age: 30 }, { ...env, functions: table })).toBe(false);
    await Promise.resolve();
    expect(condition.evaluate({ age: 30 }, { ...env, functions: table })).toBe(true);
  });

  it('is not asked where nothing can wait for it, once it is known to ask', () => {
    let calls = 0;
    const table = functionTable({ rate: () => { calls++; return Promise.resolve(1); } });
    const expression = compileExpression('rate()', table);
    expect(expression.evaluate({}, { functions: table })).toBeNull();
    expect(expression.evaluate({}, { functions: table })).toBeNull();
    expect(calls).toBe(1);
  });
});
