import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DecompressionStream } from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';
import { deflateRawSync } from 'node:zlib';
import { csvRows, decodeText, FileProblem, formatWrites, guessSeparator, readFile, serialAt, type PickedFile } from './import-file';
import { xlsxOf } from './xlsx';

/**
 * A file a list's Import reads in the browser: a CSV file whose encoding and
 * separator are guessed — UTF-8 with or without its mark, UTF-16 as Excel's
 * Unicode text saves it, Arabic's or Western Europe's Windows code page;
 * commas, semicolons or tabs — and an Excel workbook read from its zip with
 * the browser's DecompressionStream: as Excel writes one (the demo's sample),
 * as openpyxl does (test-files/openpyxl.xlsx, written by openpyxl 3.1.5), and
 * as Fieldia's own Export does. A file that is none of them says why.
 */

// jsdom has neither, which every browser has: Node's, for the tests.
Object.assign(globalThis, { TextEncoder, TextDecoder, DecompressionStream });

const picked = (bytes: Uint8Array | string, name = 'contacts.csv'): PickedFile => {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  return { name, size: data.length, type: '', arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer };
};
const encoded = (text: string, encoding: 'latin1' | 'utf16le') => new Uint8Array(Buffer.from(text, encoding));
/** Text in Windows-1256, as Excel saves it on an Arabic Windows: each letter's byte, found by reading every byte in it. */
const WIN1256 = new Map(Array.from({ length: 128 }, (_, i) => [new TextDecoder('windows-1256').decode(new Uint8Array([0x80 + i])), 0x80 + i]));
const in1256 = (text: string) => new Uint8Array([...text].map((letter) => WIN1256.get(letter) ?? letter.charCodeAt(0)));
const SAMPLES = join(__dirname, '../../../../demos/samples');

describe('a CSV file', () => {
  it('reads UTF-8 with its mark, semicolons between its values, quoted values whole', async () => {
    const sheet = await readFile(picked('\ufeffName;Company;Notes\r\nMona Adel;"Nile; Traders";"Two\r\nlines, ""quoted"""\r\nOmar;Delta;\r\n'));
    expect(sheet).toMatchObject({ kind: 'csv', encoding: 'utf-8', separator: ';', headers: ['Name', 'Company', 'Notes'], numbers: [2, 3], total: 2 });
    expect(sheet.rows).toEqual([
      ['Mona Adel', 'Nile; Traders', 'Two\r\nlines, "quoted"'],
      ['Omar', 'Delta', null],
    ]);
  });

  it('reads UTF-8 without its mark, and commas', async () => {
    const sheet = await readFile(picked('الاسم,المدينة\nسلمى,القاهرة\n'));
    expect(sheet).toMatchObject({ encoding: 'utf-8', separator: ',', headers: ['الاسم', 'المدينة'], rows: [['سلمى', 'القاهرة']] });
  });

  it('guesses Arabic’s Windows-1256 for a file Excel saved on an Arabic Windows', async () => {
    const sheet = await readFile(picked(new Uint8Array([...in1256('الاسم;المدينة'), 0x0d, 0x0a, ...in1256('مني;القاهرة'), 0x0d, 0x0a])));
    expect(sheet.encoding).toBe('windows-1256');
    expect(sheet.headers).toEqual(['الاسم', 'المدينة']);
    expect(sheet.rows).toEqual([['مني', 'القاهرة']]);
  });

  it('guesses Western Europe’s Windows-1252 for accented words', async () => {
    const sheet = await readFile(picked(encoded('Name;Firma\r\nJürgen Müller;Café Crème\r\nRenée;Société\r\n', 'latin1')));
    expect(sheet.encoding).toBe('windows-1252');
    expect(sheet.rows).toEqual([
      ['Jürgen Müller', 'Café Crème'],
      ['Renée', 'Société'],
    ]);
  });

  it('reads UTF-16 with its mark and tabs, as Excel saves Unicode text', async () => {
    const sheet = await readFile(picked(encoded('\ufeffName\tCity\r\nسلمى\tAmman\r\n', 'utf16le'), 'contacts.txt'));
    expect(sheet).toMatchObject({ encoding: 'utf-16le', separator: '\t', headers: ['Name', 'City'], rows: [['سلمى', 'Amman']] });
  });

  it('takes Excel’s own sep= line, and numbers its rows after it', async () => {
    const sheet = await readFile(picked('sep=|\r\nName|City\r\nOmar|Giza\r\n'));
    expect(sheet).toMatchObject({ separator: '|', headers: ['Name', 'City'], rows: [['Omar', 'Giza']], numbers: [3] });
  });

  it('reads again as the person says: another encoding, another separator', async () => {
    const file = picked(encoded('Name;Firma\r\nJürgen;Café\r\n', 'latin1'));
    expect((await readFile(file, { encoding: 'windows-1252', separator: ',' })).headers).toEqual(['Name;Firma']);
    expect((await readFile(file, { encoding: 'windows-1251', separator: ';' })).rows[0][0]).toBe('Jьrgen');
  });

  it('skips blank rows, keeps each row’s number, names a column with no header by its letter', async () => {
    const sheet = await readFile(picked('\r\nName,City,\r\nMona,Cairo,VIP\r\n,,\r\nOmar,Giza,\r\n'), {}, Infinity, (letter) => `Column ${letter}`);
    expect(sheet.headers).toEqual(['Name', 'City', 'Column C']);
    expect(sheet.numbers).toEqual([3, 5]);
    expect(sheet.rows).toEqual([
      ['Mona', 'Cairo', 'VIP'],
      ['Omar', 'Giza', null],
    ]);
  });

  it('keeps at most so many rows, and counts them all', async () => {
    const sheet = await readFile(picked(`Name\n${Array.from({ length: 30 }, (_, i) => `Row ${i + 1}`).join('\n')}\n`), {}, 10);
    expect(sheet.rows).toHaveLength(10);
    expect(sheet.total).toBe(30);
  });

  it('guesses the separator its lines share most steadily', () => {
    expect(guessSeparator('a;b;c\n1;"2,5";3\n4;5;6\n')).toBe(';');
    expect(guessSeparator('a,b,c\n1,"2;5",3\n4,5,6\n')).toBe(',');
    expect(guessSeparator('a\tb\n1\t2\n')).toBe('\t');
    expect(guessSeparator('one column\nonly\n')).toBe(',');
  });

  it('splits a CSV file’s rows, a quote inside a value doubled, a value after its quotes kept', () => {
    expect(csvRows('a,"b ""c""",d\r\n"e\nf",g', ',')).toEqual([
      ['a', 'b "c"', 'd'],
      ['e\nf', 'g'],
    ]);
  });

  it('decodes UTF-8 when its bytes are UTF-8, whatever else they could be', () => {
    expect(decodeText(new TextEncoder().encode('Müller'))).toEqual({ text: 'Müller', encoding: 'utf-8' });
  });
});

