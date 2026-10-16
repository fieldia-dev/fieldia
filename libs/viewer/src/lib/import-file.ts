import { unzip, ZipProblem } from './unzip';

/**
 * A file a list's Import reads in the browser: an Excel workbook (.xlsx), its
 * few XML files read from the zip it is (unzip.ts) with no library; or a CSV
 * file, its characters' encoding and its separator guessed — UTF-8 with or
 * without its mark, UTF-16 as Excel's "Unicode text" saves it, or the code
 * page a Windows of the language wrote it in (Arabic's Windows-1256, Western
 * Europe's Windows-1252, …), commas or semicolons, tabs or bars — as the
 * person may then say otherwise. Its first row that holds anything names the
 * columns; each row under it keeps its number in the file, as Excel numbers
 * it, so a row refused is found there.
 */

/** A cell as the file holds it: words, a number, yes or no, a day ("2026-11-03") or a day and its time ("2026-11-03T14:30:00", on no zone's clock), or nothing. */
export type FileCell = string | number | boolean | { at: string } | null;

/** A file picked or dropped: a browser's File fits. */
export interface PickedFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** How to read a file again, as the person says: a CSV file's encoding and separator, a workbook's sheet. */
export interface ReadHow {
  encoding?: string;
  separator?: string;
  sheet?: number;
}

/** A file's rows, read. */
export interface FileSheet {
  kind: 'xlsx' | 'csv';
  /** The words over each column: its first row's, or "Column F" where it names none (the reader's `unnamed`). */
  headers: string[];
  /** The rows under them that hold anything, at most the reader's `most`, each as long as the headers. */
  rows: FileCell[][];
  /** Each row's number in the file, as a spreadsheet numbers it (the first is 1). */
  numbers: number[];
  /** How many rows hold anything under the headers, those past `most` too. */
  total: number;
  /** A CSV file's: the encoding it was read in, and its separator. */
  encoding?: string;
  separator?: string;
  /** A workbook's: its sheets' names, and the one read. */
  sheets?: string[];
  sheet?: number;
}

/** Why a file could not be read. */
export class FileProblem extends Error {
  constructor(readonly problem: 'notSheet' | 'oldExcel' | 'locked' | 'damaged' | 'noRows' | 'cannotInflate') {
    super(problem);
    this.name = 'FileProblem';
  }
}

/** The encodings a CSV file may be read in, the person's choice: UTF-8 and UTF-16, and each language's Windows code page and its kin. */
export const ENCODINGS = ['utf-8', 'utf-16le', 'utf-16be', 'windows-1252', 'windows-1250', 'windows-1251', 'windows-1253', 'windows-1254', 'windows-1255', 'windows-1256', 'windows-1257', 'windows-1258', 'windows-874', 'shift_jis', 'gbk', 'big5', 'euc-kr'] as const;
/** The script each encoding is for, by its ISO 15924 code (named in the page's language by Intl). */
export const ENCODING_SCRIPT: Record<string, string> = {
  'windows-1252': 'Latn',
  'windows-1250': 'Latn',
  'windows-1254': 'Latn',
  'windows-1257': 'Latn',
  'windows-1258': 'Latn',
  'windows-1251': 'Cyrl',
  'windows-1253': 'Grek',
  'windows-1255': 'Hebr',
  'windows-1256': 'Arab',
  'windows-874': 'Thai',
  shift_jis: 'Jpan',
  gbk: 'Hans',
  big5: 'Hant',
  'euc-kr': 'Kore',
};
/** The separators a CSV file may have between its values. */
export const SEPARATORS = [',', ';', '\t', '|'] as const;

