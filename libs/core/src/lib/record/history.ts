import type { Value } from './values';

/** A change a person made to a record, as Undo takes it back and Redo makes it again (`form.undo()`, `form.redo()`). */
export interface HistoryStep {
  /** The field it changed: a table's own for a change to its lines. */
  readonly field: string;
  /** The line of a table it changed, by its key: a cell typed in, a line added or taken away. None for a line moved. */
  readonly line?: string;
}

/**
 * A record's changes as the person makes them, kept by the form from the first in the order made (form.ts): each field
 * written, cell typed in, line added, taken away or moved — `[field, line, before, after, joins]`, `joins` typing that
 * goes on in the same box — and a box left, `[field]`. A step's, a rule's or the app's writes are never one; another
 * record shown, or the form started again, starts a list of its own. The undo part takes them as they come
 * (history-steps.ts) and walks them for Undo and Redo.
 */
export type Noted = [field: string, line?: string, before?: Value, after?: Value, joins?: boolean];
