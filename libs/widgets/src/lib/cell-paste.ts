import { charCount, cleanPastedNumber, couldBeNumber, fill, foldForSearch, MESSAGES, numberMisfit, oneLine, placesOfCurrency, readDuration, stripMarks, type DateOrder, type LineField, type Locale, type NumberLimits, type Value } from '@fieldia/core';
import { leftWords, quoted, readDateText, refusalWords, type WidgetLabels } from '@fieldia/widgets';

/**
 * Pasting a block on the grid's cells: the grid's own, so a page with no grid
 * (the one-tag script, the plain table) never carries it.
 */

/** A column's least, when its field has one. */
const leastOf = (def: LineField) => ('min' in def && typeof def.min === 'number' ? def.min : undefined);

/**
 * Hours as their box reads them ("6:30", "6,5", "6h30"), within the column's least; undefined when they do not read
 * or the column cannot hold them ("6:3" could be 6:03 or 6:30: neither is taken).
 */
function hours(def: LineField, text: string, locale: Locale): number | null | undefined {
  const read = readDuration(text, locale);
  if (!read.ok) return undefined;
  const least = leastOf(def);
  return read.value !== null && least !== undefined && read.value < least ? undefined : read.value;
}

/**
 * A per cent as its box reads it ("25", "25%", "٢٥٪"), within the column's places (two unless its field says) and
 * least, as its box keeps them: the fraction it is, or undefined when it does not read or does not fit. "12.555" in
 * a column of two places is never 12.56 %.
 */
function perCent(def: LineField, text: string, locale: Locale): number | null | undefined {
  const least = leastOf(def);
  const limits: NumberLimits = { percent: true, places: def.type === 'float' ? (def.digits?.[1] ?? 2) : 2, ...(least !== undefined ? { min: least * 100 } : {}) };
  const cleaned = cleanPastedNumber(text, locale, { percent: true });
  if (!cleaned.ok) return undefined;
  if (couldBeNumber(cleaned.text, locale, limits) || numberMisfit(cleaned.value, limits) || (limits.min !== undefined && cleaned.value < limits.min)) return undefined;
  return Math.round((cleaned.value / 100) * 1e10) / 1e10;
}

/**
 * A block copied from a spreadsheet, as a table's cells take it: its rows (by
 * line breaks) and, in each, its cells (by tabs). A cell a spreadsheet wrote in
 * double quotes — Excel, Google Sheets, LibreOffice and Numbers quote one
 * holding a line break, a tab or a quote, its own quotes doubled — is one cell,
 * read without its quoting: `"Oak top⏎black frame"⇥7` is one row of two cells.
 * A cell whose quotes are not such quoting (`5" screen`, `"Hello" world`) is
 * taken as it is. The line break a copied block ends with is no row of its own.
 */
export function blockOf(text: string): string[][] {
  const t = text.replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  for (let at = 0; ; ) {
    const quoted = t[at] === '"' ? quotedCell(t, at) : null;
    const end = quoted ? quoted.end : nextBreak(t, at);
    row.push(quoted ? quoted.cell : t.slice(at, end));
    if (end >= t.length) break;
    at = end + 1;
    if (t[end] === '\t') continue;
    rows.push(row);
    row = [];
    // The line break a block ends with ends its last row; no row follows it.
    if (at >= t.length) return rows;
  }
  rows.push(row);
  return rows;
}

/** Where the cell starting at `at` ends: its tab or line break, or the end. */
function nextBreak(text: string, at: number): number {
  const found = text.slice(at).search(/[\t\n]/);
  return found < 0 ? text.length : at + found;
}

/**
 * A cell in a spreadsheet's double quotes, from its opening quote: what it holds, its doubled quotes as one, and where
 * it ends — at the tab or line break after its closing quote. Null when what follows that quote is neither: no
 * quoting, but a cell that starts with a quote.
 */
