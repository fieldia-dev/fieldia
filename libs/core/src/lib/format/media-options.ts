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
