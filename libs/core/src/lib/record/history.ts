import type { Value } from './values';

/** A change a person made to a record, as Undo takes it back and Redo makes it again (`form.undo()`, `form.redo()`). */
export interface HistoryStep {
  /** The field it changed: a table's own for a change to its lines. */
  readonly field: string;
  /** The line of a table it changed, by its key: a cell typed in, a line added or taken away. None for a line moved. */
  readonly line?: string;
}

/** A change kept: what the field held before it and after it, and whether more typing in the same box joins it. */
interface Kept extends HistoryStep {
  before: Value;
  after: Value;
  open: boolean;
}

/** The most changes kept to take back: the oldest give way. */
const MOST = 100;

/**
 * A record's changes, a person's alone, as Undo and Redo walk them: each field written, each cell typed in, each line
 * added, taken away or moved. Typing on in the same box is one change until the box is left (`close`); a step's, a
 * rule's or the app's writes are never one. Another record shown, or the form started again, keeps none. `same` says
 * whether two values of a field are one: a change typed back to where it started is none.
 */
export function createHistory(same: (field: string, one: Value, other: Value) => boolean) {
  let done: Kept[] = [];
  let undone: Kept[] = [];
  return {
    /** A person's change, as it was written: `joins`, typing that goes on in the box of the last change joins it. */
    note(step: HistoryStep, before: Value, after: Value, joins: boolean) {
      const last = done[done.length - 1];
      if (joins && last?.open && last.field === step.field && last.line === step.line) {
        last.after = after;
        undone = [];
        return;
      }
      if (same(step.field, before, after)) return;
      undone = [];
      if (last) last.open = false;
      done.push({ ...step, before, after, open: joins });
      if (done.length > MOST) done = done.slice(-MOST);
    },
    /** A field's box left: typing in it again is a change of its own. */
    close(field: string) {
      const last = done[done.length - 1];
      if (last?.field === field) last.open = false;
    },
    /**
     * The change to take back (`back`) or make again: the latest still standing (`stands`: its field holds what it
     * `left` there, and may be changed) — one whose field holds something else since (a step, the app, someone else's
     * save laid over it), or is locked now, is let go — moved to the other side. Null when none is left.
     */
    take(back: boolean, stands: (step: HistoryStep, left: Value) => boolean): (HistoryStep & { value: Value }) | null {
      const from = back ? done : undone;
      for (let kept = from.pop(); kept; kept = from.pop()) {
        kept.open = false;
        if (same(kept.field, kept.before, kept.after) || !stands(kept, back ? kept.after : kept.before)) continue;
        (back ? undone : done).push(kept);
        return { field: kept.field, ...(kept.line !== undefined ? { line: kept.line } : {}), value: back ? kept.before : kept.after };
      }
      return null;
    },
    /** The change Undo and Redo would take, each the latest kept: what a button or a menu names. */
    next(): { undo: HistoryStep | null; redo: HistoryStep | null } {
      const step = (kept: Kept | undefined): HistoryStep | null => (kept ? { field: kept.field, ...(kept.line !== undefined ? { line: kept.line } : {}) } : null);
      return { undo: step(done[done.length - 1]), redo: step(undone[undone.length - 1]) };
    },
    clear() {
      done = [];
      undone = [];
    },
  };
}
