import { ANY_FUNCTION, compileModifier, isRightToLeft, stripMarks, type Field, type LineField, type Locale, type MoneyLook, type Period, type Value, intlFormat } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import { formatNumber } from './numbers';
import { currencySymbol } from './units';

/**
 * An amount as a page's money look (`money` on a monetary field) writes it:
 * its currency by symbol or by code, before or after it, short, the home
 * currency left unsaid, and what it is for ("/month"). Each in its own
 * direction: Latin digits and a code read left to right in Arabic too
 * ("1,610,000 EGP"), Arabic's short words right to left ("13.9 مليون"),
 * and a symbol such as "E£" is kept whole, never turned round to "£E".
 */

/**
 * A symbol set apart on a right-to-left page, in the direction of its first letter: "E£" and "US$" stay
 * whole left to right, and an Arabic one ("ر.س.") keeps its dots where they were, right to left.
 */
const isolate = (text: string) => `\u2068${text}\u2069`;

/** A number short, in the page's language and Latin digits: "13.9M", "450K", "13.9 مليون", "13,9 Mio.". */
export function shortNumber(value: number, locale: Locale = 'en'): string {
  // Without the marks Intl puts round Arabic numbers to say their direction: the text says its own.
  return stripMarks(intlFormat('NumberFormat', locale, { notation: 'compact', numberingSystem: 'latn', maximumFractionDigits: 1 }).format(value));
}

const PER_KEYS: Record<Period, keyof WidgetLabels> = { day: 'perDay', night: 'perNight', week: 'perWeek', month: 'perMonth', year: 'perYear' };
const compiled = new WeakMap<object, { period: Period; holds: (values: Record<string, unknown>) => boolean }[]>();

/** What the amount is for on this record, by the first of the look's conditions that holds: a rent's month. */
function periodOf(look: MoneyLook, values: Readonly<Record<string, Value>>): Period | null {
  if (!look.per) return null;
  let rules = compiled.get(look.per);
  if (!rules) {
    rules = look.per.map(({ period, when }) => {
      // Drawn apart from the form: a call of the app's own functions gives nothing here.
      const condition = when === undefined ? null : compileModifier(when, ANY_FUNCTION);
      return { period, holds: (context) => !condition || condition.evaluate(context) };
    });
    compiled.set(look.per, rules);
  }
  // A link reads as its id in a condition, as a form's own conditions read it.
  const context: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(values)) context[name] = value && typeof value === 'object' && !Array.isArray(value) && 'id' in value ? (value as { id: unknown }).id : value;
  return rules.find((rule) => rule.holds(context))?.period ?? null;
}

/**
 * An amount written as `look` says: `currency` a code ("EGP") or the words
 * a record keeps for it, null for none; `decimals` its digits after the
 * point when written in full; `values` the record's, for what it is for.
 */
export function writeMoney(value: number, currency: string | null, decimals: number, locale: Locale, look: MoneyLook, values: Readonly<Record<string, Value>> = {}): string {
  const amount = look.short ? shortNumber(value, locale) : formatNumber(value, decimals, locale);
  let money = amount;
  if (currency && currency !== look.home) {
    const code = /^[A-Z]{3}$/.test(currency);
    const where = code ? currencySymbol(currency, locale) : null;
    const text = stripMarks(look.currency === 'code' || !where ? currency : where.text);
    const after = look.at ? look.at === 'after' : !!where?.after;
    // Only letters ("EGP") keep their order anywhere; a symbol is kept whole on a right-to-left page.
    const said = isRightToLeft(locale) && !/^\p{L}+$/u.test(text) ? isolate(text) : text;
    money = after ? `${amount}\u00a0${said}` : `${said}\u00a0${amount}`;
  }
  const period = periodOf(look, values);
  if (!period) return money;
  const words = WIDGET_LABELS[locale] ?? WIDGET_LABELS.en;
  // On a right-to-left page the amount keeps its own direction, so what it is for comes after it as an Arabic
  // reader reads: "25,000 EGP" then "/شهر", never "/شهر" first because the line began with Latin letters.
  return `${isRightToLeft(locale) ? `\u2068${money}\u2069` : money}${words[PER_KEYS[period]]}`;
}

/** The fields an amount's words read besides its own: its currency's, and those its look's conditions read. */
export function moneyReads(def: Field | LineField | undefined, over?: MoneyLook): string[] {
  if (def?.type !== 'monetary') return [];
  const reads = def.currencyField && !def.currencyField.startsWith('parent.') ? [def.currencyField] : [];
  for (const look of [def.money, over]) for (const item of look?.per ?? []) if (item.when !== undefined) reads.push(...compileModifier(item.when, ANY_FUNCTION).fields);
  return [...new Set(reads)];
}
