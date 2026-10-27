import type { Page } from './page';
import type { PageIssue, PageValidation } from './references';
import { pageOutline, pageReferences, type PageCheckOptions } from './check-page';
import { shapeCheck } from './shape-check';
import { PAGE_SHAPE } from './page-shape';
import { needOf, stampProblem } from './stamp';
import { SENSE } from './sense-checks';

/**
 * The whole check of a page, refusing what `validatePage` refuses without the validation library an app showing forms
 * need not carry: its outline, then its whole shape — every key and value against the format's schema and its rules
 * (shape-check.ts) — then every name and condition in it and its settings held to themselves (sense-checks.ts).
 * shape-parity.spec.ts holds it and `validatePage` to one verdict. And the page read by its stamp: one that says an
 * older format than a setting it uses came in is refused (stamp.ts; `format.under-stamped`, warned of in 0.36).
 *
 * Every viewer runs it before a page's first draw, and refuses what it finds (0.37; said and drawn in 0.36,
 * `page.invalid`): in an app's bundle at once (check-now.ts), in the one-tag script once its part has come
 * (`fieldia.check.js`, asked for as the script starts). As the check before the draw, it owes the checks a part carries
 * until they are in (`later`, owed-checks.ts); `checkPageWhole` puts them all in first (check-part.ts). `shape: false`
 * leaves the shape out, for a caller that checked it against the format's schemas itself.
 */
export function wholeCheck(given: unknown, options: PageCheckOptions & { shape?: false } = {}): PageValidation {
  const outline = pageOutline(given);
  if (!outline.page || outline.issues.length) return { ok: false, issues: outline.issues };
  const input = outline.page;
  let shaped: PageIssue[] = [];
  if (options.shape !== false) {
    const found = shapeCheck(input, PAGE_SHAPE);
    // Read by its stamp: a page that says a format older than a setting it uses came in, refused where its shape passed.
    const stamp = found.issues.length ? null : stampProblem(given, needOf(input, found));
    shaped = stamp ? [stamp] : found.issues;
  }
  const page = input as unknown as Page;
  try {
    const { issues, later } = pageReferences(page, options, SENSE);
    const owed = later ? { later } : {};
    // What the names and conditions found is said in their own words first; the shape's, where they found nothing.
    if (issues.length) return { ok: false, issues, ...owed };
    return shaped.length ? { ok: false, issues: shaped } : { ok: true, page, ...owed };
  } catch (error) {
    // A part the names' check could not read: what the shape says of it, where it says anything.
    if (shaped.length) return { ok: false, issues: shaped };
    return { ok: false, issues: [{ path: '(page)', message: `a part of this page cannot be read: ${(error as Error).message}` }] };
  }
}