function quotedCell(text: string, at: number): { cell: string; end: number } | null {
  let cell = '';
  for (let i = at + 1; i < text.length; i++) {
    if (text[i] !== '"') {
      cell += text[i];
      continue;
    }
    if (text[i + 1] === '"') {
      cell += '"';
      i++;
      continue;
    }
    const after = i + 1;
    return after >= text.length || text[after] === '\t' || text[after] === '\n' ? { cell, end: after } : null;
  }
  return null;
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
    case 'char': {
      // Past the column's most it is not taken: the cell keeps what it holds, and says by how much (`whyNotPasted`).
      const value = oneLine(stripMarks(pasted, 'ends')).trim();
      return overBy(def, value) > 0 ? null : { value };
    }
    case 'text': {
      const value = stripMarks(pasted, 'ends');
      return overBy(def, value) > 0 ? null : { value };
    }
    case 'html':
      return { value: stripMarks(pasted, 'ends') };
    case 'integer':
    case 'float':
    case 'monetary': {
      if (reading.widget === 'duration' || reading.widget === 'percentage') {
        const value = reading.widget === 'duration' ? hours(def, text, reading.locale) : perCent(def, text, reading.locale);
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
      // Pasted whole, the number is what it reads as: its places and kind judged as they are (12.50 has one place).
      return couldBeNumber(cleaned.text, reading.locale, limits) || numberMisfit(cleaned.value, limits) ? null : { value: cleaned.value };
    }
    case 'date':
    case 'datetime': {
      // As the cell's own date box reads it: a day, or a date and time as the instant its field keeps. An instant in a
      // day's cell would leave its time out: not pasted, and named, as a date and time is.
      // A date and time on its zone's clock: its own, or its page's written into it.
      const zone = def.type === 'datetime' ? def.timeZone : undefined;
      const read = readDateText(text, { kind: def.type, order: reading.dateOrder ?? 'dmy', locale: reading.locale, label: def.label, ...(zone ? { zone } : {}) });
      return read.ok && !read.timeLeftOut ? { value: read.value } : null;
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

/** How many characters words are past their column's most (`size`), counted as a server counts them: 0 within it. */
function overBy(def: LineField, words: string): number {
  const size = def.type === 'char' || def.type === 'text' ? def.size : undefined;
  return size ? Math.max(0, charCount(words) - size) : 0;
}

/** A number column's limits, as its box keeps them: whole or its places, its digits, its least. */
function limitsOf(def: LineField, currency: string | null): NumberLimits {
  const digits = def.type === 'float' || def.type === 'monetary' ? def.digits : undefined;
  return {
    integer: def.type === 'integer',
    ...(def.type === 'integer' ? {} : digits ? { places: digits[1] } : def.type === 'monetary' ? { places: placesOfCurrency(currency) } : {}),
    ...(digits ? { digits: digits[0] } : {}),
    ...(leastOf(def) !== undefined ? { min: leastOf(def) } : {}),
  };
}

/**
 * Why a cell did not take what was pasted into it (`readPastedCell` gave null), in the words its box says as it is
 * left: a number that does not read or does not fit, an amount in another currency, hours whose minute could be
 * two, a date that does not read or whose time a day leaves out, a choice nothing is called, words past the column's
 * most. Null when there are no words for it (a link, a file).
 */
export function whyNotPasted(def: LineField, pasted: string, reading: CellReading & { labels: WidgetLabels }): string | null {
  const text = stripMarks(pasted).trim();
  const { locale, labels } = reading;
  const label = def.label;
  switch (def.type) {
    case 'integer':
    case 'float':
    case 'monetary': {
      if (reading.widget === 'duration') {
        const unread = leftWords(text, { label, locale, labels, duration: true, limits: () => ({}) });
        if (unread) return unread;
        const least = leastOf(def);
        const read = readDuration(text, locale);
        return read.ok && read.value !== null && least !== undefined && read.value < least ? refusalWords({ problem: 'min', min: least }, { label, locale, labels }) : null;
      }
      if (reading.widget === 'percentage') {
        const least = leastOf(def);
        const limits: NumberLimits = { percent: true, places: def.type === 'float' ? (def.digits?.[1] ?? 2) : 2, ...(least !== undefined ? { min: least * 100 } : {}) };
        const cleaned = cleanPastedNumber(text, locale, { percent: true });
        return leftWords(cleaned.ok ? cleaned.text : text, { label, locale, labels, percent: true, limits: () => limits });
      }
      const currency = def.type === 'monetary' ? (reading.currency ?? null) : null;
      const cleaned = cleanPastedNumber(text, locale, { currency });
      // An amount in another currency is named as its box names it: "Unit price is in EGP, and this amount is in $".
      if (!cleaned.ok && cleaned.problem === 'otherCurrency' && currency) return fill(labels.otherCurrency, { label, currency, pasted: cleaned.currency });
      return leftWords(cleaned.ok ? cleaned.text : text, { label, locale, labels, limits: () => limitsOf(def, currency) });
    }
    case 'char':
    case 'text': {
      const over = overBy(def, def.type === 'char' ? oneLine(stripMarks(pasted, 'ends')).trim() : stripMarks(pasted, 'ends'));
      // In the words Save would use, as the field's own box says it: the one message for a text past its most.
      const messages = MESSAGES[locale] ?? MESSAGES.en;
      return over > 0 ? fill(over === 1 ? messages.overByOne : messages.overBy, { label, over, max: (def as { size?: number }).size ?? 0 }) : null;
    }
    case 'date':
    case 'datetime': {
      const reader = { order: reading.dateOrder ?? 'dmy', locale, label, labels } as const;
      const zone = def.type === 'datetime' ? def.timeZone : undefined;
      const read = readDateText(text, { kind: def.type, ...reader, ...(zone ? { zone } : {}) });
      if (read.ok) return read.timeLeftOut ? fill(labels.timeLeftOut, { label, time: read.timeLeftOut }) : null;
      // A day and time pasted into a day: said as the date box says it, the time it would leave out named.
      const moment = def.type === 'date' ? readDateText(text, { kind: 'datetime', ...reader }) : null;
      if (moment?.ok && moment.value) {
        const at = new Date(moment.value);
        return fill(labels.timeLeftOut, { label, time: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` });
      }
      return read.words;
    }
    case 'selection':
      return fill(labels.noMatch, { label, text: quoted(text) });
    default:
      return null;
  }
}
