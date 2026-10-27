import { lazyPart, type Part } from '../parts';
import { LATER_CHECKS } from './later-checks';
import type * as FormatChecksModule from './format-checks-part';

/**
 * Every check of a page that comes with a part (owed-checks.ts) — a list's settings, a map's, a page's limits … — in a
 * chunk of an app's bundle of its own, put in as it comes: what a viewer asks for where its page's check owes one,
 * beside the parts that page draws from, and runs its check again once it came (perf-leftovers' item 5, 0.37). A record
 * that has none of them never fetches it. Null in the one-tag script, whose parts each bring their own
 * (tools/script-bundle.mjs).
 */
export const formatChecksPart: Part<typeof FormatChecksModule> | null = lazyPart('formatchecks', () =>
  import('./format-checks-part').then((module) => {
    for (const [part, checks] of Object.entries(module.ALL_CHECKS)) LATER_CHECKS[part] ??= checks;
    return module;
  })
);
