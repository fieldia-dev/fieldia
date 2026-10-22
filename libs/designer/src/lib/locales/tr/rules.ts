import type { ValueKind } from '@fieldia/core';
import type { DesignerWords } from '../../designer-words';
import { listOf, plural } from '../speak';

/** The kinds of value, as a sentence names them. */
const KINDS: Record<ValueKind, string> = { number: 'sayı', text: 'metin', date: 'tarih', boolean: 'evet/hayır', list: 'liste', any: 'herhangi bir değer' };
/** The formula's own words, as Turkish reads them: "in" and "not in" before the list they test. */
const KEYWORDS: Record<string, string> = { and: 've', or: 'veya', not: 'değil', in: 'şunlardan biri:', 'not in': 'şunlardan biri değil:' };

const q = (name: string) => `“${name}”`;
/** The first letter small, the Turkish way (İ → i, I → ı). */
const lower = (words: string) => words.charAt(0).toLocaleLowerCase('tr') + words.slice(1);
const letters = (n: number) => plural('tr', n, { one: '# harf', other: '# harf' });
const values = (n: number) => plural('tr', n, { one: '# değer', other: '# değer' });

/**
 * The designer's words in Turkish: rules as sentences — "Şu durumda görünür: Durum eşittir Etkin" — and a formula in
 * words: its signs, what is wrong with it, what it gives on made-up values. UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
 */
