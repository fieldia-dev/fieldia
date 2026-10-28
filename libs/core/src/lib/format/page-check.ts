import { lazyPart, type Part } from '../parts';
import { deprecated } from '../deprecations';
import type { PageIssue, PageValidation } from './references';
import type { PageCheckOptions } from './check-page';
import type * as CheckPart from './check-part';

/** The whole check's part: `wholeCheck` (check-whole.ts). */
export type PageCheckPart = typeof CheckPart;

/**
 * The whole check of a page in a part of its own (`fieldia.check.js` in the one-tag script, a chunk of its own in an app's
 * bundle): asked for as soon as nothing a page is drawn from is still on its way (`askForCheck`), run as soon as the
 * page is drawn, never delaying the draw — a page it refuses taken down, every write through the page held until it has
 * run (0.37) — or by `checkPageWhole`.
 */
export const pageCheckPart: Part<PageCheckPart> = lazyPart('check', () => import('./check-part'));

/** The pages drawing from parts still on their way: until they are drawn, the whole check's part is not asked for. */
let drawing = 0;
/** Whether it was asked for, once nothing held it back. */
let asked = false;
/**
 * Ask for the whole check's part as soon as it takes nothing from a page's first draw: at once where no page is waiting
 * for the parts it is drawn from, else once each such page is drawn (`until`) — on a slow line its bytes would share the
 * line with theirs: measured on Slow 4G, a page of parts drew 0.09–0.10 s later with it asked for beside them (0.37). The
 * one-tag script asks a task after it starts, so a page mounted at once says first what it waits for; a page mounted
 * later (once its own data came) meets the part in, or on its way.
 */
export function askForCheck(until?: Promise<unknown>): void {
  if (until) {
    drawing++;
    const done = () => {
      drawing--;
      askForCheck();
    };
    until.then(done, done);
    return;
  }
  if (drawing || asked) return;
  asked = true;
  void pageCheckPart.load().then(
    () => undefined,
    // Forgotten as the part is (parts.ts): asked for anew by the next page, or by a write that waits for it.
    () => void (asked = false)
  );
}

/**
 * `validatePage`'s verdict without the validation library (the whole check, shape-parity.spec.ts holds the two to one):
 * the page's whole shape, every name and condition, its settings held to themselves — its part fetched the first time.
 * The check every viewer runs as soon as a page is drawn (0.37). `checkPage` is the part of it 0.35's viewer ran.
 */
export async function checkPageWhole(given: unknown, options: PageCheckOptions = {}): Promise<PageValidation> {
  return (await pageCheckPart.load()).wholeCheck(given, options);
}

/** 0.36's error for a page drawn whose whole check found mistakes, as its viewer told `onError` as a warning. */
export type PageInvalid = Error & { issues: PageIssue[] };

/**
 * 0.36's error for a page drawn that the whole check refuses, which its viewer told `onError` as a warning. A 0.37
 * viewer takes such a page down, and tells `onError` a `PageRefused` (`stage: "check"`, @fieldia/viewer):
 * nothing in Fieldia makes this error any more. Deprecated in 0.37, gone in 0.38 (`core.page-invalid`).
 */
export function pageInvalid(issues: readonly PageIssue[]): PageInvalid {
  deprecated('core.page-invalid', 'pageInvalid() is 0.36\'s: a viewer refuses such a page, telling onError a PageRefused', '0.38');
  const listed = issues.map((issue) => `${issue.path}: ${issue.message}`);
  return Object.assign(new Error(`This page has mistakes validatePage refuses.\n${listed.map((line) => `  ${line}`).join('\n')}`), { issues: [...issues] });
}
