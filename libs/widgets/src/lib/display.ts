import { languagesOf, hijriWords, monthWords, placesOf, placesOfCurrency, precisionOf, type LineField, type Locale, type Value } from '@fieldia/core';
import { anyText, languagesPart } from './widget-parts';
import { formatMoney, formatNumber } from './numbers';
import { writeMoney } from './money';
import { shownNumber } from './duration';
import { distributionWords } from './distribution';
import { restingText } from './date-text';


/** A date field's day, at the browser's midnight. */
function localDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
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
 *
 * A number is written with its field's places — a money field without them,
 * its currency's — and never fewer than it has, so a cell never shows a
 * rounded picture of a different value. Words where a number goes (from a
 * server, an old draft) are shown as they are, never read by JavaScript's own
 * rules: never "NaN", never 26 for "0x1A".
 */
export function displayValue(def: LineField, value: Value | undefined, values: Record<string, Value> = {}, locale: Locale = 'en', parent?: Readonly<Record<string, Value>>): string {
  if (value === null || value === undefined || value === '') return '';
  // A text kept in several languages: in the reader's (the languages part, which its page loads), else the first typed.
  if (languagesOf(def)) return languagesPart.loaded?.languageText(value, def, locale) ?? anyText(value);
  if ((def.type === 'integer' || def.type === 'float' || def.type === 'monetary') && typeof value !== 'number') return typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (typeof value === 'number' && !Number.isFinite(value)) return '';
  /** The places a number is written with: its field's, and never fewer than it has. */
  const places = (n: number, field: number) => Math.max(field, Math.min(placesOf(n), 20));
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
      return formatNumber(value as number, places(value as number, 0), locale);
    case 'float':
      return formatNumber(value as number, places(value as number, def.digits?.[1] ?? 2), locale);
    case 'monetary': {
      const amount = value as number;
      const currency = currencyOf(def, values, parent);
      const digits = places(amount, def.digits?.[1] ?? placesOfCurrency(currency));
      // As the page's money look writes it, when it has one: by code, after, short, per month.
      if (def.money) return writeMoney(amount, currency, digits, locale, def.money, values);
      // Its currency's symbol, as the amount's own box shows it.
      return currency ? formatMoney(amount, currency, digits, locale) : formatNumber(amount, digits, locale);
    }
    case 'date': {
      const date = localDate(String(value));
      if (!date) return String(value);
      // A month alone, or a year alone, as its box writes it at rest: "Oct 2026", "2026".
      const precision = precisionOf(def);
      if (precision !== 'day') return precision === 'year' ? String(date.getFullYear()) : monthWords(Date.UTC(date.getFullYear(), date.getMonth(), 1), locale);
      const day = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn' }).format(date);
      // A Hijri date, its Hijri day beside it: "13 Oct 2026 · 2 Jumada I 1448 AH".
      return def.hijri ? `${day} · ${hijriWords(String(value), locale)}` : day;
    }
    case 'datetime':
      // The instant it is, as its box shows it at rest: on its zone's clock, its name beside it where that is not the
      // browser's — the browser's own clock where nothing names one; never the clock it was written with (12:30Z).
      return restingText(String(value), 'datetime', locale, def.timeZone);
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
  // An analytic distribution in a cell: its shares, "60% · 40%".
  if (shown.widget === 'distribution' && def.type === 'json') return distributionWords(value, locale);
  return shownNumber(shown.widget, def as never, value, locale, shown.options as Record<string, unknown>) ?? displayValue(def, value, values, locale, parent);
}

/**
 * The widgets a cell is drawn with rather than typed into: a bar, stars, a
 * state's dot, a colour, a pill. A grid shows them in the cell itself, used
 * there with a click; the rest are typed into as the field's own box.
 */
export const DRAWN_IN_CELLS: ReadonlySet<string> = new Set(['progressbar', 'priority', 'dot', 'color', 'timer', 'badge']);

/** The kinds whose words read as one: a number, an amount, a day, a day and time. */
const WHOLE = new Set(['integer', 'float', 'monetary', 'date', 'datetime']);
/**
 * Whether a column's words are one thing a reader takes in at once — a number, an amount, a day, a phone number — so a
 * printed table keeps them on one line, never "+20 12 0528" over "2720": by its field's kind, or the widget its cells
 * are shown with (`phone`, a time of day's `time`).
 */
export function keepsWhole(type: string | undefined, widget?: string): boolean {
  return !!type && (WHOLE.has(type) || widget === 'phone' || widget === 'time');
}
