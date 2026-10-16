import * as z from 'zod';

/**
 * Phone numbers read and kept as one number the world over (`"widget": "phone"` on a char field): typed at home
 * ("010 1234 5678") or abroad ("+20 10 1234 5678"), checked against its country's lengths and starts, kept as E.164
 * ("+201012345678"), and shown at rest as the page chooses, with a call and a WhatsApp link beside it.
 *
 * A page says so for all its phone fields (`phone`), or a field for itself (its node's `options`); a page that says
 * neither keeps its phone fields as text boxes, as before. `country` is the one a number typed without its + is read
 * in, by its ISO code — never assumed: left out, a number is written with its + and country code, or its country
 * picked beside it. `shown` writes a number at rest abroad's way ("+20 10 1234 5678", the default) or at home's
 * ("010 1234 5678") — a number of another country always abroad's.
 *
 *   "phone": { "country": "EG", "shown": "national" }
 *   { "field": "mobile", "widget": "phone", "options": { "country": "AE" } }
 */

const COUNTRY = /^[A-Z]{2}$/;
const country = z.string().regex(COUNTRY, 'a country is its ISO code in capitals, such as "EG"');
const shown = z.enum(['international', 'national'], { error: 'shown is "international" (+20 10 1234 5678) or "national" (010 1234 5678)' });

/** A page's phone numbers: the country a number typed without its + is read in, and how a number is shown at rest. */
export const PagePhoneSchema = z
  .strictObject({
    country: country.optional(),
    shown: shown.optional(),
  })
  .meta({ id: 'PagePhone' });

export type PagePhone = z.infer<typeof PagePhoneSchema>;

/** A phone field's own: the page's settings, for this field. Its other options stay as they are. */
export const PhoneOptionsSchema = z
  .object({
    country: country.optional(),
    shown: shown.optional(),
  })
  .meta({ id: 'PhoneOptions' });

export type PhoneOptions = z.infer<typeof PhoneOptionsSchema>;

/** The issues of a phone field's settings, each at its path under `options`. */
export function phoneOptionIssues(node: { widget?: string; options?: Record<string, unknown> }): { message: string; path: (string | number)[] }[] {
  if (node.widget !== 'phone') return [];
  return (PhoneOptionsSchema.safeParse(node.options ?? {}).error?.issues ?? []).map((issue) => ({ message: issue.message, path: ['options', ...issue.path] as (string | number)[] }));
}
