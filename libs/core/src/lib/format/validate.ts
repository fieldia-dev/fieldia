import type * as z from 'zod';
import { PageSchema, type Page } from './page';
import { upgradePage } from './upgrade';
import { ReferenceCheck, type PageIssue, type PageValidation } from './references';
import { functionTable, type FunctionsKnown } from '../expression/app-functions';
import { parseExpression } from '../expression/expression';
import { kindProblems, kindProblemWords } from '../expression/kinds';
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
  const issues = check.run();
  const warned = check.warnings.length ? { warnings: check.warnings } : {};
  return issues.length ? { ok: false, issues, ...warned } : { ok: true, page, ...warned };
}

/** The reference check of a page, reading the kinds of value its expressions hand their functions as warnings. */
function kindCheck(page: Page, functions: FunctionsKnown | undefined): ReferenceCheck {
  const kinds = (source: string, scope: Parameters<typeof kindProblems>[1]) => {
    try {
      return kindProblems(parseExpression(source, functionTable(functions)), scope, functions).map(kindProblemWords);
    } catch {
      // What does not read is said by the check that reads it.
      return [];
    }
  };
  return new ReferenceCheck(page, undefined, { functions, kinds });
}

/**
 * A page's warnings alone, as `validatePage` gives them beside a page — a value of a kind a function does not take —
 * for a page already known to pass the format (the designer's, as each edit is made).
 */
export function pageWarnings(page: Page, options: { functions?: FunctionsKnown } = {}): PageIssue[] {
  const check = kindCheck(page, options.functions);
  check.run();
  return check.warnings;
}

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
