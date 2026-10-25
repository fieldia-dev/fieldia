import { lazyPart, type Part } from '@fieldia/core';

/** What the format's schemas give the designer: `validatePage`, and the schemas a check of what an edit changed reads. */
export type PageSchemaPart = typeof import('@fieldia/core/schema');

/**
 * The page format's schemas and `validatePage`, with zod (`@fieldia/core/schema`, a file of its own): fetched as the
 * designer opens, beside its canvas's parts, never before its first paint (0.35). An edit made before they came is
 * held to the quick check every viewer draws a page with (`checkPage`), its whole check owed till then: the next edit
 * after they came checks the page whole, and so does publishing (validate-edit.ts, whole-check.ts).
 */
export const pageSchemaPart: Part<PageSchemaPart> = lazyPart('schema', () => import('@fieldia/core/schema'));
