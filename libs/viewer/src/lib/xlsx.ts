import { zipOf } from './zip';

/**
 * An Excel workbook of one sheet, written in the browser: a zip of the few
 * XML files Office Open XML asks for (zip.ts), no library. A header row in
 * bold that stays in view and filters its columns; text as text, never read
 * as a formula; numbers, money and dates as numbers in the format they are
 * read in, so they still add up and sort.
 */

/** A number, shown in an Excel format: `#,##0.00`, `"E£" #,##0.00`, `d mmm yyyy`. */
export interface SheetNumber {
  n: number;
  format?: string;
}

/** A cell: words, a number, or nothing. */
export type SheetCell = string | SheetNumber | null;

export interface Sheet {
  /** The sheet's name on its tab: 31 characters at most, with none of []:*?/\ (cut and dropped here). */
  name: string;
  /** Its headers, in order. */
  columns: string[];
  rows: SheetCell[][];
  /** Its columns run right to left, as the page did. */
  rtl?: boolean;
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
/** Formats Excel knows by number, without writing them out. */
const BUILT_IN: Record<string, number> = { '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4 };
/** The most characters a cell holds. */
const MOST = 32767;

/** Text as XML may carry it: its marks escaped, and the characters XML cannot hold at all left out. */
// eslint-disable-next-line no-control-regex
const escaped = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A column's letters: A, …, Z, AA, … */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

/** A name a sheet's tab may have. */
export function sheetName(name: string): string {
  const kept = name.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '').slice(0, 31).trim();
  return kept || 'Sheet1';
}

/** The workbook's bytes. */
export function xlsxOf(sheet: Sheet, when?: Date): Promise<Uint8Array> {
  const name = sheetName(sheet.name);
  // Each number format once: Excel's own by number, the rest written out from 164.
  const formats = new Map<string, number>();
  const ownFormats: string[] = [];
  const styleOf = (format: string | undefined): number => {
    if (!format) return 0;
    if (!formats.has(format)) {
      formats.set(format, formats.size + 2);
      if (BUILT_IN[format] === undefined) ownFormats.push(format);
    }
    return formats.get(format) as number;
  };
  const widths = sheet.columns.map((header) => Math.max(8, header.length + 4));
  const cell = (value: SheetCell, ref: string, column: number, style?: number): string => {
    if (value === null || value === '') return '';
    if (typeof value === 'string') {
      const text = value.length > MOST ? value.slice(0, MOST) : value;
      widths[column] = Math.max(widths[column], Math.min(60, text.length + 2));
      const space = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
      return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t${space}>${escaped(text)}</t></is></c>`;
    }
    if (!Number.isFinite(value.n)) return '';
    widths[column] = Math.max(widths[column], 14);
    const s = styleOf(value.format);
    return `<c r="${ref}"${s ? ` s="${s}"` : ''}><v>${value.n}</v></c>`;
  };
  const header = `<row r="1">${sheet.columns.map((words, i) => cell(words, `${columnName(i)}1`, i, 1)).join('')}</row>`;
  const body = sheet.rows.map((row, r) => `<row r="${r + 2}">${row.map((value, i) => cell(value, `${columnName(i)}${r + 2}`, i)).join('')}</row>`);
  const last = `${columnName(Math.max(0, sheet.columns.length - 1))}${sheet.rows.length + 1}`;
  const worksheet =
    `${XML}<worksheet xmlns="${MAIN}" xmlns:r="${DOC}">` +
    `<dimension ref="A1:${last}"/>` +
    // The header row stays in view as the rows scroll under it.
    `<sheetViews><sheetView workbookViewId="0"${sheet.rtl ? ' rightToLeft="1"' : ''}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>` +
    `<cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${header}${body.join('')}</sheetData>` +
    `<autoFilter ref="A1:${last}"/>` +
    `</worksheet>`;
  const xfs = [...formats.keys()].map((format) => `<xf numFmtId="${BUILT_IN[format] ?? 164 + ownFormats.indexOf(format)}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`);
  const styles =
    `${XML}<styleSheet xmlns="${MAIN}">` +
    (ownFormats.length ? `<numFmts count="${ownFormats.length}">${ownFormats.map((format, i) => `<numFmt numFmtId="${164 + i}" formatCode="${escaped(format)}"/>`).join('')}</numFmts>` : '') +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${2 + xfs.length}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>${xfs.join('')}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;
  const quoted = `'${name.replace(/'/g, "''")}'`;
  const workbook =
    `${XML}<workbook xmlns="${MAIN}" xmlns:r="${DOC}">` +
    `<sheets><sheet name="${escaped(name)}" sheetId="1" r:id="rId1"/></sheets>` +
    // What Excel itself writes beside a sheet's filter.
    `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${escaped(quoted)}!$A$1:$${last.replace(/(\d+)$/, '$$$1')}</definedName></definedNames>` +
    `</workbook>`;
  return zipOf(
    [
      {
        path: '[Content_Types].xml',
        data:
          `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      },
      { path: '_rels/.rels', data: `${XML}<Relationships xmlns="${RELS}"><Relationship Id="rId1" Type="${DOC}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { path: 'xl/workbook.xml', data: workbook },
      {
        path: 'xl/_rels/workbook.xml.rels',
        data: `${XML}<Relationships xmlns="${RELS}"><Relationship Id="rId1" Type="${DOC}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${DOC}/styles" Target="styles.xml"/></Relationships>`,
      },
      { path: 'xl/worksheets/sheet1.xml', data: worksheet },
      { path: 'xl/styles.xml', data: styles },
    ],
    when
  );
}
