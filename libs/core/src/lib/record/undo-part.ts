/**
 * The undo part (parts.ts): Undo and Redo walking a record's changes as the form keeps them (history-steps.ts), asked
 * for as the first is kept; and a one-tap press that offers Undo (a button's or a menu item's `undo`, or the app
 * answering with one) said with Undo once it ends, and taken back when it is pressed (press-undo.ts). Loaded through
 * `pressUndoPart` (undo-later.ts).
 */
export { offerUndo, takeBack } from './press-undo';
export { nextSteps, takeNoted, takeStep } from './history-steps';
