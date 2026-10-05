/**
 * What every language's table of the designer's words uses to say a count,
 * a name or a list: whole sentences come from the tables, these only fill
 * them in. Numbers are written in Latin digits in every language, as Arabic
 * business software shows them.
 */

/** A count's words for each plural form the language has: Arabic has six (zero, one, two, few, many, other), English two. `#` is the number. */
export type PluralForms = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;

const rules = new Map<string, Intl.PluralRules>();

/** The words for `n` in the form the language takes for it, `#` written as the number. */
export function plural(locale: 'en' | 'ar', n: number, forms: PluralForms): string {
  let rule = rules.get(locale);
  if (!rule) rules.set(locale, (rule = new Intl.PluralRules(locale)));
  return (forms[rule.select(n)] ?? forms.other).replaceAll('#', String(n));
}

/** A number in Latin digits, with the language's separators. */
export function number(locale: 'en' | 'ar', n: number): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', { maximumFractionDigits: 20 }).format(n);
}

/**
 * A name in a sentence of Arabic words: in guillemets, and isolated, so a
 * name written left to right keeps its own order and its marks stay at its ends.
 */
export const quoteAr = (name: string): string => `«⁨${name}⁩»`;

/** Several things said as one, the language's way: "A, B and C", "أ وب وج". */
export function listOf(locale: 'en' | 'ar', items: readonly string[], join: 'and' | 'or'): string {
  return new Intl.ListFormat(locale, { type: join === 'and' ? 'conjunction' : 'disjunction' }).format(items);
}
