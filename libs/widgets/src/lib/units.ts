import type { Locale } from '@fieldia/core';

/**
 * A currency as the page's language writes it beside an amount: its symbol —
 * "$", "€", "E£" — and whether it comes after the number, as in "12,50 €".
 * A name that is no currency code stays as it is, before the number.
 */
export function currencySymbol(code: string, locale: Locale): { text: string; after: boolean } {
  try {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(1);
    const at = parts.findIndex((part) => part.type === 'currency');
    return { text: parts[at].value, after: at > parts.findIndex((part) => part.type === 'integer') };
  } catch {
    return { text: code, after: false };
  }
}
