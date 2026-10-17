import { placesOf, placesOfCurrency, stripMarks, wallClock, wallDay, wallTime, type DataSource, type ExportedFile, type Field, type ListedRecord, type Locale, type RecordId, type ResolvedFilter, type SortOrder, type Value, type Values } from '@fieldia/core';
import { currencyOf, currencySymbol } from '@fieldia/widgets';
import type { ViewerLabels } from './labels';
import { xlsxOf, XLSX_TYPE, type SheetCell } from './xlsx';

/**
 * A list's records in a file: an Excel workbook (xlsx.ts) or a CSV file, its
 * columns as the list shows them, in its order, under a header row. In the
 * workbook each value is as a person reads it in the list — a date as a date,
 * money with its currency, a choice by its label. A CSV file has no formats:
 * its numbers and amounts are written as a spreadsheet adds them (digits and
 * the decimal mark, nothing else), each amount's currency in a column of its
 * own (or in the header, where the field has one), its days and times as ISO
 * 8601 writes them. The records are the rows ticked, or every one the search
 * finds, asked of the data source a page at a time; or the source writes the
 * file itself (`exportRecords`).
 */

/** The most records a file written in the browser holds: past it, the first so many, and the list says so. */
export const EXPORT_MOST = 50000;
/** Records asked for at a time. */
const PAGE = 500;
/** Ids asked for at a time, by `id in`. */
const IDS_AT_ONCE = 200;

export type ExportFormat = 'xlsx' | 'csv';

/** What an export reads of its list. */
export interface ExportList {
  model: string;
  title: string;
  fields: Record<string, Field>;
  /** The columns, in order. */
  columns: string[];
  /** What the list asks for of each record: its columns, and what their words read (a currency). */
  reads: string[];
  dataSource: DataSource | undefined;
  locale: Locale;
  labels: ViewerLabels;
  doc: Document;
  /** A column's words for a record, as its cell says them. */
  words: (name: string, values: Values) => string;
  /** The page runs right to left. */
  rtl: boolean;
}

/** Which records go: those ticked, in this order, or (no ids) every one the filter finds. */
export interface ExportWhich {
  ids?: RecordId[];
  filter: ResolvedFilter[];
  sort: SortOrder[];
  /** How many go. */
  count: number;
}

/** How an export ended: so many of so many in the file, or the source's words when it handed the file over its own way. */
export type ExportEnd = { done: number; total: number } | { message: string };

/** The file's name: the list's, then the day, as "Customers 2026-10-16.xlsx" — the day written the same way everywhere. */
export function exportName(title: string, format: ExportFormat, when: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  // eslint-disable-next-line no-control-regex
  const name = stripMarks(title).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Export';
  return `${name} ${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())}.${format}`;
}

/** Between a CSV file's values: a comma, or a semicolon where the language writes a decimal comma — what a spreadsheet there reads. */
export function csvSeparator(locale: Locale): string {
  try {
    return new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value === ',' ? ';' : ',';
  } catch {
    return ',';
  }
}

