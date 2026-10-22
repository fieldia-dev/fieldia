import * as z from 'zod';
import { PageSchema } from './page';
import { makeSchemasJitless } from './jitless';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

/**
 * The page format as a JSON Schema (draft 2020-12), for tools outside
 * JavaScript. It describes shape only: whether every reference resolves —
 * unique ids, fields that exist — is checked by `validatePage`.
 */
export function pageJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(PageSchema, { target: 'draft-2020-12' }) as Record<string, unknown>;
}