/** Its bytes. */
async function bytesOf(file: PickedFile): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** A file read: a workbook or a CSV file, by what it holds (a zip, or text), whatever its name says. */
export async function readFile(file: PickedFile, how: ReadHow = {}, most = Infinity, unnamed: (column: string) => string = (column) => `Column ${column}`): Promise<FileSheet> {
  const bytes = await bytesOf(file);
  // A zip: an Excel workbook. An older workbook (.xls), or one locked with a password, is a compound file.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return readWorkbook(bytes, how, most, unnamed);
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) throw new FileProblem('oldExcel');
  if (/\.(xlsx|xlsm|xls|ods|numbers)$/i.test(file.name)) throw new FileProblem('notSheet');
  const { text, encoding } = decodeText(bytes, how.encoding);
  // Text with characters no text has (a picture, a PDF): no table.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000e-\u001a]/.test(text.slice(0, 4096))) throw new FileProblem('notSheet');
  const separator = how.separator ?? guessSeparator(text);
  return tableOf('csv', csvRows(text.replace(/^sep=.\r?\n/i, ''), separator).map((cells, i) => ({ number: i + 1 + (/^sep=./i.test(text) ? 1 : 0), cells })), most, unnamed, { encoding, separator });
}

// ---- CSV ------------------------------------------------------------------------------------------------------

/**
 * A CSV file's text, and the encoding it was read in: the one asked for; else the one its mark at the start says
 * (UTF-8, UTF-16); else UTF-8 when its bytes are UTF-8; else the code page whose reading looks most like words.
 */
export function decodeText(bytes: Uint8Array, asked?: string): { text: string; encoding: string } {
  const read = (encoding: string, fatal = false) => new TextDecoder(encoding, { fatal }).decode(bytes);
  if (asked) return { text: read(asked).replace(/^\ufeff/, ''), encoding: asked };
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { text: read('utf-8').replace(/^\ufeff/, ''), encoding: 'utf-8' };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: read('utf-16le').replace(/^\ufeff/, ''), encoding: 'utf-16le' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: read('utf-16be').replace(/^\ufeff/, ''), encoding: 'utf-16be' };
  try {
    return { text: read('utf-8', true), encoding: 'utf-8' };
  } catch {
    // Not UTF-8: a code page, the one whose reading looks most like words.
  }
  let best = { text: '', encoding: 'windows-1252', score: -Infinity };
  for (const encoding of ENCODINGS.filter((one) => one !== 'utf-8' && !one.startsWith('utf-16'))) {
    let text: string;
    try {
      text = read(encoding, true);
    } catch {
      continue;
    }
    const score = wordsScore(text);
    if (score > best.score) best = { text, encoding, score };
  }
  return { text: best.text || read('windows-1252'), encoding: best.encoding };
}

const SCRIPTS: [string, RegExp][] = [
  ['Latn', /\p{Script=Latin}/u],
  ['Arab', /\p{Script=Arabic}/u],
  ['Cyrl', /\p{Script=Cyrillic}/u],
  ['Grek', /\p{Script=Greek}/u],
  ['Hebr', /\p{Script=Hebrew}/u],
  ['Thai', /\p{Script=Thai}/u],
  ['Hani', /\p{Script=Han}/u],
  ['Kana', /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
  ['Hang', /\p{Script=Hangul}/u],
];
const scriptOf = (letter: string) => SCRIPTS.find(([, test]) => test.test(letter))?.[0] ?? 'other';

/**
 * How much a reading looks like words: a word of one script counts for it, and so does a Latin word with a few
 * letters beyond ASCII ("Müller", "Café"); a word that mixes scripts, a Latin word made mostly of accented letters
 * ("ÇáÞÇåÑÉ", Arabic read as Windows-1252), a word whose capitals come after its small letters ("ЗбЗУг", Arabic read
 * as Cyrillic), and a mark no text writes count against it.
 */
function wordsScore(text: string): number {
  let score = 0;
  for (const [word] of text.slice(0, 65536).matchAll(/\p{L}+/gu)) {
    const letters = [...word];
    const beyond = letters.filter((letter) => letter.charCodeAt(0) > 0x7f).length;
    if (!beyond) continue;
    const scripts = new Set(letters.map(scriptOf));
    // Japanese mixes its kana with Han: one writing.
    if (scripts.size === 2 && scripts.has('Hani') && scripts.has('Kana')) scripts.delete('Kana');
    if (scripts.size > 1 || /\p{Ll}\p{Lu}/u.test(word)) score -= 2 * letters.length;
    else if (scripts.has('Latn')) score += beyond * 2 <= letters.length ? beyond : -letters.length;
    else score += letters.length;
  }
  // Marks a reading made of what is no text: control characters, the replacement mark, the private and unused.
  for (const _ of text.slice(0, 65536).matchAll(/[\u0080-\u009f\ufffd\ue000-\uf8ff†‡‰¤¦¨¬¯´¸]/g)) score -= 3;
  return score;
}

/** The separator a CSV file's lines share most steadily: Excel's own `sep=` line, else the one that splits its first lines into the same number of values, the most. */
export function guessSeparator(text: string): string {
  const said = /^sep=(.)\r?\n/i.exec(text);
  if (said) return said[1];
  const sample = text.slice(0, 32768);
  let best = { separator: ',', score: -1 };
  for (const separator of SEPARATORS) {
    const rows = csvRows(sample, separator).slice(0, 50).filter((row) => row.some((cell) => cell.trim()));
    // The last row may be cut off by the sample.
    if (rows.length > 2) rows.pop();
    const counts = rows.map((row) => row.length);
    const tally = new Map<number, number>();
    for (const count of counts) tally.set(count, (tally.get(count) ?? 0) + 1);
    const [mode, times] = [...tally].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] ?? [1, 0];
    if (mode < 2) continue;
    const score = (times / counts.length) * 1000 + mode;
    if (score > best.score) best = { separator, score };
  }
  return best.separator;
}

