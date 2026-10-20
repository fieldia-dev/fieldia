import { charCount, cleanPastedNumber, optionsList, couldBeNumber, fill, foldForSearch, isRightToLeft, MESSAGES, numberMisfit, oneLine, placesOfCurrency, readDuration, stripMarks, type DateOrder, type Line, type LineField, type Locale, type NumberLimits, type Option, type RelatedRecord, type Value, type Values } from '@fieldia/core';
import { readDateText } from './date-text';
import { leftWords, quoted, refusalWords } from './input-rules';
import { inPlural, type WidgetLabels } from './labels';

/**
 * A block pasted on a table's cells, and a file's cells read for a list's
 * Import: each cell read as its column reads what is typed. In the lines part
 * (lines-part.ts), which gives it to the grid and to the list's Import too, so
 * a page with no table, grid or Import never carries it.
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

// ---- a block pasted on a table of lines: the grid's and the plain table's one way --------------------------------

/** What a block pasted on a table of lines reads and writes through: the grid and the plain table each give theirs. */
export interface PasteTable {
  /** The line's fields, by column. */
  fields: Record<string, LineField>;
  /** The columns shown, in their order: a row's cells go across them from the one pasted on. */
  columns: readonly string[];
  /** The lines as they are now. */
  lines(): readonly Line[];
  /** A line added at the end for a row past the last, its key; null past the most lines the table may have. */
  add(): string | null;
  /** Whether a line's cell takes typing now: an item's, not read-only, not worked out, not hidden. */
  typable(line: Line, column: string): boolean;
  /** How a line's cell reads what is pasted: the page's language and date order, its widget, its currency now. */
  reading(line: Line, column: string): CellReading;
  /** A cell named in the note: "Product, line 3", or a section's by its words. */
  cellName(line: Line, column: string): string;
  /** Write a value read into a line's cell, as its box writes what is typed. */
  write(line: Line, column: string, value: Value): void;
  /**
   * The records a link column's search finds for words, as its box searches them (`form.searchLine`): filtered by the
   * line's values (`key`), or a new line's (null), `exact` asking for those named exactly so.
   */
  search(key: string | null, column: string, query: string, limit: number, exact: boolean): Promise<RelatedRecord[]>;
  /**
   * A choice column's choices from the app's list (`optionsFrom`), as its line asks for them (`form.lineChoices`): by
   * the line's values (`key`), or a new line's (null), with the row's own laid over them. Without it, such a column
   * takes nothing pasted, and says so.
   */
  choices?(key: string | null, column: string, values: Values): Promise<Option[]>;
  /** False once the record pasted on is no longer the one shown: a late answer writes nothing on another. */
  shown(): boolean;
}

/** Records a name's search asks for: past them, the name is asked for exactly, as a link's box and Import ask. */
const NAMES_LIMIT = 20;
const foldedName = (text: string) => foldForSearch(text.trim()).replace(/\s+/g, ' ');

/** What words name in a link column: the one record of that exact name (any case, Arabic in any of its forms), several, none, or not asked (the source failed). */
type Named = RelatedRecord | 'several' | null | 'failed';

/** The record words name, looked up as a link's box looks a name up: a search, and where it came back full, the name asked for exactly too. */
async function lookUpName(table: PasteTable, key: string | null, column: string, name: string): Promise<Named> {
  const among = (records: readonly RelatedRecord[]): RelatedRecord | 'several' | null => {
    const same = [...new Map(records.filter((record) => foldedName(record.label) === foldedName(name)).map((record) => [String(record.id), record])).values()];
    return same.length > 1 ? 'several' : (same[0] ?? null);
  };
  try {
    const found = await table.search(key, column, name.trim(), NAMES_LIMIT, false);
    const first = among(found);
    if (found.length < NAMES_LIMIT || first === 'several') return first;
    return among([...found, ...(await table.search(key, column, name.trim(), NAMES_LIMIT, true))]);
  } catch {
    return 'failed';
  }
}

/** Between the names a cell of a many2many holds: a comma, a semicolon or a line break, as Import reads them. */
const NAMES = /\s*[,;\n]\s*/;

/**
 * A link cell's words read as records, or why not: a many2one's one name; a many2many's names — the whole words first
 * (a name may hold a comma: "Monitor arm, dual"), else each between its commas.
 */
