import { lazyPart, type Part } from '../parts';
import type * as ActsModule from './acts-part';

/** The acts part's form code: the engine that runs a page's steps (run-steps.ts). */
export type FormActsPart = typeof ActsModule;

/**
 * A page's steps run — a button's, a moment's, the app's (`form.run`) — loaded once the page is drawn and its whole check
 * has come (page-check.ts), or as the first run asks for it, which waits for it: a press meanwhile keeps its button busy.
 * In the one-tag script one script with the viewer's half (fieldia.acts.js): its dialogs, a page opened, its questions.
 */
export const formActsPart: Part<FormActsPart> = lazyPart('acts', () => import('./acts-part'));
