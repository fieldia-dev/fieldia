import type { LineField, Locale, Value } from '@fieldia/core';
import { formatMoney, formatNumber } from './numbers';


function localDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(text);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
}

/**
 * A value as a person reads it where it is not being edited: a cell of the
 * lines grid, a totals row. Shared by the plain lines table and @fieldia/grid.
 */
export function displayValue(def: LineField, value: Value | undefined, values: Record<string, Value> = {}, locale: Locale = 'en'): string {
  const number = (n: number, digits: number) => formatNumber(n, digits, locale);
  if (value === null || value === undefined || value === '') return '';
  switch (def.type) {
    case 'many2one':
    case 'reference':
      return (value as { label?: string }).label ?? '';
    case 'many2many':
      return ((value as { label: string }[]) ?? []).map((r) => r.label).join(', ');
    case 'selection': {
      const label = (v: unknown) => def.options.find((o) => o.value === v)?.label ?? String(v);
      return Array.isArray(value) ? value.map(label).join(', ') : label(value);
    }
    case 'integer':
      return number(Number(value), 0);
    case 'float':
      return number(Number(value), def.digits?.[1] ?? 2);
    case 'monetary': {
      const currency = def.currency ?? (def.currencyField ? (values[def.currencyField] as { label?: string } | null)?.label : undefined);
      // Its currency's symbol, as the amount's own box shows it.
      return currency ? formatMoney(Number(value), currency, def.digits?.[1] ?? 2, locale) : number(Number(value), def.digits?.[1] ?? 2);
    }
    case 'date': {
      const date = localDate(String(value));
      return date ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' }).format(date) : String(value);
    }
    case 'datetime': {
      const date = localDate(String(value));
      return date
        ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' }).format(date)
        : String(value);
    }
    case 'html':
      return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    case 'binary':
    case 'image':
      // One file, or several: their names.
      return [value].flat().map((file) => (file as { name?: string }).name ?? '').join(', ');
    case 'boolean':
      return value ? '✓' : '';
    default:
      return String(value);
  }
}