async function readLinkCell(table: PasteTable, key: string | null, column: string, def: LineField, text: string, labels: WidgetLabels): Promise<{ value: Value } | { why: string }> {
  const label = def.label;
  const why = (named: Named, name: string) =>
    fill(named === 'several' ? labels.pasteSeveralCalled : named === 'failed' ? labels.pasteNotLookedUp : labels.pasteNoMatch, { label, text: quoted(name) });
  const whole = await lookUpName(table, key, column, text);
  if (whole && whole !== 'several' && whole !== 'failed') return { value: def.type === 'many2many' ? [whole] : whole };
  const names = def.type === 'many2many' ? text.split(NAMES).filter(Boolean) : [];
  if (names.length < 2) return { why: why(whole, text.trim()) };
  const linked: RelatedRecord[] = [];
  for (const name of names) {
    const named = await lookUpName(table, key, column, name);
    if (!named || named === 'several' || named === 'failed') return { why: why(named, name) };
    if (!linked.some((record) => String(record.id) === String(named.id))) linked.push(named);
  }
  return { value: linked };
}

const isLink = (def: LineField | undefined) => def?.type === 'many2one' || def?.type === 'many2many';
/** A choice column whose choices are the app's, each line's its own. */
const isListed = (def: LineField | undefined) => def?.type === 'selection' && !!optionsList(def.optionsFrom);

/**
 * A row's choices from the app's lists read by its line's choices: the line as the row leaves it — its links found and
 * its other cells read — asked for each such cell, its words read among them as a choice's are. Null for a cell that
 * is none, that takes nothing, or is empty; why, where the choices could not be asked.
 */
async function readListedCells(table: PasteTable, key: string | null, line: Line | undefined, cells: readonly string[], columnOf: (c: number) => string | undefined, links: readonly (({ value: Value } | { why: string }) | null)[], labels: WidgetLabels) {
  const listed = cells.map((text, c) => {
    const column = columnOf(c);
    const def = column ? table.fields[column] : undefined;
    return column && isListed(def) && text.trim() && (!line || table.typable(line, column)) ? column : null;
  });
  if (!listed.some(Boolean)) return listed.map(() => null);
  // A row past the last line is read as a line of nothing yet.
  const at = line ?? { key: '', values: {} };
  // The line as the row leaves it, but for these cells: what their choices change with.
  const values: Values = {};
  cells.forEach((text, c) => {
    const column = columnOf(c);
    const def = column ? table.fields[column] : undefined;
    if (!column || !def || listed[c] || (line && !table.typable(line, column))) return;
    const link = links[c];
    const read = link ? ('value' in link ? link : null) : isLink(def) ? null : readPastedCell(def, text, table.reading(at, column));
    if (read) values[column] = read.value;
  });
  return Promise.all(
    cells.map(async (text, c): Promise<{ value: Value } | { why: string } | null> => {
      const column = listed[c];
      if (!column) return null;
      const def = table.fields[column];
      try {
        const options = table.choices ? await table.choices(key, column, values) : [];
        return readPastedCell({ ...def, options } as LineField, text, table.reading(at, column)) ?? { why: fill(labels.noMatch, { label: def.label, text: quoted(text.trim()) }) };
      } catch {
        return { why: fill(labels.pasteNotLookedUp, { label: def.label, text: quoted(text.trim()) }) };
      }
    })
  );
}
/** A row named in the note by the words it starts with, as the person copied it. */
const rowStart = (cells: readonly string[]) => quoted(cells.find((text) => text.trim()) ?? '');

/**
 * A block pasted on a table of lines — a spreadsheet's rows, tabs between their cells — from the line at `from` and
 * the column `fromColumn`: each row goes on its own line, across the columns shown — the lines there, then lines added
 * past the last, as many as the table may have. Each cell is read as its column reads what is typed; a link's by its
 * name through the source's search, as its box reads a name typed — the one record of that exact name. A row whose
 * name does not read (nothing, or more than one, called so) is not pasted at all, never half laid on a line with
 * another record: named with why. A cell that cannot take its text keeps what it holds, named with why; so are rows
 * past the most lines. Names are looked up first, then every row written at once — nothing once the record is gone.
 * Returns the note to say under the table: what went in, the lines added, and what did not; null when the record went.
 */
