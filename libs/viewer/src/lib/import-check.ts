import { checkValue, choiceOptions, fill, foldForSearch, initialValues, oneLine, optionsList, stripMarks, zonedPage, type DateOrder, type Field, type Form, type LineField, type ListNode, type Locale, type Messages, type Option, type Page, type RelatedRecord, type Value, type Values } from '@fieldia/core';
import { currencyOf, phoneSettings, type LinesPart, type PhonePart, type WidgetLabels } from '@fieldia/widgets';
import { serialAt, type FileCell, type FileSheet } from './import-file';
import { inEveryLanguage } from './import-match';

/**
 * A file's rows checked before anything is written (a list's Import): each
 * cell read as its field's box reads what is typed — a number in any script,
 * with the page's marks or as a spreadsheet keeps it; a day in the page's
 * order, or as a workbook keeps it; money in its record's currency; yes or no
 * in any of the page's languages; a choice by its label in any of them; a
 * link by its name, looked up through the source's search, none or several
 * said — then the page's own rules for the record (required, its most
 * characters, its least and most, its places, its pattern) over what the row
 * fills and the page's defaults for the rest. A row with a problem is named
 * with why; nothing is written from it.
 */

/** What a check reads the page and its words by. */
export interface RowsCheck {
  page: Page;
  /** The list's form: its search finds a link's record by name, with the field's own filter. */
  form: Pick<Form, 'search'>;
  /** The list's cells, for a column drawn as hours, a per cent or a phone. */
  cells: ListNode['cells'];
  locale: Locale;
  dateOrder: DateOrder;
  /** Today, as the page counts it: a date's limits and defaults counted from it. */
  today: string;
  messages: Messages;
  /** A box's words for what it does not read. */
  labels: WidgetLabels;
  /** The import's own words. */
  words: { importNoneCalled: string; importSeveralCalled: string; importNotYesNo: string };
  /** Yes and No, in each language the page knows. */
  yes: readonly string[];
  no: readonly string[];
  /** Each cell read as its column reads what is pasted: the lines part's. */
  readers: Pick<LinesPart, 'readPastedCell' | 'whyNotPasted'>;
  /** A phone read the world over, where a column of the page's reads its phones so: the phone part. */
  phones?: Pick<PhonePart, 'readPhone' | 'phoneCountry'>;
  /**
   * A choice's options, for a field whose options the app lists (`optionsFrom`): by the row's values where they change
   * with another field (`dependsOn`) — asked once for each of its values among the rows — else once, with none.
   */
  options?: (field: string, values: Values) => Promise<Option[]>;
}

/** A row read: its number in the file, the values it would make a record with, and why it may not, in the person's words. */
export interface CheckedRow {
  number: number;
  values: Values;
  problems: string[];
}

/** A name looked up: the one record of that name, several, or none. */
type Named = RelatedRecord | 'several' | null;

/** Names asked at once of the source. */
const LOOKUPS_AT_ONCE = 4;
/** Records a name's search asks for: past them, the name is asked for exactly. */
const LIMIT = 20;
/** Between the names a cell of links holds: a comma, a semicolon or a line break. */
const NAMES = /\s*[,;\n]\s*/;

const folded = (text: string) => foldForSearch(text.trim()).replace(/\s+/g, ' ');

/** A value as a choice follows it: a link by its id, whatever its name says. */
const keyOf = (value: unknown): unknown => (Array.isArray(value) ? value.map(keyOf) : value !== null && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : (value ?? null));

/** A cell as words: a number as JavaScript writes it whole ("201001234567"), a day as written, yes or no as given. */
function textOf(cell: FileCell): string {
  if (cell === null) return '';
  if (typeof cell === 'object') return cell.at.replace(/T00:00(:00)?$/, '').replace('T', ' ');
  if (typeof cell === 'number') return Number.isInteger(cell) && Math.abs(cell) < 1e21 ? cell.toFixed(0) : String(cell);
  return String(cell);
}

/**
 * The record each name of a link column calls: looked up once a name, as its box looks a name up — the one record
 * of that name, in any case; several, or none — asked for exactly where a search came back full.
 */
async function lookUp(check: RowsCheck, field: string, names: readonly string[], progress: () => void, stopped: () => boolean): Promise<Map<string, Named>> {
  const found = new Map<string, Named>();
  const among = (name: string, records: readonly RelatedRecord[]): Named => {
    const same = [...new Map(records.filter((record) => folded(record.label) === folded(name)).map((record) => [String(record.id), record])).values()];
    return same.length > 1 ? 'several' : (same[0] ?? null);
  };
  let next = 0;
  const one = async () => {
    while (next < names.length && !stopped()) {
      const name = names[next++];
      let named: Named;
      try {
        const records = await check.form.search(field, name, LIMIT);
        const first = among(name, records);
        // A full answer may have cut off the record of that very name, or another of it.
        named = records.length >= LIMIT && first !== 'several' ? among(name, [...records, ...(await check.form.search(field, name, LIMIT, { exact: true }))]) : first;
      } catch {
        named = null;
      }
      found.set(folded(name), named);
      progress();
    }
  };
  await Promise.all(Array.from({ length: LOOKUPS_AT_ONCE }, one));
  return found;
}

