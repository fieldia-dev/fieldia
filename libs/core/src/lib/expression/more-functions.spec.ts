import { compileExpression } from './expression';
import type { ExpressionEnv } from './functions';

/**
 * The functions 0.27 adds: ages and days moved by months, text tests, a join,
 * an average, money rounded to its currency, and empty values.
 */

const value = (source: string, values: Record<string, unknown> = {}, env?: ExpressionEnv) => compileExpression(source).evaluate(values, env);
const on = (day: string): ExpressionEnv => ({ today: () => day });

describe('age(birth, on = today())', () => {
  it('counts whole years to today, on the page’s clock', () => {
    expect(value('age(birth)', { birth: '1990-10-20' }, on('2026-10-20'))).toBe(36);
    expect(value('age(birth)', { birth: '1990-10-21' }, on('2026-10-20'))).toBe(35);
    expect(value('age(birth) >= 18', { birth: '2008-10-21' }, on('2026-10-20'))).toBe(false);
    expect(value('age(birth) >= 18', { birth: '2008-10-20' }, on('2026-10-20'))).toBe(true);
  });

  it('counts to the day given, a datetime by its day', () => {
    expect(value('age(birth, visit)', { birth: '1980-03-01', visit: '2026-02-28 09:30:00' })).toBe(45);
    expect(value('age(birth, visit)', { birth: '1980-03-01', visit: '2026-03-01T08:00' })).toBe(46);
  });

  it('counts a birthday on 29 February on the 28th in other years, as addYears moves it', () => {
    expect(value('age(birth)', { birth: '2004-02-29' }, on('2025-02-27'))).toBe(20);
    expect(value('age(birth)', { birth: '2004-02-29' }, on('2025-02-28'))).toBe(21);
  });

  it('gives null without a birth date, or for words that are no day', () => {
    expect(value('age(birth)', { birth: null }, on('2026-10-20'))).toBeNull();
    expect(value("age('soon')", {}, on('2026-10-20'))).toBeNull();
    expect(value("age('2026-02-30')", {}, on('2026-10-20'))).toBeNull();
  });
});

describe('addDays, addMonths and addYears(day, n)', () => {
  it('move a day, back when n is negative', () => {
    expect(value("addDays('2026-10-30', 3)")).toBe('2026-11-02');
    expect(value("addDays('2026-03-01', -1)")).toBe('2026-02-28');
    expect(value("addMonths('2026-01-15', 2)")).toBe('2026-03-15');
    expect(value("addMonths('2026-01-15', -2)")).toBe('2025-11-15');
    expect(value("addYears('2026-10-20', 1)")).toBe('2027-10-20');
  });

  it('end on the last day of a shorter month', () => {
    expect(value("addMonths('2026-01-31', 1)")).toBe('2026-02-28');
    expect(value("addMonths('2028-01-31', 1)")).toBe('2028-02-29');
    expect(value("addYears('2028-02-29', 1)")).toBe('2029-02-28');
  });

  it('keep a date and time’s time', () => {
    expect(value("addDays('2026-10-24 22:30:00', 2)")).toBe('2026-10-26 22:30:00');
    expect(value("addMonths('2026-01-31T09:00', 1)")).toBe('2026-02-28T09:00');
  });

  it('take whole numbers, nights or instalments worked out', () => {
    expect(value('addDays(arrival, nights)', { arrival: '2026-12-30', nights: 4 })).toBe('2027-01-03');
    expect(value('addMonths(first, n - 1)', { first: '2026-11-30', n: 4 })).toBe('2027-02-28');
    expect(value("addDays('2026-10-01', 1.9)")).toBe('2026-10-02');
  });

  it('give null for what is not a day or not a number', () => {
    expect(value('addDays(start, 1)', { start: null })).toBeNull();
    expect(value("addDays('2026-10-01', 'two')")).toBeNull();
    expect(value("addMonths('next week', 1)")).toBeNull();
  });
});

describe('months and years(from, to)', () => {
  it('count whole ones, negative when the second day comes first', () => {
    expect(value("months('2026-01-15', '2026-04-14')")).toBe(2);
    expect(value("months('2026-01-15', '2026-04-15')")).toBe(3);
    expect(value("months('2026-04-15', '2026-01-15')")).toBe(-3);
    expect(value("years('2020-06-01', '2026-05-31')")).toBe(5);
    expect(value("years('2026-05-31', '2020-06-01')")).toBe(-5);
  });

  it('agree with addMonths at a month’s end', () => {
    expect(value("months('2026-01-31', '2026-02-28')")).toBe(1);
    expect(value("months('2026-01-31', addMonths('2026-01-31', 7))")).toBe(7);
  });

  it('give null for what is not a day', () => {
    expect(value('months(a, b)', { a: null, b: '2026-01-01' })).toBeNull();
  });
});

describe('contains, startsWith and endsWith', () => {
  it('find words in text whatever their case', () => {
    expect(value("contains(email, '@GMAIL.')", { email: 'mona@gmail.com' })).toBe(true);
    expect(value("startsWith(phone, '+20')", { phone: '+201001234567' })).toBe(true);
    expect(value("endsWith(name, 'LLC')", { name: 'Nile Traders llc' })).toBe(true);
    expect(value("contains(notes, 'urgent')", { notes: 'Call back' })).toBe(false);
  });

  it('find a value in a list: choices ticked, links', () => {
    expect(value("contains(treatments, 'botox')", { treatments: ['filler', 'botox'] })).toBe(true);
    expect(value("contains(treatments, 'Botox')", { treatments: ['filler', 'botox'] })).toBe(false);
    expect(value('contains(tag_ids, 7)', { tag_ids: [3, 7] })).toBe(true);
  });

  it('hold for nothing in an empty value, and give null for a number searched', () => {
    expect(value("contains(notes, 'x')", { notes: null })).toBe(false);
    expect(value("startsWith(code, 'A')", { code: '' })).toBe(false);
    expect(value("startsWith(n, '1')", { n: 12 })).toBeNull();
  });
});

