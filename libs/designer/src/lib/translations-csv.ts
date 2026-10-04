import { pageWords, type Page } from '@fieldia/core';
import { languagesOf, languageTag, pageLanguage } from './translations';

/**
 * The page's words as CSV, for a translator's spreadsheet, and a CSV read
 * back as translations. The first row names the languages by tag, the first
 * column holds the page's words as written, and each other column a
 * language's translations. What a spreadsheet copies — split by tabs — reads
 * as well as CSV split by commas or by semicolons.
 */

/** The split a CSV uses, by its first row: the commas, tabs or semicolons outside quotes, whichever there are most of. */
function splitOf(text: string): string {
  const counts: Record<string, number> = { ',': 0, '\t': 0, ';': 0 };
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && char in counts) counts[char]++;
  }
  return Object.keys(counts).reduce((best, split) => (counts[split] > counts[best] ? split : best), ',');
}

/** Rows of fields, as RFC 4180 has them: fields in quotes may hold the split, line breaks and doubled quotes. Blank lines are skipped. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const split = splitOf(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let at = 0;
  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
    field = '';
  };
  while (at < text.length) {
    const char = text[at];
    if (char === '"' && field === '') {
      // A quoted field: to the next quote not doubled, or to the end.
      let end = at + 1;
      for (;;) {
        const quote = text.indexOf('"', end);
        if (quote === -1) {
          field += text.slice(end);
          end = text.length;
          break;
        }
        field += text.slice(end, quote);
        if (text[quote + 1] === '"') {
          field += '"';
          end = quote + 2;
        } else {
          end = quote + 1;
          break;
        }
      }
      at = end;
    } else if (char === split) {
      row.push(field);
      field = '';
      at++;
    } else if (char === '\n' || char === '\r') {
      endRow();
      at += char === '\r' && text[at + 1] === '\n' ? 2 : 1;
    } else {
      field += char;
      at++;
    }
  }
  if (field !== '' || row.length) endRow();
  return rows;
}

/** Rows as CSV: a field with a comma, quote, tab, semicolon, line break or space at an end goes in quotes, its quotes doubled. */
export function toCsv(rows: string[][]): string {
  const field = (text: string) => (/[",;\t\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  return rows.map((row) => row.map(field).join(',') + '\r\n').join('');
}

/** The page's words and their translations as CSV: the page's language, then each language it keeps. */
export function translationsCsv(page: Page): string {
  const languages = languagesOf(page);
  return toCsv([[pageLanguage(page), ...languages], ...pageWords(page).map((word) => [word, ...languages.map((tag) => page.translations?.[tag]?.[word] ?? '')])]);
}

export type ReadCsv = { words: Record<string, Record<string, string>>; notOnPage: number } | { problem: string };

/**
 * A CSV as translations to fill: each column after the first by the language
 * its first row names, by tag or name; the page's own language and unnamed
 * columns skipped. Words the page no longer has are left out, and counted.
 */
export function readTranslationsCsv(text: string, page: Page): ReadCsv {
  const [head, ...rows] = parseCsv(text);
  if (!head) return { problem: 'There is nothing to read: paste the CSV, its first row naming the languages' };
  const columns: [number, string][] = [];
  for (const [at, name] of head.entries()) {
    if (at === 0 || !name.trim()) continue;
    const tag = languageTag(name);
    if (!tag) return { problem: `“${name.trim()}” in the first row is not a language: name it by its tag or name, such as ar or Arabic` };
    if (tag !== pageLanguage(page)) columns.push([at, tag]);
  }
  if (!columns.length) return { problem: 'The first row names no language to fill: put a language’s tag or name over each column after the first, such as ar or Arabic' };
  const shown = new Set(pageWords(page));
  const words: Record<string, Record<string, string>> = {};
  let notOnPage = 0;
  for (const row of rows) {
    const source = row[0] ?? '';
    const given = columns.filter(([at]) => row[at]?.trim());
    if (!given.length) continue;
    if (!shown.has(source)) {
      notOnPage++;
      continue;
    }
    for (const [at, tag] of given) (words[tag] ??= {})[source] = row[at];
  }
  return { words, notOnPage };
}
