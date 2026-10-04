import type { Page } from '@fieldia/core';
import { parseCsv, readTranslationsCsv, toCsv, translationsCsv } from './translations-csv';

/**
 * The page's words as CSV, for a translator's spreadsheet, and a CSV pasted
 * back to fill the translations: quoted fields, quotes doubled, commas and
 * line breaks inside quotes, and what a spreadsheet copies (tabs) all read.
 */

describe('parseCsv', () => {
  it('reads rows of fields split by commas', () => {
    expect(parseCsv('en,ar\nYes,نعم\nNo,لا')).toEqual([['en', 'ar'], ['Yes', 'نعم'], ['No', 'لا']]);
  });

  it('reads quoted fields: commas, doubled quotes and line breaks inside them', () => {
    expect(parseCsv('"Name, full","He said ""hi""","Two\nlines"\r\nnext,"",end')).toEqual([
      ['Name, full', 'He said "hi"', 'Two\nlines'],
      ['next', '', 'end'],
    ]);
  });

  it('reads Windows and old Mac line ends, a byte-order mark, and skips blank lines and the last line end', () => {
    expect(parseCsv('\uFEFFa,b\r\n\r\nc,d\re,f\r\n')).toEqual([['a', 'b'], ['c', 'd'], ['e', 'f']]);
  });

  it('keeps empty fields, at the ends of a row too', () => {
    expect(parseCsv(',x,\n,,')).toEqual([['', 'x', ''], ['', '', '']]);
  });

  it('reads what a spreadsheet copies, split by tabs, and a CSV split by semicolons', () => {
    expect(parseCsv('en\tar\nYes, please\tنعم، من فضلك')).toEqual([['en', 'ar'], ['Yes, please', 'نعم، من فضلك']]);
    expect(parseCsv('en;de\nYes, please;Ja, bitte')).toEqual([['en', 'de'], ['Yes, please', 'Ja, bitte']]);
    // A comma inside quotes is no split, and does not count when telling which split is used.
    expect(parseCsv('"a,b,c"\td\ne\tf')).toEqual([['a,b,c', 'd'], ['e', 'f']]);
  });

  it('takes a quote left open to the end, and a quote inside a field as it is', () => {
    expect(parseCsv('a,"open\nstill')).toEqual([['a', 'open\nstill']]);
    expect(parseCsv('5" screen,x')).toEqual([['5" screen', 'x']]);
  });

  it('reads nothing as no rows', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\n\n')).toEqual([]);
  });
});

describe('toCsv', () => {
  it('quotes only the fields that need it, doubling quotes', () => {
    expect(toCsv([['en', 'ar'], ['Name, full', 'He said "hi"'], ['Two\nlines', ' padded '], ['plain', '']])).toBe(
      'en,ar\r\n"Name, full","He said ""hi"""\r\n"Two\nlines"," padded "\r\nplain,\r\n'
    );
  });

  it('reads back what it writes', () => {
    const rows = [['a', 'b,c', '"q"'], ['line\r\nbreak', '', '\t'], ['', '', 'x']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('quotes tabs and semicolons, so a first row full of them is not read as split by them', () => {
    for (const rows of [[['a\tb\tc', 'd'], ['e', 'f']], [['a;b;c', 'd'], ['e', 'f']]]) expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

const page: Page = {
  fieldia: '0.1',
  id: 'p',
  title: 'Sign up',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name', help: 'As on your ID, in full' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'name' }] },
  translations: { ar: { 'Sign up': 'التسجيل', 'Gone word': 'كلمة' }, es: { 'Your name': 'Tu nombre' } },
};

describe('the page’s words as CSV', () => {
  it('has a column for the page’s words, then one per language, named by tag; a row per word on the page', () => {
    expect(parseCsv(translationsCsv(page))).toEqual([
      ['en', 'ar', 'es'],
      ['Sign up', 'التسجيل', ''],
      ['Your name', '', 'Tu nombre'],
      ['As on your ID, in full', '', ''],
    ]);
  });

  it('names the page’s own language first when it says one', () => {
    expect(translationsCsv({ ...page, language: 'de', translations: undefined })).toBe('de\r\nSign up\r\nYour name\r\n"As on your ID, in full"\r\n');
  });
});

describe('a CSV read as translations', () => {
  it('fills each language column by the page’s words in the first column', () => {
    const read = readTranslationsCsv('en,ar,fr\nSign up,سجّل,Inscription\nYour name,,Votre nom\n', page);
    expect(read).toEqual({ words: { ar: { 'Sign up': 'سجّل' }, fr: { 'Sign up': 'Inscription', 'Your name': 'Votre nom' } }, notOnPage: 0 });
  });

  it('takes a language by its name as well as its tag, and skips the page’s own language and unnamed columns', () => {
    const read = readTranslationsCsv('Words,Arabic,English,,pt-br\nYour name,اسمك,Name,x,Seu nome', page);
    expect(read).toEqual({ words: { ar: { 'Your name': 'اسمك' }, 'pt-BR': { 'Your name': 'Seu nome' } }, notOnPage: 0 });
  });

  it('counts the words it leaves out because the page no longer has them', () => {
    const read = readTranslationsCsv('en,ar\nGone word,كلمة\nOther gone,أخرى\nNo translation,\nSign up,التسجيل', page);
    expect(read).toEqual({ words: { ar: { 'Sign up': 'التسجيل' } }, notOnPage: 2 });
  });

  it('says what is wrong with a CSV it cannot read', () => {
    expect(readTranslationsCsv('', page)).toEqual({ problem: 'There is nothing to read: paste the CSV, its first row naming the languages' });
    expect(readTranslationsCsv('en\nSign up', page)).toEqual({ problem: 'The first row names no language to fill: put a language’s tag or name over each column after the first, such as ar or Arabic' });
    expect(readTranslationsCsv('en,Klingon tongue\nSign up,x', page)).toEqual({ problem: '“Klingon tongue” in the first row is not a language: name it by its tag or name, such as ar or Arabic' });
  });
});
