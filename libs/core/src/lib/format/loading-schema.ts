import * as z from 'zod';
import { ruled } from './ruled';
import { makeSchemasJitless } from './jitless';
import { LOADING_ERRORS, LOADING_TECHNIQUES, LOADING_VARIANTS } from './loading';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

/*
 * The shape of `PageLoading` (loading.ts), where pages are made and checked (`validatePage`, the JSON Schema, the
 * designer): an app showing forms never carries it.
 */

/** A length of time in whole milliseconds, up to ten minutes. */
const ms = z.int().min(0).max(600000);

export const PageLoadingSchema = ruled(
  z.strictObject({
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
  }),
  // A timeout after the loader could show, "Still loading…" before it (rules.ts).
  'loading'
).meta({ id: 'PageLoading' });