export async function pasteRows(table: PasteTable, from: number, fromColumn: string, block: readonly (readonly string[])[], words: { labels: WidgetLabels; locale?: Locale }): Promise<string | null> {
  const { labels, locale } = words;
  const start = table.columns.indexOf(fromColumn);
  if (start < 0) return null;
  const columnOf = (c: number) => table.columns[start + c] as string | undefined;
  // The lines the rows land on, by key, as they are now; past the last, new lines.
  const landing = table.lines().slice(from, from + block.length).map((line) => line.key);
  const lineOf = (key: string) => table.lines().find((line) => line.key === key);
  // Every link cell's name, looked up before anything is written: a row is written whole, or not at all.
  const links = await Promise.all(
    block.map((cells, r) => {
      const key = landing[r] ?? null;
      const line = key ? lineOf(key) : undefined;
      return Promise.all(
        cells.map((text, c) => {
          const column = columnOf(c);
          const def = column ? table.fields[column] : undefined;
          if (!column || !def || !isLink(def) || !text.trim()) return null;
          // A cell that takes nothing on its line is named as any cell is, never looked up.
          if (line && !table.typable(line, column)) return null;
          return readLinkCell(table, key, column, def, text, labels);
        })
      );
    })
  );
  // Every choice from the app's lists, read by its line's choices as the row leaves the line.
  const listed = await Promise.all(block.map((cells, r) => readListedCells(table, landing[r] ?? null, landing[r] ? lineOf(landing[r]) : undefined, cells, columnOf, links[r], labels)));
  if (!table.shown()) return null;
  let pasted = 0;
  let added = 0;
  let beyond = false;
  const missed: string[] = [];
  block.forEach((cells, r) => {
    const read = links[r];
    const refused = read.find((one): one is { why: string } => !!one && 'why' in one);
    if (refused) return void missed.push(fill(labels.notPastedWhy, { cell: fill(labels.pasteRowRefused, { start: rowStart(cells) }), why: refused.why }));
    let key = landing[r];
    if (key && !lineOf(key)) return; // its line went while the names were looked up
    if (!key) {
      // A row of nothing adds no line; past the most lines, the rest is said.
      if (cells.every((text) => !text.trim())) return;
      const made = beyond ? null : table.add();
      if (!made) return void (beyond = true);
      key = made;
      added++;
    }
    // Its links first: what the other cells read by (an amount's currency) may be one of them.
    const order = cells.map((text, c) => ({ text, c, link: read[c] })).sort((a, b) => Number(!a.link) - Number(!b.link));
    for (const { text, c, link } of order) {
      // The line as it is now: a cell pasted before may have set what this one reads by.
      const line = lineOf(key);
      const column = columnOf(c);
      if (!column || !line) continue;
      const def = table.fields[column];
      const takes = table.typable(line, column);
      // Nothing pasted on a cell that takes nothing: nothing lost, nothing to say.
      if (!takes && !text.trim()) continue;
      const reading = table.reading(line, column);
      const choice = listed[r][c];
      const value = !takes ? null : link && 'value' in link ? link : choice ? ('value' in choice ? choice : null) : isLink(def) && !text.trim() ? { value: def.type === 'many2many' ? [] : null } : readPastedCell(def, text, reading);
      if (!value) {
        const why = !takes ? null : choice && 'why' in choice ? choice.why : whyNotPasted(def, text, { ...reading, labels });
        const cell = table.cellName(line, column);
        missed.push(why ? fill(labels.notPastedWhy, { cell, why }) : cell);
        continue;
      }
      table.write(line, column, value.value);
      pasted++;
    }
  });
  const separator = locale && isRightToLeft(locale) ? '؛ ' : '; ';
  return [
    ...(pasted ? [inPlural(labels.pastedCells, labels.pastedCellsOne, pasted, locale)] : []),
    ...(added ? [inPlural(labels.pasteAddedLines, labels.pasteAddedLinesOne, added, locale)] : []),
    ...(missed.length ? [fill(labels.notPastedCells, { cells: missed.join(separator) })] : []),
    ...(beyond ? [inPlural(labels.pasteBeyondLines, labels.pasteBeyondLinesOne, table.lines().length, locale)] : []),
  ].join(' ');
}
