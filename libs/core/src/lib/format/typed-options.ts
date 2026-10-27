import * as z from 'zod';
import { ruled } from './ruled';

/**
 * Boxes that read a value typed to a shape, as a field's node says (its `options`): a text box typed to a mask — a
 * national ID, an IBAN, a car plate — a one-time code's boxes (`"widget": "one-time-code"`), and a number or an amount
 * typed in shorthand (`shorthand`: "3.5m", "500k"). Known to the format,
 * so a word written wrong is refused before anything draws.
 *
 *   { "field": "national_id", "options": { "mask": "9 999999 99 99999" } }
 *   { "field": "iban", "options": { "mask": "aa99 **** **** **** **** **[** **** **** **]", "upper": true } }
 *   { "field": "code", "widget": "one-time-code", "options": { "length": 6 } }
 *   { "field": "price", "options": { "shorthand": true } }
 *
 * A mask's pattern: 9 a digit, a a letter, * a letter or a digit, \ before a character that character itself, [ ]
 * round the end of it what may be left out; every other character the mask's own, written in as the person types.
 */

/** A mask on a char field: its pattern, letters in capitals, and whether the value keeps the mask's own characters. */
export const MaskOptionsSchema = z
  .object({
    // What goes in it named, what may be left out at its end (rules.ts).
    mask: ruled(z.string().min(1), 'mask').optional(),
    /** Letters typed in it written in capitals: an IBAN's, a plate's. */
    upper: z.boolean().optional(),
    /** What the field keeps: the characters typed ("typed", the default: "29010112345678") or as shown, with the mask's own ("shown"). */
    maskKeeps: z.enum(['typed', 'shown'], { error: 'maskKeeps is "typed" (the characters typed) or "shown" (with the mask’s own)' }).optional(),
  })
  .meta({ id: 'MaskOptions' });

/** A one-time code's boxes: how many characters (4 to 12; 6 unless said), and whether letters are in it too. */
export const OneTimeCodeOptionsSchema = z
  .object({
    length: z.int().min(4).max(12).optional(),
    letters: z.boolean().optional(),
  })
  .meta({ id: 'OneTimeCodeOptions' });

/** Amounts typed in shorthand on a number or an amount: "3.5m", "500k", "٣٫٥ مليون". */
export const ShorthandOptionsSchema = z.object({ shorthand: z.boolean({ error: 'shorthand is true: amounts typed as 3.5m or 500k are read' }).optional() }).meta({ id: 'ShorthandOptions' });

export type MaskOptions = z.infer<typeof MaskOptionsSchema>;
export type OneTimeCodeOptions = z.infer<typeof OneTimeCodeOptionsSchema>;
