import { fill, type Form, type Page } from '@fieldia/core';
import type { El } from './dom';
import type { ViewerLabels } from './labels';

/** The inputs nothing is typed in: a tick, a choice, a file or a colour picker has no typing of its own to take back. */
const NOT_TYPED = new Set(['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image', 'color', 'range', 'hidden']);
const editable = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && !NOT_TYPED.has((target as HTMLInputElement).type)) || target.isContentEditable);
const textOf = (box: HTMLElement) => (box.isContentEditable ? box.innerHTML : (box as HTMLInputElement).value);

/**
 * Ctrl+Z (⌘Z) takes back the person's last change to the record — a field, a cell, a line added, taken away or moved
 * (`form.undo()`) — and Ctrl+Shift+Z or Ctrl+Y (⌘⇧Z) makes it again. In a box whose text was changed since it was
 * entered, the browser's own undo goes through it first; once the box shows what it showed as it was entered, the
 * record's. In a formatted text, always its own. The field taken back takes the focus, and what was done is said
 * politely. Right after a save, nothing is taken back — a change saved is none to take back — and
 * Ctrl+Z says so ("Nothing to undo since it was saved."). In the undo part: the viewer asks for it as the person first enters the form, so the box they are in is
 * known as it was entered before they type — and a key's answer, the browser's own undo or the record's, is given at
 * once, as it is pressed. Gives back what takes the keys away again.
 */
export function undoKeys(
  root: HTMLElement,
  form: Form,
  page: Page,
  el: El,
  labels: ViewerLabels,
  /** Whether a key pressed on this target is this form's: not a dialog's over it, nor another form's. */
  hotkeysHere: (target: EventTarget | null) => boolean,
  /** Words shown and said to the person, as a step's are. */
  say: (words: string) => void
): () => void {
  const doc = root.ownerDocument;
  /** What a box showed as it was entered, and the browser's own undos in it since its last typing: what its redo has. */
  const boxEdits = new WeakMap<EventTarget, { text: string; undone: number }>();
  const entered = (box: EventTarget | null) => {
    if (editable(box) && root.contains(box)) boxEdits.set(box, { text: textOf(box), undone: 0 });
  };
  // Once its own focus has written it (a value shown at rest, written for typing as it is entered).
  const onEntered = (event: Event) => queueMicrotask(() => entered(event.target));
  const onEdited = (event: Event) => {
    const edits = boxEdits.get(event.target as EventTarget);
    const how = (event as InputEvent).inputType ?? '';
    if (edits) edits.undone = how === 'historyUndo' ? edits.undone + 1 : how === 'historyRedo' ? Math.max(0, edits.undone - 1) : 0;
  };
  let heard: HTMLElement | null = null;
  const onUndoKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    const redo = key === 'y' ? !event.shiftKey && !event.metaKey : key === 'z' && event.shiftKey;
    if (!redo && (key !== 'z' || event.shiftKey)) return;
    const target = event.target as Element;
    // An app's own content in a slot keeps its keys, and so do its own boxes outside the form and a form inside this one
    // (a dialog's); pressed on nothing, the keys are the first form's on the page, as a button's key is.
    if ((editable(target) && !root.contains(target)) || target.closest('.fd-slot') || !hotkeysHere(target)) return;
    // A formatted text keeps its own undo: its tools (a table's rows, a header row) change it as typing does, and the
    // browser's history holds both, across leaving it for a menu and coming back.
    if (editable(target) && target.isContentEditable) return;
    // A box whose text is not what it showed as it was entered: the browser's own undo has typing to take back there;
    // its own redo, its undos since.
    const edits = editable(target) ? boxEdits.get(target) : undefined;
    if (edits && (redo ? edits.undone > 0 : textOf(target as HTMLElement) !== edits.text)) return;
    const step = redo ? form.redo() : form.undo();
    if (!step) {
      // Saved, nothing changed since (a save starts the changes afresh): said, so a key pressed is never met with silence.
      const state = form.getState();
      if (!redo && state.status === 'saved' && !state.dirty.length) {
        event.preventDefault();
        say(labels.nothingSinceSave);
      }
      return;
    }
    event.preventDefault();
    const name = page.fields[step.field]?.label ?? step.field;
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
    // What the record's undo wrote in the box the person is in is what it shows as entered: the next Ctrl+Z is the record's too.
    queueMicrotask(() => entered(doc.activeElement));
  };
  // The box the person entered as the part was asked for: as it shows now, before they type.
  entered(doc.activeElement);
  root.addEventListener('focusin', onEntered, true);
  root.addEventListener('input', onEdited, true);
  doc.addEventListener('keydown', onUndoKey);
  return () => {
    root.removeEventListener('focusin', onEntered, true);
    root.removeEventListener('input', onEdited, true);
    doc.removeEventListener('keydown', onUndoKey);
  };
}
