import * as z from 'zod';

/** What a file field records on the page: a voice note, a short film. */
export type RecordedKind = 'audio' | 'video';

/**
 * A file field that records (`binary`): a voice note or a short film recorded on the page with the browser's
 * microphone and camera, as its node's `options` say — `record` is `"audio"`, `"video"` or both, and `maxSeconds` the
 * longest a recording may be (1 to 3600; 120 for a voice note and 60 for a film unless it says). A recording is the
 * field's as a file picked is: stored as it is made where the data source has `upload`, its `accept`, `maxSize` and
 * `maxFiles` kept to. Known to the format, so a setting written wrong is refused before anything draws.
 *
 *   { "field": "voice_notes", "options": { "record": "audio", "maxSeconds": 90 } }
 */
export const RecordOptionsSchema = z
  .object({
    record: z
      .union([z.enum(['audio', 'video']), z.array(z.enum(['audio', 'video'])).min(1).max(2)], { error: 'record is "audio" (a voice note), "video" (a short film) or both: ["audio", "video"]' })
      .optional(),
    maxSeconds: z.int({ error: 'maxSeconds is a whole number of seconds, 1 to 3600' }).min(1, 'maxSeconds is a whole number of seconds, 1 to 3600').max(3600, 'maxSeconds is a whole number of seconds, 1 to 3600: an hour at most').optional(),
  })
  .meta({ id: 'RecordOptions' });

export type RecordOptions = z.infer<typeof RecordOptionsSchema>;

/** The issues of a file field's recording settings, each at its path under `options`: none where it records nothing. */
export function recordOptionIssues(node: { options?: Record<string, unknown> }): { message: string; path: (string | number)[] }[] {
  const options = node.options ?? {};
  if (options['record'] === undefined && options['maxSeconds'] === undefined) return [];
  return (RecordOptionsSchema.safeParse({ record: options['record'], maxSeconds: options['maxSeconds'] }).error?.issues ?? []).map((issue) => ({ message: issue.message, path: ['options', ...issue.path] as (string | number)[] }));
}

/**
 * A value shown as a code on the screen: `"widget": "qrcode"` (a char or text field) or `"widget": "barcode"` (a char or
 * integer field, Code 128), its settings in the node's `options` — a QR code's error correction `level` ("L", "M", "Q"
 * or "H": about 7, 15, 25 or 30 per cent of it may be lost and still read; "M" unless said), its `size` in pixels (a QR
 * code's side, a barcode's height: 160 and 64 unless said, 48 to 640), and `showValue` (the value's words under it: a
 * barcode's unless false, a QR code's where true).
 *
 *   { "field": "ticket_link", "widget": "qrcode", "options": { "level": "Q", "size": 200 } }
 */
export const CodeOptionsSchema = z
  .object({
    level: z.enum(['L', 'M', 'Q', 'H'], { error: 'level is a QR code\'s error correction: "L", "M", "Q" or "H"' }).optional(),
    size: z.int({ error: 'size is a whole number of pixels, 48 to 640' }).min(48, 'size is a whole number of pixels, 48 to 640').max(640, 'size is a whole number of pixels, 48 to 640').optional(),
    showValue: z.boolean().optional(),
  })
  .meta({ id: 'CodeOptions' });

export type CodeOptions = z.infer<typeof CodeOptionsSchema>;

/** The issues of a code's settings (`qrcode`, `barcode`), each at its path under `options`; a barcode has no level. */
export function codeOptionIssues(node: { widget?: string; options?: Record<string, unknown> }): { message: string; path: (string | number)[] }[] {
  if (node.widget !== 'qrcode' && node.widget !== 'barcode') return [];
  const issues = (CodeOptionsSchema.safeParse(node.options ?? {}).error?.issues ?? []).map((issue) => ({ message: issue.message, path: ['options', ...issue.path] as (string | number)[] }));
  if (node.widget === 'barcode' && node.options?.['level'] !== undefined) issues.push({ message: 'level is a QR code\'s error correction: a barcode has none', path: ['options', 'level'] });
  return issues;
}
