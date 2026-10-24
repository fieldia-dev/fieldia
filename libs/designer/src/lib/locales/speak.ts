/**
 * What every language's table of the designer's words uses to say a count,
 * a name or a list: whole sentences come from the tables, these only fill
 * them in. Numbers are written in Latin digits in every language, as Arabic
 * business software shows them.
 */
import { intlFormat } from '@fieldia/core';

/** The languages the designer's words are written in. */
export type Speaker = 'en' | 'ar' | 'tr' | 'fa' | 'ur' | 'es';

/** A count's words for each plural form the language has: Arabic has six (zero, one, two, few, many, other), English two. `#` is the number. */
export type PluralForms = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;

const rules = new Map<string, Intl.PluralRules>();

/** The words for `n` in the form the language takes for it, `#` written as the number. */
export function plural(locale: Speaker, n: number, forms: PluralForms): string {
  let rule = rules.get(locale);
  if (!rule) rules.set(locale, (rule = intlFormat('PluralRules', locale)));
  return (forms[rule.select(n)] ?? forms.other).replaceAll('#', String(n));
}

/** A number in Latin digits, with the language's separators. */
export function number(locale: Speaker, n: number): string {
  return intlFormat('NumberFormat', locale === 'en' ? 'en' : `${locale}-u-nu-latn`, { maximumFractionDigits: 20 }).format(n);
}

/**
 * A name in a sentence of Arabic words — or Persian or Urdu ones: in guillemets,
 * and isolated, so a name written left to right keeps its own order and its
 * marks stay at its ends.
 */
export const quoteAr = (name: string): string => `«\u2068${name}\u2069»`;

/** Words written left to right — a pattern, an ending, a range of places — kept so in a sentence right to left. */
export const ltr = (text: string | number): string => `\u2066${text}\u2069`;

/** Several things said as one, the language's way: "A, B and C", "أ وب وج". */
export function listOf(locale: Speaker, items: readonly string[], join: 'and' | 'or'): string {
  return intlFormat('ListFormat', locale, { type: join === 'and' ? 'conjunction' : 'disjunction' }).format(items);
}
