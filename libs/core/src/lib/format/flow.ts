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

/**
 * A time limit for a whole page of responses (`timeLimit` on the page) or one step of its wizard (`timeLimit` on the
 * step): a countdown while it runs, a warning `warn` minutes before its end, then — as `then` says, and the page says
 * which — the answers sent as they stand (`send`), or locked (`lock`): a page's kept for the person to send, a step's
 * kept as they are while the form goes on to the next. A page's clock starts as the person presses Start, a step's as
 * it is first entered; both are kept in a draft, so a page opened again goes on counting.
 *
 *   "timeLimit": { "minutes": 20, "warn": 2, "then": "send" }
 */
export interface TimeLimit {
  /** The time it allows, in minutes: 0.5 is thirty seconds. */
  minutes: number;
  /** How many minutes before its end the countdown warns: 1 unless said (a fifth of the time, where that is less). */
  warn?: number;
  /** What happens as it runs out: the answers sent as they stand (a page's, unless said), or locked (a step's, unless said). */
  then?: 'send' | 'lock';
}

export const TimeLimitSchema = z
  .strictObject({
    minutes: z.number().positive().max(24 * 60),
    warn: z.number().positive().max(24 * 60).optional(),
    then: z.enum(['send', 'lock']).optional(),
  })
  .refine((limit) => limit.warn === undefined || limit.warn < limit.minutes, { message: 'warn comes before the end: fewer minutes than the limit', path: ['warn'] })
  .meta({ id: 'TimeLimit' });
