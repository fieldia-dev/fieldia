import { PAGE_SHAPE } from './page-shape';
import { shapeCheck } from './shape-check';
import { compareFormats, FORMAT_VERSIONS, type FormatVersion } from './version';
import { PAGE_UPGRADES, upgradePage, type PageJson, type PageUpgrade } from './upgrade';
import type { PageIssue } from './references';

/**
 * The lowest format a page's settings need (the audit's R-M7): the newest format any setting it uses came in — a key,
 * a kind of part, a value a setting takes, a limit an older format held tighter — read from the format's own history
 * (tools/format-since.json, written into the schema the checks read), and any format whose step says the page relies
 * on what it brought (`PageUpgrade.uses`: a default it changed). A page stamped so is read by every Fieldia that reads
 * that format: an older viewer never refuses a page that uses nothing new. tools/format-since.test.mjs holds every
 * example page, stamped so, to that format's own schema.
 */
export function lowestFormat(page: unknown): FormatVersion {
  return FORMAT_VERSIONS[needOf(upgradePage(page)).index];
}

/** The page with its stamp the lowest format its settings need (`lowestFormat`): a copy; the page given is unchanged. */
export function stampPage<T>(page: T): T {
  return { ...(page as object), fieldia: lowestFormat(page) } as T;
}

/**
 * The newest format a page in the current format needs, by index, and the place that needs it: what its settings use
 * (`found`, the schema's walk), and each format whose step says the page relies on what it brought (`steps`).
 */
export function needOf(page: unknown, found: { need: number; needAt: string } = shapeCheck(page, PAGE_SHAPE), steps: readonly PageUpgrade[] = PAGE_UPGRADES): { index: number; at: string } {
  let index = Math.max(0, found.need);
  let at = found.needAt;
  steps.forEach((step) => {
    const to = FORMAT_VERSIONS.indexOf(step.to as FormatVersion);
    if (to > index && step.uses?.(page as PageJson)) [index, at] = [to, '(page)'];
  });
  return { index, at };
}

/**
 * Why a page says a format lower than one a setting it uses came in — an older Fieldia reading it would not know that
 * setting — or null: the page is read by its stamp. `given`, the page as it was given, before it was brought up to date.
 * `validatePage` and the whole check refuse it (0.37; warned of in 0.36: DEPRECATIONS, `format.under-stamped`).
 */
export function stampProblem(given: unknown, need: { index: number; at: string }): PageIssue | null {
  const stamp = (given as { fieldia?: unknown } | null)?.fieldia;
  const needed = FORMAT_VERSIONS[need.index];
  if (typeof stamp !== 'string' || !FORMAT_VERSIONS.includes(stamp as FormatVersion) || (compareFormats(stamp, needed) ?? 0) >= 0) return null;
  return {
    path: need.at,
    message: `this came in format ${needed}, but the page says it is in format ${stamp}, which a Fieldia reading ${stamp} would read without it: write "fieldia": "${needed}" — lowestFormat(page) gives the lowest a page needs`,
  };
}
