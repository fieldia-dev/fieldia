import * as z from 'zod';
import { makeSchemasJitless } from './jitless';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

/**
 * A date and time drawn as booking slots (`"widget": "slots"`): its settings in
 * the node's `options`. The days of a month shaded by how they are booked, and
 * the chosen day's free times to pick from, all asked of the data source's
 * `slots` — for the schedule named, a booking's length and the minutes kept
 * free between two — and asked again when a field it depends on changes.
 * Known to the format, so a setting written wrong is refused before anything
 * draws.
 */
export const SlotsOptionsSchema = z
  .object({
    /** The schedule the data source is asked for: a doctor's, a showroom's. The field's name unless said. */
    schedule: z.string().min(1).optional(),
    /** The minutes a booking lasts, unless the data source says otherwise (a service's own length): 30 unless said. */
    length: z.int().min(5).max(1440).optional(),
    /** The minutes kept free after each booking, between it and the next. */
    between: z.int().min(0).max(1440).optional(),
    /** A date and time field the booking's end is written in, as a time is picked: its start and its length. */
    endField: z.string().min(1).optional(),
    /** The fields whose change asks for the free times again: the doctor, the service, the car. */
    dependsOn: z.array(z.string().min(1)).min(1).optional(),
  })
  .meta({ id: 'SlotsOptions' });

export type SlotsOptions = z.infer<typeof SlotsOptionsSchema>;
