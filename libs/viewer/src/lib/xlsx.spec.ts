import { unzip } from './test-unzip';
import { columnName, sheetName, xlsxOf } from './xlsx';
import { crc32, zipOf } from './zip';

/**
 * An Excel workbook written in the browser: a zip (zip.ts) of the XML files
 * Office Open XML asks for. Read back here as a spreadsheet program reads it:
 * the archive's directory, each file's check, and each XML file well formed.
 */

const wellFormed = (xml: string) => !new DOMParser().parseFromString(xml, 'application/xml').querySelector('parsererror');

describe('a zip', () => {
  it('checks its files as zips do (CRC-32)', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('holds each file, read back from its directory', async () => {
    const files = unzip(await zipOf([{ path: 'a.txt', data: 'Nile Traders' }, { path: 'dir/b.txt', data: 'نايل' }], new Date(2026, 9, 16, 9, 30)));
    expect([...files]).toEqual([['a.txt', 'Nile Traders'], ['dir/b.txt', 'نايل']]);
  });
});

describe('an Excel workbook', () => {
  const sheet = {
    name: 'Customers: all [2026]',
    columns: ['Name', 'Credit limit', 'Since', 'Note'],
    rows: [
      ['Nile Traders', { n: 250000, format: '"E£" #,##0.00' }, { n: 46311, format: 'd mmm yyyy' }, '=1+1 & <b>'],
      ['Petra Tours', { n: 80000, format: '#,##0.000 "JOD"' }, null, ' spaced '],
      ['Amira', { n: 3, format: '#,##0' }, { n: 1.5 }, ''],
    ],
  };

  it('is the files Excel asks for, each well formed', async () => {
    const files = unzip(await xlsxOf(sheet));
    expect([...files.keys()]).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']);
    for (const [name, xml] of files) expect([name, wellFormed(xml)]).toEqual([name, true]);
  });

  it('has a header row in bold that stays in view and filters, text as text, and numbers in their formats', async () => {
    const files = unzip(await xlsxOf(sheet));
    const xml = files.get('xl/worksheets/sheet1.xml') as string;
    expect(xml).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(xml).toContain('<autoFilter ref="A1:D4"/>');
    expect(xml).toContain('<c r="A1" t="inlineStr" s="1"><is><t>Name</t></is></c>');
    // Text is never a formula: "=1+1" stays words, its marks escaped.
    expect(xml).toContain('<c r="D2" t="inlineStr"><is><t>=1+1 &amp; &lt;b&gt;</t></is></c>');
    expect(xml).toContain('<t xml:space="preserve"> spaced </t>');
    expect(xml).toContain('<c r="B2" s="2"><v>250000</v></c>');
    expect(xml).toContain('<c r="C2" s="3"><v>46311</v></c>');
    // A number with no format is plain; nothing is written for an empty cell.
    expect(xml).toContain('<c r="C4"><v>1.5</v></c>');
    expect(xml).not.toContain('r="C3"');
    expect(xml).not.toContain('r="D4"');
    const styles = files.get('xl/styles.xml') as string;
    expect(styles).toContain('<numFmt numFmtId="164" formatCode="&quot;E£&quot; #,##0.00"/>');
    expect(styles).toContain('<numFmt numFmtId="165" formatCode="d mmm yyyy"/>');
    expect(styles).toContain('<numFmt numFmtId="166" formatCode="#,##0.000 &quot;JOD&quot;"/>');
    // #,##0 is Excel's own (3): not written out.
    expect(styles).toContain('<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>');
    expect(styles).toContain('<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>');
    const workbook = files.get('xl/workbook.xml') as string;
    expect(workbook).toContain('<sheet name="Customers all 2026" sheetId="1" r:id="rId1"/>');
    expect(workbook).toContain(`'Customers all 2026'!$A$1:$D$4`);
  });

  it('runs right to left where the page did', async () => {
    const xml = unzip(await xlsxOf({ ...sheet, rtl: true })).get('xl/worksheets/sheet1.xml') as string;
    expect(xml).toContain('<sheetView workbookViewId="0" rightToLeft="1">');
  });

  it('names its columns and its tab as Excel allows', () => {
    expect([0, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
    expect(sheetName('A very long list name that goes on and on')).toBe('A very long list name that goes');
    expect(sheetName("'[]'")).toBe('Sheet1');
  });
});
