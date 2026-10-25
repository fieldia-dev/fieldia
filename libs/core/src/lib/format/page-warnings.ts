import type { Page } from './page';
import { ReferenceCheck, type PageIssue } from './references';
import { functionTable, type FunctionsKnown } from '../expression/app-functions';
import { parseExpression } from '../expression/expression';
import { kindProblems, kindProblemWords } from '../expression/kinds';

/**
 * The reference check of a page, reading the kinds of value its expressions hand their functions as warnings: what
 * `validatePage` runs once the page has passed the format, and `pageWarnings` alone. No schema here (zod is
 * validate.ts's alone): the designer reads a page's warnings before the format's schemas have come.
 */
export function kindCheck(page: Page, functions: FunctionsKnown | undefined): ReferenceCheck {
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
