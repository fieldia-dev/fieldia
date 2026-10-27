import type { Form } from '@fieldia/core';

/** A box's own undo and redo, by the input they send. */
const OWN: Record<string, 'undo' | 'redo'> = { historyUndo: 'undo', historyRedo: 'redo' };

/**
 * What a box's own undo and redo write — the browser's, through the person's typing there (an input's `historyUndo`,
 * `historyRedo`) — told to the record (`form.boxHistory`) before the box's widget writes it, and no longer once it has:
 * the record's Redo makes again what the box's own undo took back, once the box is left too. The browser's own redo
 * cannot then, the box having written its text again since (a number grouped as it is left), and the keys are the
 * record's there (undo-keys.ts). Heard in the undo part, as the person first enters the form. Gives back what stops it.
 */
export function boxHistory(root: HTMLElement, form: Form): () => void {
  const heard = (event: Event) => form.boxHistory(OWN[(event as InputEvent).inputType] ?? null);
  const written = () => form.boxHistory(null);
  root.addEventListener('input', heard, true);
  root.addEventListener('input', written);
  return () => {
    root.removeEventListener('input', heard, true);
    root.removeEventListener('input', written);
  };
}
