/**
 * How Fieldia reads what a person types or pastes into a box: one set of
 * readers for every box — a form's fields, a table's cells, a list's filters,
 * the designer's settings — so a number, a duration, a date or a word is read
 * the same way wherever it is typed. Pure: no DOM, no form.
 *
 * People in Egypt and the Gulf type in Arabic too: Arabic-Indic digits
 * (٠١٢…), Persian ones (۰۱۲…), the Arabic decimal separator (٫) and its
 * thousands separator (٬), and a French or German decimal comma are read,
 * never refused. Invisible direction marks, which Arabic text carries and
 * copying brings along, are never part of what is read.
 */

/** Invisible direction marks: LRM, RLM, ALM, the embeddings and overrides, the isolates, and a byte-order mark. */
const MARKS = /[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069\ufeff]/g;
const MARKS_AT_ENDS = /^[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069\ufeff]+|[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069\ufeff]+$/g;

/** Invisible direction marks taken out: everywhere (what is structured), or only at the ends (any one line of text). */
export function stripMarks(text: string, where: 'all' | 'ends' = 'all'): string {
  return text.replace(where === 'all' ? MARKS : MARKS_AT_ENDS, '');
}

/** Arabic-Indic (٠-٩), Persian (۰-۹) and fullwidth (０-９) digits as 0-9; every other character as it is. */
export function foldDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06f0-\u06f9\uff10-\uff19]/g, (d) => {
    const code = d.charCodeAt(0);
    return String(code - (code >= 0xff10 ? 0xff10 : code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}

/** Line breaks as spaces, as one line of text keeps them; a password drops them instead. */
export function oneLine(text: string, options: { password?: boolean } = {}): string {
  return text.replace(/\r\n|[\r\n\u2028\u2029]/g, options.password ? '' : ' ');
}

/** How many characters a text has, as a server counts them: by code point, so an emoji is one. */
export function charCount(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

/**
 * The Arabic letters the readers fold or read, made from their code points: the one-tag script carries no
 * Arabic words (tools/script-bundle.mjs checks that none got past the languages' add-ons), and these are none.
 */
const letter = (...codes: number[]) => String.fromCharCode(...codes);
const ARABIC = {
  /** أ إ آ ٱ, as ا. */
  alefs: new RegExp(`[${letter(0x623, 0x625, 0x622, 0x671)}]`, 'g'),
  alef: letter(0x627),
  /** ة as ه, ى as ي. */
  tehMarbuta: new RegExp(letter(0x629), 'g'),
  heh: letter(0x647),
  alefMaksura: new RegExp(letter(0x649), 'g'),
  yeh: letter(0x64a),
  /** The tatweel and the short vowels. */
  marks: new RegExp(`[${letter(0x640)}${letter(0x64b)}-${letter(0x65f)}${letter(0x670)}]`, 'g'),
  /** ص and م: a time's am and pm. */
  am: letter(0x635),
  pm: letter(0x645),
};
/** am or pm after a time, in English or Arabic. */
const HALF = `[aApP]\\.?\\s*[mM]\\.?|[${ARABIC.am}${ARABIC.pm}]`;
/** A time after a date, set apart by a space or a T: "14:30", "14h30", "2:30 pm", "2 pm", "٢:٣٠ م". */
const TIME_AFTER_DATE = new RegExp(`^(.*?\\d)(?:\\s+|T)(\\d{1,2}\\s*[:hH.]\\s*\\d{1,2}(?::\\d{2})?\\s*(?:${HALF})?|\\d{1,2}\\s*(?:${HALF}))$`);
/** A time of day: hours, minutes after a colon, a point or an h, seconds, am or pm. */
const TIME = new RegExp(`^(\\d{1,2})(?:\\s*[:.hH]\\s*(\\d{1,2})?)?(?::(\\d{2}))?\\s*(${HALF})?$`);

/**
 * Words folded for finding: case, Arabic letter forms (أ إ آ ٱ as ا, ة as ه,
 * ى as ي, the tatweel and short vowels dropped), digits in any script as 0-9,
 * and no direction marks — so "أحمد" finds "احمد" and "١٢" finds "12".
 */
export function foldForSearch(text: string): string {
  return foldDigits(stripMarks(text))
    .toLowerCase()
    .replace(ARABIC.alefs, ARABIC.alef)
    .replace(ARABIC.tehMarbuta, ARABIC.heh)
    .replace(ARABIC.alefMaksura, ARABIC.yeh)
    .replace(ARABIC.marks, '');
}

// ---------------------------------------------------------------------------
// Numbers

/** A page's own marks for numbers: its decimal mark and its grouping mark. */
export interface NumberMarks {
  decimal: string;
  group: string;
}

const marksByLocale = new Map<string, NumberMarks>();

/** The marks a language writes numbers with, in Latin digits: en "." and ",", de "," and ".", fr "," and a narrow space. */
export function numberMarks(locale: string): NumberMarks {
  let found = marksByLocale.get(locale);
  if (!found) {
    let parts: Intl.NumberFormatPart[];
    try {
      parts = new Intl.NumberFormat(locale, { numberingSystem: 'latn' }).formatToParts(12345.6);
    } catch {
      parts = [];
    }
    found = { decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.', group: parts.find((p) => p.type === 'group')?.value ?? ',' };
    marksByLocale.set(locale, found);
  }
  return found;
}

/** Why a text is not a number, or not yet one. */
export type NumberProblem =
  /** A letter, an emoji or another symbol: never part of a number. */
  | 'numbersOnly'
  /** A minus that is not first. */
  | 'minusFirst'
  /** Two decimal marks. */
  | 'oneDecimalMark'
  /** Grouping marks where groups of three cannot be: "12 34". */
  | 'groupsOfThree'
  /** A tab or a line break: several values, as spreadsheets copy them. */
  | 'severalValues'
  /** Not a whole number yet: "-", ".", "1,". */
  | 'unfinished';

/** A number read: its value (null for nothing typed), as written plain in the page's way, and how many places and digits it has. */
export interface NumberReading {
  ok: true;
  value: number | null;
  /** The number with no grouping, in Latin digits and the page's decimal mark: "-1234,5" on a German page. Empty for nothing. */
  plain: string;
  /** Its decimal places as typed: "1.50" has 2. */
  places: number;
  /** Its digits, leading zeros of the whole part left out: what a field's `digits[0]` counts. */
  digits: number;
  /** Its significant digits: past 15, a number is no longer kept exactly. */
  significant: number;
}

export type NumberRead = NumberReading | { ok: false; problem: NumberProblem };

/** What a box reads besides plain numbers: a trailing per cent sign (% or ٪). */
export interface NumberReadOptions {
  percent?: boolean;
}

const MINUS = '-\u2212\ufe63\uff0d';
const IS_MINUS = new RegExp(`[${MINUS}]`);
const LINE_BREAKS = /[\t\n\r\v\f\u2028\u2029]/;
const GROUP_SPACE = /[ \u00a0\u2007\u2009\u202f]/;

/** Fullwidth marks a Japanese or Chinese keyboard types, as their plain kind. */
const fullwidth = (text: string) => text.replace(/[\uff0b\uff0c\uff0e\uff05]/g, (c) => ({ '\uff0b': '+', '\uff0c': ',', '\uff0e': '.', '\uff05': '%' })[c] as string);

/** Text as the readers see it: no direction marks, digits and fullwidth marks folded. */
const folded = (text: string) => fullwidth(foldDigits(stripMarks(text)));

type MarkKind = 'dot' | 'comma' | 'arcomma' | 'ardecimal' | 'argroup' | 'space';
interface Mark {
  kind: MarkKind;
  char: string;
  /** Digits since the mark before it (or the start). */
  before: string;
}

/**
 * A number's body (no sign) taken apart: its digit runs and the marks between
 * them, and which mark is its decimal mark. `ambiguous` when that mark is the
 * page's grouping mark used once with too few digits after it yet: more
 * digits may still make it group ("1,5" on the way to "1,500").
 */
interface Body {
  marks: Mark[];
  /** Digits after the last mark. */
  tail: string;
  /** The index in `marks` of the decimal mark, or -1. */
  decimal: number;
  ambiguous: boolean;
  problem?: NumberProblem;
}

function kindOf(char: string): MarkKind | null {
  if (char === '.') return 'dot';
  if (char === ',') return 'comma';
  if (char === '\u060c') return 'arcomma';
  if (char === '\u066b') return 'ardecimal';
  if (char === '\u066c') return 'argroup';
  return GROUP_SPACE.test(char) ? 'space' : null;
}

/** The body's marks, and which is the decimal mark, by the reading rules (see readNumber). */
function takeApart(body: string, page: NumberMarks): Body {
  const marks: Mark[] = [];
  let run = '';
  for (const char of body) {
    if (char >= '0' && char <= '9') {
      run += char;
      continue;
    }
    const kind = kindOf(char);
    if (!kind) return { marks, tail: run, decimal: -1, ambiguous: false, problem: 'numbersOnly' };
    marks.push({ kind, char, before: run });
    run = '';
  }
  const tail = run;
  const after = (i: number) => (i + 1 < marks.length ? marks[i + 1].before : tail);
  const of = (...kinds: MarkKind[]) => marks.map((m, i) => (kinds.includes(m.kind) ? i : -1)).filter((i) => i >= 0);
  const done = (decimal: number, ambiguous = false, problem?: NumberProblem): Body => ({ marks, tail, decimal, ambiguous, ...(problem ? { problem } : {}) });
  const arabic = of('ardecimal');
  if (arabic.length > 1) return done(arabic[1], false, 'oneDecimalMark');
  if (arabic.length === 1) return done(arabic[0]);
  const dots = of('dot');
  const commas = of('comma', 'arcomma');
  if (dots.length && commas.length) {
    // Both: the last one is the decimal mark, and the other groups.
    const last = Math.max(dots[dots.length - 1], commas[commas.length - 1]);
    const same = marks[last].kind === 'dot' ? dots : commas;
    return done(last, false, same.length > 1 ? 'oneDecimalMark' : undefined);
  }
  const one = dots.length ? dots : commas;
  // One kind repeated groups; none at all, only spaces or ٬, groups too.
  if (one.length !== 1) return done(-1);
  const at = one[0];
  const mark = marks[at];
  if (mark.kind === 'arcomma' || mark.char === page.decimal) return done(at);
  if (mark.char === page.group) {
    const following = after(at);
    const leading = mark.before.length;
    // The page's grouping mark groups only with exactly three digits after it and one to three before.
    if (following.length === 3 && leading >= 1 && leading <= 3) return done(-1);
    // Fewer than three after it yet, where it could still group: typing may be on its way to "1,500".
    const couldGroup = following.length < 3 && leading >= 1 && leading <= 3 && at === marks.length - 1;
    return done(at, couldGroup);
  }
  // A mark the page does not use is a decimal mark.
  return done(at);
}

/** Whether the groups before the decimal mark (all of them, without one) are groups of three, or could still become them. */
function groupsProblem(body: Body, prefix: boolean): NumberProblem | null {
  const { marks, tail, decimal } = body;
  const groupMarks = decimal === -1 ? marks : marks.slice(0, decimal);
  // Groups never come after the decimal mark.
  if (decimal !== -1 && decimal < marks.length - 1) return 'groupsOfThree';
  if (!groupMarks.length) return null;
  const runs = [...groupMarks.map((m) => m.before), decimal === -1 ? tail : marks[decimal].before];
  if (runs[0].length < 1 || runs[0].length > 3) return 'groupsOfThree';
  for (let i = 1; i < runs.length; i++) {
    const last = i === runs.length - 1;
    const len = runs[i].length;
    // The last group, with nothing after it, may still be on its way to three digits.
    if (last && decimal === -1 && prefix ? len > 3 : len !== 3) return 'groupsOfThree';
  }
  return null;
}

interface Parsed {
  negative: boolean;
  body: string;
  problem?: NumberProblem;
}

/** The sign taken off: one leading minus (or plus, dropped); a minus anywhere else is a problem. */
function takeSign(text: string, options: NumberReadOptions): Parsed {
  let t = text.trim();
  if (options.percent) t = t.replace(/\s*[%\u066a]$/, '');
  let negative = false;
  if (t && (IS_MINUS.test(t[0]) || t[0] === '+')) {
    negative = t[0] !== '+';
    t = t.slice(1).replace(/^\s+/, '');
  }
  if (IS_MINUS.test(t)) return { negative, body: t, problem: 'minusFirst' };
  if (t.includes('+')) return { negative, body: t, problem: 'numbersOnly' };
  return { negative, body: t };
}

/**
 * Typed or pasted text as a number, in the page's language (`locale`).
 *
 * Digits in Latin, Arabic-Indic, Persian and fullwidth script; one leading
 * minus (also \u2212 U+2212) or plus; spaces, and the marks . , ، ٫ ٬. Which mark
 * is the decimal one:
 *   - both . and , : the last; the other groups;
 *   - one kind repeated: it groups;
 *   - one mark once: the page's decimal mark, ٫ or ، is decimal; the page's
 *     grouping mark groups only with exactly three digits after it and one to
 *     three before; a mark the page does not use is decimal;
 *   - spaces and ٬ only group.
 * Groups run one to three digits, then threes, and never come after the
 * decimal mark. So on en and ar pages 1,500 is 1500 and 1,5 is 1.5; on a de
 * page 1.500 is 1500 and 1.5 is 1.5; anywhere 1 234,56 is 1234.56, and 12 34
 * does not read. Nothing reads letters, a tab or a line break.
 */
export function readNumber(text: string, locale: string, options: NumberReadOptions = {}): NumberRead {
  const t = folded(text);
  if (LINE_BREAKS.test(t.trim())) return { ok: false, problem: 'severalValues' };
  if (!t.trim()) return { ok: true, value: null, plain: '', places: 0, digits: 0, significant: 0 };
  const sign = takeSign(t, options);
  if (sign.problem) return { ok: false, problem: sign.problem };
  if (!sign.body) return { ok: false, problem: 'unfinished' };
  const page = numberMarks(locale);
  const body = takeApart(sign.body, page);
  if (body.problem) return { ok: false, problem: body.problem };
  const { marks, tail, decimal } = body;
  // A grouping mark last ("1,", "1.234."): the number is still being written.
  if (marks.length && !tail && (decimal === -1 || body.ambiguous || marks[decimal].char === page.group)) return { ok: false, problem: 'unfinished' };
  const groups = groupsProblem(body, false);
  if (groups) return { ok: false, problem: groups };
  const whole = (decimal === -1 ? [...marks.map((m) => m.before), tail] : [...marks.slice(0, decimal + 1).map((m) => m.before)]).join('');
  const fraction = decimal === -1 ? '' : tail;
  if (!whole && !fraction) return { ok: false, problem: 'unfinished' };
  const value = Number(`${whole || '0'}.${fraction || '0'}`) * (sign.negative ? -1 : 1);
  const digits = whole.replace(/^0+/, '').length + fraction.length;
  const significant = (whole + fraction).replace(/^0+/, '').length;
  const plain = `${sign.negative && value !== 0 ? '-' : ''}${whole || '0'}${fraction ? page.decimal + fraction : ''}`;
  return { ok: true, value: value === 0 ? 0 : value, plain, places: fraction.length, digits, significant };
}

/** What a field takes, for judging a keystroke or a paste. */
export interface NumberLimits {
  /** A whole number: no decimal mark. */
  integer?: boolean;
  /** At most these decimal places. */
  places?: number;
  /** At most these digits in all (a field's `digits[0]`); never more than 15 are kept exactly. */
  digits?: number;
  /** The least: a minus is refused when it is 0 or more. */
  min?: number;
  /** A per cent box: a trailing % or ٪ may be typed. */
  percent?: boolean;
  /** An hours box: `:` and `h` may be typed too ("6:30", "6h30"). */
  duration?: boolean;
}

/** Why a keystroke or a paste is refused, with what the words name. */
export type NumberRefusal =
  | { problem: 'numbersOnly' | 'minusFirst' | 'oneDecimalMark' | 'groupsOfThree' | 'severalValues' | 'integer' }
  | { problem: 'min'; min: number }
  | { problem: 'decimals'; places: number }
  | { problem: 'digits'; n: number };

/** The most significant digits a number keeps exactly. */
export const MOST_DIGITS = 15;

/**
 * Whether the text a box would hold after a keystroke may stand: null when it
 * may, or why not. Refused: letters, emoji and other symbols; a minus that is
 * not first, or any minus where the least is 0 or more; the page's decimal
 * mark or ٫ in a whole number; a second decimal mark; a decimal place past the
 * field's; a digit past `digits` or past 15 significant ones; and grouping
 * that can never be right ("1.2." on a German page). Text on its way to a
 * number ("-", "1,", "12 3") may stand; min and max are not judged here.
 */
export function couldBeNumber(text: string, locale: string, limits: NumberLimits = {}): NumberRefusal | null {
  const t = folded(text);
  if (LINE_BREAKS.test(t)) return { problem: 'severalValues' };
  const sign = takeSign(t, limits);
  const atLeastZero = limits.min !== undefined && limits.min >= 0;
  const minus = (sign.negative || IS_MINUS.test(sign.body)) && atLeastZero;
  if (minus) return { problem: 'min', min: limits.min as number };
  if (sign.problem) return { problem: sign.problem as 'minusFirst' | 'numbersOnly' };
  if (limits.percent && /[%\u066a]/.test(sign.body)) return { problem: 'numbersOnly' };
  if (limits.duration) return couldBeDuration(sign.body);
  const page = numberMarks(locale);
  const decimals = [...sign.body].filter((c) => c === page.decimal || c === '\u066b').length;
  if (decimals > 1) return { problem: 'oneDecimalMark' };
  if (limits.integer && decimals) return { problem: 'integer' };
  const body = takeApart(sign.body, page);
  if (body.problem === 'numbersOnly') return { problem: 'numbersOnly' };
  if (body.problem === 'oneDecimalMark') return { problem: 'oneDecimalMark' };
  // Two marks side by side never make a number ("1,,5", "1 ,5").
  if (body.marks.some((m, i) => i > 0 && m.before === '')) return { problem: 'groupsOfThree' };
  const groups = groupsProblem(body, true);
  if (groups) return { problem: 'groupsOfThree' };
  const certain = body.decimal !== -1 && !body.ambiguous;
  const fraction = body.decimal === -1 ? '' : body.tail;
  if (certain && limits.integer) return { problem: 'integer' };
  if (certain && limits.places !== undefined && fraction.length > limits.places) return { problem: 'decimals', places: limits.places };
  const all = [...sign.body].filter((c) => c >= '0' && c <= '9').join('');
  const whole = body.decimal === -1 ? all : all.slice(0, all.length - fraction.length);
  const significant = all.replace(/^0+/, '').length;
  const digits = whole.replace(/^0+/, '').length + fraction.length;
  const most = Math.min(MOST_DIGITS, limits.digits ?? MOST_DIGITS);
  if (significant > MOST_DIGITS || digits > most) return { problem: 'digits', n: most };
  return null;
}

/** An hours box's keystroke: digits, the marks, `:` and `h`, the colon and the h each once (a second colon only for ":00" seconds). */
function couldBeDuration(body: string): NumberRefusal | null {
  if (/[^0-9.,\u060c\u066b\u066c:hH \u00a0\u202f]/.test(body)) return { problem: 'numbersOnly' };
  if ((body.match(/[hH]/g) ?? []).length > 1 || (body.match(/:/g) ?? []).length > 2) return { problem: 'numbersOnly' };
  return null;
}

/** A pasted or dropped amount, cleaned: the plain number for the box, or why nothing is pasted. */
export type PastedNumber =
  | { ok: true; text: string; value: number }
  | { ok: false; problem: 'notANumber' | 'severalValues' }
  | { ok: false; problem: 'otherCurrency'; currency: string };

const currencyForms = new Map<string, string[]>();

/** Every way a currency is written beside an amount: its symbols, narrow and wide, its code, in the page's language, English and Arabic. */
function formsOf(currency: string, locale: string): string[] {
  const key = `${currency}:${locale}`;
  let found = currencyForms.get(key);
  if (!found) {
    const forms = new Set<string>([currency]);
    for (const language of new Set([locale, 'en', 'ar'])) {
      for (const currencyDisplay of ['symbol', 'narrowSymbol', 'code'] as const) {
        try {
          const part = new Intl.NumberFormat(language, { style: 'currency', currency, currencyDisplay }).formatToParts(1).find((p) => p.type === 'currency');
          if (part) forms.add(stripMarks(part.value).trim());
        } catch {
          // A name that is no currency code: only its own words.
        }
      }
    }
    found = [...forms].filter(Boolean).sort((a, b) => b.length - a.length);
    currencyForms.set(key, found);
  }
  return found;
}

/**
 * Pasted (or dropped) text as the plain number a box takes, in the page's
 * way: direction marks, the box's own currency (its symbol, narrow symbol,
 * code or Arabic symbol), grouping, % and spaces taken out, and an
 * accounting negative read — (1,200.00) and 1,200- are -1200. Another
 * currency is named; a tab or a line break inside is several values; a
 * single line break at the end, as a copied cell brings, is let go.
 */
export function cleanPastedNumber(text: string, locale: string, options: { currency?: string | null; percent?: boolean } = {}): PastedNumber {
  let t = folded(text).replace(/(\r\n|[\r\n])$/, '');
  if (LINE_BREAKS.test(t.trim())) return { ok: false, problem: 'severalValues' };
  t = t.trim();
  if (options.currency) for (const form of formsOf(options.currency, locale)) t = t.split(form).join(' ');
  t = t.replace(/[%\u066a]/g, ' ').trim();
  const other = /[\p{Sc}]|[A-Za-z]{3}|[\u0600-\u06ff]+\.[\u0600-\u06ff.]*/u.exec(t.replace(/[\u0660-\u0669]/g, ''));
  if (other) {
    const token = /[\p{L}\p{Sc}][\p{L}\p{Sc}.]*/u.exec(t)?.[0] ?? other[0];
    if (/\p{Sc}/u.test(token) || /^[A-Z]{3}$/.test(token) || /[\u0600-\u06ff]/.test(token)) return { ok: false, problem: 'otherCurrency', currency: token };
    return { ok: false, problem: 'notANumber' };
  }
  // An accounting negative: in brackets, or with its minus after it.
  const bracketed = /^\(\s*([^()]*?)\s*\)$/.exec(t);
  if (bracketed) t = `-${bracketed[1]}`;
  const trailing = new RegExp(`^([^${MINUS}]*\\d)\\s*[${MINUS}]$`).exec(t);
  if (trailing) t = `-${trailing[1]}`;
  // A sign set apart from the amount by the currency taken out of it ("- 1,500").
  t = t.replace(new RegExp(`^([${MINUS}+])\\s+`), '$1');
  const read = readNumber(t, locale);
  if (!read.ok || read.value === null) return { ok: false, problem: read.ok ? 'notANumber' : read.problem === 'severalValues' ? 'severalValues' : 'notANumber' };
  return { ok: true, text: read.plain, value: read.value };
}

// ---------------------------------------------------------------------------
// Durations

/** Why typed hours do not read. */
export type DurationProblem = 'unfinished' | 'minutes' | 'duration' | 'numbersOnly' | 'minusFirst' | 'severalValues';
export type DurationRead = { ok: true; value: number | null } | { ok: false; problem: DurationProblem };

/**
 * Typed hours: "6:30", "06:30", "6.5" (or "6,5"), "6h30", "6h", "6:30:00"
 * (seconds only when :00), Arabic digits too; a leading minus. Minutes past 59
 * do not read ('minutes'), nor do "6 30" or other shapes ('duration'); "6:"
 * and "-" are on their way ('unfinished').
 */
export function readDuration(text: string, locale: string): DurationRead {
  const t = folded(text).trim();
  if (LINE_BREAKS.test(t)) return { ok: false, problem: 'severalValues' };
  if (!t) return { ok: true, value: null };
  const sign = takeSign(t, {});
  if (sign.problem) return { ok: false, problem: sign.problem === 'minusFirst' ? 'minusFirst' : 'duration' };
  const body = sign.body;
  const signed = (hours: number) => (sign.negative && hours !== 0 ? -hours : hours);
  if (!body || /^\d+\s*:$/.test(body) || body === ':') return { ok: false, problem: 'unfinished' };
  const clock = /^(\d+)\s*(?::|[hH])\s*(\d{1,2})?(?::(\d{1,2}))?$/.exec(body);
  if (clock) {
    // An h alone is whole hours ("6h").
    const [, h, m = '0', s] = clock;
    if (Number(m) > 59) return { ok: false, problem: 'minutes' };
    if (s !== undefined && Number(s) !== 0) return { ok: false, problem: 'duration' };
    return { ok: true, value: signed(Number(h) + Number(m) / 60) };
  }
  if (/[:hH]/.test(body)) return { ok: false, problem: 'duration' };
  // Hours as a number, in the page's way: "6.5", "6,5".
  const read = readNumber(body, locale);
  if (read.ok) return { ok: true, value: read.value === null ? null : signed(read.value) };
  if (read.problem === 'unfinished') return { ok: false, problem: 'unfinished' };
  return { ok: false, problem: read.problem === 'numbersOnly' ? 'numbersOnly' : 'duration' };
}

// ---------------------------------------------------------------------------
// Dates and times

/** The order a page types a date's day, month and year in. */
export type DateOrder = 'dmy' | 'mdy' | 'ymd';

export type DateProblem = 'unfinished' | 'noSuchMonth' | 'yearDigits' | 'time';
export type DateRead =
  | { ok: true; value: string | null }
  | { ok: false; problem: DateProblem }
  | { ok: false; problem: 'noSuchDay'; year: number; month: number; days: number }
  /** A year of two digits ("85"): never given a century in silence; the two it could be are named. */
  | { ok: false; problem: 'shortYear'; short: string; early: number; late: number };

const daysIn = (year: number, month: number) => [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
const pad2 = (n: number) => String(n).padStart(2, '0');
/** A moment as the local day and time it is, as the readers give a date and time: yyyy-mm-ddTHH:MM. */
const localOf = (d: Date) => `${String(d.getFullYear()).padStart(4, '0')}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** An instant as a server or a spreadsheet writes one, with its zone: 2026-10-15T14:30:00Z, 2026-10-15T16:30:00.000+02:00. */
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)$/i;

/** The languages whose month names a date may be written with, whatever the page's: the four Fieldia speaks. */
const MONTH_LANGUAGES = ['en-GB', 'en-US', 'ar', 'fr', 'de'];
const monthsByLocale = new Map<string, Map<string, number>>();
/** A month's name as it is looked up: folded as a search folds it, its dot ("oct.", "Okt.") let go. */
const monthKey = (name: string) => foldForSearch(name).replace(/\.+$/, '').trim();

/**
 * Every name a month is written with — long and short, alone and inside a date, as Intl writes them — in English,
 * Arabic, French and German, and the page's own language: by its folded name, its number. Made from Intl, so no
 * language's words are carried in the code (the one-tag script carries none).
 */
function monthNames(locale?: string): Map<string, number> {
  const key = locale ?? '';
  let found = monthsByLocale.get(key);
  if (found) return found;
  found = new Map();
  for (const language of new Set([...MONTH_LANGUAGES, ...(locale ? [locale] : [])])) {
    for (const month of ['long', 'short'] as const) {
      let alone: Intl.DateTimeFormat;
      let inDate: Intl.DateTimeFormat;
      try {
        alone = new Intl.DateTimeFormat(language, { month, calendar: 'gregory' });
        inDate = new Intl.DateTimeFormat(language, { day: 'numeric', month, year: 'numeric', calendar: 'gregory' });
      } catch {
        continue; // a language Intl does not know: its names are not read
      }
      for (let m = 0; m < 12; m++) {
        const day = new Date(2000, m, 15);
        for (const name of [alone.format(day), inDate.formatToParts(day).find((part) => part.type === 'month')?.value ?? '']) {
          const folded = monthKey(name);
          if (folded && !/\d/.test(folded) && !found.has(folded)) found.set(folded, m + 1);
        }
      }
    }
  }
  monthsByLocale.set(key, found);
  return found;
}

/** Whether `word` is how a month's name begins, in any of the languages its names are read in: typing it is on its way. */
export function couldBeMonth(word: string, locale?: string): boolean {
  const wanted = monthKey(word);
  if (!wanted) return false;
  for (const name of monthNames(locale).keys()) if (name.startsWith(wanted)) return true;
  return false;
}

/**
 * A typed date, in the page's order (`order`, day/month/year unless told):
 * separators / . - or a space; ISO yyyy-mm-dd always; Arabic and Persian
 * digits; a year of four digits, from 1000 — one of two digits could be either
 * century, so it is never read as one ('shortYear', naming both). Its month
 * may be a word, as Fieldia writes a date at rest — "15 Oct 2026", "15
 * أكتوبر 2026", "15 oct. 2026", "15. Okt. 2026", "Oct 15, 2026" — in
 * English, Arabic, French, German or the page's language (`locale`); the
 * numbers beside a month in words are its day and its year of four digits,
 * in either order. With `time`, a time may follow ("13/10/2026 14:30", "…,
 * 2:30 pm", "… ٢:٣٠ م"), and the value is yyyy-mm-ddTHH:MM. An instant with
 * its zone (2026-10-15T14:30:00Z) is the local day and time it is — with
 * `time`, its seconds :00, never dropped. Unfinished or impossible dates say
 * why (31/02 → 'noSuchDay' with the days that month has).
 */
export function readDate(text: string, options: { order?: DateOrder; time?: boolean; locale?: string } = {}): DateRead {
  let t = folded(text).trim();
  if (!t) return { ok: true, value: null };
  const instant = INSTANT.exec(t);
  if (instant) {
    const [, y, mo, d, h, mi, seconds = '0', fraction = '0', zone] = instant;
    // A time is kept to the minute: seconds are never dropped in silence. A date's box takes the instant's day alone.
    if (options.time && (Number(seconds) !== 0 || Number(fraction) !== 0)) return { ok: false, problem: 'time' };
    const offset = /^z$/i.test(zone) ? 'Z' : zone.length === 3 ? `${zone}:00` : `${zone.slice(0, 3)}:${zone.slice(-2)}`;
    const at = new Date(`${y}-${mo}-${d}T${h}:${mi}:00${offset}`);
    if (Number.isNaN(at.getTime())) return { ok: false, problem: 'unfinished' };
    const local = localOf(at);
    return { ok: true, value: options.time ? local : local.slice(0, 10) };
  }
  // A comma before a space sets a date's parts apart ("Oct 15, 2026") or its time ("15 Oct 2026, 14:30"): no part of either.
  t = t.replace(/\s*[,\u060c](?=\s)/g, '');
  let datePart = t;
  let timePart = '';
  if (options.time) {
    const split = TIME_AFTER_DATE.exec(t);
    if (split) [datePart, timePart] = [split[1], split[2]];
  }
  const pieces = datePart.split(/\s*[/.\-\s]\s*/).filter((p, i, all) => p !== '' || i < all.length - 1);
  if (pieces.length < 3 || pieces.some((p) => p === '')) return { ok: false, problem: 'unfinished' };
  if (pieces.length > 3) return { ok: false, problem: 'unfinished' };
  let yearText: string;
  let monthText: string;
  let dayText: string;
  let month: number;
  const named = pieces.findIndex((p) => !/^\d*$/.test(p));
  if (named >= 0) {
    // A month in words: the other two are its day and its year, the year the one of four digits (else the last).
    const numbers = pieces.filter((_, i) => i !== named);
    const found = monthNames(options.locale).get(monthKey(pieces[named]));
    if (!found || numbers.some((p) => !/^\d+$/.test(p))) return { ok: false, problem: 'unfinished' };
    const at = numbers[0].length > 2 && numbers[1].length <= 2 ? 0 : 1;
    [yearText, dayText] = [numbers[at], numbers[1 - at]];
    monthText = String(found);
    month = found;
  } else {
    // ISO, whatever the page's order: a four-digit year first.
    const order = pieces[0].length === 4 ? 'ymd' : (options.order ?? 'dmy');
    [yearText, monthText, dayText] = [pieces[order.indexOf('y')], pieces[order.indexOf('m')], pieces[order.indexOf('d')]];
    month = Number(monthText);
  }
  if (yearText.length === 2) return { ok: false, problem: 'shortYear', short: yearText, early: 1900 + Number(yearText), late: 2000 + Number(yearText) };
  if (yearText.length !== 4) return { ok: false, problem: 'yearDigits' };
  const year = Number(yearText);
  // Four digits from 1000: year 2, which a box half typed once made, is no year people write.
  if (year < 1000) return { ok: false, problem: 'yearDigits' };
  const day = Number(dayText);
  if (monthText.length > 2 || month < 1 || month > 12) return { ok: false, problem: 'noSuchMonth' };
  const days = daysIn(year, month);
  if (dayText.length > 2 || day < 1 || day > days) return { ok: false, problem: 'noSuchDay', year, month, days };
  const date = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  if (!options.time) return { ok: true, value: date };
  if (!timePart) return { ok: true, value: `${date}T00:00` };
  const time = readTime(timePart);
  if (!time.ok) return { ok: false, problem: time.problem === 'unfinished' ? 'unfinished' : 'time' };
  return { ok: true, value: `${date}T${time.value}` };
}

export type TimeRead = { ok: true; value: string | null } | { ok: false; problem: 'unfinished' | 'time' };

/**
 * A typed time of day: 24-hour "14:30" (or "14.30", "14h30", "1430"), or
 * twelve-hour with am/pm or ص/م; Arabic digits; seconds only when :00.
 * The value is HH:MM.
 */
export function readTime(text: string): TimeRead {
  const t = folded(text).trim();
  if (!t) return { ok: true, value: null };
  const match = TIME.exec(t) ?? /^(\d{2})(\d{2})()()$/.exec(t);
  if (!match) return { ok: false, problem: /^\d{1,2}\s*[:.hH]?$/.test(t) ? 'unfinished' : 'time' };
  const [, h, m, s, half] = match;
  if (m === undefined && /[:.]$/.test(t)) return { ok: false, problem: 'unfinished' };
  let hours = Number(h);
  const minutes = Number(m ?? 0);
  if (s && Number(s) !== 0) return { ok: false, problem: 'time' };
  if (half) {
    if (hours < 1 || hours > 12) return { ok: false, problem: 'time' };
    const pm = /^[pP]/.test(half) || half === ARABIC.pm;
    hours = (hours % 12) + (pm ? 12 : 0);
  }
  if (hours > 23 || minutes > 59) return { ok: false, problem: 'time' };
  return { ok: true, value: `${pad2(hours)}:${pad2(minutes)}` };
}

// ---------------------------------------------------------------------------

const currencyPlaces = new Map<string, number>();

/** The places a currency's amounts are written with: 3 for the Kuwaiti, Bahraini, Omani and Jordanian dinars and rials, 2 for most. */
export function placesOfCurrency(currency: string | null | undefined): number {
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return 2;
  let found = currencyPlaces.get(currency);
  if (found === undefined) {
    try {
      found = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      found = 2;
    }
    currencyPlaces.set(currency, found);
  }
  return found;
}

/** The decimal places a number has as JavaScript writes it: 12.345 has 3, 1e-7 has 7. */
export function placesOf(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = String(Math.abs(value));
  const exponent = /e([+-]\d+)$/.exec(text);
  const mantissa = exponent ? text.slice(0, exponent.index) : text;
  const dot = mantissa.indexOf('.');
  const places = (dot === -1 ? 0 : mantissa.length - dot - 1) - (exponent ? Number(exponent[1]) : 0);
  return Math.max(0, places);
}
