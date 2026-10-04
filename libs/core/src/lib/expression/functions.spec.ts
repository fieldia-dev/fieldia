import { compileExpression } from './expression';
import type { ExpressionEnv } from './functions';

const value = (source: string, values: Record<string, unknown> = {}, env?: ExpressionEnv) => compileExpression(source).evaluate(values, env);

describe('round(x, digits = 0)', () => {
  it('rounds half away from zero, as people and invoices do', () => {
    expect(value('round(2.5)')).toBe(3);
    expect(value('round(-2.5)')).toBe(-3);
    expect(value('round(2.4)')).toBe(2);
    expect(value('round(2.45, 1)')).toBe(2.5);
  });

  it('rounds to the digits asked for, money included', () => {
    expect(value('round(1.005, 2)')).toBe(1.01);
    expect(value('round(2.675, 2)')).toBe(2.68);
    expect(value('round(1234.5, -2)')).toBe(1200);
    // Digits that are not whole are cut to whole ones.
    expect(value('round(1.26, 1.9)')).toBe(1.3);
    expect(value('round(qty * price, 2)', { qty: 3, price: 0.333 })).toBe(1);
  });

  it('gives null for what is not a number', () => {
    expect(value('round(x)', { x: null })).toBeNull();
    expect(value("round('2.5')")).toBeNull();
    expect(value("round(2.5, 'two')")).toBeNull();
  });
});

describe('abs(x)', () => {
  it('drops the sign of a number', () => {
    expect(value('abs(-3.5)')).toBe(3.5);
    expect(value('abs(4)')).toBe(4);
    expect(value('abs(x)', { x: null })).toBeNull();
    expect(value("abs('x')")).toBeNull();
  });
});

describe('min(…) and max(…)', () => {
  it('take any number of values, or a list', () => {
    expect(value('min(3, 1, 2)')).toBe(1);
    expect(value('max(3, 1, 2)')).toBe(3);
    expect(value('max(7)')).toBe(7);
    expect(value('min([4, 2, 9])')).toBe(2);
    expect(value('max(tags)', { tags: [4, 12, 9] })).toBe(12);
  });

  it('leave empty values out, as a spreadsheet does', () => {
    expect(value('max(total - 100, 0)', { total: null })).toBe(0);
    expect(value('min(a, 5)', { a: null })).toBe(5);
    expect(value('max(a, b)', { a: null })).toBeNull();
  });

  it('order dates written as text, and refuse to mix text with numbers', () => {
    expect(value("min('2026-01-02', '2025-12-31')")).toBe('2025-12-31');
    expect(value("max('2026-01-02', '2025-12-31')")).toBe('2026-01-02');
    expect(value("max(1, 'a')")).toBeNull();
    expect(value('max(1, flag)', { flag: true })).toBeNull();
  });
});

describe('len(x)', () => {
  it('counts the letters of text and the items of a list; an empty value has none', () => {
    expect(value("len('abc')")).toBe(3);
    expect(value('len(name)', { name: 'Sara' })).toBe(4);
    expect(value('len(tags)', { tags: [1, 2] })).toBe(2);
    expect(value('len(name)', { name: null })).toBe(0);
    expect(value('len(name)', {})).toBe(0);
    expect(value('len(5)')).toBeNull();
  });
});

describe('today()', () => {
  it('is the day the form is filled in, as YYYY-MM-DD, from the clock it is given', () => {
    expect(value('today()', {}, { today: () => '2031-02-03' })).toBe('2031-02-03');
    expect(value("due < today()", { due: '2031-02-01' }, { today: () => '2031-02-03' })).toBe(true);
  });

  it('reads the computer’s clock when given none', () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    expect(value('today()')).toBe(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  });
});

describe('sum(lines, field) and count(lines)', () => {
  const rows = [{ subtotal: 100 }, { subtotal: 250.5 }, { subtotal: null }, { name: 'no price' }];
  const env: ExpressionEnv = { lines: (field) => (field === 'lines' ? rows : undefined) };

  it('add up a field of the lines, leaving out the lines without a number', () => {
    expect(value("sum(lines, 'subtotal')", { lines: ['k1', 'k2', 'k3', 'k4'] }, env)).toBe(350.5);
  });

  it('count the lines', () => {
    expect(value('count(lines)', { lines: ['k1', 'k2', 'k3', 'k4'] }, env)).toBe(4);
  });

  it('give 0 for no lines at all, or an empty field', () => {
    expect(value("sum(lines, 'subtotal')", { lines: [] }, { lines: () => [] })).toBe(0);
    expect(value('count(lines)', { lines: [] }, { lines: () => [] })).toBe(0);
    expect(value('sum(xs)', { xs: null })).toBe(0);
    expect(value('count(xs)', {})).toBe(0);
  });

  it('add up the lines inside other functions too', () => {
    expect(value("round(sum(lines, 'subtotal') / 3, 2)", {}, env)).toBe(116.83);
    expect(value("if(count(lines) > 3, 'many', 'few')", {}, env)).toBe('many');
  });

  it('add up and count a plain list too', () => {
    expect(value('sum([1, 2, 3.5])')).toBe(6.5);
    expect(value('sum([0.1, 0.2])')).toBe(0.3);
    expect(value('count(tags)', { tags: [3, 4] })).toBe(2);
    expect(value("sum(rows, 'n')", { rows: [{ n: 0.1 }, { n: 0.2 }] })).toBe(0.3);
  });

  it('give null for something that is not a list', () => {
    expect(value("sum(name, 'x')", { name: 'Sara' })).toBeNull();
    expect(value('count(name)', { name: 'Sara' })).toBeNull();
  });
});

describe('if(condition, then, otherwise)', () => {
  it('picks a value by a condition, with Python’s idea of true', () => {
    expect(value("if(qty > 10, 'bulk', 'single')", { qty: 12 })).toBe('bulk');
    expect(value("if(qty > 10, 'bulk', 'single')", { qty: 2 })).toBe('single');
    expect(value('if(tags, 1, 0)', { tags: [] })).toBe(0);
    expect(value('if(name, len(name), -1)', { name: 'Ali' })).toBe(3);
  });
});

describe('functions are checked when the expression is read', () => {
  it.each([
    ['foo(1)', /no function "foo"/],
    ['round()', /round takes 1 or 2 values/],
    ['round(1, 2, 3)', /round takes 1 or 2 values/],
    ['abs(1, 2)', /abs takes 1 value$/],
    ['min()', /min takes 1 or more values/],
    ['today(1)', /today takes no values/],
    ['if(a, b)', /if takes 3 values/],
    ["sum(lines, subtotal)", /the name of a field, in quotes/],
    ['round(1,)', /Unexpected/],
    ['round(1 2)', /Expected "," or "\)"/],
  ])('%s', (source, message) => {
    expect(() => compileExpression(source)).toThrow(message);
  });

  it('still lets a field share a function’s name, when it is not called', () => {
    expect(value('count + sum', { count: 2, sum: 3 })).toBe(5);
  });
});
