import type * as z from 'zod';
import { PageSchema, type Page } from './page';
import { upgradePage } from './upgrade';
import { ReferenceCheck, type PageValidation } from './references';
import { functionTable, type FunctionsKnown } from '../expression/app-functions';
import { parseExpression } from '../expression/expression';
import { kindProblems, kindProblemWords } from '../expression/kinds';

export type { PageIssue, PageValidation } from './references';

/**
 * Check a page in two passes: its shape against the format, then every
 * reference inside it — ids unique, every field a layout, title, statusbar,
 * stat button, currency or filter names actually defined, and every modifier
 * readable and reading only fields of this page.
 *
 * Every function an expression calls must be Fieldia's or the app's (`functions`), given as many values as it
 * takes, each of a kind it takes: `age(notes)` is refused, notes being text.
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
  const { functions } = options;
  const kinds = (source: string, scope: Parameters<typeof kindProblems>[1]) => {
    try {
      return kindProblems(parseExpression(source, functionTable(functions)), scope, functions).map(kindProblemWords);
    } catch {
      // What does not read is said by the check that reads it.
      return [];
    }
  };
  const issues = new ReferenceCheck(page, undefined, { functions, kinds }).run();
  return issues.length ? { ok: false, issues } : { ok: true, page };
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
