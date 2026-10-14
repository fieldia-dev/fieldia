import { cleanPastedNumber, couldBeNumber, foldForSearch, oneLine, placesOfCurrency, readDuration, readNumber, stripMarks, type DateOrder, type LineField, type Locale, type NumberLimits, type Value } from '@fieldia/core';
import { readDateText } from '@fieldia/widgets';

/**
 * Pasting a block on the grid's cells: the grid's own, so a page with no grid
 * (the one-tag script, the plain table) never carries it.
 */

/** Hours as their box reads them ("6:30", "6,5", "6h30"), or undefined when they do not read. */
function hours(text: string, locale: Locale): number | null | undefined {
  const read = readDuration(text, locale);
  return read.ok ? read.value : undefined;
}

/** A per cent as its box reads it ("25", "25%", "٢٥٪"): the fraction it is, or undefined when it does not read. */
function perCent(text: string, locale: Locale): number | null | undefined {
  const read = readNumber(text, locale, { percent: true });
  if (!read.ok) return undefined;
  return read.value === null ? null : Math.round((read.value / 100) * 1e10) / 1e10;
}

/**
 * A block copied from a spreadsheet, as a table's cells take it: its rows (by
 * line breaks) and, in each, its cells (by tabs). The line break a copied
 * block ends with is no row of its own.
 */
export function blockOf(text: string): string[][] {
  const rows = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  return rows.map((row) => row.split('\t'));
}

/** How a cell's column reads what is pasted into it: the page's language and date order, the widget it is typed with, its currency now. */
export interface CellReading {
  locale: Locale;
  /** The widget the column is typed with: hours (`duration`), a per cent (`percentage`). */
  widget?: string;
  /** The order the page types dates in: day/month/year unless told. */
  dateOrder?: DateOrder;
  /** A money column's currency on this line. */
  currency?: string | null;
}

/**
 * Text pasted into one cell, read as its column reads what is typed: a number
 * by the input rules (the page's marks, Arabic digits, its own currency, an
 * accounting negative) within the field's places and digits; hours and per
 * cents as their boxes read them; a date in the page's order; a choice by its
 * label or value; words on one line. Null when it does not read — the cell is
 * then left as it was, and named. Empty text empties the cell.
 */
export function readPastedCell(def: LineField, pasted: string, reading: CellReading): { value: Value } | null {
  const text = stripMarks(pasted).trim();
  if (!text) return def.type === 'boolean' ? null : { value: null };
  switch (def.type) {
    case 'char':
      return { value: oneLine(stripMarks(pasted, 'ends')).trim() };
    case 'text':
    case 'html':
      return { value: stripMarks(pasted, 'ends') };
    case 'integer':
    case 'float':
    case 'monetary': {
      if (reading.widget === 'duration' || reading.widget === 'percentage') {
        const value = reading.widget === 'duration' ? hours(text, reading.locale) : perCent(text, reading.locale);
        return value === undefined ? null : { value };
      }
      const currency = def.type === 'monetary' ? (reading.currency ?? null) : null;
      const cleaned = cleanPastedNumber(text, reading.locale, { currency });
      if (!cleaned.ok) return null;
      const digits = def.type === 'integer' ? undefined : def.digits;
      const limits: NumberLimits = {
        integer: def.type === 'integer',
        ...(def.type === 'integer' ? {} : digits ? { places: digits[1] } : def.type === 'monetary' ? { places: placesOfCurrency(currency) } : {}),
        ...(digits ? { digits: digits[0] } : {}),
        ...('min' in def && typeof def.min === 'number' ? { min: def.min } : {}),
      };
      return couldBeNumber(cleaned.text, reading.locale, limits) ? null : { value: cleaned.value };
    }
    case 'date':
    case 'datetime': {
      // As the cell's own date box reads it: a day, or a date and time as the instant its field keeps.
      const read = readDateText(text, { kind: def.type, order: reading.dateOrder ?? 'dmy', locale: reading.locale, label: def.label });
      return read.ok ? { value: read.value } : null;
    }
    case 'selection': {
      const wanted = foldForSearch(text);
      const option = def.options.find((o) => foldForSearch(o.label) === wanted) ?? def.options.find((o) => String(o.value) === text);
      return option ? { value: option.value } : null;
    }
    default:
      // A link is found by searching, a file by choosing it: nothing a paste can say.
      return null;
  }
}
