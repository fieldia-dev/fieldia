/**
 * The acts part's form code (parts.ts): the engine that runs a page's steps — a button's, a moment's, the app's own
 * (run-steps.ts) — which no page draws from. Loaded through `formActsPart` (acts-later.ts), as the viewer's half of the
 * part is: once a page is drawn and its whole check has come, or by the first press or moment that runs steps.
 */
export { createRunner } from './run-steps';