export const rules: DesignerWords['rules'] = {
  // ---- what "Add a rule" offers
  kinds: {
    length: 'Uzunluk',
    ending: 'Son ek',
    pattern: 'Desen',
    range: 'Aralık',
    count: 'İşaretlenen sayısı',
    past: 'Geçmişte bir tarih',
    future: 'Gelecekte bir tarih',
    across: 'Alanlar arası kural',
    distinct: 'Bir sütunda aynı değer iki kez olmasın',
  },
  patterns: { letters: 'Yalnızca harfler', digits: 'Yalnızca rakamlar', lettersAndDigits: 'Yalnızca harfler ve rakamlar' },
  // ---- an answer rule's asks: as it reads alone, and as what the answer must be
  exactlyLetters: (n) => `Tam olarak ${letters(n)}`,
  mustExactlyLetters: (n) => `Tam olarak ${letters(n)} olmalı`,
  betweenLetters: (a, b) => `${a} ile ${letters(b)} arası`,
  mustBetweenLetters: (a, b) => `${a} ile ${letters(b)} arasında olmalı`,
  atLeastLetters: (n) => `En az ${letters(n)}`,
  mustAtLeastLetters: (n) => `En az ${letters(n)} olmalı`,
  atMostLetters: (n) => `En fazla ${letters(n)}`,
  mustAtMostLetters: (n) => `En fazla ${letters(n)} olmalı`,
  mustNamed: { letters: 'Yalnızca harflerden oluşmalı', digits: 'Yalnızca rakamlardan oluşmalı', lettersAndDigits: 'Yalnızca harf ve rakamlardan oluşmalı' },
  matches: (pattern) => `Şu desene uyar: ${pattern}`,
  mustMatch: (pattern) => `Şu desene uymalı: ${pattern}`,
  endsWith: (end) => `Şununla biter: ${end}`,
  mustEndWith: (end) => `Şununla bitmeli: ${end}`,
  exactly: (n) => `Tam olarak ${n}`,
  mustExactly: (n) => `Tam olarak ${n} olmalı`,
  between: (a, b) => `${a} ile ${b} arası`,
  mustBetween: (a, b) => `${a} ile ${b} arasında olmalı`,
  atLeast: (n) => `En az ${n}`,
  mustAtLeast: (n) => `En az ${n} olmalı`,
  atMost: (n) => `En fazla ${n}`,
  mustAtMost: (n) => `En fazla ${n} olmalı`,
  tickBetween: (a, b) => `${a} ile ${b} arasında işaretleyin`,
  mustTickBetween: (a, b) => `${a} ile ${b} arasında işaretlenmeli`,
  tickAtLeast: (n) => `En az ${n} işaretleyin`,
  mustTickAtLeast: (n) => `En az ${n} işaretlenmeli`,
  tickAtMost: (n) => `En fazla ${n} işaretleyin`,
  mustTickAtMost: (n) => `En fazla ${n} işaretlenmeli`,
  past: 'Geçmişte bir tarih',
  mustPast: 'Geçmişte bir tarih olmalı',
  future: 'Gelecekte bir tarih',
  mustFuture: 'Gelecekte bir tarih olmalı',
  mustHold: (formula) => `Sağlanmalı: ${formula}`,
  distinct: (column) => `${column} değerleri tekrarlanmaz`,
  mustDistinct: (column) => `Her ${column} değeri yalnızca bir kez olmalı`,
  joinAsks: (asks) => [asks[0], ...asks.slice(1).map(lower)].join(', '),
  onlyWarns: 'yalnızca uyarır',
  neverChecked: 'hiç denetlenmez',
  onlyWhen: (condition) => `yalnızca şu durumda: ${condition}`,
  sentence: (said, notes) => (notes.length ? `${said} — ${notes.join(', ')}` : said),
  must: (said, notes) => (notes.length ? `${said} (${notes.join(', ')})` : said),
  asksNothingYet: 'Henüz bir şey istemiyor',
  asksNothing: 'Bir şey istemiyor',
  // ---- conditions and values: "is" said as Turkish filters say it, between the field and its value
  is: 'eşittir',
  isNot: 'eşit değildir',
  test: (field, op, value) => `${field} ${op} ${value}`,
  allOf: (tests) => tests.join(' ve '),
  anyOf: (tests) => tests.join(' veya '),
  text: (text) => q(text),
  yes: 'Evet',
  no: 'Hayır',
  nothing: 'hiçbir şey',
  // ---- every rule on the page
  untitledPage: 'Adsız sayfa',
  alwaysHidden: 'Her zaman gizli',
  hiddenWhen: (formula) => `Şu durumda gizli: ${formula}`,
  showsWhen: (condition) => `Şu durumda görünür: ${condition}`,
  requiredWhen: (formula) => `Şu durumda zorunlu: ${formula}`,
  readonlyWhen: (formula) => `Şu durumda salt okunur: ${formula}`,
  workedOutFrom: (formula) => `Şundan hesaplanır: ${formula}`,
  setTo: (value, when) => `Şu durumda ${value} olarak ayarlanır: ${when}`,
  onChange: (labels, condition) => `${listOf('tr', labels.map(q), 'or')} değiştiğinde${condition ? `, ${condition} ise` : ''}`,
  // ---- a formula in words
  signs: { is: 'eşittir', isNot: 'eşit değildir' },
  keyword: (word) => {
    const said = word.toLowerCase().split(/\s+/).join(' ');
    return KEYWORDS[said] ?? said.split(' ').map((part) => KEYWORDS[part] ?? part).join(' ');
  },
  quoteName: (label) => q(label),
  // ---- what is wrong with a formula
  typeAFormula: 'Bir formül yazın',
  cannotBeIn: (sign) => `${q(sign)} bir formülde yer alamaz,`,
  unknownField: (name) => `Bilinmeyen alan: ${q(name)}`,
  personHas: (part) => `Kişinin kimliği, adı veya rolleri olur; ${q(part)} olmaz`,
  unknownFunction: (name) => `Bilinmeyen işlev: ${q(name)}`,
  wrongKind: (name, wants, given, got) => `${q(name)} ${listOf('tr', wants.map((kind) => KINDS[kind]), 'or')} alır: ${given} ise ${KINDS[got]}`,
  takes: (name, rest) => {
    // The formula reader's own words, said again in Turkish; an example it gives is kept as written.
    const example = /: (.+)$/.exec(rest)?.[1];
    let said: string;
    let m: RegExpExecArray | null;
    if (/^ takes no values/.test(rest)) said = 'hiç değer almaz';
    else if ((m = /^ takes (\d+) or more values/.exec(rest))) said = `${values(Number(m[1]))} veya daha fazlasını alır`;
    else if ((m = /^ takes (\d+) or (\d+) values/.exec(rest))) said = `${m[1]} veya ${values(Number(m[2]))} alır`;
    else if ((m = /^ takes (\d+) values?/.exec(rest))) said = `${values(Number(m[1]))} alır`;
    else if (/^ takes the name of a field/.test(rest)) said = `satırlardan sonra tırnak içinde bir alan adı alır${example ? `: ${example}` : ''}`;
    else if (/^ takes a condition/.test(rest)) said = `satırlar için tırnak içinde bir koşul alır${example ? `: ${example}` : ''}`;
    else said = 'bu değerleri kabul etmez';
    return `${q(name)} ${said},`;
  },
  neverClosed: 'Bir “(” hiç kapatılmamış',
  missingAfter: (piece) => `${q(piece)} sonrasında bir şey eksik`,
  outOfPlace: (piece) => `${q(piece)} yanlış yerde`,
  /** Where, after the words (their own comma dropped): "Bilinmeyen alan: “prise” (konum 1–5)". */
  at: (words, place) => `${words.replace(/,$/, '')} (konum ${place})`,
  fromItself: (label) => `${q(label)} kendisinden hesaplanamaz`,
  circle: (label, path) => `${q(label)} kendisinden hesaplanmış olurdu: ${path.join(' → ')}`,
  // ---- on made-up values
  cannotWorkOut: 'hiçbir şey — hesaplanamaz',
  always: (value) => `Her zaman ${value}`,
  given: (name, value) => `${name} ${value}`,
  withValues: (given, result) => `${listOf('tr', given, 'and')} olduğunda: ${result}`,
  alwaysHolds: 'Her zaman sağlanır',
  neverHolds: 'Hiçbir zaman sağlanmaz',
  checkedOnce: (names) => `${listOf('tr', names, 'and')} doldurulduğunda denetlenir`,
  holds: 'sağlanır',
  doesNotHold: 'sağlanmaz',
  // ---- a rule refused
  asks: {
    minLength: 'uzunluk',
    maxLength: 'uzunluk',
    endsWith: 'son ek',
    pattern: 'desen',
    min: 'aralık',
    max: 'aralık',
    atLeast: 'işaretlenen sayısı',
    atMost: 'işaretlenen sayısı',
    date: 'geçmişte veya gelecekte bir tarih',
    holds: 'alanlar arası kural',
    distinct: 'bir sütunda aynı değerin iki kez olmaması',
  },
  computeFromModel: (label) => `${q(label)} alanının nasıl hesaplandığı veri modelinden gelir`,
  notALineField: (name, table) => `${q(name)}, ${table} satırlarının bir alanı değil`,
  setFromModel: (label) => `${q(label)} alanını neyin ayarladığı veri modelinden gelir`,
  cannotBeWorkedOut: (label, stored) => `${q(label)} alanının içeriği: ${stored}; bu, diğer alanlardan hesaplanamaz`,
  cannotBeSet: (label, stored) => `${q(label)} alanının içeriği: ${stored}; bu, bir kuralla ayarlanamaz`,
  inWhen: (problem) => `Koşul: ${problem}`,
  inSetTo: (problem) => `Ayarlanacak değer: ${problem}`,
  holdsNot: (label, stored, value) => `${q(label)} alanının içeriği: ${stored}; ${value} değerini alamaz`,
  offersNot: (label, offered, value) => `${q(label)} şunları sunar: ${listOf('tr', offered, 'and')}; ${value} değil`,
  askSomething: 'Bir kural bir şey ister: uzunluk, son ek, desen, aralık, işaretlenen sayısı, tarih veya alanlar arası kural',
  askMisfit: (label, stored, ask) => `${q(label)} alanının içeriği: ${stored}; bu alana ${ask} kuralı uygulanamaz`,
  patternUnreadable: (pattern) => `${q(pattern)} deseni okunamıyor`,
  lengthWhole: 'Uzunluk, tam sayı bir harf sayısıdır',
  tickedWhole: 'İşaretlenen sayısı bir tam sayıdır',
  rangeNumbers: 'Aralık sayılar arasında olur',
  shortestLonger: (a, b) => `En kısa (${a}), en uzundan (${b}) uzun`,
  smallestMore: (a, b) => `En küçük (${a}), en büyükten (${b}) büyük`,
  atLeastMore: (a, b) => `“En az ${a}”, “en çok ${b}” değerinden büyük`,
  inMustHold: (problem) => `Sağlanmalı: ${problem}`,
  inOnlyWhen: (problem) => `Yalnızca şu durumda: ${problem}`,
  noRule: (label, n) => `${q(label)} alanının ${n}. kuralı yok`,
};