describe('an Excel workbook', () => {
  it('reads the demo’s sample as Excel writes one: shared words, rich text, days in a day’s format, yes or no, a blank row', async () => {
    const bytes = new Uint8Array(readFileSync(join(SAMPLES, 'contacts-to-import.xlsx')));
    const sheet = await readFile(picked(bytes, 'contacts-to-import.xlsx'));
    expect(sheet).toMatchObject({ kind: 'xlsx', sheets: ['Contacts', 'Notes'], sheet: 0 });
    expect(sheet.headers).toEqual(['Full name', 'Company', 'E-mail', 'Country', 'Status', 'Owner', 'Last order', 'Newsletter', 'Notes']);
    expect(sheet.rows[0]).toEqual(['Amira Hassan', 'Delta Foods', 'amira.hassan@deltafoods.example', 'Egypt', 'Customer', 'Sara Haddad', { at: '2026-09-14' }, true, 'Orders every month']);
    expect(sheet.rows[1].slice(0, 2)).toEqual(['Omar Farouk', 'Nile Traders']);
    // The blank row after the eighth contact is skipped; the rows keep their numbers in the sheet.
    expect(sheet.numbers.slice(7, 9)).toEqual([9, 11]);
    expect(sheet.total).toBe(17);
    expect((await readFile(picked(bytes, 'contacts-to-import.xlsx'), { sheet: 1 })).headers).toEqual(['Contacts from the spring fairs, to bring into the CRM.']);
  });

  it('reads a workbook openpyxl wrote: inline words, a day, a day and its time, money as a number, a hidden sheet left out', async () => {
    const bytes = new Uint8Array(readFileSync(join(__dirname, 'test-files/openpyxl.xlsx')));
    const sheet = await readFile(picked(bytes, 'kunden.xlsx'));
    expect(sheet.sheets).toEqual(['Kunden']);
    expect(sheet.headers).toEqual(['Name', 'Betrag', 'Seit', 'Termin', 'Aktiv', 'Notiz']);
    expect(sheet.rows).toEqual([
      ['Müller GmbH', 1250.5, { at: '2026-03-14' }, { at: '2026-10-16T14:30:00' }, true, 'Grüße & „Zitate“'],
      ['Société Générale', 99, { at: '1999-12-31' }, { at: '2026-01-02T09:05:07' }, false, null],
      ['شركة النيل', -3.25, { at: '2026-02-28' }, null, null, 'سطر\nثانٍ'],
    ]);
    expect(sheet.numbers).toEqual([2, 3, 5]);
  });

  it('reads back what Fieldia’s own Export writes', async () => {
    const bytes = await xlsxOf({ name: 'Contacts', columns: ['Name', 'Since', 'Value'], rows: [['Mona', { n: 46095, format: 'd mmm yyyy' }, { n: 1500, format: '"E£" #,##0.00' }], ['=1+1', null, { n: 0.5 }]] });
    const sheet = await readFile(picked(bytes, 'Contacts 2026-10-16.xlsx'));
    expect(sheet.headers).toEqual(['Name', 'Since', 'Value']);
    expect(sheet.rows).toEqual([
      ['Mona', { at: '2026-03-14' }, 1500],
      ['=1+1', null, 0.5],
    ]);
  });

  it('says why a file cannot be read', async () => {
    const problem = (file: PickedFile) => readFile(file).then(() => null, (error: unknown) => (error instanceof FileProblem ? error.problem : String(error)));
    expect(await problem(picked(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 'old.xls'))).toBe('oldExcel');
    expect(await problem(picked(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x00, 0x01, 0x02]), 'scan.pdf'))).toBe('notSheet');
    expect(await problem(picked('', 'empty.csv'))).toBe('noRows');
    expect(await problem(picked(' ,  \n,\n', 'blank.csv'))).toBe('noRows');
    expect(await problem(picked(zipOf([['hello.txt', 'hi']]), 'notes.xlsx'))).toBe('notSheet');
    const sample = new Uint8Array(readFileSync(join(SAMPLES, 'contacts-to-import.xlsx')));
    expect(await problem(picked(sample.slice(0, 2000), 'cut.xlsx'))).toBe('damaged');
    // A file of it locked with a password: its flag says so.
    const locked = zipOf([['xl/workbook.xml', '<workbook/>']]);
    locked[6] |= 1;
    locked[locked.length - 22 - 46 - 'xl/workbook.xml'.length + 8] |= 1;
    expect(await problem(picked(locked, 'locked.xlsx'))).toBe('locked');
  });
});