/** A CSV file's rows, each its values: a value in double quotes may hold the separator, line breaks and its own quotes, doubled. */
export function csvRows(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let at = 0;
  const n = text.length;
  while (at < n) {
    const c = text[at];
    if (quoted) {
      if (c === '"') {
        if (text[at + 1] === '"') {
          cell += '"';
          at += 2;
          continue;
        }
        quoted = false;
        at++;
        continue;
      }
      cell += c;
      at++;
      continue;
    }
    if (c === '"' && !cell.trim()) {
      quoted = true;
      cell = '';
      at++;
    } else if (c === separator) {
      row.push(cell);
      cell = '';
      at++;
    } else if (c === '\r' || c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      at += c === '\r' && text[at + 1] === '\n' ? 2 : 1;
    } else {
      cell += c;
      at++;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// ---- the rows, under their headers ---------------------------------------------------------------------------

/** A column's letters, as a spreadsheet names it: A, …, Z, AA, … */
export function columnLetters(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

const blank = (cell: FileCell | undefined) => cell === null || cell === undefined || (typeof cell === 'string' && !cell.trim());
/** A header's words: a cell's, whatever it holds. */
const wordsOf = (cell: FileCell): string => (cell === null ? '' : typeof cell === 'object' ? cell.at : String(cell)).replace(/\s+/g, ' ').trim();

function tableOf(kind: 'xlsx' | 'csv', all: { number: number; cells: FileCell[] }[], most: number, unnamed: (column: string) => string, more: Partial<FileSheet>): FileSheet {
  const filled = all.filter((row) => row.cells.some((cell) => !blank(cell)));
  if (!filled.length) throw new FileProblem('noRows');
  const [head, ...under] = filled;
  // As many columns as the header names or a row fills, at most a thousand.
  const width = Math.min(1000, Math.max(head.cells.length, ...under.slice(0, most).map((row) => row.cells.length)));
  let last = width;
  while (last > 0 && blank(head.cells[last - 1]) && under.every((row) => blank(row.cells[last - 1]))) last--;
  const headers = Array.from({ length: last }, (_, i) => wordsOf(head.cells[i] ?? null) || unnamed(columnLetters(i)));
  const kept = under.slice(0, most);
  return {
    kind,
    headers,
    rows: kept.map((row) => Array.from({ length: last }, (_, i) => {
      const cell = row.cells[i];
      return cell === undefined || (typeof cell === 'string' && !cell.trim()) ? null : cell;
    })),
    numbers: kept.map((row) => row.number),
    total: under.length,
    ...more,
  };
}

// ---- an Excel workbook ---------------------------------------------------------------------------------------

/** XML's marks put back: &amp;, &lt;, &#1575;, &#x627; … */
const unescaped = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, name: string) => {
    const lower = name.toLowerCase();
    if (lower[0] === '#') {
      const code = lower[1] === 'x' ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[lower];
  });
/** Each attribute's and element's pattern, made once: a sheet asks for them a few times a cell. */
const patterns = new Map<string, RegExp>();
const pattern = (key: string, source: () => string, flags = '') => {
  let found = patterns.get(key);
  if (!found) patterns.set(key, (found = new RegExp(source(), flags)));
  return found;
};
/** An attribute of a tag's text: `r="B2"` of `<c r="B2" t="s">`. */
const attribute = (tag: string, name: string) => {
  const found = pattern(`@${name}`, () => `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return found ? unescaped(found[1] ?? found[2]) : undefined;
};
/** The words of a string item or an inline string: its runs' texts, its phonetic guides (Japanese furigana) left out. */
const textOf = (xml: string) => unescaped([...xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '').matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((found) => found[1]).join('').replace(/_x([0-9A-F]{4})_/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16))));
/** An element's tags, its namespace's prefix (`x:`) or none: each one's attributes and what it holds. */
const elements = (xml: string, name: string) => xml.matchAll(pattern(`<${name}`, () => `<(?:\\w+:)?${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${name}>)`, 'g'));

/** Excel's formats by number that write a day, a time or both. */
const DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 34, 35, 36, 50, 51, 52, 53, 54, 57, 58]);
const TIME_FORMATS = new Set([18, 19, 20, 21, 32, 33, 45, 46, 47, 55, 56]);

/** What a number format writes: a day, a time of day, both, or a number. */
export function formatWrites(code: string | undefined, id: number): 'day' | 'time' | 'both' | 'number' {
  if (code === undefined) return id === 22 ? 'both' : DATE_FORMATS.has(id) ? 'day' : TIME_FORMATS.has(id) ? 'time' : 'number';
  // Its words in quotes, its escaped marks and its colours and locales in brackets ([Red], [$-409]) say nothing of it;
  // an elapsed time ([h]:mm) is a time.
  const plain = code
    .split(';')[0]
    .replace(/"[^"]*"/g, '')
    .replace(/\\./g, '')
    .replace(/\[(h+|m+|s+)\]/gi, 'h')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/_.|\*./g, '');
  const day = /[dy]/i.test(plain) || (/m/i.test(plain) && !/[hs]/i.test(plain));
  const time = /[hs]/i.test(plain);
  return day && time ? 'both' : day ? 'day' : time ? 'time' : 'number';
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');
/** A spreadsheet's day number as the day, the time or both it writes; 1904's count where the workbook says so. */
export function serialAt(serial: number, writes: 'day' | 'time' | 'both', in1904 = false): FileCell {
  // Whole seconds: a time typed as 14:30 is 0.6041666…, never 14:29:59.
  const seconds = Math.round(serial * 86400);
  const days = Math.floor(seconds / 86400);
  const rest = seconds - days * 86400;
  const time = `${pad(Math.floor(rest / 3600))}:${pad(Math.floor((rest % 3600) / 60))}${rest % 60 ? `:${pad(rest % 60)}` : ''}`;
  if (writes === 'time') return time;
  // From 30 December 1899 (Excel's 1900 count, which holds a 29 February 1900 that never was), or 1 January 1904.
  const day = new Date(Date.UTC(in1904 ? 1904 : 1899, in1904 ? 0 : 11, in1904 ? 1 : 30) + days * 86400000);
  const date = `${pad(day.getUTCFullYear(), 4)}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
  return { at: writes === 'day' && !rest ? date : `${date}T${time.length === 5 ? `${time}:00` : time}` };
}

/** A path in the workbook a relationship points at, from the folder of the file that names it. */
const resolved = (from: string, target: string) => {
  if (target.startsWith('/')) return target.slice(1);
  const parts = from.split('/').slice(0, -1);
  for (const part of target.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  return parts.join('/');
};

async function readWorkbook(bytes: Uint8Array, how: ReadHow, most: number, unnamed: (column: string) => string): Promise<FileSheet> {
  let zip: ReturnType<typeof unzip>;
  try {
    zip = unzip(bytes);
  } catch {
    throw new FileProblem('damaged');
  }
  const text = async (path: string) => {
    try {
      const found = await zip.read(path);
      return found ? new TextDecoder('utf-8').decode(found) : null;
    } catch (error) {
      if (error instanceof ZipProblem && error.problem === 'locked') throw new FileProblem('locked');
      if (error instanceof ZipProblem && error.problem === 'cannotInflate') throw new FileProblem('cannotInflate');
      throw new FileProblem('damaged');
    }
  };
  const workbook = await text('xl/workbook.xml');
  if (workbook === null) throw new FileProblem('notSheet');
  const rels = (await text('xl/_rels/workbook.xml.rels')) ?? '';
  const targets = new Map<string, { type: string; path: string }>();
  for (const [, tag] of elements(rels, 'Relationship')) {
    const id = attribute(tag, 'Id');
    const target = attribute(tag, 'Target');
    if (id && target) targets.set(id, { type: attribute(tag, 'Type') ?? '', path: resolved('xl/workbook.xml', target) });
  }
  const ofType = (kind: string) => [...targets.values()].find((target) => target.type.endsWith(`/${kind}`))?.path;
  // Its sheets, those hidden left out, in their order on the tabs.
  const sheets = [...elements(workbook, 'sheet')]
    .map(([, tag]) => ({ name: attribute(tag, 'name') ?? '', hidden: !!attribute(tag, 'state') && attribute(tag, 'state') !== 'visible', path: targets.get(attribute(tag, 'r:id') ?? attribute(tag, 'id') ?? '')?.path }))
    .filter((sheet) => !sheet.hidden && sheet.path);
  if (!sheets.length) throw new FileProblem('noRows');
  const in1904 = /<(?:\w+:)?workbookPr\b[^>]*\bdate1904\s*=\s*["'](1|true)["']/.test(workbook);
  const chosen = Math.min(Math.max(0, how.sheet ?? 0), sheets.length - 1);
  const [strings, styles, sheet] = await Promise.all([text(ofType('sharedStrings') ?? 'xl/sharedStrings.xml'), text(ofType('styles') ?? 'xl/styles.xml'), text(sheets[chosen].path as string)]);
  if (sheet === null) throw new FileProblem('damaged');
  const shared = strings === null ? [] : [...elements(strings, 'si')].map(([, , inner]) => textOf(inner ?? ''));
  // What each cell style writes, by its number in the cells' formats.
  const codes = new Map<number, string>();
  const writes: ('day' | 'time' | 'both' | 'number')[] = [];
  if (styles !== null) {
    for (const [, tag] of elements(styles, 'numFmt')) codes.set(Number(attribute(tag, 'numFmtId')), attribute(tag, 'formatCode') ?? '');
    const cellXfs = /<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/.exec(styles)?.[1] ?? '';
    for (const [, tag] of elements(cellXfs, 'xf')) {
      const id = Number(attribute(tag, 'numFmtId') ?? 0);
      writes.push(formatWrites(codes.get(id), id));
    }
  }
  const rows: { number: number; cells: FileCell[] }[] = [];
  let next = 1;
  for (const [, rowTag, inner] of elements(sheet, 'row')) {
    const number = Number(attribute(rowTag, 'r')) || next;
    next = number + 1;
    const cells: FileCell[] = [];
    let column = 0;
    for (const [, tag, body = ''] of elements(inner ?? '', 'c')) {
      const ref = attribute(tag, 'r');
      const letters = ref ? /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() : undefined;
      if (letters) column = [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
      const type = attribute(tag, 't') ?? 'n';
      const value = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body)?.[1];
      let cell: FileCell = null;
      if (type === 's') cell = value === undefined ? null : (shared[Number(value)] ?? null);
      else if (type === 'inlineStr') cell = textOf(body);
      else if (type === 'str' || type === 'e') cell = value === undefined ? null : unescaped(value);
      else if (type === 'b') cell = value === undefined ? null : value.trim() === '1';
      else if (type === 'd') cell = value === undefined ? null : { at: unescaped(value).replace(/Z$/, '') };
      else if (value !== undefined && value.trim() !== '') {
        const n = Number(value);
        const style = writes[Number(attribute(tag, 's') ?? 0)] ?? 'number';
        cell = !Number.isFinite(n) ? unescaped(value) : style === 'number' ? n : serialAt(n, style, in1904);
      }
      if (column < 16384) cells[column] = cell;
      column++;
    }
    rows.push({ number, cells });
  }
  return tableOf('xlsx', rows, most, unnamed, { sheets: sheets.map((one) => one.name), sheet: chosen });
}
