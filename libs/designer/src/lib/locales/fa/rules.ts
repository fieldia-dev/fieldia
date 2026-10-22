/**
 * The designer's words in Farsi: rules as sentences — «نمایش در صورتی که …»، «محاسبه‌شده از …» — and a formula in
 * words: its signs, what is wrong with it, what it gives on made-up values. UNREVIEWED: machine-assisted, not yet
 * reviewed by a native speaker.
 */
import type { ValueKind } from '@fieldia/core';
import type { DesignerWords } from '../../designer-words';
import { listOf, ltr, plural, quoteAr } from '../speak';

const q = quoteAr;
/** A length in characters, the noun singular after the number: «5 نویسه». */
const letters = (n: number) => plural('fa', n, { one: '# نویسه', other: '# نویسه' });
/** The formula's own words, said in Persian. */
const KEYWORDS: Record<string, string> = { and: 'و', or: 'یا', not: 'نه', in: 'در' };
/** The kinds of value, as a sentence names them. */
const KINDS: Record<ValueKind, string> = { number: 'عدد', text: 'متن', date: 'تاریخ', boolean: 'بله یا خیر', list: 'فهرست', any: 'هر مقداری' };

export const rules: DesignerWords['rules'] = {
  kinds: {
    length: 'طول',
    ending: 'پسوند',
    pattern: 'قالب',
    range: 'بازه',
    count: 'تعداد انتخاب‌ها',
    past: 'تاریخی در گذشته',
    future: 'تاریخی در آینده',
    across: 'قاعده‌ای میان فیلدها',
    distinct: 'هیچ مقداری دو بار در یک ستون',
  },
  patterns: { letters: 'فقط حروف', digits: 'فقط ارقام', lettersAndDigits: 'فقط حروف و ارقام' },
  exactlyLetters: (n) => `دقیقاً ${letters(n)}`,
  mustExactlyLetters: (n) => `باید دقیقاً ${letters(n)} باشد`,
  betweenLetters: (a, b) => `بین ${a} و ${letters(b)}`,
  mustBetweenLetters: (a, b) => `باید بین ${a} و ${letters(b)} باشد`,
  atLeastLetters: (n) => `دست‌کم ${letters(n)}`,
  mustAtLeastLetters: (n) => `باید دست‌کم ${letters(n)} باشد`,
  atMostLetters: (n) => `حداکثر ${letters(n)}`,
  mustAtMostLetters: (n) => `باید حداکثر ${letters(n)} باشد`,
  mustNamed: { letters: 'باید فقط حروف باشد', digits: 'باید فقط ارقام باشد', lettersAndDigits: 'باید فقط حروف و ارقام باشد' },
  matches: (pattern) => `مطابق قالب ${ltr(pattern)}`,
  mustMatch: (pattern) => `باید با قالب ${ltr(pattern)} مطابقت داشته باشد`,
  endsWith: (end) => `با ${ltr(end)} تمام می‌شود`,
  mustEndWith: (end) => `باید با ${ltr(end)} تمام شود`,
  exactly: (n) => `دقیقاً ${n}`,
  mustExactly: (n) => `باید دقیقاً ${n} باشد`,
  between: (a, b) => `بین ${a} و ${b}`,
  mustBetween: (a, b) => `باید بین ${a} و ${b} باشد`,
  atLeast: (n) => `دست‌کم ${n}`,
  mustAtLeast: (n) => `باید دست‌کم ${n} باشد`,
  atMost: (n) => `حداکثر ${n}`,
  mustAtMost: (n) => `باید حداکثر ${n} باشد`,
  tickBetween: (a, b) => `انتخاب بین ${a} و ${b} مورد`,
  mustTickBetween: (a, b) => `باید بین ${a} و ${b} مورد انتخاب شود`,
  tickAtLeast: (n) => `انتخاب دست‌کم ${n} مورد`,
  mustTickAtLeast: (n) => `باید دست‌کم ${n} مورد انتخاب شود`,
  tickAtMost: (n) => `انتخاب حداکثر ${n} مورد`,
  mustTickAtMost: (n) => `باید حداکثر ${n} مورد انتخاب شود`,
  past: 'تاریخی در گذشته',
  mustPast: 'باید تاریخی در گذشته باشد',
  future: 'تاریخی در آینده',
  mustFuture: 'باید تاریخی در آینده باشد',
  mustHold: (formula) => `باید برقرار باشد: ${formula}`,
  distinct: (column) => `بدون ${column} تکراری`,
  mustDistinct: (column) => `هر ${column} باید فقط یک بار بیاید`,
  // Persian has no capitals to lower: the asks are joined as they are.
  joinAsks: (asks) => asks.join('، '),
  onlyWarns: 'فقط هشدار می‌دهد',
  neverChecked: 'هرگز بررسی نمی‌شود',
  onlyWhen: (condition) => `فقط در صورتی که ${condition}`,
  sentence: (said, notes) => (notes.length ? `${said} — ${notes.join('، ')}` : said),
  must: (said, notes) => (notes.length ? `${said} (${notes.join('، ')})` : said),
  asksNothingYet: 'هنوز چیزی نمی‌خواهد',
  asksNothing: 'چیزی نمی‌خواهد',
  is: 'برابر با',
  isNot: 'برابر نیست با',
  test: (field, op, value) => `${field} ${op} ${value}`,
  allOf: (tests) => tests.join(' و '),
  anyOf: (tests) => tests.join(' یا '),
  text: (text) => q(text),
  yes: 'بله',
  no: 'خیر',
  nothing: 'هیچ',
  untitledPage: 'صفحهٔ بی‌عنوان',
  alwaysHidden: 'همیشه پنهان',
  hiddenWhen: (formula) => `پنهان در صورتی که ${formula}`,
  showsWhen: (condition) => `نمایش در صورتی که ${condition}`,
  requiredWhen: (formula) => `الزامی در صورتی که ${formula}`,
  readonlyWhen: (formula) => `فقط‌خواندنی در صورتی که ${formula}`,
  workedOutFrom: (formula) => `محاسبه‌شده از ${formula}`,
  setTo: (value, when) => `تنظیم روی ${value} در صورتی که ${when}`,
  // Names joined by «یا» take a singular verb in Persian.
  onChange: (labels, condition) => `${listOf('fa', labels.map((label) => q(label)), 'or')} تغییر کند${condition ? `، اگر ${condition}` : ''}`,
  signs: { is: 'برابر با', isNot: 'برابر نیست با' },
  keyword: (word) => word.toLowerCase().split(/\s+/).map((part) => KEYWORDS[part] ?? part).join(' '),
  quoteName: (label) => q(label),
  typeAFormula: 'یک فرمول تایپ کنید',
  cannotBeIn: (sign) => `${q(sign)} نمی‌تواند در فرمول باشد،`,
  unknownField: (name) => `فیلد ناشناخته ${q(name)}`,
  personHas: (part) => `فرد شناسه، نام یا نقش دارد، نه ${q(part)}`,
  unknownFunction: (name) => `تابع ناشناخته ${q(name)}`,
  wrongKind: (name, wants, given, got) => `${q(name)} ${listOf('fa', wants.map((kind) => KINDS[kind]), 'or')} می‌گیرد: ${q(given)} ${KINDS[got]} است`,
  takes: (name, rest) => {
    // The formula reader's own words, said again in Persian.
    const values = (n: number) => plural('fa', n, { one: '# مقدار', other: '# مقدار' });
    let said: string;
    let m: RegExpExecArray | null;
    if (/^ takes no values/.test(rest)) said = 'هیچ مقداری نمی‌گیرد';
    else if ((m = /^ takes (\d+) or more values/.exec(rest))) said = `${values(Number(m[1]))} یا بیشتر می‌گیرد`;
    else if ((m = /^ takes (\d+) or (\d+) values/.exec(rest))) said = `${m[1]} یا ${m[2]} مقدار می‌گیرد`;
    else if ((m = /^ takes (\d+) values?/.exec(rest))) said = `${values(Number(m[1]))} می‌گیرد`;
    else if (/^ takes the name of a field/.test(rest)) said = `نام یک فیلد را میان علامت نقل‌قول، پس از سطرها، می‌گیرد: ${ltr(`${name}(lines, 'subtotal')`)}`;
    else said = 'این مقادیر را نمی‌پذیرد';
    return `${q(name)} ${said}،`;
  },
  neverClosed: 'پرانتز «(» هرگز بسته نمی‌شود',
  missingAfter: (piece) => `پس از ${q(piece)} چیزی کم است`,
  outOfPlace: (piece) => `${q(piece)} در جای خود نیست`,
  at: (words, place) => `${words} در جایگاه ${ltr(place)}`,
  fromItself: (label) => `${q(label)} نمی‌تواند از خودش محاسبه شود`,
  circle: (label, path) => `${q(label)} از خودش محاسبه می‌شود: ${path.join(' ← ')}`,
  cannotWorkOut: 'هیچ — قابل محاسبه نیست',
  always: (value) => `همیشه ${value}`,
  given: (name, value) => `${name} ${value}`,
  withValues: (given, result) => `با ${listOf('fa', given, 'and')}: ${result}`,
  alwaysHolds: 'همیشه برقرار است',
  neverHolds: 'هرگز برقرار نیست',
  checkedOnce: (names) => `پس از پر شدن ${listOf('fa', names, 'and')} بررسی می‌شود`,
  holds: 'برقرار است',
  doesNotHold: 'برقرار نیست',
  asks: {
    minLength: 'طول',
    maxLength: 'طول',
    endsWith: 'پسوند',
    pattern: 'قالب',
    min: 'بازه',
    max: 'بازه',
    atLeast: 'تعداد انتخاب‌ها',
    atMost: 'تعداد انتخاب‌ها',
    date: 'تاریخی در گذشته یا آینده',
    holds: 'قاعده‌ای میان فیلدها',
    distinct: 'هیچ مقداری دو بار در یک ستون',
  },
  computeFromModel: (label) => `نحوهٔ محاسبهٔ ${q(label)} از مدل داده می‌آید`,
  notALineField: (name, table) => `${q(name)} فیلدی از سطرهای ${q(table)} نیست`,
  setFromModel: (label) => `آنچه ${q(label)} را تنظیم می‌کند از مدل داده می‌آید`,
  cannotBeWorkedOut: (label, stored) => `مقدار ${q(label)} ${stored} است، که نمی‌توان آن را از فیلدهای دیگر محاسبه کرد`,
  cannotBeSet: (label, stored) => `مقدار ${q(label)} ${stored} است، که نمی‌توان آن را با قاعده تنظیم کرد`,
  inWhen: (problem) => `شرط: ${problem}`,
  inSetTo: (problem) => `تنظیم روی: ${problem}`,
  holdsNot: (label, stored, value) => `مقدار ${q(label)} ${stored} است، نه ${value}`,
  offersNot: (label, offered, value) => `${q(label)} ${listOf('fa', offered, 'and')} را ارائه می‌کند، نه ${value}`,
  askSomething: 'قاعده چیزی می‌خواهد: طول، پسوند، قالب، بازه، تعداد انتخاب‌ها، تاریخ یا قاعده‌ای میان فیلدها',
  askMisfit: (label, stored, ask) => `مقدار ${q(label)} ${stored} است: ${ask} مناسب آن نیست`,
  patternUnreadable: (pattern) => `قالب ${ltr(pattern)} قابل خواندن نیست`,
  lengthWhole: 'طول، تعداد صحیحی از نویسه‌هاست',
  tickedWhole: 'تعداد انتخاب‌ها یک عدد صحیح است',
  rangeNumbers: 'بازه میان عددهاست',
  shortestLonger: (a, b) => `کوتاه‌ترین (${a}) بلندتر از بلندترین (${b}) است`,
  smallestMore: (a, b) => `کوچک‌ترین (${a}) بیشتر از بزرگ‌ترین (${b}) است`,
  atLeastMore: (a, b) => `«دست‌کم ${a}» بیشتر از «حداکثر ${b}» است`,
  inMustHold: (problem) => `باید برقرار باشد: ${problem}`,
  inOnlyWhen: (problem) => `فقط در صورتی که: ${problem}`,
  noRule: (label, n) => `${q(label)} قاعدهٔ ${n} ندارد`,
};
