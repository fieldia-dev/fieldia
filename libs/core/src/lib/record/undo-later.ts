import { lazyPart, type Part } from '../parts';
import type * as UndoModule from './undo-part';

/** The undo part: a one-tap press said with Undo, and taken back (press-undo.ts). */
export type PressUndoPart = typeof UndoModule;

/** A press said with Undo and taken back, loaded with a page whose buttons offer it, else as an answer first brings one. */
export const pressUndoPart: Part<PressUndoPart> = lazyPart('undo', () => import('./undo-part'));