/** Rows of words as a CSV file: quoted where a value needs it, a line break between rows, and a mark at its start that says UTF-8. */
export function csvOf(rows: readonly (readonly string[])[], separator = ','): string {
  const quoted = (value: string) => (value.includes(separator) || /["\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return `\ufeff${rows.map((row) => row.map(quoted).join(separator)).join('\r\n')}\r\n`;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;
/** A day, and its time, as a spreadsheet counts it — days since 30 December 1899 — read as the list reads it, its hour as written. */
export function serialDay(text: string): number | null {
  const found = DAY.exec(text);
  if (!found) return null;
  const [, y, m, d, hh, mm, ss] = found.map(Number);
  const days = (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
  return days + ((hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0)) / 86400;
}

/** A cell's words as a file holds them: without the marks that set their direction, and with plain spaces for the ones that never break ("E£ 250,000.00", French "250 000,00 €"), which other programs read as words. */
const plainWords = (text: string) => stripMarks(text).replace(/[\u00a0\u202f]/g, ' ');

/** A number format with these places: #,##0, #,##0.00, … */
const grouped = (places: number) => (places ? `#,##0.${'0'.repeat(places)}` : '#,##0');
/** Words a number format keeps as they are. */
const literal = (text: string) => `"${text.replace(/"/g, '')}"`;
/** A number's places: its field's, and never fewer than it has. */
const placesFor = (n: number, field: number) => Math.max(field, Math.min(placesOf(n), 10));

/**
 * A value in a sheet's cell: a number, an amount and a day as numbers in the format the list reads them in — the
 * amount with its currency, as its cell writes it; yes or no in words; anything else as the list's cell says it.
 */
export function sheetCell(list: ExportList, name: string, values: Values): SheetCell {
  const def = list.fields[name];
  const value: Value | undefined = values[name];
  if (value === null || value === undefined || value === '') return null;
  if (def.type === 'boolean') return value ? list.labels.yes : list.labels.no;
  if (typeof value === 'number' && (def.type === 'integer' || def.type === 'float')) return { n: value, format: grouped(placesFor(value, def.type === 'float' ? def.digits?.[1] ?? 2 : 0)) };
  if (typeof value === 'number' && def.type === 'monetary') {
    const currency = currencyOf(def, values);
    const number = grouped(placesFor(value, def.digits?.[1] ?? placesOfCurrency(currency)));
    // The home currency of the field's money look is left unsaid, as its cell leaves it.
    if (!currency || currency === def.money?.home) return { n: value, format: number };
    const where = /^[A-Z]{3}$/.test(currency) ? currencySymbol(currency, list.locale) : null;
    const text = stripMarks(def.money?.currency === 'code' || !where ? currency : where.text);
    const after = def.money?.at ? def.money.at === 'after' : !!where?.after;
    return { n: value, format: after ? `${number} ${literal(text)}` : `${literal(text)} ${number}` };
  }
  if (typeof value === 'string' && (def.type === 'date' || def.type === 'datetime')) {
    const day = serialDay(value);
    if (day !== null) return { n: day, format: def.type === 'date' ? 'd mmm yyyy' : 'd mmm yyyy hh:mm' };
  }
  return plainWords(list.words(name, values));
}

/** A CSV file's decimal mark: a point, or a comma where the file's values are kept apart by semicolons (`csvSeparator`). */
export const csvDecimal = (separator: string): string => (separator === ';' ? ',' : '.');

/** Whether an amount's currency is the record's, each its own: then the file gives it a column of its own. */
const ownCurrency = (def: Field) => def.type === 'monetary' && !def.currency && !!def.currencyField;

/**
 * A CSV file's columns: each of the list's, under its label — an amount's under its currency where the field has one
 * ("Amount (EGP)"), else followed by a column of each record's currency ("Amount currency").
 */
export function csvHeaders(list: ExportList): string[] {
  return list.columns.flatMap((name) => {
    const def = list.fields[name];
    if (ownCurrency(def)) return [def.label, list.labels.exportCurrency.replace('{column}', def.label)];
    const fixed = def.type === 'monetary' ? currencyOf(def, {}) : null;
    return [fixed && /^[A-Z]{3}$/.test(fixed) ? `${def.label} (${fixed})` : def.label];
  });
}

/**
 * A record's values in a CSV file, a column's or two (an amount and its currency): numbers and amounts as a
 * spreadsheet adds them — digits, a minus, the decimal mark (`decimal`) and the field's places, no grouping and no
 * sign; a day as 2026-10-15 and a time as 2026-10-15 14:30, on the clock the list shows; yes or no, and anything else,
 * in the words the list says it with.
 */
export function csvCells(list: ExportList, name: string, values: Values, decimal = '.'): string[] {
  const def = list.fields[name];
  const value = values[name];
  const own = ownCurrency(def);
  const blank = value === null || value === undefined || value === '';
  if (blank) return own ? ['', ''] : [''];
  if (def.type === 'boolean') return [value ? list.labels.yes : list.labels.no];
  if (typeof value === 'number' && Number.isFinite(value) && (def.type === 'integer' || def.type === 'float' || def.type === 'monetary')) {
    const currency = def.type === 'monetary' ? currencyOf(def, values) : null;
    const field = def.type === 'integer' ? 0 : def.type === 'monetary' ? (def.digits?.[1] ?? placesOfCurrency(currency)) : (def.digits?.[1] ?? 0);
    const number = value.toFixed(placesFor(value, field)).replace('.', decimal);
    return own ? [number, currency ?? ''] : [number];
  }
  if (typeof value === 'string' && def.type === 'date' && /^\d{4}-\d{2}-\d{2}/.test(value)) return [value.slice(0, 10)];
  if (typeof value === 'string' && def.type === 'datetime') {
    const at = new Date(value).getTime();
    if (!Number.isNaN(at)) {
      const wall = wallTime(at, def.timeZone);
      return [`${wallDay(wall)} ${wallClock(wall)}`];
    }
  }
  const words = plainWords(list.words(name, values));
  return own ? [words, ''] : [words];
}

/** The records that go, asked of the source a page at a time (or by their ids), in the list's order: at most `most` (Print's too). */
export async function gather(list: Pick<ExportList, 'dataSource' | 'model' | 'reads'>, which: ExportWhich, progress: (done: number, total: number) => void, most: number): Promise<{ records: ListedRecord[]; total: number }> {
  const source = list.dataSource;
  if (!source?.list) throw new Error('This list’s data source cannot list its records');
  const records: ListedRecord[] = [];
  if (which.ids) {
    const ids = which.ids.slice(0, most);
    const place = new Map(ids.map((id, i) => [String(id), i]));
    for (let at = 0; at < ids.length; at += IDS_AT_ONCE) {
      const some = ids.slice(at, at + IDS_AT_ONCE);
      const answer = await source.list({ model: list.model, fields: list.reads, filter: [...which.filter, { field: 'id', op: 'in', value: some }], sort: which.sort, offset: 0, limit: some.length });
      records.push(...answer.records.filter((record) => place.has(String(record.id))));
      progress(at + some.length, which.ids.length);
    }
    // In the order they were chosen in: the list's.
    records.sort((a, b) => (place.get(String(a.id)) as number) - (place.get(String(b.id)) as number));
    // Past the most, the first so many of those ticked; a record gone since it was ticked is simply not there.
    return { records, total: which.ids.length > most ? which.ids.length : records.length };
  }
  // How many match as the source answers, from its first page on: the list's own count is only where it starts.
  let total = which.count;
  for (let offset = 0; offset < most; ) {
    const answer = await source.list({ model: list.model, fields: list.reads, filter: which.filter, sort: which.sort, offset, limit: Math.min(PAGE, most - offset) });
    total = answer.total;
    records.push(...answer.records.slice(0, most - offset));
    // As many as the source gave: one that keeps to a smaller page is asked again from there.
    offset += answer.records.length;
    progress(Math.min(offset, total), total);
    if (!answer.records.length || offset >= total) break;
  }
  return { records, total };
}

/** A file handed to the browser to save, by a link it presses: its bytes, or its address. */
export function saveFile(doc: Document, name: string, file: Blob | string): void {
  const url = typeof file === 'string' ? file : URL.createObjectURL(file);
  const link = doc.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  (doc.body ?? doc.documentElement).append(link);
  link.click();
  link.remove();
  // Let go of the bytes once the browser has taken them.
  if (typeof file !== 'string') setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** The list's records in a file, saved by the browser — or by the source, where it writes the file itself. At most `most` of them. */
export async function exportList(list: ExportList, which: ExportWhich, format: ExportFormat, progress: (done: number, total: number) => void, when = new Date(), most = EXPORT_MOST): Promise<ExportEnd> {
  const name = exportName(list.title, format, when);
  const source = list.dataSource;
  if (source?.exportRecords) {
    const answer = await source.exportRecords({
      model: list.model,
      format,
      columns: list.columns.map((field) => ({ field, label: list.fields[field].label })),
      ...(which.ids ? { ids: which.ids } : {}),
      filter: which.filter,
      sort: which.sort,
      count: which.count,
      name,
      locale: list.locale,
    });
    if (answer !== false) {
      if (!('name' in answer)) return { message: answer.message };
      const file = answer as ExportedFile;
      saveFile(list.doc, file.name || name, file.url ?? new Blob([file.data as BlobPart], { type: file.type ?? (format === 'csv' ? 'text/csv;charset=utf-8' : XLSX_TYPE) }));
      return { done: which.count, total: which.count };
    }
  }
  const { records, total } = await gather(list, which, progress, most);
  const headers = list.columns.map((field) => list.fields[field].label);
  const separator = csvSeparator(list.locale);
  const blob =
    format === 'csv'
      ? new Blob([csvOf([csvHeaders(list), ...records.map((record) => list.columns.flatMap((field) => csvCells(list, field, record.values, csvDecimal(separator))))], separator)], { type: 'text/csv;charset=utf-8' })
      : new Blob([(await xlsxOf({ name: list.title, columns: headers, rows: records.map((record) => list.columns.map((field) => sheetCell(list, field, record.values))), rtl: list.rtl }, when)) as BlobPart], { type: XLSX_TYPE });
  saveFile(list.doc, name, blob);
  return { done: records.length, total };
}
