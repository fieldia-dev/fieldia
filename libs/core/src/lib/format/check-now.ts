import { wholeCheck } from './check-whole';
import type { PageValidation } from './references';
import type { PageCheckOptions } from './check-page';

/**
 * Whether the whole check comes in a part a viewer waits for (`pageCheckPart`): in the one-tag script, where it is
 * `fieldia.check.js`, asked for as the script starts (tools/script-bundle.mjs stands this file in so); never in an app's
 * bundle, where it is in with the viewer.
 */
export const WHOLE_CHECK_APART: boolean = false;

/**
 * The whole check of a page (check-whole.ts: `validatePage`'s verdict without the validation library) as a viewer runs
 * it before a page's first draw (0.37) — its checks a part carries owed until they are in, as the check before the draw
 * owes them — or null where it has not come yet: in the one-tag script, until its part has (`WHOLE_CHECK_APART`).
 */
export function wholeCheckNow(given: unknown, options: PageCheckOptions = {}): PageValidation | null {
  return wholeCheck(given, options);
}
