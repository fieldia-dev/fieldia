import * as z from 'zod';

/**
 * A review before a page of responses is sent (`review` on a page): every answer shown — by step on a wizard, by
 * titled group on a page of sections — each with Edit, then Back and Send. `true` says it with Fieldia's own words
 * ("Check your answers"); its own `title` and `text` say it in the page's.
 *
 *   "review": { "title": "Check your answers before you send them", "text": "Press Edit to change one." }
 */
export interface PageReview {
  /** Its heading, in place of "Check your answers". */
  title?: string;
  /** Words under the heading. */
  text?: string;
}

export const PageReviewSchema = z
  .union([
    z.boolean(),
    z.strictObject({
      title: z.string().regex(/\S/, 'a review’s title is words').max(300).optional(),
      text: z.string().regex(/\S/, 'a review’s text is words').max(2000).optional(),
    }),
  ])
  .meta({ id: 'PageReview' });

