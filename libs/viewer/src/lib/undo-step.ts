import { fill, type Form, type Page } from '@fieldia/core';
import type { El } from './dom';
import type { ViewerLabels } from './labels';

/**
 * The record's Undo (Ctrl+Z, ⌘Z) or Redo (Ctrl+Shift+Z, Ctrl+Y, ⌘⇧Z) for a key the form heard as the record's
 * (undo-keys.ts), in the undo part: the person's last change taken back or made again (`form.undo()`, `form.redo()`),
 * the field it was in taking the focus where it is shown and the person is not in it, and what was done said politely.
 * Right after a save, nothing is taken back — a change saved is none to take back — and Ctrl+Z says so ("Nothing to
 * undo since it was saved."). Whether the key was answered: when it was not, it is the browser's own.
 */
export function undoStep(
  root: HTMLElement,
  form: Form,
  page: Page,
  el: El,
  labels: ViewerLabels,
  /** Words shown and said to the person, as a step's are. */
  say: (words: string) => void,
  redo: boolean
): boolean {
  const doc = root.ownerDocument;
  const step = redo ? form.redo() : form.undo();
  if (!step) {
    // Saved, nothing changed since (a save starts the changes afresh): said, so a key pressed is never met with silence.
    const state = form.getState();
    if (redo || state.status !== 'saved' || state.dirty.length) return false;
    say(labels.nothingSinceSave);
    return true;
  }
  const name = page.fields[step.field]?.label ?? step.field;
  let heard = root.querySelector<HTMLElement>(':scope > .fd-undo-heard');
  if (!heard) root.append((heard = el('div', { class: 'fd-sr-only fd-undo-heard', role: 'status', 'aria-live': 'polite' })));
  const words = fill(redo ? labels.redoneField : labels.undoneField, { field: name });
  heard.textContent = '';
  setTimeout(() => heard && (heard.textContent = words), 0);
  // The field taken back takes the focus, where it is shown and is not the one the person is in.
  const box = [...root.querySelectorAll<HTMLElement>(`.fd-field[data-field="${step.field}"]`)]
    .filter((wrapper) => !wrapper.closest('[hidden]') && wrapper.closest('.fd-form') === root)
    .flatMap((wrapper) => [...wrapper.querySelectorAll<HTMLElement>('input:not([type="hidden"]), select, textarea, [contenteditable="true"]')])
    .find((one) => !one.closest('[hidden]'));
  if (box && !box.contains(doc.activeElement)) box.focus();
  return true;
}
