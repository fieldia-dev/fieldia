import type { PageValidation } from './references';
import { checkPageOwing, type PageCheckOptions } from './check-before';
import { wholeChecks } from './all-checks';

// What every check reads first, and the check a viewer runs before the draw: check-before.ts, kept apart from the checks a
// part carries, which `checkPage` puts in (an app's first paint carries none of them).
export { checkPageOwing, pageOutline, pageReferences, type PageCheckOptions } from './check-before';

/**
 * The check a page gets before it is drawn, as 0.35's viewer refused a page: its outline, then every name and condition
 * in it, the same as `validatePage` finds them (its warnings — a value of a kind a function does not take — are said
 * where pages are made, and stop nothing). It leaves out the key-by-key check of the format and the settings held to
 * themselves: the whole check (`checkPageWhole`, check-whole.ts), which gives `validatePage`'s verdict and which every
 * viewer runs before the first draw too (0.37), refusing what it finds. Run `validatePage` where pages are made or
 * tested. A page that passes is handed back as it is — one in an older format, brought up to date (`upgradePage`). A
 * line's own form — a page of a table's line fields — is checked with `parent`, the fields of the record the line is on,
 * which its conditions read as `parent`; `functions`, the app's own, which its expressions may call besides Fieldia's.
 *
 * Whole at once: the checks of what a part draws (a list's settings, a map's: owed-checks.ts) run too — but in the
 * one-tag script, which owes those until each part has come (`later`).
 */
export function checkPage(given: unknown, options: PageCheckOptions = {}): PageValidation {
  wholeChecks();
  return checkPageOwing(given, options);
}
