import * as z from 'zod';

/**
 * Boxes that read a value typed to a shape, as a field's node says (its `options`): a text box typed to a mask — a
 * national ID, an IBAN, a car plate — and a one-time code's boxes (`"widget": "one-time-code"`). Known to the format,
 * so a word written wrong is refused before anything draws.
 *
 *   { "field": "national_id", "options": { "mask": "9 999999 99 99999" } }
 *   { "field": "iban", "options": { "mask": "aa99 **** **** **** **** **[** **** **** **]", "upper": true } }
 *   { "field": "code", "widget": "one-time-code", "options": { "length": 6 } }
 *
 * A mask's pattern: 9 a digit, a a letter, * a letter or a digit, \ before a character that character itself, [ ]
 * round the end of it what may be left out; every other character the mask's own, written in as the person types.
 */

/** A mask on a char field: its pattern, letters in capitals, and whether the value keeps the mask's own characters. */
export const MaskOptionsSchema = z
  .object({
    mask: z
      .string()
      .min(1)
      .refine((pattern) => /[9a*]/.test(pattern.replace(/\\./g, '')), { message: 'a mask names what goes in it: 9 a digit, a a letter, * either' })
      .refine((pattern) => /^[^[\]]*(\[[^[\]]*\][^[\]9a*]*)?$/.test(pattern.replace(/\\./g, '')), { message: 'what may be left out is the end of a mask, in [ ]: "aa99 **** [****]"' })
      .optional(),
    /** Letters typed in it written in capitals: an IBAN's, a plate's. */
    upper: z.boolean().optional(),
    /** What the field keeps: the characters typed ("typed", the default: "29010112345678") or as shown, with the mask's own ("shown"). */
    maskKeeps: z.enum(['typed', 'shown'], { error: 'maskKeeps is "typed" (the characters typed) or "shown" (with the mask’s own)' }).optional(),
  })
  .meta({ id: 'MaskOptions' });

/** A one-time code's boxes: how many characters (4 to 12; 6 unless said), and whether letters are in it too. */
export const CodeOptionsSchema = z
  .object({
    length: z.int().min(4).max(12).optional(),
    letters: z.boolean().optional(),
  })
  .meta({ id: 'CodeOptions' });

export type MaskOptions = z.infer<typeof MaskOptionsSchema>;
export type CodeOptions = z.infer<typeof CodeOptionsSchema>;

/** The issues of a field node's mask or code settings, each at its path under `options`. */
export function typedOptionIssues(node: { widget?: string; options?: Record<string, unknown> }): { message: string; path: (string | number)[] }[] {
  const options = node.options ?? {};
  const schemas = [...(node.widget === 'one-time-code' ? [CodeOptionsSchema] : []), ...('mask' in options || 'maskKeeps' in options ? [MaskOptionsSchema] : [])];
  return schemas.flatMap((schema) => (schema.safeParse(options).error?.issues ?? []).map((issue) => ({ message: issue.message, path: ['options', ...issue.path] as (string | number)[] })));
}
