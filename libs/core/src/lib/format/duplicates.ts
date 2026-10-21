import * as z from 'zod';
import { makeSchemasJitless } from './jitless';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

/**
 * Possible duplicates (`duplicates` on a record's page): while a person types a record — and again as it is saved —
 * the page asks the data source's `duplicates` whether records like it exist already, by the fields named here: the
 * same phone, the same email, the same tax or national id, a name close enough. What matched is said under the field
 * it matched on, with Open it, "It's someone new" and Merge. Without the source's `duplicates`, nothing is asked and
 * nothing shows.
 *
 *   "duplicates": { "fields": ["name", "phone", "email", "vat"] }
 *   "duplicates": { "fields": ["phone", "email"], "on": "save" }
 *
 * `on`: `type` (the default) asks as a field named here is typed in, a moment after the typing stops, as a saved
 * record is opened, and as the record is saved; `save` only as it is saved.
 */
export const PageDuplicatesSchema = z
  .strictObject({
    fields: z.array(z.string().min(1)).min(1),
    on: z.enum(['type', 'save'], { error: 'on is "type" (asked as the fields are typed in, and as the record is saved) or "save" (as it is saved)' }).optional(),
  })
  .meta({ id: 'PageDuplicates' });

export type PageDuplicates = z.infer<typeof PageDuplicatesSchema>;
