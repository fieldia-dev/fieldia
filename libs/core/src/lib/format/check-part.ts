/**
 * The whole check of a page (check-whole.ts) — the format's schema and its rules, read without the validation library,
 * and the settings held to themselves — in a part of its own: what `checkPageWhole` fetches, and every viewer as a page is
 * mounted, running it as soon as the page is drawn (page-check.ts); the one-tag script asks for it as it starts. None
 * waits for it to be drawn.
 */
export { wholeCheck } from './check-whole';
// A page stamped with the lowest format its settings need, read from the same schema: where pages are saved (the
// designer's publish), fetched with it rather than carried before a first paint.
export { lowestFormat, stampPage } from './stamp';
