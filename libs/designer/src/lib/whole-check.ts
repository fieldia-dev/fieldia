import { checkPage, pageWarnings, type FunctionsKnown, type PageValidation } from '@fieldia/core';
import { pageSchemaPart } from './schema-part';

/**
 * A page checked whole, as the designer checks what it keeps: by the format's schemas and every reference
 * (`validatePage`) once they have come — a file of their own, with zod (`pageSchemaPart`, asked for as the designer
 * opens, 0.35) — and till then by the quick check every viewer draws a page with (`checkPage`) and its warnings,
 * `whole` false: what the designer keeps meanwhile is checked whole once they have come (the next edit, its checks, and
 * always before it is published).
 */
export function checkWhole(page: unknown, functions?: FunctionsKnown): PageValidation & { whole: boolean } {
  const schema = pageSchemaPart.loaded;
  if (schema) return { ...schema.validatePage(page, { functions }), whole: true };
  const quick = checkPage(page, { functions });
  return quick.ok ? { ...quick, warnings: pageWarnings(quick.page, { functions }), whole: false } : { ...quick, whole: false };
}
