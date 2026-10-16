/**
 * The lines part (parts.ts): a one2many as a table of its lines (lines-table.ts)
 * — its cells, grips and moves, sections and notes, totals, a line's buttons,
 * lines chosen, cards on a phone — and a many2many as a table of its records
 * (links-table.ts), with their stylesheet (styles-lines.ts). Loaded the first
 * time a page shows one, through `linesPart`; what they hold as plain words
 * meanwhile (lines-plain.ts). What a line is edited through (lines.ts) is the
 * main script's: the form a cell sees — its unread text, its uploads stored as
 * its line's — a column's total and a line's dialog, which a grid and cards
 * draw with too. A block pasted on a table's cells — a spreadsheet's rows, each
 * cell read as its column reads what is typed (cell-paste.ts) — is this part's
 * too: the table of lines pastes with it, and gives it to the grid and to a
 * list's Import, which load this part for it.
 */
export { linesWidget } from './lines-table';
export { linksTableWidget } from './links-table';
export { blockOf, readPastedCell, whyNotPasted, type CellReading } from './cell-paste';
