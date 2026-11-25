import type { Fields } from '../format/field';
import type { Page } from '../format/page';
import type { DataSource } from './data-source';
import type { FormState } from './form';
import { loadedRecordOf } from './data-source';
import { valuesFromSource } from './from-source';
import type { Messages } from './messages';
import { structuredCopy, type RecordId, type Value, type Values } from './values';

/**
 * A save over someone else's, answered (the acts part's, as the banners that ask are): Reload — their version shown,
 * this person's changes set aside to put back — Keep mine — saved over theirs — and Put back. The form's own
 * (`form.reloadTheirs`, `form.keepMine`, `form.putBack`), reached through what it gives them here.
 */

/** What a conflict's choice reaches its form by (form.ts gives it). */
export interface ConflictKit {
  state(): FormState;
  set(patch: Partial<FormState>): void;
  readonly fields: Fields;
  readonly page: Page;
  readonly messages: Messages;
  source(): DataSource | undefined;
  /** Whether the record shown as it was asked is shown still (form.ts `shownNow`). */
  shownNow(): () => boolean;
  /** The saves on their way, settled. */
  savesSettled(): Promise<void>;
  /** What is still typed read, a name looked up waited for; null with nothing to wait for. */
  readTyped(): Promise<void> | null;
  load(again: boolean): Promise<void>;
  generation(): number;
  track<T>(promise: Promise<T>): Promise<T>;
  /** Two values of a field the same: a link by the record it points to (form.ts `sameValue`). */
  same(name: string, a: unknown, b: unknown): boolean;
  /** Whether a path's cell is there still (its line not gone). */
  kept(path: string): boolean;
  /** Their version as the record's saved values, under this person's changes. */
  rebase(theirs: Values): void;
  writeValues(values: Values): void;
  save(): Promise<boolean>;
  setValue(name: string, value: Value): void;
}

export async function reloadTheirs(k: ConflictKit): Promise<boolean> {
  // A save on its way first: its answer is not dropped by the load.
  const asked = k.shownNow();
  await k.savesSettled();
  if (!asked()) return false;
  // What is still typed is the person's too: read, a name looked up waited for, before theirs are loaded.
  const waiting = k.readTyped();
  if (waiting) await waiting;
  if (!asked()) return false;
  // The person's changes, kept before theirs are loaded over them; and text they left that does not read.
  const mine: Values = {};
  for (const name of k.state().dirty) mine[name] = structuredCopy(k.state().values[name]) as Value;
  const typed = k.state().unread;
  // The record loaded again is a record shown anew: what is set aside is laid on it alone.
  const loading = k.load(true);
  const loaded = k.generation();
  await k.track(loading);
  if (loaded !== k.generation() || k.state().status !== 'ready') return false;
  // Set aside where theirs differ from mine: a change they made the same way is no loss.
  const aside: Values = { ...(k.state().setAside ?? {}) };
  for (const [name, value] of Object.entries(mine)) if (!k.same(name, value, k.state().values[name])) aside[name] = value;
  // Text that does not read is no value to set aside: it stays in its box, unread with why, over their value —
  // never dropped unsaid. A line of theirs no longer there takes its cells' text with it.
  const unread = Object.fromEntries(Object.entries(typed).filter(([path]) => k.kept(path)));
  k.set({ conflict: null, saveProblem: null, setAside: Object.keys(aside).length ? aside : null, ...(Object.keys(unread).length ? { unread } : {}) });
  return true;
}

export async function keepMine(k: ConflictKit): Promise<boolean> {
  const conflict = k.state().conflict;
  let told = conflict?.theirs;
  let version = conflict?.version;
  // Not told the record as they left it: read as it is now, so a source that saves whole records keeps their work.
  const source = k.source();
  if (conflict && !told) {
    if (source?.load && k.state().recordId != null && k.page.data.kind === 'record') {
      const shown = k.shownNow();
      try {
        const now = loadedRecordOf(await k.track(source.load({ model: k.page.data.model, id: k.state().recordId as RecordId, fields: k.fields })));
        told = valuesFromSource(k.fields, now.values).values;
        version = now.version ?? version;
      } catch {
        // Unread: said below.
      }
      // Read, or not, once another record is shown or the values let go: nothing is laid, nothing saved.
      if (!shown()) return false;
    }
    // Still unread: saving now would go over work this person never saw. Nothing is saved; they are told, and choose again.
    if (!told) {
      const message = k.messages.theirsUnread;
      k.set({ status: 'error', error: message, saveProblem: { kind: 'conflict', message, conflict: { version: conflict.version } }, conflict: { ...conflict, unread: true } });
      return false;
    }
  }
  if (told) {
    // The record as they left it is where this person's changes start from: theirs stay wherever they changed nothing.
    const theirs: Values = {};
    for (const [name, value] of Object.entries(told)) if (k.fields[name]) theirs[name] = structuredCopy(value) as Value;
    const mine = k.state().dirty;
    k.rebase(theirs);
    const values = { ...(k.state().values as Values) };
    for (const [name, value] of Object.entries(theirs)) if (!mine.includes(name)) values[name] = value;
    k.writeValues(values);
  }
  // Saved with the version it has now: these changes over the record as it is.
  if (version) k.set({ version });
  return k.track(k.save());
}

export function putBack(k: ConflictKit, field?: string): void {
  const aside = k.state().setAside;
  if (!aside) return;
  const names = field === undefined ? Object.keys(aside) : Object.prototype.hasOwnProperty.call(aside, field) ? [field] : [];
  if (!names.length) return;
  const left = { ...aside };
  for (const name of names) delete left[name];
  k.set({ setAside: Object.keys(left).length ? left : null });
  for (const name of names) k.setValue(name, aside[name] as Value);
}
