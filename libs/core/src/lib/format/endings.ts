import * as z from 'zod';
import { ModifierSchema, type Modifier } from './layout';
import { makeSchemasJitless } from './jitless';

// zod compiles no code for these schemas: a strict Content-Security-Policy refuses it (jitless.ts).
makeSchemasJitless();

/**
 * What a page of responses shows once its answers are sent, in place of the plain "Thank you" (`endings` on a page):
 * the first ending whose `when` holds, read on the answers as they were sent with what the app's source answered —
 * the `values` it added (`SubmitResult.values`) and the response's `id` — else the ending with no `when`, the page's
 * default. Its title and words hold `{field}`s as a text's words do, each written as the field shows its value: a
 * choice by its label, money with its currency, a day in the page's order; `{id}` is the id the source gave the
 * response, where the page has no field of that name.
 *
 *   "endings": [
 *     { "when": "overall <= 2", "title": "We are sorry, {name}", "text": "Someone from {branch} will call you today." },
 *     { "title": "Thank you, {name}", "text": "Your booking is {id}. See you on {date} at {time}." }
 *   ]
 *
 * A link goes where an ending's words say `[words](address)`, as a text's. A redirect after sending is a step
 * (`on.afterSave`, `openUrl` with its `when`), as before.
 */
export interface PageEnding {
  /** When this ending is the one shown: a condition on the answers as sent, as any `when`. Left out: the default. */
  when?: Modifier;
  /** Its heading: "Thank you, {name}". The viewer's own thanks when it has neither title nor text. */
  title?: string;
  /** Its words under the heading: "Your booking is {id}." A line break starts a new paragraph. */
  text?: string;
  /** The words of the button that starts the form again ("Book another"), or false for none; the viewer's own when left out. */
  again?: string | false;
}

export const PageEndingSchema = z
  .strictObject({
    when: ModifierSchema.optional(),
    title: z.string().regex(/\S/, 'an ending’s title is words: "Thank you, {name}"').max(300).optional(),
    text: z.string().regex(/\S/, 'an ending’s text is words: "Your booking is {id}."').max(4000).optional(),
    again: z.union([z.literal(false), z.string().regex(/\S/, 'again is the button’s words, or false for none').max(80)]).optional(),
  })
  .meta({ id: 'PageEnding' });

export const PageEndingsSchema = z.array(PageEndingSchema).min(1).max(50);
