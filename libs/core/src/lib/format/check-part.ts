import { wholeCheck as owingCheck } from './check-whole';
import { wholeChecks } from './all-checks';
import type { PageValidation } from './references';
import type { PageCheckOptions } from './check-page';

/**
 * The whole check of a page (check-whole.ts) — the format's schema and its rules, read without the validation library,
 * and the settings held to themselves — in a part of its own: what `checkPageWhole` fetches; and in the one-tag script
 * `fieldia.check.js`, asked for as the script starts, which a viewer waits for before a page's first draw (0.37). Whole
 * at once: every check a part carries put in first (all-checks.ts) — but in the one-tag script, where each comes with
 * its part and is owed until it has.
 */
export function wholeCheck(given: unknown, options: PageCheckOptions & { shape?: false } = {}): PageValidation {
  wholeChecks();
  return owingCheck(given, options);
}
// A page stamped with the lowest format its settings need, read from the same schema: where pages are saved (the
// designer's publish), fetched with it rather than carried before a first paint.
export { lowestFormat, stampPage } from './stamp';