describe('a workbook’s numbers', () => {
  it('tells a day’s format, a time’s and a number’s apart, by its code or Excel’s own number', () => {
    expect(formatWrites(undefined, 14)).toBe('day');
    expect(formatWrites(undefined, 22)).toBe('both');
    expect(formatWrites(undefined, 20)).toBe('time');
    expect(formatWrites(undefined, 4)).toBe('number');
    expect(formatWrites('dd/mm/yyyy', 164)).toBe('day');
    expect(formatWrites('yyyy-mm-dd hh:mm', 165)).toBe('both');
    expect(formatWrites('[h]:mm', 166)).toBe('time');
    expect(formatWrites('#,##0.00 "EGP"', 167)).toBe('number');
    expect(formatWrites('[Red]#,##0;[$-409]0.00', 168)).toBe('number');
    expect(formatWrites('0.00E+00', 169)).toBe('number');
    expect(formatWrites('[$-F800]dddd\\,\\ mmmm\\ dd\\,\\ yyyy', 170)).toBe('day');
  });

  it('counts days as a spreadsheet does: 1900’s, past its 29 February that never was, and 1904’s', () => {
    expect(serialAt(46095, 'day')).toEqual({ at: '2026-03-14' });
    expect(serialAt(61, 'day')).toEqual({ at: '1900-03-01' });
    expect(serialAt(46311.604166666664, 'both')).toEqual({ at: '2026-10-16T14:30:00' });
    expect(serialAt(0.75, 'time')).toBe('18:00');
    expect(serialAt(0, 'day', true)).toEqual({ at: '1904-01-01' });
  });
});

/** A zip of these files, squeezed as Excel squeezes them. */
function zipOf(files: [string, string][]): Uint8Array {
  const parts: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const [path, text] of files) {
    const name = Buffer.from(path);
    const plain = Buffer.from(text);
    const body = deflateRawSync(plain);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(plain.length, 22);
    head.writeUInt16LE(name.length, 26);
    const listed = Buffer.alloc(46);
    listed.writeUInt32LE(0x02014b50, 0);
    listed.writeUInt16LE(8, 10);
    listed.writeUInt32LE(body.length, 20);
    listed.writeUInt32LE(plain.length, 24);
    listed.writeUInt16LE(name.length, 28);
    listed.writeUInt32LE(offset, 42);
    parts.push(head, name, body);
    directory.push(listed, name);
    offset += 30 + name.length + body.length;
  }
  const size = directory.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...parts, ...directory, end]));
}
