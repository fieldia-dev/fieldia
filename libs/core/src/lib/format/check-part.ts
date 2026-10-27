/**
 * The whole check of a page (check-whole.ts) — the format's schema and its rules, read without the validation library,
 * and the settings held to themselves — in a part of its own: what `checkPageWhole` fetches, and the viewer after a
 * page's first draw (page-check.ts). Every page drawn asks for it then; none waits for it to be drawn (0.36). From 0.37,
 * which refuses what it finds, it is to be asked for as the script starts, beside the page's own parts.
 */
export { wholeCheck } from './check-whole';
// A page stamped with the lowest format its settings need, read from the same schema: where pages are saved (the
// designer's publish), fetched with it rather than carried before a first paint.
export { lowestFormat, stampPage } from './stamp';
