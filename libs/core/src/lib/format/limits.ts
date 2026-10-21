import * as z from 'zod';
import { makeSchemasJitless } from './jitless';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

/**
 * A day ("2026-11-20"), a day and a time on the page's clock ("2026-11-01T09:00"), or an instant with its offset
 * ("2026-11-01T07:00:00Z", "2026-11-01T09:00+02:00").
 */
const WHEN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;
const when = (what: string) => z.string().regex(WHEN, { error: `${what} is a day ("2026-11-20"), or a day and a time on the page's clock ("2026-11-01T09:00")` });

/**
 * When a page of responses takes answers, and how many (`limits` on a page): a sign-up that opens on a day and closes
 * on another, a limited offer that takes 200, a vote that takes one from each person. A closed form says so at once,
 * as it is opened — when it opens, or when it closed, and the page's own words — and never takes answers it would
 * refuse: a person learns it before they start, never after filling it.
 *
 *   "limits": { "opens": "2026-11-01T09:00", "closes": "2026-11-20", "maxResponses": 200, "onePerPerson": true,
 *               "message": "Sign-ups for November are closed. See you in December." }
 *
 * `opens` and `closes` are read on the page's clock (`timeZone`; the browser's without one): a day alone opens at its
 * first minute and closes at its end (the form takes answers through that day). They need nothing of the data
 * source. `maxResponses` and `onePerPerson` are counted on the app's server, through the data source's `limits`
 * (`responses`, `mine`): without it, they are not drawn on — the server's `submit` refuses as it would. A choice's
 * places (`seats` on an option) are the option's own, on any page.
 */
export const PageLimitsSchema = z
  .strictObject({
    opens: when('opens').optional(),
    closes: when('closes').optional(),
    maxResponses: z.int().min(1).max(100_000_000).optional(),
    onePerPerson: z.boolean().optional(),
    message: z.string().regex(/\S/, 'message is the page’s own words while it takes no answers').max(1000).optional(),
  })
  .meta({ id: 'PageLimits' });

export type PageLimits = z.infer<typeof PageLimitsSchema>;
