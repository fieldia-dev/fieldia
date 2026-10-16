/**
 * The lines part (parts.ts): a one2many as a table of its lines (lines-table.ts)
 * — its cells, grips and moves, sections and notes, totals, a line's buttons,
 * lines chosen, cards on a phone — a one2many as a repeating group of cards
 * (cards.ts, with its own sheet, styles-cards.ts) and a many2many as a table of
 * its records (links-table.ts), with their stylesheet (styles-lines.ts). Loaded the first
 * time a page shows one, through `linesPart`; what they hold as plain words
 * meanwhile (lines-plain.ts). What a line is edited through (lines.ts) is the
 * main script's: the form a cell sees — its unread text, its uploads stored as
 * its line's — a column's total and a line's dialog, which a grid and cards
 * draw with too.
 */
export { linesWidget } from './lines-table';
export { cardsWidget } from './cards';
export { linksTableWidget } from './links-table';
