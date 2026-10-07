import type { LineField, Locale, Value } from '@fieldia/core';
import { formatMoney, formatNumber } from './numbers';
import { shownNumber } from './duration';


function localDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(text);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0));
}

/**
 * The currency a money field is in: its own, or the field holding it — on a
 * line, `parent.` and a field of the record it is on (`parent`). A link by its
 * name ("EGP"), a choice or text as it is; null when none is known.
 */
export function currencyOf(def: LineField, values: Readonly<Record<string, Value>>, parent?: Readonly<Record<string, Value>>): string | null {
  if (def.type !== 'monetary') return null;
  if (def.currency) return def.currency;
  if (!def.currencyField) return null;
  const holder = def.currencyField.startsWith('parent.') ? parent?.[def.currencyField.slice('parent.'.length)] : values[def.currencyField];
  if (holder && typeof holder === 'object' && 'label' in holder) return (holder as { label: string }).label || null;
  return typeof holder === 'string' && holder ? holder : null;
}

/**
 * A value as a person reads it where it is not being edited: a cell of the
 * lines grid, a totals row. Shared by the plain lines table and @fieldia/grid.
 * `parent` is the record a line is on, for money in its currency.
 */
export function displayValue(def: LineField, value: Value | undefined, values: Record<string, Value> = {}, locale: Locale = 'en', parent?: Readonly<Record<string, Value>>): string {
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
      const currency = currencyOf(def, values, parent);
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

/** How a value is shown where it is not edited: by the widget it is drawn with (a cell's, a field's), and its options. */
export interface ShownWith {
  widget?: string;
  options?: Readonly<Record<string, unknown>>;
}

/**
 * A value as words in the widget it is shown with — hours as HH:MM
 * (`duration`), a fraction as a per cent (`percentage`) — else as its type
 * says it (`displayValue`). For a table's cells and totals, plain and grid.
 */
export function cellText(def: LineField, value: Value | undefined, values: Record<string, Value> = {}, locale: Locale = 'en', parent?: Readonly<Record<string, Value>>, shown: ShownWith = {}): string {
  return shownNumber(shown.widget, def as never, value, locale, shown.options as Record<string, unknown>) ?? displayValue(def, value, values, locale, parent);
}

/**
 * The widgets a cell is drawn with rather than typed into: a bar, stars, a
 * state's dot, a colour, a pill. A grid shows them in the cell itself, used
 * there with a click; the rest are typed into as the field's own box.
 */
export const DRAWN_IN_CELLS: ReadonlySet<string> = new Set(['progressbar', 'priority', 'dot', 'color', 'badge']);