describe('upper and lower(text)', () => {
  it('write text in capitals or small letters', () => {
    expect(value('upper(code)', { code: 'eg-cai' })).toBe('EG-CAI');
    expect(value("lower('Mona Adel')")).toBe('mona adel');
    expect(value('upper(code)', { code: null })).toBeNull();
    expect(value('upper(5)')).toBeNull();
  });
});

describe('join(between, values…)', () => {
  it('joins several values or a list with the words between them, leaving empty ones out', () => {
    expect(value("join(' ', first, middle, last)", { first: 'Mona', middle: null, last: 'Adel' })).toBe('Mona Adel');
    expect(value("join(', ', treatments)", { treatments: ['botox', 'filler'] })).toBe('botox, filler');
    expect(value("join(' – ', code, 12)", { code: 'B' })).toBe('B – 12');
    expect(value("join(', ', tags)", { tags: [] })).toBe('');
  });

  it('gives null for what is not text or a number', () => {
    expect(value("join(', ', flag)", { flag: true })).toBeNull();
    expect(value('join(1, 2)')).toBeNull();
  });

  it('takes the words between first, then at least one value', () => {
    expect(() => compileExpression("join(', ')")).toThrow(/join takes 2 or more values/);
  });
});

describe('average(…)', () => {
  const env: ExpressionEnv = { lines: () => [{ price: 100, qty: 1 }, { price: 50, qty: 0 }, { price: null, qty: 2 }, { price: 30, qty: 3 }] };

  it('of values or a list, empty ones left out', () => {
    expect(value('average(a, b, c)', { a: 4, b: null, c: 5 })).toBe(4.5);
    expect(value('round(average(scores), 2)', { scores: [1, 2, 2] })).toBe(1.67);
    expect(value('average(scores)', { scores: [0.1, 0.2] })).toBe(0.15);
    expect(value('average(a)', { a: null })).toBeNull();
    expect(value("average(1, 'x')")).toBeNull();
  });

  it('of a field of the lines, where a condition holds, as sum takes them', () => {
    expect(value("average(lines, 'price')", {}, env)).toBe(60);
    expect(value(`average(lines, 'price', "qty > 0")`, {}, env)).toBe(65);
    expect(() => compileExpression("average(lines, 'price', qty)")).toThrow(/condition, in quotes/);
  });
});

describe('roundMoney(amount, currency)', () => {
  it('rounds to its currency’s places', () => {
    expect(value("roundMoney(10.4567, 'JOD')")).toBe(10.457);
    expect(value("roundMoney(1234.5, 'JPY')")).toBe(1235);
    expect(value("roundMoney(9.995, 'egp')")).toBe(10);
    expect(value('roundMoney(price * 1.14, currency)', { price: 99.99, currency: 'USD' })).toBe(113.99);
  });

  it('reads a link to a currency by its name', () => {
    const env: ExpressionEnv = { nameOf: (field) => (field === 'currency_id' ? 'KWD' : undefined) };
    expect(value('roundMoney(total, currency_id)', { total: 2.12345, currency_id: 3 }, env)).toBe(2.123);
  });

  it('gives null without a currency or an amount', () => {
    expect(value('roundMoney(total, currency)', { total: 5, currency: null })).toBeNull();
    expect(value("roundMoney(total, 'EGP')", { total: null })).toBeNull();
    expect(value("roundMoney(5, 'dollars')")).toBeNull();
  });
});

describe('empty(value) and firstOf(values…)', () => {
  it('empty: nothing, spaces alone, an empty list — never zero or no', () => {
    expect(value('empty(a)', { a: null })).toBe(true);
    expect(value('empty(a)', { a: '  ' })).toBe(true);
    expect(value('empty(a)', { a: [] })).toBe(true);
    expect(value('empty(a)', { a: 0 })).toBe(false);
    expect(value('empty(a)', { a: false })).toBe(false);
    expect(value('not empty(a)', { a: 'x' })).toBe(true);
  });

  it('firstOf: the first that is not empty, zero a value', () => {
    expect(value("firstOf(nickname, first_name, 'friend')", { nickname: '', first_name: 'Mona' })).toBe('Mona');
    expect(value('firstOf(discount, 5)', { discount: 0 })).toBe(0);
    expect(value('firstOf(a, b)', { a: null, b: null })).toBeNull();
  });
});

describe('the new functions are checked when the expression is read', () => {
  it.each([
    ['age()', /age takes 1 or 2 values/],
    ['addDays(start)', /addDays takes 2 values/],
    ['upper(a, b)', /upper takes 1 value$/],
    ['firstOf()', /firstOf takes 1 or more values/],
    ['roundMoney(1)', /roundMoney takes 2 values/],
    ['empty()', /empty takes 1 value$/],
  ])('%s', (source, message) => {
    expect(() => compileExpression(source)).toThrow(message);
  });
});
