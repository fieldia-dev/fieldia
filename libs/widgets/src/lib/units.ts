import type { Locale } from '@fieldia/core';
import { intlFormat } from '@fieldia/core';

/**
 * A currency as the page's language writes it beside an amount: its symbol —
 * "$", "€", "E£" — and whether it comes after the number, as in "12,50 €".
 * A name that is no currency code stays as it is, before the number.
 */
export function currencySymbol(code: string, locale: Locale): Readonly<{ text: string; after: boolean }> {
  // Worked out once for a currency and a language: a table of lines asks it of every money cell on every change.
  const key = `${code} ${locale}`;
  let found = symbols.get(key);
  if (!found) {
    try {
      const parts = intlFormat('NumberFormat', locale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(1);
      const at = parts.findIndex((part) => part.type === 'currency');
      found = { text: parts[at].value, after: at > parts.findIndex((part) => part.type === 'integer') };
    } catch {
      found = { text: code, after: false };
    }
    symbols.set(key, found);
  }
  return found;
}
const symbols = new Map<string, { text: string; after: boolean }>();
