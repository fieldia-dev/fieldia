import type { ViewerLabels } from '../labels';

/**
 * The viewer's words in Turkish, Persian, Urdu and Spanish — machine-assisted, not yet reviewed by a native
 * speaker — each in a chunk of its own, fetched where it is spoken (`wordsReady` in @fieldia/core): an app never carries
 * the words of a language it does not show. The one-tag script builds this module as an empty one: its languages are
 * its add-on scripts (tools/script-bundle.mjs).
 */
export const LATER: Record<string, () => Promise<ViewerLabels>> = {
  tr: () => import('./tr').then((words) => words.tr),
  fa: () => import('./fa').then((words) => words.fa),
  ur: () => import('./ur').then((words) => words.ur),
  es: () => import('./es').then((words) => words.es),
};
