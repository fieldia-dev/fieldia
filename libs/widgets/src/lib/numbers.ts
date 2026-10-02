import type { Locale } from '@fieldia/core';

/**
 * Numbers as a reader of the page's language writes them: grouped, with a
 * field's decimals, in Latin digits (as business software in Arabic shows
 * them), and read back the same way. Shared by the number widget, the lines
 * grid and totals.
 */

const formats = new Map<string, Intl.NumberFormat>();
function format(locale: Locale, decimals: number): Intl.NumberFormat {
  const key = `${locale}:${decimals}`;
  let found = formats.get(key);
  if (!found) {
    found = new Intl.NumberFormat(locale, { numberingSystem: 'latn', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formats.set(key, found);
  }
  return found;
}

/** The language's grouping and decimal marks. */
function marks(locale: Locale): { group: string; decimal: string } {
  const parts = format(locale, 1).formatToParts(12345.6);
  return { group: parts.find((p) => p.type === 'group')?.value ?? ',', decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.' };
}

/** A number at rest: "1,850,000.50", "1.850.000,50". */
export function formatNumber(value: number, decimals: number, locale: Locale = 'en'): string {
  return format(locale, decimals).format(value);
}

/**
 * Typed text as a number in JavaScript's own spelling ("1234.5"), or the text
 * unchanged when it is not one. Arabic-Indic digits are read as digits.
 */
export function normalizeNumber(text: string, locale: Locale = 'en'): string {
  const { group, decimal } = marks(locale);
  let out = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, decimal)
    .replace(/٬/g, group);
  // Spaces of any width group digits too (French uses a narrow no-break space).
  out = out.replace(/[\s\u00a0\u202f]/g, '');
  if (group.trim()) out = out.split(group).join('');
  return decimal === '.' ? out : out.split(decimal).join('.');
}
