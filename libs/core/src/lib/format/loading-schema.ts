import * as z from 'zod';
import { makeSchemasJitless } from './jitless';
import { LOADING_DEFAULTS, LOADING_ERRORS, LOADING_TECHNIQUES, LOADING_VARIANTS } from './loading';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

/*
 * The shape of `PageLoading` (loading.ts), where pages are made and checked (`validatePage`, the JSON Schema, the
 * designer): an app showing forms never carries it.
 */

/** A length of time in whole milliseconds, up to ten minutes. */
const ms = z.int().min(0).max(600000);

export const PageLoadingSchema = z
  .strictObject({
    first: z.enum(LOADING_TECHNIQUES.first).optional(),
    refresh: z.enum(LOADING_TECHNIQUES.refresh).optional(),
    more: z.enum(LOADING_TECHNIQUES.more).optional(),
    search: z.enum(LOADING_TECHNIQUES.search).optional(),
    action: z.enum(LOADING_TECHNIQUES.action).optional(),
    skeleton: z.enum(LOADING_VARIANTS.skeleton).optional(),
    spinner: z.enum(LOADING_VARIANTS.spinner).optional(),
    progress: z.enum(LOADING_VARIANTS.progress).optional(),
    delay: ms.max(10000).optional(),
    minShown: ms.max(10000).optional(),
    slowAfter: ms.optional(),
    timeout: ms.min(1).optional(),
    error: z.enum(LOADING_ERRORS).optional(),
  })
  .superRefine((loading, context) => {
    // A wait that ends before anything could be said of it fails every slow answer unseen.
    if (loading.timeout !== undefined && loading.timeout <= (loading.delay ?? LOADING_DEFAULTS.delay)) {
      context.addIssue({ code: 'custom', path: ['timeout'], message: `a timeout ends the wait as failed: make it longer than the delay before a loader shows (${loading.delay ?? LOADING_DEFAULTS.delay} ms)` });
    }
    if (loading.timeout !== undefined && loading.slowAfter !== undefined && loading.slowAfter >= loading.timeout) {
      context.addIssue({ code: 'custom', path: ['slowAfter'], message: `"Still loading…" is said before the wait ends: make slowAfter shorter than the timeout (${loading.timeout} ms)` });
    }
  })
  .meta({ id: 'PageLoading' });

/** The issues of a field's `options.loading`, each at its path under `options`. */
export function loadingOptionIssues(node: { options?: Record<string, unknown> }): { message: string; path: (string | number)[] }[] {
  const loading = node.options?.['loading'];
  if (loading === undefined) return [];
  return (PageLoadingSchema.safeParse(loading).error?.issues ?? []).map((issue) => ({ message: issue.message, path: ['options', 'loading', ...issue.path] as (string | number)[] }));
}
