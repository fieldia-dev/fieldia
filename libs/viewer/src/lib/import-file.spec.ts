import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DecompressionStream } from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';
import { deflateRawSync } from 'node:zlib';
import { CELL_MOST, csvRows, decodeText, FileProblem, formatWrites, guessSeparator, ownEncoding, readFile, serialAt, type PickedFile } from './import-file';
import { xlsxOf } from './xlsx';
import { PROOF_MS } from '../../../../testing/proof-time';

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

  it('reads a cell a spreadsheet would run as a formula, kept as words by a ' + "'" + ', as it was written (S-M1)', async () => {
    const sheet = await readFile(picked(`Name,Phone,Note\r\nMona,'+20 100 123 4567,'=SUM(A1)\r\nOmar,'-5,it's fine\r\n`));
    expect(sheet.rows).toEqual([
      ['Mona', '+20 100 123 4567', '=SUM(A1)'],
      ['Omar', '-5', "it's fine"],
    ]);
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

  it('says the encoding a file’s bytes are in where they say — a mark, UTF-8 whole — and nothing for plain ASCII', () => {
    expect(ownEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toBe('utf-8');
    expect(ownEncoding(encoded('\ufeffName', 'utf16le'))).toBe('utf-16le');
    expect(ownEncoding(new TextEncoder().encode('Müller'))).toBe('utf-8');
    expect(ownEncoding(new TextEncoder().encode('Name;Email'))).toBeNull();
    expect(ownEncoding(in1256('الاسم;البريد'))).toBeNull();
  });

  it('read in an encoding its bytes say it is not in, says the one that reads it; read right, nothing (the walk of 0.25)', async () => {
    const utf8 = readFileSync(join(SAMPLES, 'contacts-to-import.csv'));
    const wrong = await readFile(picked(new Uint8Array(utf8)), { encoding: 'windows-1256' });
    expect(wrong.headers[0]).toBe('ï»؟Name');
    expect(wrong.misread).toBe('utf-8');
    expect((await readFile(picked(new Uint8Array(utf8)), { encoding: 'utf-8' })).misread).toBeUndefined();
    expect((await readFile(picked(new Uint8Array(utf8)))).misread).toBeUndefined();
    // An Arabic code page's file read as it: nothing to say.
    expect((await readFile(picked(in1256('الاسم;البريد\r\nسلمى;s@x.example')), { encoding: 'windows-1256' })).misread).toBeUndefined();
  });

  it('reads a file of a header alone as no rows under it', async () => {
    const sheet = await readFile(picked('Name;Email\r\n'));
    expect(sheet.headers).toEqual(['Name', 'Email']);
    expect(sheet.total).toBe(0);
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

describe('a file that could freeze the page, read once through or refused at once (S-M3)', () => {
  /** A workbook of one sheet, its shared strings as given. */
  const workbook = (strings: string, cells = '<c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Mona</t></is></c>') =>
    zipOf([
      ['xl/workbook.xml', '<workbook><sheets><sheet name="One" r:id="rId1"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Type="x/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x/sharedStrings" Target="sharedStrings.xml"/></Relationships>'],
      ['xl/worksheets/sheet1.xml', `<worksheet><sheetData><row r="1">${cells}</row><row r="2"><c r="A2" t="inlineStr"><is><t>Omar</t></is></c></row></sheetData></worksheet>`],
      ['xl/sharedStrings.xml', strings],
    ]);
  /**
   * What reading `run` took — its answer (a refusal's problem), its milliseconds, and the characters of the workbook's
   * long documents (over 50,000 characters) its ends were looked for across (`indexOf`, from where it looked to where
   * it found one or the end): read once through is a few times their length, never their square.
   */
  const timed = async (run: () => Promise<unknown>) => {
    let scanned = 0;
    const real = String.prototype.indexOf;
    const spy = jest.spyOn(String.prototype, 'indexOf').mockImplementation(function (this: string, search: string, from?: number) {
      const at = real.call(this, search, from);
      if (this.length > 50_000) scanned += (at < 0 ? this.length : at) - Math.max(0, from ?? 0);
      return at;
    });
    const start = performance.now();
    try {
      const result = await run().catch((error: unknown) => (error instanceof FileProblem ? error.problem : error));
      return { result, ms: performance.now() - start, scanned };
    } finally {
      spy.mockRestore();
    }
  };

  it('reads a workbook’s strings once through: 40,000 "<si>" never closed take no time (the audit’s proof: 1.8 s, growing as its square)', async () => {
    const strings = `<sst>${'<si>'.repeat(40000)}</sst>`;
    const { ms, scanned } = await timed(() => readFile(picked(workbook(strings), 'strings.xlsx')));
    // The work it bounds, counted: each "<si>"'s end looked for once, across what is left — once through, not 40,000 times.
    expect(scanned).toBeGreaterThan(strings.length / 2);
    expect(scanned).toBeLessThanOrEqual(2 * strings.length);
    expect(ms).toBeLessThan(PROOF_MS);
    const cells = `<c r="A1" t="inlineStr"><is>${'<rPh>'.repeat(20000)}<t>x</t></is></c><c r="B1"><v>${'<v>'.repeat(20000)}</c>`;
    const { ms: inCell, scanned: acrossCells } = await timed(() => readFile(picked(workbook('<sst/>', cells), 'cells.xlsx')));
    expect(acrossCells).toBeGreaterThan(cells.length / 2);
    expect(acrossCells).toBeLessThanOrEqual(4 * cells.length);
    expect(inCell).toBeLessThan(PROOF_MS);
    // Its words, as ever: a shared string, its phonetic guide left out, an inline one.
    const sheet = await readFile(picked(workbook('<sst><si><r><t>Del</t></r><r><t>ta</t></r><rPh><t>デルタ</t></rPh></si></sst>'), 'read.xlsx'));
    expect([sheet.headers, sheet.rows]).toEqual([['Delta', 'Mona'], [['Omar', null]]]);
  });

  it('refuses a cell longer than a spreadsheet’s own, said why — never read on by every reader after it', async () => {
    expect((await timed(() => readFile(picked(`Name,Note\r\nMona,${'x'.repeat(CELL_MOST + 1)}\r\n`)))).result).toBe('tooLarge');
    expect((await timed(() => readFile(picked(workbook(`<sst><si><t>${'x'.repeat(CELL_MOST + 1)}</t></si></sst>`), 'long.xlsx')))).result).toBe('tooLarge');
    const sheet = await readFile(picked(`Name,Note\r\nMona,${'x'.repeat(CELL_MOST)}\r\n`));
    expect((sheet.rows[0][1] as string).length).toBe(CELL_MOST);
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
