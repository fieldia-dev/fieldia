import type { HistoryStep, Noted } from './history';
import type { Value } from './values';

/**
 * Undo and Redo walking a record's changes as the form notes them (history.ts), in the undo part: asked for as the
 * first is noted, in by the time the person presses Ctrl+Z.
 */

/**
 * A change kept: what the field held before it and after it, and whether more typing in the same box joins it — taken
 * back, whether more of the box's own undos do.
 */
interface Kept extends HistoryStep {
  before: Value;
  after: Value;
  open: boolean;
}

/** Whether two values of a field are one: a change typed back to where it started is none. */
type Same = (field: string, one: Value, other: Value) => boolean;

/** The changes done and taken back of each list the form notes in, latest last. */
interface Steps {
  done: Kept[];
  undone: Kept[];
}
const walked = new WeakMap<Noted[], Steps>();

/** The most changes kept to take back: the oldest give way. */
const MOST = 100;

/**
 * The form's notes taken in as they come, and the list emptied: typing that goes on in the box of the last change joins
 * it, a change typed back to where it started is none, a box left closes its change. The box's own undo through that
 * typing (the browser's) takes it back as Undo would — what it took back made again by Redo, the box left or not, its
 * undos since its last typing one change as that typing is one — and its own redo makes that again. What Undo and Redo
 * walk.
 */
export function takeNoted(noted: Noted[], same: Same): Steps {
  let steps = walked.get(noted);
  if (!steps) walked.set(noted, (steps = { done: [], undone: [] }));
  for (const note of noted.splice(0)) {
    const [field, line, before = null, after = null, joins = false] = note;
    const last = steps.done[steps.done.length - 1];
    const back = steps.undone[steps.undone.length - 1];
    /** The change still being typed in this box, or its own undos since: the box's own undo and redo go through them. */
    const typing = (kept: Kept | undefined): kept is Kept => !!kept?.open && kept.field === field && kept.line === line;
    // A box left: typing in it again is a change of its own.
    if (note.length === 1) {
      if (last?.field === field) last.open = false;
    } else if (joins === 'undo' && typing(last)) {
      // Taken back by the box's own undo: kept to make again, from what the field holds now to what it held before.
      if (typing(back)) back.before = after;
      else steps.undone.push({ field, ...(line !== undefined ? { line } : {}), before: after, after: before, open: true });
      last.after = after;
    } else if (joins === 'redo' && typing(last) && typing(back)) {
      // Made again by its own redo, as far as it goes.
      if (same(field, after, back.after)) steps.undone.pop();
      else back.before = after;
      last.after = after;
    } else if (joins && typing(last)) {
      last.after = after;
      steps.undone = [];
    } else if (!same(field, before, after)) {
      steps.undone = [];
      if (last) last.open = false;
      steps.done.push({ field, ...(line !== undefined ? { line } : {}), before, after, open: !!joins });
      if (steps.done.length > MOST) steps.done.shift();
    }
  }
  return steps;
}

const stepOf = (kept: Kept | undefined): HistoryStep | null => (kept ? { field: kept.field, ...(kept.line !== undefined ? { line: kept.line } : {}) } : null);

/**
 * The change to take back (`back`) or make again: the latest still standing (`stands`: its field holds what it `left`
 * there, and may be changed) — one whose field holds something else since (a step, the app, someone else's save laid
 * over it), or is locked now, is let go — moved to the other side, with the value to write. Null when none is left.
 */
export function takeStep(noted: Noted[], same: Same, back: boolean, stands: (step: HistoryStep, left: Value) => boolean): (HistoryStep & { value: Value }) | null {
  const steps = takeNoted(noted, same);
  const from = back ? steps.done : steps.undone;
  for (let kept = from.pop(); kept; kept = from.pop()) {
    kept.open = false;
    if (same(kept.field, kept.before, kept.after) || !stands(kept, back ? kept.after : kept.before)) continue;
    (back ? steps.undone : steps.done).push(kept);
    return { ...(stepOf(kept) as HistoryStep), value: back ? kept.before : kept.after };
  }
  return null;
}

/** The changes Undo and Redo would take, each the latest kept: what a button or a menu names. */
export function nextSteps(noted: Noted[], same: Same): { undo: HistoryStep | null; redo: HistoryStep | null } {
  const steps = takeNoted(noted, same);
  return { undo: stepOf(steps.done[steps.done.length - 1]), redo: stepOf(steps.undone[steps.undone.length - 1]) };
}
