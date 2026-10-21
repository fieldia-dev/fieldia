/**
 * The undo part (parts.ts): a one-tap press that offers Undo (a button's or a menu item's `undo`, or the app answering
 * with one) said with Undo once it ends, and taken back when it is pressed (press-undo.ts). Loaded through
 * `pressUndoPart` (undo-later.ts) with a page whose buttons offer it, else the first time an answer brings one.
 */
export { offerUndo, takeBack } from './press-undo';
