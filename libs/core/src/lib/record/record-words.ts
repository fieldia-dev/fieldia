import type { PageRecords } from '../format/records';
import { isRightToLeft } from '../format/translate';

/** The words of a page's records in a sentence: one, more than one, and one with its article. */
const NOUNS = /\{(record|records|aRecord)\}/g;

/** Languages that write every noun with a capital: a label stays as written inside their sentences. */
const NOUNS_CAPITAL = /^(de|lb)(-|$)/i;

/** The first letter of some words, whole where it takes two code units; empty for none. */
const firstOf = (words: string) => (words ? String.fromCodePoint(words.codePointAt(0) as number) : '');
const capital = (words: string, locale: string) => firstOf(words).toLocaleUpperCase(locale) + words.slice(firstOf(words).length);

/**
 * One of Fieldia's sentences in the words a page names its records by (`Page.records`): `named` — the sentence with
 * `{record}` (one), `{records}` (more than one) and `{aRecord}` (one with its article) — those filled in, its first
 * letter a capital where one of them begins it, and the rest (`{n}` and the like) left for its own fill. Else `plain`,
 * the sentence as a page that names none reads it: where the page names no records, the language has no such sentence
 * (`named` left out), or the sentence needs `a` and the page gave none — an article is never guessed.
 */
export function recordSentence(records: PageRecords | undefined, named: string | undefined, plain: string, locale = 'en'): string {
  const { one, other, a } = records ?? {};
  if (!one || !other || named === undefined) return plain;
  if (named.includes('{aRecord}') && !a) return plain;
  const filled = named.replace(NOUNS, (_, noun: string) => (noun === 'record' ? one : noun === 'records' ? other : (a as string)));
  return /^\{(record|records|aRecord)\}/.test(named) ? capital(filled, locale) : filled;
}

const asWritten = (label: string) => label;

/**
 * Whether a label is a question put to the person: it ends with a question mark — in any script: ?, ؟, ？ — or with an
 * ellipsis the answer completes ("May we tell you about…"). A name ("Your name", "Rate (1–5)") is none.
 */
export function isQuestion(label: string): boolean {
  return /([?؟？⸮]|…|\.\.\.)\s*$/u.test(label);
}

/** Each language's quotation marks round a question its sentence names: “…” where it has none of its own here. */
const QUOTES: Record<string, readonly [string, string]> = { de: ['„', '“'], fr: ['« ', ' »'], ar: ['«', '»'], fa: ['«', '»'] };

/**
 * A label as a sentence names it: a question (`isQuestion`) between the language's quotation marks — "Please answer
 * “How was your visit?”", "“How many days?” must be at most 5" — and a name as written.
 */
export function quotedLabel(label: string, locale = 'en'): string {
  if (!isQuestion(label)) return label;
  const [open, close] = QUOTES[locale.split('-')[0].toLowerCase()] ?? ['“', '”'];
  return `${open}${label.trim()}${close}`;
}

/**
 * A label with a small first letter: one whose first word starts as a common word does ("Phone", "Tax ID", "Order
 * lines"), never a name — a first word with another capital, or none small after its first ("IBAN", "WhatsApp",
 * "E-mail"). Its first letter only, as the quiet look's "Add story points" has always written it.
 */
const small = (locale: string) => (label: string) => {
  const word = label.split(/\s/, 1)[0];
  if (!/^\p{Lu}\p{Ll}/u.test(word) || /\p{Lu}/u.test(word.slice(firstOf(word).length))) return label;
  return firstOf(label).toLocaleLowerCase(locale) + label.slice(firstOf(label).length);
};

/**
 * A field's label as a sentence of Fieldia's puts it at its blank `key` (`{label}`, `{field}`, `{fields}`…): with a
 * small first letter where the page asks (`lower`: its `lowerLabels`) and the blank stands inside the sentence
 * — after a word of it, a colon's words too: "Choose at least 2 for interests", "Fix tax rate to see total", "Check:
 * phone" — else as written. A label that begins its sentence keeps its capital: "Phone is required", and "Status: …" at
 * a line's start, a heading's place. So does a name ("IBAN", "WhatsApp", "E-mail"), and every label in a language that
 * writes its nouns with a capital (German) or in a script with none (Arabic): a label there is as the page wrote it. Where a sentence puts the blank in both places, as
 * written. A label that is a question (`isQuestion`) is quoted, as written, wherever it stands (`quotedLabel`): "Fix
 * “How was your visit?” to see Total". The one rule every caller asks; the quiet look's "Add story points" asks it
 * always.
 */
export function labelAt(template: string, key: string, lower: boolean | undefined, locale = 'en'): (label: string) => string {
  const cased = casedAt(template, key, lower, locale);
  // A question is quoted as written, wherever its sentence puts it.
  return (label) => (isQuestion(label) ? quotedLabel(label, locale) : cased(label));
}

function casedAt(template: string, key: string, lower: boolean | undefined, locale: string): (label: string) => string {
  if (!lower || NOUNS_CAPITAL.test(locale) || isRightToLeft(locale)) return asWritten;
  const parts = template.split(`{${key}}`);
  if (parts.length < 2) return asWritten;
  // Inside its sentence: some words of it before the blank, since the sentence began (the template's start, or a full stop's end).
  const inside = parts.slice(0, -1).every((_, at) => /[\p{L}\p{N}]/u.test(parts.slice(0, at + 1).join(`{${key}}`).split(/[.!?؟]\s+|\n/).pop() as string));
  return inside ? small(locale) : asWritten;
}