/** The names a cell of a link column holds: one for a link, those between its commas for links. */
const namesIn = (def: Field, cell: FileCell): string[] => {
  const text = stripMarks(textOf(cell)).trim();
  if (!text) return [];
  return def.type === 'many2many' ? text.split(NAMES).filter(Boolean) : [oneLine(text)];
};

/**
 * The rows of a file read into records' values and checked, the columns matched to fields as `columns` says (null
 * left out). `progress` is told how far it has got, in steps (names looked up, then rows read) of `steps`.
 */
export async function checkRows(check: RowsCheck, sheet: FileSheet, columns: readonly (string | null)[], progress: (done: number, steps: number) => void = () => undefined, stopped: () => boolean = () => false): Promise<CheckedRow[]> {
  const { locale, labels, messages, readers } = check;
  // A date and time on its zone's clock: its own, or the page's written into it (as the viewer's page has it already).
  const page = zonedPage(check.page);
  const filled = columns.map((field, column) => (field ? { field, column, def: page.fields[field] } : null)).filter((one): one is { field: string; column: number; def: Field } => !!one);
  const links = filled.filter((one) => one.def.type === 'many2one' || one.def.type === 'many2many');
  // Every name each link column holds, once.
  const asked = links.map(({ field, column, def }) => {
    const names = new Map<string, string>();
    for (const row of sheet.rows) for (const name of namesIn(def, row[column])) if (!names.has(folded(name))) names.set(folded(name), name);
    return { field, names: [...names.values()] };
  });
  const steps = asked.reduce((sum, one) => sum + one.names.length, 0) + sheet.rows.length;
  let done = 0;
  const tick = () => progress(++done, steps);
  const records = new Map<string, Map<string, Named>>();
  for (const { field, names } of asked) {
    if (stopped()) break;
    records.set(field, await lookUp(check, field, names, tick, stopped));
  }
  // A choice's options: those the app lists — one that changes with another field, by each row's values below — or
  // every option one carried from an earlier question may hold.
  const choices = new Map<string, Option[]>();
  /** A choice that changes with another field: its options asked by each row's values, once for each such value. */
  const following = (def: Field) => def.type === 'selection' && !!optionsList(def.optionsFrom)?.dependsOn?.length && !!check.options;
  for (const { field, def } of filled) {
    if (def.type !== 'selection' || following(def)) continue;
    choices.set(field, optionsList(def.optionsFrom) && check.options ? await check.options(field, {}).catch(() => []) : choiceOptions(page.fields, field));
  }
  const choicesAsked = new Map<string, Promise<Option[]>>();
  /** A row's options for a choice that follows another field: asked by what it follows, as the row has it. */
  function rowOptions(field: string, def: Field, values: Values): Promise<Option[]> {
    const on = optionsList((def as Extract<Field, { type: 'selection' }>).optionsFrom)?.dependsOn ?? [];
    const key = JSON.stringify([field, on.map((name) => keyOf(values[name]))]);
    let ask = choicesAsked.get(key);
    if (!ask) choicesAsked.set(key, (ask = (check.options as NonNullable<RowsCheck['options']>)(field, { ...values }).catch(() => [])));
    return ask;
  }
  // What a new record starts with: the page's defaults, today's date where it says so.
  const start = initialValues(page.fields, check.today);
  const defaults: Values = {};
  for (const [name, def] of Object.entries(page.fields)) if (def.default !== undefined) defaults[name] = start[name];
  const yes = new Set(check.yes.map(folded));
  const no = new Set(check.no.map(folded));

  /** A cell read into its field's value: nothing, the value, or why it does not read. */
  function read(field: string, def: Field, cell: FileCell, values: Values): { value: Value } | { why: string } | null {
    const label = def.label;
    const text = textOf(cell);
    if (!stripMarks(text).trim()) return null;
    const cellOf = check.cells?.[field];
    const reading = { locale, widget: cellOf?.widget, dateOrder: check.dateOrder, currency: currencyOf(def as LineField, values) };
    const pasted = (words: string) => readers.readPastedCell(def as LineField, words, reading) ?? { why: readers.whyNotPasted(def as LineField, words, { ...reading, labels }) ?? fill(messages.text, { label }) };
    switch (def.type) {
      case 'char': {
        // A phone read the world over, as its column writes it: kept as E.164, or why not.
        const phone = cellOf?.widget === 'phone' && check.phones ? phoneSettings(page, cellOf.options) : null;
        if (phone && check.phones) {
          const found = check.phones.readPhone(text, phone.country);
          if ('number' in found) return { value: found.number };
          const country = found.country ? check.phones.phoneCountry(found.country) : undefined;
          const where = { label, dial: country ? `+${country.dial}` : '', country: country ? regionName(country.code, locale) : '', start: found.start ?? '' };
          if (found.problem === 'country') return { why: fill(labels.phoneNeedsCountry, where) };
          if (found.problem === 'code' || !country) return { why: fill(labels.phoneNoCode, { label, code: found.start ?? '+' }) };
          return { why: fill(found.problem === 'short' ? labels.phoneShort : found.problem === 'long' ? labels.phoneLong : labels.phoneStart, where) };
        }
        return pasted(text);
      }
      case 'text':
        return pasted(text);
      case 'integer':
      case 'float':
      case 'monetary':
        // A number the workbook keeps as one is that number: its places and its most checked with the record.
        if (typeof cell === 'number') return { value: cell };
        return pasted(text);
      case 'boolean': {
        if (typeof cell === 'boolean') return { value: cell };
        const words = folded(text);
        if (yes.has(words)) return { value: true };
        if (no.has(words)) return { value: false };
        return { why: fill(check.words.importNotYesNo, { label, text }) };
      }
      case 'date':
      case 'datetime':
        // A day a workbook keeps as a number with no day's format: as a spreadsheet counts days.
        return pasted(typeof cell === 'number' && cell > 0 && cell < 2958466 ? textOf(serialAt(cell, def.type === 'date' ? 'day' : 'both')) : text);
      case 'selection': {
        const options = (following(def) ? rowChoices.get(field) : choices.get(field)) ?? [];
        const byWords = new Map<string, Option>();
        for (const option of options) for (const words of inEveryLanguage(page, option.label)) if (!byWords.has(folded(words))) byWords.set(folded(words), option);
        const pick = (words: string) => byWords.get(folded(words)) ?? options.find((option) => String(option.value) === words.trim());
        const all = def.multiple ? text.split(NAMES).filter((words) => words.trim()) : [text];
        const picked: Option[] = [];
        for (const words of all) {
          const option = pick(words);
          if (!option) return { why: fill(check.words.importNoneCalled, { label, text: words.trim() }) };
          picked.push(option);
        }
        return { value: def.multiple ? picked.map((option) => option.value) : picked[0].value };
      }
      case 'many2one':
      case 'many2many': {
        const known = records.get(field) ?? new Map<string, Named>();
        const linked: RelatedRecord[] = [];
        for (const name of namesIn(def, cell)) {
          const named = known.get(folded(name));
          if (named === 'several') return { why: fill(check.words.importSeveralCalled, { label, text: name }) };
          if (!named) return { why: fill(check.words.importNoneCalled, { label, text: name }) };
          if (!linked.some((record) => String(record.id) === String(named.id))) linked.push({ id: named.id, label: named.label });
        }
        return { value: def.type === 'many2one' ? linked[0] : linked };
      }
      default:
        return null;
    }
  }

  const rows: CheckedRow[] = [];
  /** The options of a row's choices that follow another field, as asked for that row. */
  const rowChoices = new Map<string, Option[]>();
  // Links first: an amount reads in its record's currency, which may be a link of the same row; a choice that follows
  // another field last, by what the row's other cells read.
  const rank = (def: Field) => (following(def) ? 2 : def.type === 'many2one' || def.type === 'many2many' ? 0 : 1);
  const order = [...filled].sort((a, b) => rank(a.def) - rank(b.def));
  for (let r = 0; r < sheet.rows.length; r++) {
    if (stopped()) break;
    const row = sheet.rows[r];
    // A shallow copy: a value is only ever replaced, never changed in place.
    const values: Values = { ...defaults };
    /** Each problem by the column it is in, so a row's are said in the file's order; a field no column fills, after them. */
    const problems: { at: number; why: string }[] = [];
    const unread = new Set<string>();
    for (const { field, column, def } of order) {
      if (following(def) && stripMarks(textOf(row[column])).trim()) rowChoices.set(field, await rowOptions(field, def, values));
      const got = read(field, def, row[column], values);
      if (!got) continue;
      if ('why' in got) {
        problems.push({ at: column, why: got.why });
        unread.add(field);
      } else values[field] = got.value;
    }
    // The page's own rules for the record, over each field a person may fill: required, its most, least and places.
    for (const [name, def] of Object.entries(page.fields)) {
      if (unread.has(name) || def.readonly === true || def.compute || def.type === 'one2many') continue;
      const widget = check.cells?.[name]?.widget;
      const problem = checkValue(def, values[name], def.required === true, messages, check.today, widget);
      const column = columns.indexOf(name);
      if (problem) problems.push({ at: column < 0 ? Infinity : column, why: problem });
    }
    rows.push({ number: sheet.numbers[r], values, problems: problems.sort((a, b) => a.at - b.at).map((problem) => problem.why) });
    tick();
    // A breath for the page every so many rows, so a long file never freezes it.
    if (r % 500 === 499) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return rows;
}

/** A country's name in the page's language: "Egypt", "مصر". */
function regionName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
