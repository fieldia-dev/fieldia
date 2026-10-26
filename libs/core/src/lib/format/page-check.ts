import { lazyPart, type Part } from '../parts';
import { deprecated } from '../deprecations';
import type { PageIssue, PageValidation } from './references';
import type { PageCheckOptions } from './check-page';
import type * as CheckPart from './check-part';

/** The whole check's part: `wholeCheck` (check-whole.ts). */
export type PageCheckPart = typeof CheckPart;

/**
 * The whole check of a page in a part of its own (`fieldia.check.js` in the one-tag script, a chunk of its own in an
 * app's bundle): fetched after a page's first draw, never before it (0.36), or by `checkPageWhole`.
 */
export const pageCheckPart: Part<PageCheckPart> = lazyPart('check', () => import('./check-part'));

/**
 * `validatePage`'s verdict without the validation library (the whole check, shape-parity.spec.ts holds the two to one):
 * the page's whole shape, every name and condition, its settings held to themselves — its part fetched the first time.
 * `checkPage` is the check before the draw, as 0.35's viewer checked a page.
 */
export async function checkPageWhole(given: unknown, options: PageCheckOptions = {}): Promise<PageValidation> {
  return (await pageCheckPart.load()).wholeCheck(given, options);
}

/** A page drawn whose whole check found mistakes, as the viewer tells `onError` (`stage: "check"`, a warning). */
export type PageInvalid = Error & { issues: PageIssue[] };

/** The most of a page's mistakes the console's warning lists: every one is on the error `onError` hears. */
const SAID = 10;

/**
 * A page drawn that the whole check refuses (0.36): what `validatePage` refuses and 0.35's viewer drew — a list's
 * `pageSize` past 500, a key the format does not have, its least more than its most, a first value outside its
 * choices — said once in the page's console (`page.invalid`), refused from 0.37; and handed back as the error the
 * viewer tells `onError`, each problem on it by its path.
 */
export function pageInvalid(issues: readonly PageIssue[]): PageInvalid {
  const listed = issues.map((issue) => `${issue.path}: ${issue.message}`);
  const said = `${listed.slice(0, SAID).join('; ')}${listed.length > SAID ? `; and ${listed.length - SAID} more` : ''}`;
  deprecated('page.invalid', `a page drawn has mistakes validatePage refuses (${said}) — drawn as 0.35 drew it`, '0.37');
  return Object.assign(new Error(`This page has mistakes validatePage refuses: drawn in 0.36, refused from 0.37.\n${listed.map((line) => `  ${line}`).join('\n')}`), { issues: [...issues] });
}
