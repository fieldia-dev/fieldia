import * as z from 'zod';

/** A shape as people write it: its width and its height, "4:3", "16:9", "1:1". */
const ASPECT = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/;
const SHAPE = 'aspect is a shape, its width and its height: "4:3", "16:9", "1:1" — no longer than five to one either way';

/**
 * A photo set (`"widget": "photos"` on a picture field of several photos, `multiple`): its settings in the node's
 * `options`, beside a picture field's own (`camera`). The photos stand in the order a person puts them — dragged, a
 * finger resting on one first on a phone, or moved with Alt and the arrow keys — the first the cover, marked so, which
 * a list's card and a map's pin show (`cover: false` marks none: a clinic's before and after); each with its words
 * under it where `captions` is true (`FileValue.caption`); each cropped and turned in place unless `edit` is false, to
 * the shape `aspect` says, or one the person picks where it says none — the photo as it was kept beside the result
 * (`FileValue.original`, with what was done, `FileValue.edit`) unless `keepOriginal` is false. How many it takes is
 * the field's `maxFiles`, how large each its `maxSize`.
 *
 *   { "field": "photos", "widget": "photos", "options": { "captions": true, "aspect": "4:3" } }
 */
export const PhotosOptionsSchema = z
  .object({
    /** The first photo is the cover, marked so, with Make cover on the others: true unless said. */
    cover: z.boolean().optional(),
    /** A caption under each photo, typed by a person. */
    captions: z.boolean().optional(),
    /** Crop and turn on each photo: true unless said. */
    edit: z.boolean().optional(),
    /** The photo as it was kept beside one cropped or turned, to crop again from and to put back: true unless said. */
    keepOriginal: z.boolean().optional(),
    /** The shape every crop keeps; left out, the person picks one, or none. */
    aspect: z
      .string()
      .refine((text) => {
        const [, width, height] = ASPECT.exec(text) ?? [];
        const ratio = Number(width) / Number(height);
        return ratio >= 0.2 && ratio <= 5;
      }, SHAPE)
      .meta({ pattern: ASPECT.source })
      .optional(),
  })
  .meta({ id: 'PhotosOptions' });

export type PhotosOptions = z.infer<typeof PhotosOptionsSchema>;

/** The issues of a photo set's settings, each at its path under `options`. */
export function photosOptionIssues(node: { widget?: string; options?: Record<string, unknown> }): { message: string; path: (string | number)[] }[] {
  if (node.widget !== 'photos') return [];
  return (PhotosOptionsSchema.safeParse(node.options ?? {}).error?.issues ?? []).map((issue) => ({ message: issue.message, path: ['options', ...issue.path] as (string | number)[] }));
}
