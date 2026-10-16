/**
 * The choice part (parts.ts): a choice in Fieldia's own list (`options.list:
 * "own"` on a selection) — a box showing the value, a list with a tick by the
 * option picked — and its stylesheet; a long choice's box that searches its
 * options as they are typed (`options.search`, or more than 15 options), and
 * several answers chosen as tags (`selection.tags`), from choice-tags.ts.
 * Loaded the first time a page shows one, through `choicePart`; the browser's
 * own list meanwhile, and the tags' words.
 */
export { ownListWidget } from './own-list';
export { choiceTagsWidget, searchWidget } from './choice-tags';
