/**
 * The undo part's viewer half (the core's beside it: a record's changes walked, a press taken back): Ctrl+Z and
 * Ctrl+Shift+Z through a record's changes (undo-keys.ts), asked for as the person first enters a form; and a press's
 * words with Undo (undo-toast.ts), brought by the press that offers it.
 */
export { undoKeys } from './undo-keys';
export { undoToast } from './undo-toast';
