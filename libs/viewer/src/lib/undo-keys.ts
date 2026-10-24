/** The inputs nothing is typed in: a tick, a choice, a file or a colour picker has no typing of its own to take back. */
const NOT_TYPED = new Set(['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image', 'color', 'range', 'hidden']);
const editable = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement && (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && !NOT_TYPED.has((target as HTMLInputElement).type)) || target.isContentEditable);
const textOf = (box: HTMLElement) => (box.isContentEditable ? box.innerHTML : (box as HTMLInputElement).value);

/**
 * Ctrl+Z (⌘Z) and Ctrl+Shift+Z or Ctrl+Y (⌘⇧Z) while filling, heard from the person's first entering the form (in the
 * main script, so no key waits for a part to decide whose it is). In a box whose
 * text was changed since it was entered, the browser's own undo goes through it first, and its own redo through its
 * undos since; in a formatted text, always its own. Every other is the record's, given to `take` — the undo part's
 * step (undo-step.ts), which says whether it answered it: answered, the browser's own undo is kept out of it. A key
 * pressed before that part has come is the record's all the same, its step taken as the part comes (`take` answers
 * true): never meanwhile the browser's, which takes back the last typing anywhere on the page, in another box. Each
 * box is known as it showed when it was entered, from the first: the decision is made at once, as the key is pressed.
 * `written` is called once the record's step has written the field: what the box the person is in shows then is what
 * it shows as entered, so the next Ctrl+Z is the record's too. Gives back what takes the keys away again.
 */
export function undoKeys(
  root: HTMLElement,
  /** Whether a key pressed on this target is this form's: not a dialog's over it, nor another form's. */
  hotkeysHere: (target: EventTarget | null) => boolean,
  take: (redo: boolean, written: () => void) => boolean
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
  const written = () => queueMicrotask(() => entered(doc.activeElement));
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
    if (take(redo, written)) event.preventDefault();
  };
  // The box the person is entering as the keys are first heard: as its own focus has written it, before they type.
  queueMicrotask(() => entered(doc.activeElement));
  root.addEventListener('focusin', onEntered, true);
  root.addEventListener('input', onEdited, true);
  doc.addEventListener('keydown', onUndoKey);
  return () => {
    root.removeEventListener('focusin', onEntered, true);
    root.removeEventListener('input', onEdited, true);
    doc.removeEventListener('keydown', onUndoKey);
  };
}
