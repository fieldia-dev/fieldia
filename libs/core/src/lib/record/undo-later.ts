import { lazyPart, type Part } from '../parts';
import type * as UndoModule from './undo-part';

/** The undo part: Undo and Redo through a record's changes (history-steps.ts), and a one-tap press said with Undo and taken back (press-undo.ts). */
export type PressUndoPart = typeof UndoModule;

/**
 * Undo, loaded as a person first changes a record (Ctrl+Z walks the changes), with a page whose buttons offer it, or as
 * an answer first brings one.
 */
export const pressUndoPart: Part<PressUndoPart> = lazyPart('undo', () => import('./undo-part'));
