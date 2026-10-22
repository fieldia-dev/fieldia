import type { ValueKind } from '@fieldia/core';
import type { DesignerWords } from '../../designer-words';
import { listOf, ltr, plural, quoteAr } from '../speak';

const q = quoteAr;
const letters = (n: number) => plural('ur', n, { one: '# حرف', other: '# حروف' });
/** The formula's own words, said in Urdu; "not in" is one piece of a formula. */
const KEYWORDS: Record<string, string> = { and: 'اور', or: 'یا', not: 'نہیں', in: 'ان میں سے ایک', 'not in': 'ان میں سے کوئی نہیں' };
/** The kinds of value, as a sentence names them. */
const KINDS: Record<ValueKind, string> = { number: 'عدد', text: 'متن', date: 'تاریخ', boolean: 'ہاں یا نہیں', list: 'فہرست', any: 'کوئی بھی قدر' };

/**
 * The designer's words in Urdu: rules as sentences, and a formula in words — its signs, what is wrong with it, what it
 * gives on made-up values. A condition's test says the value before its verb, as Urdu does; a formula keeps
 * its own order, so = and ≠ stand for == and !=, beside the ≥, ≤, × and ÷ every language shows.
 * UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const rules: DesignerWords['rules'] = {
  kinds: {
    length: 'لمبائی',
    ending: 'اختتام',
    pattern: 'پیٹرن',
    range: 'رینج',
    count: 'کتنے منتخب ہوں',
    past: 'ماضی کی تاریخ',
    future: 'مستقبل کی تاریخ',
    across: 'فیلڈز کے درمیان قاعدہ',
    distinct: 'کالم میں کوئی قدر دو بار نہیں',
  },
  patterns: { letters: 'صرف حروف', digits: 'صرف ہندسے', lettersAndDigits: 'صرف حروف اور ہندسے' },
  exactlyLetters: (n) => `ٹھیک ${letters(n)}`,
  mustExactlyLetters: (n) => `ٹھیک ${letters(n)} کا ہونا لازمی ہے`,
  betweenLetters: (a, b) => `${a} سے ${letters(b)} تک`,
  mustBetweenLetters: (a, b) => `${a} سے ${letters(b)} تک کا ہونا لازمی ہے`,
  atLeastLetters: (n) => `کم از کم ${letters(n)}`,
  mustAtLeastLetters: (n) => `کم از کم ${letters(n)} کا ہونا لازمی ہے`,
  atMostLetters: (n) => `زیادہ سے زیادہ ${letters(n)}`,
  mustAtMostLetters: (n) => `زیادہ سے زیادہ ${letters(n)} کا ہونا لازمی ہے`,
  mustNamed: { letters: 'صرف حروف کا ہونا لازمی ہے', digits: 'صرف ہندسوں کا ہونا لازمی ہے', lettersAndDigits: 'صرف حروف اور ہندسوں کا ہونا لازمی ہے' },
  matches: (pattern) => `پیٹرن ${ltr(pattern)} سے مطابقت`,
  mustMatch: (pattern) => `پیٹرن ${ltr(pattern)} سے مطابقت لازمی ہے`,
  endsWith: (end) => `آخر میں ${ltr(end)}`,
  mustEndWith: (end) => `آخر میں ${ltr(end)} کا ہونا لازمی ہے`,
  exactly: (n) => `ٹھیک ${n}`,
  mustExactly: (n) => `ٹھیک ${n} ہونا لازمی ہے`,
  between: (a, b) => `${a} اور ${b} کے درمیان`,
  mustBetween: (a, b) => `${a} اور ${b} کے درمیان ہونا لازمی ہے`,
  atLeast: (n) => `کم از کم ${n}`,
  mustAtLeast: (n) => `کم از کم ${n} ہونا لازمی ہے`,
  atMost: (n) => `زیادہ سے زیادہ ${n}`,
  mustAtMost: (n) => `زیادہ سے زیادہ ${n} ہونا لازمی ہے`,
  tickBetween: (a, b) => `${a} سے ${b} تک منتخب کریں`,
  mustTickBetween: (a, b) => `${a} سے ${b} تک منتخب کرنا لازمی ہے`,
  tickAtLeast: (n) => `کم از کم ${n} منتخب کریں`,
  mustTickAtLeast: (n) => `کم از کم ${n} منتخب کرنا لازمی ہے`,
  tickAtMost: (n) => `زیادہ سے زیادہ ${n} منتخب کریں`,
  mustTickAtMost: (n) => `زیادہ سے زیادہ ${n} منتخب کرنا لازمی ہے`,
  past: 'ماضی کی تاریخ',
  mustPast: 'ماضی کی تاریخ ہونا لازمی ہے',
  future: 'مستقبل کی تاریخ',
  mustFuture: 'مستقبل کی تاریخ ہونا لازمی ہے',
  mustHold: (formula) => `لازماً درست ہو: ${formula}`,
  distinct: (column) => `کوئی ${column} دو بار نہیں`,
  mustDistinct: (column) => `ہر ${column} کا ایک ہی بار ہونا لازمی ہے`,
  joinAsks: (asks) => asks.join('، '),
  onlyWarns: 'صرف خبردار کرتا ہے',
  neverChecked: 'کبھی نہیں جانچا جاتا',
  onlyWhen: (condition) => `صرف جب ${condition}`,
  sentence: (said, notes) => (notes.length ? `${said} — ${notes.join('، ')}` : said),
  must: (said, notes) => (notes.length ? `${said} (${notes.join('، ')})` : said),
  asksNothingYet: 'ابھی کچھ نہیں مانگتا',
  asksNothing: 'کچھ نہیں مانگتا',
  is: 'ہو',
  isNot: 'نہ ہو',
  test: (field, op, value) => `${field} ${value} ${op}`,
  allOf: (tests) => tests.join(' اور '),
  anyOf: (tests) => tests.join(' یا '),
  text: (text) => q(text),
  yes: 'ہاں',
  no: 'نہیں',
  nothing: 'کچھ نہیں',
  untitledPage: 'بے عنوان صفحہ',
  alwaysHidden: 'ہمیشہ پوشیدہ',
  hiddenWhen: (formula) => `پوشیدہ جب ${formula}`,
  showsWhen: (condition) => `تب دکھائیں جب ${condition}`,
  requiredWhen: (formula) => `لازمی جب ${formula}`,
  readonlyWhen: (formula) => `صرف پڑھنے کے لیے جب ${formula}`,
  workedOutFrom: (formula) => `حساب شدہ: ${formula}`,
  setTo: (value, when) => `جب ${when} تو ${value} پر سیٹ کریں`,
  onChange: (labels, condition) => `${listOf('ur', labels.map((label) => q(label)), 'or')} تبدیل ہو${condition ? `، اگر ${condition}` : ''}`,
  signs: { is: '=', isNot: '≠' },
  keyword: (word) => {
    const said = word.toLowerCase().split(/\s+/).join(' ');
    return KEYWORDS[said] ?? said.split(' ').map((part) => KEYWORDS[part] ?? part).join(' ');
  },
  quoteName: (label) => q(label),
  typeAFormula: 'فارمولا لکھیں',
  cannotBeIn: (sign) => `${q(sign)} فارمولے میں نہیں آ سکتا،`,
  unknownField: (name) => `نامعلوم فیلڈ ${q(name)}`,
  personHas: (part) => `شخص کی شناخت، نام یا کردار ہوتے ہیں، ${q(part)} نہیں`,
  unknownFunction: (name) => `نامعلوم فنکشن ${q(name)}`,
  wrongKind: (name, wants, given, got) => `${q(name)} ${listOf('ur', wants.map((kind) => KINDS[kind]), 'or')} لیتا ہے: ${q(given)} ${KINDS[got]} ہے`,
  takes: (name, rest) => {
    // The formula reader's own words, said again in Urdu.
    const values = (n: number) => plural('ur', n, { one: '# قدر', other: '# قدریں' });
    let said: string;
    let m: RegExpExecArray | null;
    if (/^ takes no values/.test(rest)) said = 'کوئی قدر نہیں لیتا';
    else if ((m = /^ takes (\d+) or more values/.exec(rest))) said = `${values(Number(m[1]))} یا زیادہ لیتا ہے`;
    else if ((m = /^ takes (\d+) or (\d+) values/.exec(rest))) said = `${m[1]} یا ${m[2]} قدریں لیتا ہے`;
    else if ((m = /^ takes (\d+) values?/.exec(rest))) said = `${values(Number(m[1]))} لیتا ہے`;
    else if (/^ takes the name of a field/.test(rest)) said = `سطروں کے بعد کوٹیشن میں کسی فیلڈ کا نام لیتا ہے: ${ltr(`${name}(lines, 'subtotal')`)}`;
    else said = 'یہ قدریں قبول نہیں کرتا';
    return `${q(name)} ${said}،`;
  },
  neverClosed: '«(» کبھی بند نہیں ہوتا',
  missingAfter: (piece) => `${q(piece)} کے بعد کچھ کم ہے`,
  outOfPlace: (piece) => `${q(piece)} اپنی جگہ پر نہیں`,
  at: (words, place) => `${words}، مقام ${ltr(place)} پر`,
  fromItself: (label) => `${q(label)} کا حساب خود اسی سے نہیں ہو سکتا`,
  circle: (label, path) => `${q(label)} کا حساب خود اسی سے ہوگا: ${path.join(' ← ')}`,
  cannotWorkOut: 'کچھ نہیں — اس کا حساب نہیں ہو سکتا',
  always: (value) => `ہمیشہ ${value}`,
  given: (name, value) => `${name} ${value}`,
  withValues: (given, result) => `${listOf('ur', given, 'and')} کے ساتھ: ${result}`,
  alwaysHolds: 'ہمیشہ درست',
  neverHolds: 'کبھی درست نہیں',
  checkedOnce: (names) => `${listOf('ur', names, 'and')} کے بھرنے کے بعد جانچا جاتا ہے`,
  holds: 'درست',
  doesNotHold: 'درست نہیں',
  asks: {
    minLength: 'لمبائی',
    maxLength: 'لمبائی',
    endsWith: 'اختتام',
    pattern: 'پیٹرن',
    min: 'رینج',
    max: 'رینج',
    atLeast: 'منتخب کی تعداد',
    atMost: 'منتخب کی تعداد',
    date: 'ماضی یا مستقبل کی تاریخ',
    holds: 'فیلڈز کے درمیان قاعدہ',
    distinct: 'کالم میں کوئی قدر دو بار نہیں',
  },
  computeFromModel: (label) => `${q(label)} کا حساب کیسے ہوتا ہے، یہ ڈیٹا ماڈل سے آتا ہے`,
  notALineField: (name, table) => `${q(name)} ${q(table)} کی سطروں کی فیلڈ نہیں`,
  setFromModel: (label) => `${q(label)} کو کیا سیٹ کرتا ہے، یہ ڈیٹا ماڈل سے آتا ہے`,
  cannotBeWorkedOut: (label, stored) => `${q(label)} کی قسم ${stored} ہے، جس کا حساب دوسری فیلڈز سے نہیں ہو سکتا`,
  cannotBeSet: (label, stored) => `${q(label)} کی قسم ${stored} ہے، جسے کسی قاعدے سے سیٹ نہیں کیا جا سکتا`,
  inWhen: (problem) => `جب: ${problem}`,
  inSetTo: (problem) => `سیٹ کریں: ${problem}`,
  holdsNot: (label, stored, value) => `${q(label)} کی قسم ${stored} ہے، ${value} نہیں`,
  offersNot: (label, offered, value) => `${q(label)} میں ${listOf('ur', offered, 'and')} ہیں، ${value} نہیں`,
  askSomething: 'قاعدہ کچھ مانگتا ہے: لمبائی، اختتام، پیٹرن، رینج، کتنے منتخب ہوں، تاریخ یا فیلڈز کے درمیان قاعدہ',
  askMisfit: (label, stored, ask) => `${q(label)} کی قسم ${stored} ہے: ${ask} اس کے لیے موزوں نہیں`,
  patternUnreadable: (pattern) => `پیٹرن ${ltr(pattern)} پڑھا نہیں جا سکتا`,
  lengthWhole: 'لمبائی حروف کا ایک مکمل عدد ہے',
  tickedWhole: 'منتخب کی تعداد ایک مکمل عدد ہے',
  rangeNumbers: 'رینج اعداد کے درمیان ہوتی ہے',
  shortestLonger: (a, b) => `سب سے مختصر (${a}) سب سے طویل (${b}) سے زیادہ لمبا ہے`,
  smallestMore: (a, b) => `سب سے چھوٹا (${a}) سب سے بڑے (${b}) سے زیادہ ہے`,
  atLeastMore: (a, b) => `«کم از کم ${a}»، «زیادہ سے زیادہ ${b}» سے زیادہ ہے`,
  inMustHold: (problem) => `لازماً درست ہو: ${problem}`,
  inOnlyWhen: (problem) => `صرف جب: ${problem}`,
  noRule: (label, n) => `${q(label)} میں قاعدہ ${n} موجود نہیں`,
};
