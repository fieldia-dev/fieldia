/**
 * The acts part's form code (parts.ts): the engine that runs a page's steps — a button's, a moment's, the app's own
 * (run-steps.ts) — and a save over someone else's answered (conflict-choice.ts), which no page draws from. Loaded
 * through `formActsPart` (acts-later.ts), as the viewer's half of the part is: once a page is drawn and its whole check
 * has come, or by the first press, moment or answer that needs it.
 */
export { createRunner } from './run-steps';
export { keepMine, putBack, reloadTheirs } from './conflict-choice';
