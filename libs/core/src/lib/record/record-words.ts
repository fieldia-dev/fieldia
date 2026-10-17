import type { PageRecords } from '../format/records';

/** The words of a page's records in a sentence: one, more than one, and one with its article. */
const NOUNS = /\{(record|records|aRecord)\}/g;

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
  if (!records || named === undefined) return plain;
  if (named.includes('{aRecord}') && !records.a) return plain;
  const filled = named.replace(NOUNS, (_, noun: string) => (noun === 'record' ? records.one : noun === 'records' ? records.other : (records.a as string)));
  return /^\{(record|records|aRecord)\}/.test(named) ? capital(filled, locale) : filled;
}
