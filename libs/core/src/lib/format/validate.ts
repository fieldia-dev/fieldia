import type * as z from 'zod';
import { PageSchema, type Page } from './page';
import { upgradePage } from './upgrade';
import type { PageValidation } from './references';
import type { FunctionsKnown } from '../expression/app-functions';
import { kindCheck } from './page-warnings';
import { makeSchemasJitless } from './jitless';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

export type { PageIssue, PageValidation } from './references';

/**
 * Check a page in two passes: its shape against the format, then every
 * reference inside it — ids unique, every field a layout, title, statusbar,
 * stat button, currency or filter names actually defined, and every modifier
 * readable and reading only fields of this page.
 *
 * Every function an expression calls must be Fieldia's or the app's (`functions`), given as many values as it takes:
 * a function there is not, or too many or too few values, is refused. A value of a kind a function does not take —
 * `age(notes)`, notes being text — is a warning (`warnings`), never a refusal: such a call gives nothing, as it did
 * before kinds were read, so a page that passed before still passes.
 *
 * Returns the page as validated. Nothing is coerced or filled in: a page that
 * passes is returned equal to the input — one in an older format, brought up to
 * date first (`upgradePage`), as every reader of it does.
 */
export function validatePage(input: unknown, options: { functions?: FunctionsKnown } = {}): PageValidation {
  const parsed = PageSchema.safeParse(upgradePage(input));
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((issue) => ({ path: formatPath(issue.path), message: describe(issue) })) };
  }
  const page: Page = parsed.data;
  const check = kindCheck(page, options.functions);
  let issues;
  try {
    issues = check.run();
  } catch (error) {
    // As the viewer's check says it (checkPage): a part it cannot read is a problem of the page, never a throw.
    return { ok: false, issues: [{ path: '(page)', message: `a part of this page cannot be read: ${(error as Error).message}` }] };
  }
  const warned = check.warnings.length ? { warnings: check.warnings } : {};
  return issues.length ? { ok: false, issues, ...warned } : { ok: true, page, ...warned };
}

// A page's warnings alone: no schema needed (page-warnings.ts), kept here under its old name too.
export { pageWarnings } from './page-warnings';

function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '(page)';
  return path
    .map((segment, i) => (typeof segment === 'number' ? `[${segment}]` : i === 0 ? String(segment) : `.${String(segment)}`))
    .join('');
}

function describe(issue: z.core.$ZodIssue): string {
  if (issue.code === 'invalid_union' && 'discriminator' in issue && issue.discriminator) {
    return `"${issue.discriminator}" is not one of the kinds allowed here`;
  }
  return issue.message;
}
