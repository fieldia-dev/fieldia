import { lazyPart, type Part } from '../parts';
import { deprecated } from '../deprecations';
import type { PageIssue, PageValidation } from './references';
import type { PageCheckOptions } from './check-page';
import type * as CheckPart from './check-part';

/** The whole check's part: `wholeCheck` (check-whole.ts). */
export type PageCheckPart = typeof CheckPart;

/**
 * The whole check of a page in a part of its own: `fieldia.check.js` in the one-tag script, asked for as the script
 * starts — beside the page's own data and parts, never after them — which a viewer waits for before a page's first draw,
 * as for the page's parts (0.37); in an app's bundle a chunk `checkPageWhole` fetches (its viewer carries the whole check
 * itself: check-now.ts).
 */
export const pageCheckPart: Part<PageCheckPart> = lazyPart('check', () => import('./check-part'));

/**
 * `validatePage`'s verdict without the validation library (the whole check, shape-parity.spec.ts holds the two to one):
 * the page's whole shape, every name and condition, its settings held to themselves — its part fetched the first time.
 * The check every viewer runs before a page's first draw (0.37). `checkPage` is the part of it 0.35's viewer ran.
 */
export async function checkPageWhole(given: unknown, options: PageCheckOptions = {}): Promise<PageValidation> {
  return (await pageCheckPart.load()).wholeCheck(given, options);
}

/** 0.36's error for a page drawn whose whole check found mistakes, as its viewer told `onError` as a warning. */
export type PageInvalid = Error & { issues: PageIssue[] };

/**
 * 0.36's error for a page drawn that the whole check refuses, which its viewer told `onError` as a warning. A 0.37
 * viewer refuses such a page before it is drawn, and tells `onError` a `PageRefused` (`stage: "check"`, @fieldia/viewer):
 * nothing in Fieldia makes this error any more. Deprecated in 0.37, gone in 0.38 (`core.page-invalid`).
 */
export function pageInvalid(issues: readonly PageIssue[]): PageInvalid {
  deprecated('core.page-invalid', 'pageInvalid() is 0.36\'s: a viewer refuses such a page, telling onError a PageRefused', '0.38');
  const listed = issues.map((issue) => `${issue.path}: ${issue.message}`);
  return Object.assign(new Error(`This page has mistakes validatePage refuses.\n${listed.map((line) => `  ${line}`).join('\n')}`), { issues: [...issues] });
}
