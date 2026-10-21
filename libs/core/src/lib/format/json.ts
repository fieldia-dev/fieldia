import * as z from 'zod';
import { makeSchemasJitless } from './jitless';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

/** Any value JSON can carry. A page holds nothing else. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Rejects functions, Dates, class instances and non-finite numbers. */
export const JsonValueSchema = z.json().meta({ id: 'JsonValue' });
