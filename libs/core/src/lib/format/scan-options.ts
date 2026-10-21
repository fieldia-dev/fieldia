import * as z from 'zod';

/**
 * A code scanned with the camera into a field (`options.scan`): a Scan button beside its box opens the camera in a sheet
 * (the back camera on a phone), and a code read fills the field — a char's or a text's words, a link's record found by
 * its code. On a table of lines, each code read counts: the line holding what it names gets one more, else a line is
 * added with one. A scanner gun (a keyboard wedge) types into the box as ever.
 *
 * `true`, or its settings:
 *
 * - `formats`: the kinds of code read — `qr_code`, `data_matrix`, `ean_13`, `ean_8`, `upc_a`, `upc_e`, `code_128`,
 *   `code_39`; every one when left out. Fewer read faster, and never mistake a box's other codes for the one meant.
 * - `by`: a link's — the field of the linked records that holds their code ("barcode"), whose value must be the code
 *   exactly; left out, the code is searched as a name is (an app's name search may find a product by its barcode).
 * - `part`: a GS1 code's part this field takes, by its Application Identifier — "10" a batch or lot, "21" a serial
 *   number, "01" a product's GTIN, "17" an expiry date; left out, the whole code.
 * - `fills`: the other fields the same GS1 code fills, each by its part — `{ "expiry": "17", "product_id": { "part":
 *   "01", "by": "barcode" } }` — a line's other columns for a cell or a counted line.
 * - `sound`: false keeps the scan silent (a beep where the browser lets it, and a phone's buzz, otherwise).
 * - A table of lines' own: `field`, the column a code names (a link, found as above, or words) and `count`, the column
 *   counted (a whole number).
 *
 *   { "field": "lot", "options": { "scan": { "formats": ["data_matrix"], "part": "10", "fills": { "expiry": "17" } } } }
 *   { "field": "line_ids", "options": { "scan": { "field": "product_id", "count": "counted", "by": "barcode" } } }
 */
export const SCAN_FORMATS = ['qr_code', 'data_matrix', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] as const;
export type ScanFormat = (typeof SCAN_FORMATS)[number];

/** A GS1 Application Identifier: two to four digits. */
const AI = /^\d{2,4}$/;
const part = z.string().regex(AI, 'a GS1 part is its Application Identifier, two to four digits: "10" a lot, "17" an expiry, "01" a GTIN');
const fieldName = z.string().min(1);

/** What one field takes of a GS1 code, among those a scan `fills`: its part, and for a link the field holding the code. */
export const ScanFillSchema = z.union([part, z.strictObject({ part, by: fieldName.optional() })], { error: 'a field filled is its GS1 part ("17"), or { "part": "01", "by": "barcode" } for a link' }).meta({ id: 'ScanFill' });

export const ScanSettingsSchema = z
  .strictObject({
    formats: z.array(z.enum(SCAN_FORMATS, { error: `a format is one of ${SCAN_FORMATS.join(', ')}` })).min(1).optional(),
    by: fieldName.optional(),
    part: part.optional(),
    fills: z.record(fieldName, ScanFillSchema).optional(),
    sound: z.boolean().optional(),
    field: fieldName.optional(),
    count: fieldName.optional(),
  })
  .meta({ id: 'ScanSettings' });

/** `options.scan`: true for a Scan button as the field is, or its settings; false for none. */
export const ScanOptionSchema = z.union([z.boolean(), ScanSettingsSchema], { error: 'scan is true, or its settings: { "formats": […], "by": "barcode", "part": "10", "fills": {…} }' }).meta({ id: 'ScanOption' });

export type ScanFill = z.infer<typeof ScanFillSchema>;
export type ScanSettings = z.infer<typeof ScanSettingsSchema>;
export type ScanOption = z.infer<typeof ScanOptionSchema>;

/** The issues of a field's or a cell's `options.scan`, each at its path under `options`. */
export function scanOptionIssues(node: { options?: Record<string, unknown> }): { message: string; path: (string | number)[] }[] {
  const scan = node.options?.['scan'];
  if (scan === undefined) return [];
  // Its settings checked as settings, so what is wrong in them is said where it is: never as "true or its settings".
  const schema = scan && typeof scan === 'object' && !Array.isArray(scan) ? ScanSettingsSchema : ScanOptionSchema;
  return (schema.safeParse(scan).error?.issues ?? []).map((issue) => ({ message: issue.message, path: ['options', 'scan', ...issue.path] as (string | number)[] }));
}
