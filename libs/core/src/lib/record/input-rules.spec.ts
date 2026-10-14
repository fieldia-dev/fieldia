import {
  charCount,
  cleanPastedNumber,
  couldBeNumber,
  foldDigits,
  foldForSearch,
  numberMarks,
  numberMisfit,
  oneLine,
  placesOf,
  placesOfCurrency,
  readDate,
  readDuration,
  readNumber,
  readTime,
  stripMarks,
} from './input-rules';

const value = (text: string, locale = 'en', options = {}) => {
  const read = readNumber(text, locale, options);
  return read.ok ? read.value : read.problem;
};

describe('text everywhere', () => {
  it('drops invisible direction marks, everywhere or at the ends only', () => {
    expect(stripMarks('\u200e-5\u200f')).toBe('-5');
    expect(stripMarks('\u061c\u202a1\u202c\u2066\u2069\ufeff')).toBe('1');
    expect(stripMarks('\u200fمرحبا \u200eWorld\u200f', 'ends')).toBe('مرحبا \u200eWorld');
  });

  it('reads Arabic-Indic, Persian and fullwidth digits as 0-9, and leaves the rest alone', () => {
    expect(foldDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(foldDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(foldDigits('１２３')).toBe('123');
    expect(foldDigits('رقم ٥ abc')).toBe('رقم 5 abc');
  });

  it('keeps one line: a line break is a space, and a password drops it', () => {
    expect(oneLine('Cairo\nGiza\r\nAlex')).toBe('Cairo Giza Alex');
    expect(oneLine('se\ncret', { password: true })).toBe('secret');
  });

  it('counts characters as a server does, an emoji as one', () => {
    expect(charCount('abc')).toBe(3);
    expect(charCount('😀😀')).toBe(2);
    expect(charCount('مرحبا')).toBe(5);
  });

  it('folds words for finding: case, Arabic letter forms, short vowels and digits', () => {
    expect(foldForSearch('أحمد')).toBe(foldForSearch('احمد'));
    expect(foldForSearch('إسلام')).toBe('اسلام');
    expect(foldForSearch('مدرسة')).toBe('مدرسه');
    expect(foldForSearch('مصطفى')).toBe('مصطفي');
    expect(foldForSearch('مُحَمَّد')).toBe('محمد');
    expect(foldForSearch('كتـــاب')).toBe('كتاب');
    expect(foldForSearch('Line ١٢')).toBe('line 12');
  });
});

describe('readNumber — the marks', () => {
  it('knows each page’s marks', () => {
    expect(numberMarks('en')).toEqual({ decimal: '.', group: ',' });
    expect(numberMarks('ar')).toEqual({ decimal: '.', group: ',' });
    expect(numberMarks('de')).toEqual({ decimal: ',', group: '.' });
    expect(numberMarks('fr')).toEqual({ decimal: ',', group: '\u202f' });
  });

  it.each([
    ['en', '1,500', 1500],
    ['en', '1,5', 1.5],
    ['en', '12,34', 12.34],
    ['en', '1.234,56', 1234.56],
    ['en', '1 234,56', 1234.56],
    ['en', '1,234,567.5', 1234567.5],
    ['ar', '1,500', 1500],
    ['ar', '1,5', 1.5],
    ['ar', '1.234,56', 1234.56],
    ['de', '1.500', 1500],
    ['de', '1.5', 1.5],
    ['de', '1,234.56', 1234.56],
    ['de', '1.234,56', 1234.56],
    ['de', '12,5', 12.5],
    ['fr', '1,5', 1.5],
    ['fr', '1.5', 1.5],
    ['fr', '1\u202f234,5', 1234.5],
    ['fr', '1 234,5', 1234.5],
  ])('%s: "%s" is %s', (locale, text, expected) => {
    expect(value(text, locale)).toBe(expected);
  });

  it.each([
    ['en', '0,500', 0.5],
    ['en', '0,750', 0.75],
    ['en', '-0,500', -0.5],
    ['en', '00,500', 0.5],
    ['ar', '0,500', 0.5],
    ['ar', '٠,٥٠٠', 0.5],
    ['de', '0.500', 0.5],
    ['fr', '0,500', 0.5],
  ])('%s: "%s", led by 0, is a half and never grouped (%s)', (locale, text, expected) => {
    expect(value(text, locale)).toBe(expected);
  });

  it('never reads a grouped number led by 0', () => {
    expect(value('0,500,000')).toBe('groupsOfThree');
    expect(value('0.500.000', 'de')).toBe('groupsOfThree');
    expect(value('0 500')).toBe('groupsOfThree');
    // Grouped after a first group that is no 0: as before.
    expect(value('1,500')).toBe(1500);
    expect(value('10,500')).toBe(10500);
  });

  it('reads Arabic digits and marks: ٫ is decimal, ٬ groups, ، is a decimal comma', () => {
    expect(value('١٢٣٤٫٥', 'ar')).toBe(1234.5);
    expect(value('١٬٢٣٤٫٥', 'ar')).toBe(1234.5);
    expect(value('١،٥', 'ar')).toBe(1.5);
    expect(value('١،٥', 'en')).toBe(1.5);
    expect(value('۱۲۳', 'ar')).toBe(123);
    expect(value('١٫٥', 'de')).toBe(1.5);
  });

  it('reads a leading plus, the minus sign U+2212 and fullwidth digits', () => {
    expect(value('+5')).toBe(5);
    expect(value('\u22125')).toBe(-5);
    expect(value('\ufe635')).toBe(-5);
    expect(value('５')).toBe(5);
    expect(value('-0')).toBe(0);
    expect(Object.is(value('-0'), -0)).toBe(false);
  });

  it('never reads a direction mark into a number', () => {
    expect(value('\u200e-5', 'ar')).toBe(-5);
    expect(value('\u061c-5')).toBe(-5);
    expect(value('-5\u200f')).toBe(-5);
    expect(value('\u200e-1,500.00', 'ar')).toBe(-1500);
  });

  it('says why a text does not read', () => {
    expect(value('abc')).toBe('numbersOnly');
    expect(value('12abc')).toBe('numbersOnly');
    expect(value('1e5')).toBe('numbersOnly');
    expect(value('0x1F')).toBe('numbersOnly');
    expect(value('😀')).toBe('numbersOnly');
    expect(value('--5')).toBe('minusFirst');
    expect(value('5-')).toBe('minusFirst');
    expect(value('12 34')).toBe('groupsOfThree');
    expect(value('1.2.3', 'de')).toBe('groupsOfThree');
    expect(value('1,234.5.6')).toBe('oneDecimalMark');
    expect(value('١٫٢٫٣')).toBe('oneDecimalMark');
    expect(value('12\t380')).toBe('severalValues');
    expect(value('12\n380')).toBe('severalValues');
  });

  it('waits for a number still being written', () => {
    for (const text of ['-', '.', '-.', '+', '1,', '1,234,']) expect(value(text)).toBe('unfinished');
    expect(value('1.', 'de')).toBe('unfinished');
    // The page's own decimal mark last: the number already reads.
    expect(value('1.')).toBe(1);
    expect(value('1,', 'de')).toBe(1);
  });

  it('reads nothing, or spaces only, as empty', () => {
    expect(value('')).toBeNull();
    expect(value('   ')).toBeNull();
  });

  it('reads a per cent sign, % or ٪, in a per cent box', () => {
    expect(value('25%', 'en', { percent: true })).toBe(25);
    expect(value('٢٥٪', 'ar', { percent: true })).toBe(25);
    expect(value('25 %', 'fr', { percent: true })).toBe(25);
    expect(value('25%')).toBe('numbersOnly');
  });

  it('writes the number plain, in the page’s way, and counts its places and digits', () => {
    expect(readNumber('1.234,50', 'de')).toEqual({ ok: true, value: 1234.5, plain: '1234,50', places: 2, digits: 6, significant: 6 });
    expect(readNumber('-٠٫٠٥', 'ar')).toEqual({ ok: true, value: -0.05, plain: '-0.05', places: 2, digits: 2, significant: 1 });
  });
});

describe('couldBeNumber — what a keystroke may add', () => {
  const judge = (text: string, limits = {}, locale = 'en') => couldBeNumber(text, locale, limits)?.problem ?? null;

  it('lets every part of a number through, in any script', () => {
    for (const text of ['', '-', '1', '1,', '1,5', '1,500', '1 2', '12 3', '١٢٫', '١،', '+5', '\u22125', '.5', '1.234,5', '25%']) expect(judge(text, { percent: true })).toBeNull();
  });

  it('refuses letters, emoji and other symbols, so exponents and hex cannot be typed', () => {
    for (const text of ['a', '12a', '1e', '0x', '😀', '$5', '5#']) expect(judge(text)).toBe('numbersOnly');
  });

  it('refuses a minus that is not first, and any minus where the least is 0 or more', () => {
    expect(judge('5-')).toBe('minusFirst');
    expect(judge('--')).toBe('minusFirst');
    expect(couldBeNumber('-', 'en', { min: 0 })).toEqual({ problem: 'min', min: 0 });
    expect(couldBeNumber('5-', 'en', { min: 1 })).toEqual({ problem: 'min', min: 1 });
    expect(judge('-', { min: -10 })).toBeNull();
  });

  it('refuses a decimal in a whole number once it can only be one, and a second decimal mark', () => {
    // A decimal mark may still be followed by zeros alone ("12.0"), or turn out to group ("1.234,00").
    expect(judge('1.', { integer: true })).toBeNull();
    expect(judge('1,', { integer: true }, 'de')).toBeNull();
    expect(judge('١٫', { integer: true }, 'ar')).toBeNull();
    expect(judge('١٫٠', { integer: true }, 'ar')).toBeNull();
    expect(judge('١٫٥', { integer: true }, 'ar')).toBe('integer');
    expect(judge('.5', { integer: true })).toBe('integer');
    expect(judge('0.5', { integer: true })).toBe('integer');
    expect(judge('0,5', { integer: true }, 'fr')).toBe('integer');
    expect(judge('1.2345', { integer: true })).toBe('integer');
    expect(judge('1,234.5', { integer: true })).toBe('integer');
    expect(judge('1.234,5', { integer: true }, 'de')).toBe('integer');
    // A grouping mark may still group: "1,500".
    expect(judge('1,5', { integer: true })).toBeNull();
    expect(judge('1,5555', { integer: true })).toBe('integer');
    expect(judge('1.2.')).toBe('oneDecimalMark');
    expect(judge('1,2,', {}, 'de')).toBe('oneDecimalMark');
  });

  it('refuses a decimal place past the field’s, unless the mark may still group', () => {
    expect(couldBeNumber('12.3456', 'en', { places: 2 })).toEqual({ problem: 'decimals', places: 2 });
    expect(couldBeNumber('0.345', 'en', { places: 2 })).toEqual({ problem: 'decimals', places: 2 });
    expect(judge('١٢٫٣٤', { places: 1 }, 'ar')).toBe('decimals');
    expect(judge('12,3456', { places: 1 }, 'de')).toBe('decimals');
    expect(judge('12.34', { places: 2 })).toBeNull();
    // "1,50" may become "1,500" on an English page, "12.345" "12.345,67", and "12,34" "12,345.6" on a German one.
    expect(judge('1,50', { places: 1 })).toBeNull();
    expect(judge('12.345', { places: 2 })).toBeNull();
    expect(judge('12,34', { places: 1 }, 'de')).toBeNull();
  });

  it.each([
    ['en', '1.234,56', { places: 2 }],
    ['ar', '1.234,56', { places: 2 }],
    ['ar', '١.٢٣٤,٥٦', { places: 2 }],
    ['en', '1.234.567', {}],
    ['fr', '1,234.56', { places: 2 }],
    ['fr', '1,234.5', { places: 1 }],
    ['de', '1,234.56', { places: 2 }],
    ['de', '1.234,56', { places: 2 }],
  ])('%s: every key of "%s", a number the field takes, may be typed', (locale, text, limits) => {
    const keys = [...text];
    for (let i = 1; i <= keys.length; i++) expect([keys.slice(0, i).join(''), judge(keys.slice(0, i).join(''), limits, locale)]).toEqual([keys.slice(0, i).join(''), null]);
  });

  it('takes trailing zeros: they say no more than the number without them', () => {
    for (const text of ['12.0', '1200.00', '1,200.00', '0.000']) expect(judge(text, { integer: true })).toBeNull();
    expect(judge('12,0', { integer: true }, 'de')).toBeNull();
    expect(judge('١٢٫٠٠', { integer: true }, 'ar')).toBeNull();
    for (const text of ['12.50', '0.50', '1234.5000']) expect(judge(text, { places: 1 })).toBeNull();
    expect(judge('٠٫٥٠', { places: 1 }, 'ar')).toBeNull();
    expect(judge('0,500', { places: 2 }, 'fr')).toBeNull();
    expect(judge('0,500', { places: 2 })).toBeNull();
    expect(judge('12.500', { places: 1, digits: 3 })).toBeNull();
    expect(judge('1.000000000000000000')).toBeNull();
    // A digit other than 0 after them still counts.
    expect(judge('1234.5001', { places: 1 })).toBe('decimals');
  });

  it('refuses a 16th significant digit, or a digit past the field’s digits', () => {
    expect(judge('123456789012345')).toBeNull();
    expect(couldBeNumber('1234567890123456', 'en')).toEqual({ problem: 'digits', n: 15 });
    expect(couldBeNumber('12345678901', 'en', { digits: 10 })).toEqual({ problem: 'digits', n: 10 });
    expect(judge('0.000000000000001')).toBeNull();
  });

  it('refuses grouping that can never be right', () => {
    expect(judge('1.2.', {}, 'de')).toBe('groupsOfThree');
    expect(judge('1,2,')).toBe('groupsOfThree');
    expect(judge('1,234,5678')).toBe('groupsOfThree');
    expect(judge('1,,5')).toBe('groupsOfThree');
    expect(judge('1.5,')).toBe('groupsOfThree');
  });

  it('refuses a tab or a line break: several values', () => {
    expect(judge('12\t3')).toBe('severalValues');
  });

  it('reads a number never grouped, as a coordinate is: its one mark is the decimal mark', () => {
    const coordinate = (text: string, locale = 'en') => value(text, locale, { ungrouped: true });
    expect(coordinate('31,235')).toBe(31.235);
    expect(coordinate('31.235', 'de')).toBe(31.235);
    expect(coordinate('٣٠٫٠٤٤٤', 'ar')).toBe(30.0444);
    expect(coordinate('۳۰٫۰۴۴۴', 'ar')).toBe(30.0444);
    expect(coordinate('\u200f٣٠٫٠٤\u200f', 'ar')).toBe(30.04);
    expect(coordinate('-31,2357')).toBe(-31.2357);
    expect(coordinate('31 235')).toBe('numbersOnly');
    expect(coordinate('31.2.3')).toBe('oneDecimalMark');
    expect(couldBeNumber('31,2357', 'en', { ungrouped: true })).toBeNull();
    expect(couldBeNumber('31.2.', 'en', { ungrouped: true })?.problem).toBe('oneDecimalMark');
    expect(cleanPastedNumber('31,235', 'en', { ungrouped: true })).toEqual({ ok: true, text: '31.235', value: 31.235 });
  });

  it('lets an hours box take a colon and an h', () => {
    for (const text of ['6:', '6:30', '6h', '6h30', '6:30:00', '-1:30', '٦:٣٠']) expect(judge(text, { duration: true })).toBeNull();
    expect(judge('6x', { duration: true })).toBe('numbersOnly');
    expect(judge('-1', { duration: true, min: 0 })).toBe('min');
  });
});

describe('numberMisfit — a number read, and what its field holds', () => {
  it('says a decimal in a whole number, places past the field’s and digits past its own', () => {
    expect(numberMisfit(1.5, { integer: true })).toEqual({ problem: 'integer' });
    expect(numberMisfit(12, { integer: true })).toBeNull();
    expect(numberMisfit(1.234, { places: 2 })).toEqual({ problem: 'decimals', places: 2 });
    expect(numberMisfit(12.5, { places: 1 })).toBeNull();
    expect(numberMisfit(12345, { digits: 4 })).toEqual({ problem: 'digits', n: 4 });
    expect(numberMisfit(1e16, {})).toEqual({ problem: 'digits', n: 15 });
  });

  it('leaves its least and most to check, and hours to their own reader', () => {
    expect(numberMisfit(-3, { min: 1 })).toBeNull();
    expect(numberMisfit(6.25, { duration: true, places: 1 })).toBeNull();
  });
});

describe('cleanPastedNumber — a pasted amount', () => {
  const paste = (text: string, locale = 'en', options = {}) => cleanPastedNumber(text, locale, options);

  it('takes an amount copied from a page with its own currency', () => {
    expect(paste('370,000.00 EGP', 'en', { currency: 'EGP' })).toEqual({ ok: true, text: '370000.00', value: 370000 });
    expect(paste('370 000,00 EGP', 'fr', { currency: 'EGP' })).toEqual({ ok: true, text: '370000,00', value: 370000 });
    expect(paste('E£ 1,500', 'en', { currency: 'EGP' })).toMatchObject({ ok: true, value: 1500 });
    expect(paste('\u200eE£\u00a01,500.00', 'ar', { currency: 'EGP' })).toMatchObject({ ok: true, value: 1500 });
    expect(paste('1.500,00 ج.م.', 'ar', { currency: 'EGP' })).toMatchObject({ ok: true, value: 1500 });
    expect(paste('E£ 1.200,00', 'de', { currency: 'EGP' })).toMatchObject({ ok: true, text: '1200,00', value: 1200 });
  });

  it('reads accounting negatives', () => {
    expect(paste('(1,200.00)')).toMatchObject({ ok: true, value: -1200 });
    expect(paste('1,200-')).toMatchObject({ ok: true, value: -1200 });
    expect(paste('-E£ 1,500', 'en', { currency: 'EGP' })).toMatchObject({ ok: true, value: -1500 });
  });

  it('takes a per cent, Arabic digits, and a single line break at the end', () => {
    expect(paste('25%')).toMatchObject({ ok: true, value: 25 });
    expect(paste('٢٥٪', 'ar')).toMatchObject({ ok: true, value: 25 });
    expect(paste('12\r\n')).toMatchObject({ ok: true, value: 12 });
  });

  it('names another currency', () => {
    expect(paste('$1,500.00', 'en', { currency: 'EGP' })).toEqual({ ok: false, problem: 'otherCurrency', currency: '$' });
    expect(paste('1,200.00 USD', 'en', { currency: 'EGP' })).toEqual({ ok: false, problem: 'otherCurrency', currency: 'USD' });
  });

  it('takes trailing zeros, and a 0 led by a decimal comma as a half', () => {
    expect(paste('1,200.00')).toEqual({ ok: true, text: '1200.00', value: 1200 });
    expect(paste('12.50')).toEqual({ ok: true, text: '12.50', value: 12.5 });
    expect(paste('٠٫٥٠', 'ar')).toEqual({ ok: true, text: '0.50', value: 0.5 });
    expect(paste('0,500')).toEqual({ ok: true, text: '0.500', value: 0.5 });
    expect(paste('0,750', 'ar')).toEqual({ ok: true, text: '0.750', value: 0.75 });
    expect(paste('0,500', 'fr')).toEqual({ ok: true, text: '0,500', value: 0.5 });
  });

  it('refuses what is not a number, and several values', () => {
    expect(paste('abc')).toEqual({ ok: false, problem: 'notANumber' });
    expect(paste('12abc')).toEqual({ ok: false, problem: 'notANumber' });
    expect(paste('12\t380')).toEqual({ ok: false, problem: 'severalValues' });
    expect(paste('12\n380')).toEqual({ ok: false, problem: 'severalValues' });
    expect(paste('')).toEqual({ ok: false, problem: 'notANumber' });
  });
});

describe('readDuration — typed hours', () => {
  const hours = (text: string, locale = 'en') => {
    const read = readDuration(text, locale);
    return read.ok ? read.value : read.problem;
  };

  it('reads hours and minutes, and hours, in every way people write them', () => {
    expect(hours('6:30')).toBe(6.5);
    expect(hours('06:30')).toBe(6.5);
    expect(hours('6.5')).toBe(6.5);
    expect(hours('6,5')).toBe(6.5);
    expect(hours('6,5', 'de')).toBe(6.5);
    expect(hours('6.5', 'de')).toBe(6.5);
    expect(hours('6h30')).toBe(6.5);
    expect(hours('6h')).toBe(6);
    expect(hours('6:30:00')).toBe(6.5);
    expect(hours('-1:30')).toBe(-1.5);
    // One digit of minutes is read as written only when it can be one time alone: "1:5" could be 1:05 or 1:50.
    expect(hours('1:7')).toBeCloseTo(1 + 7 / 60);
    expect(hours('1:5')).toBe('minuteDigits');
    expect(hours('٦:٣٠')).toBe(6.5);
    expect(hours('٦٫٥')).toBe(6.5);
    expect(hours('')).toBeNull();
  });

  it('says why: minutes past 59, or a shape that is no time', () => {
    expect(hours('12:75')).toBe('minutes');
    expect(hours('6 30')).toBe('duration');
    expect(hours('6:30:15')).toBe('duration');
    expect(hours('six')).toBe('numbersOnly');
    expect(hours('6:')).toBe('unfinished');
    expect(hours('-')).toBe('unfinished');
  });
});

describe('readDate and readTime', () => {
  it('reads a date in the page’s order, ISO always, Arabic digits too', () => {
    expect(readDate('13/10/2026')).toEqual({ ok: true, value: '2026-10-13' });
    expect(readDate('13.10.2026')).toEqual({ ok: true, value: '2026-10-13' });
    expect(readDate('13 10 2026')).toEqual({ ok: true, value: '2026-10-13' });
    expect(readDate('2026-10-13')).toEqual({ ok: true, value: '2026-10-13' });
    expect(readDate('١٣/١٠/٢٠٢٦')).toEqual({ ok: true, value: '2026-10-13' });
    expect(readDate('10/13/2026', { order: 'mdy' })).toEqual({ ok: true, value: '2026-10-13' });
    expect(readDate('2026/10/13', { order: 'ymd' })).toEqual({ ok: true, value: '2026-10-13' });
    expect(readDate('')).toEqual({ ok: true, value: null });
  });

  it('says why a date does not read', () => {
    expect(readDate('31/02/2026')).toEqual({ ok: false, problem: 'noSuchDay', year: 2026, month: 2, days: 28 });
    expect(readDate('1/13/2026')).toEqual({ ok: false, problem: 'noSuchMonth' });
    expect(readDate('1/1/20261')).toEqual({ ok: false, problem: 'yearDigits' });
    // Four digits from 1000, for every box that reads a date: year 2 is no year people write.
    expect(readDate('13/10/0002')).toEqual({ ok: false, problem: 'yearDigits' });
    expect(readDate('0002-10-13')).toEqual({ ok: false, problem: 'yearDigits' });
    expect(readDate('13/10')).toEqual({ ok: false, problem: 'unfinished' });
    expect(readDate('13/10/')).toEqual({ ok: false, problem: 'unfinished' });
  });

  it('never takes a century for a year of two digits: it names both it could be', () => {
    expect(readDate('15/3/85')).toEqual({ ok: false, problem: 'shortYear', short: '85', early: 1985, late: 2085 });
    expect(readDate('13-10-26')).toEqual({ ok: false, problem: 'shortYear', short: '26', early: 1926, late: 2026 });
    expect(readDate('١٥/٣/٨٥')).toEqual({ ok: false, problem: 'shortYear', short: '85', early: 1985, late: 2085 });
    expect(readDate('26-10-13', { order: 'ymd' })).toEqual({ ok: false, problem: 'shortYear', short: '26', early: 1926, late: 2026 });
    expect(readDate('15 Oct 85', { locale: 'en' })).toEqual({ ok: false, problem: 'shortYear', short: '85', early: 1985, late: 2085 });
    expect(readDate('13/10/26 14:30', { time: true })).toEqual({ ok: false, problem: 'shortYear', short: '26', early: 1926, late: 2026 });
  });

  it('reads a date as Fieldia writes it at rest, its month in words, in every language it speaks', () => {
    // As the boxes show a date once left (Intl, en-GB, ar, fr, de): copied from a list or a read-only view, it pastes back.
    expect(readDate('15 Oct 2026', { locale: 'en' })).toEqual({ ok: true, value: '2026-10-15' });
    expect(readDate('15 أكتوبر 2026', { locale: 'ar' })).toEqual({ ok: true, value: '2026-10-15' });
    expect(readDate('‏15 أكتوبر 2026‏', { locale: 'ar' })).toEqual({ ok: true, value: '2026-10-15' });
    expect(readDate('١٥ اكتوبر ٢٠٢٦', { locale: 'ar' })).toEqual({ ok: true, value: '2026-10-15' });
    expect(readDate('15 oct. 2026', { locale: 'fr' })).toEqual({ ok: true, value: '2026-10-15' });
    expect(readDate('1 févr. 2026', { locale: 'fr' })).toEqual({ ok: true, value: '2026-02-01' });
    expect(readDate('15. Okt. 2026', { locale: 'de' })).toEqual({ ok: true, value: '2026-10-15' });
    expect(readDate('3. März 2026', { locale: 'de' })).toEqual({ ok: true, value: '2026-03-03' });
    // Month first, as an American page writes it; the long name; any of the four languages on any page.
    expect(readDate('Oct 15, 2026', { locale: 'en' })).toEqual({ ok: true, value: '2026-10-15' });
    expect(readDate('October 15 2026')).toEqual({ ok: true, value: '2026-10-15' });
    expect(readDate('15 Sept 2026')).toEqual({ ok: true, value: '2026-09-15' });
    expect(readDate('15-OCT-2026')).toEqual({ ok: true, value: '2026-10-15' });
    expect(readDate('2026 Oct 15')).toEqual({ ok: true, value: '2026-10-15' });
    expect(readDate('15 octobre 2026', { locale: 'en' })).toEqual({ ok: true, value: '2026-10-15' });
    // Said as the numbers are: a day the month does not have, a word that is no month.
    expect(readDate('31 Feb 2026')).toEqual({ ok: false, problem: 'noSuchDay', year: 2026, month: 2, days: 28 });
    expect(readDate('15 Octo 2026')).toEqual({ ok: false, problem: 'unfinished' });
    expect(readDate('15 Oct')).toEqual({ ok: false, problem: 'unfinished' });
    expect(readDate('Oct 2026')).toEqual({ ok: false, problem: 'unfinished' });
  });

  it('reads a date and time as Fieldia writes it at rest, and an instant as a server writes one', () => {
    expect(readDate('15 Oct 2026, 14:30', { time: true, locale: 'en' })).toEqual({ ok: true, value: '2026-10-15T14:30' });
    expect(readDate('15 أكتوبر 2026، 14:30', { time: true, locale: 'ar' })).toEqual({ ok: true, value: '2026-10-15T14:30' });
    expect(readDate('15 oct. 2026, 14:30', { time: true, locale: 'fr' })).toEqual({ ok: true, value: '2026-10-15T14:30' });
    expect(readDate('15. Okt. 2026, 14:30', { time: true, locale: 'de' })).toEqual({ ok: true, value: '2026-10-15T14:30' });
    expect(readDate('Oct 15, 2026, 2:30 pm', { time: true })).toEqual({ ok: true, value: '2026-10-15T14:30' });
    expect(readDate('13/10/2026, 14:30', { time: true })).toEqual({ ok: true, value: '2026-10-13T14:30' });
    // An instant: the local day and time it is, here.
    const at = new Date('2026-10-15T14:30:00Z');
    const local = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}T${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
    expect(readDate('2026-10-15T14:30:00Z', { time: true })).toEqual({ ok: true, value: local });
    expect(readDate('2026-10-15T14:30:00.000Z', { time: true })).toEqual({ ok: true, value: local });
    expect(readDate('2026-10-15T16:30:00+02:00', { time: true })).toEqual({ ok: true, value: local });
    expect(readDate('2026-10-15T14:30Z', { time: true })).toEqual({ ok: true, value: local });
    // Its seconds are never dropped in silence: a time is kept to the minute.
    expect(readDate('2026-10-15T14:30:45Z', { time: true })).toEqual({ ok: false, problem: 'time' });
    expect(readDate('2026-10-15T14:30:00.250Z', { time: true })).toEqual({ ok: false, problem: 'time' });
    // A date's box takes an instant's day where the person is: its time, seconds and all, is no part of a day, and is named.
    expect(readDate('2026-10-15T14:30:00Z')).toEqual({ ok: true, value: local.slice(0, 10), timeLeftOut: local.slice(11) });
    expect(readDate('2026-10-15T14:30:45.250Z')).toEqual({ ok: true, value: local.slice(0, 10), timeLeftOut: local.slice(11) });
  });

  it('reads a date with its time', () => {
    expect(readDate('13/10/2026 14:30', { time: true })).toEqual({ ok: true, value: '2026-10-13T14:30' });
    expect(readDate('13/10/2026 2:30 pm', { time: true })).toEqual({ ok: true, value: '2026-10-13T14:30' });
    expect(readDate('١٣/١٠/٢٠٢٦ ٢:٣٠ م', { time: true })).toEqual({ ok: true, value: '2026-10-13T14:30' });
    expect(readDate('13/10/2026', { time: true })).toEqual({ ok: true, value: '2026-10-13T00:00' });
    expect(readDate('13/10/2026 25:00', { time: true })).toEqual({ ok: false, problem: 'time' });
  });

  it('reads a time of day, 24-hour or with am/pm', () => {
    expect(readTime('14:30')).toEqual({ ok: true, value: '14:30' });
    expect(readTime('9:05')).toEqual({ ok: true, value: '09:05' });
    expect(readTime('2:30 pm')).toEqual({ ok: true, value: '14:30' });
    expect(readTime('12 am')).toEqual({ ok: true, value: '00:00' });
    expect(readTime('٢:٣٠ م')).toEqual({ ok: true, value: '14:30' });
    expect(readTime('14h30')).toEqual({ ok: true, value: '14:30' });
    expect(readTime('1430')).toEqual({ ok: true, value: '14:30' });
    expect(readTime('14:')).toEqual({ ok: false, problem: 'unfinished' });
    expect(readTime('25:00')).toEqual({ ok: false, problem: 'time' });
    expect(readTime('13 pm')).toEqual({ ok: false, problem: 'time' });
  });
});

describe('places', () => {
  it('gives money its currency’s places: 3 for the dinars and rials of the Gulf and Jordan, else 2', () => {
    for (const code of ['KWD', 'BHD', 'OMR', 'JOD']) expect(placesOfCurrency(code)).toBe(3);
    for (const code of ['EGP', 'SAR', 'AED', 'USD']) expect(placesOfCurrency(code)).toBe(2);
    expect(placesOfCurrency(null)).toBe(2);
    expect(placesOfCurrency('Pounds')).toBe(2);
  });

  it('counts a number’s own places', () => {
    expect(placesOf(12)).toBe(0);
    expect(placesOf(12.345)).toBe(3);
    expect(placesOf(-0.5)).toBe(1);
    expect(placesOf(1e-7)).toBe(7);
    expect(placesOf(1.5e-7)).toBe(8);
    expect(placesOf(1e21)).toBe(0);
  });
});
