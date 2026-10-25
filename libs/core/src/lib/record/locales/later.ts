import type { Messages } from '../messages';

/**
 * The validation messages in every language besides English — Arabic, German and French, and Turkish, Persian, Urdu and Spanish
 * (these four machine-assisted, not yet reviewed by a native speaker) — each in a chunk of its own, fetched where it is
 * spoken (`wordsReady` in @fieldia/core): an app never carries the words of a language it does not show, and what draws
 * in one (`mountViewer`) waits for them first, so its first paint is in it. The one-tag script builds this module as an
 * empty one: its languages are its add-on scripts (tools/script-bundle.mjs).
 */
export const LATER: Record<string, () => Promise<Messages>> = {
  ar: () => import('./ar').then((words) => words.ar),
  de: () => import('./de').then((words) => words.de),
  fr: () => import('./fr').then((words) => words.fr),
  tr: () => import('./tr').then((words) => words.tr),
  fa: () => import('./fa').then((words) => words.fa),
  ur: () => import('./ur').then((words) => words.ur),
  es: () => import('./es').then((words) => words.es),
};
