import * as z from 'zod';

/**
 * AI help on a page, through the app's own model (Fieldia ships no model and no keys): every value proposed is shown
 * on its field — the old value and the new — to accept or reject, nothing kept until the person accepts it, Undo
 * after; a proposal for a record no longer shown is let go, and what the person types wins over a late one.
 *
 * `suggest` on a page: a "Fill from text" button over its fields. The person pastes words — an e-mail signature, a
 * message, a document's text — or picks files, and the data source's `suggest` answers with values for the fields
 * named here (those shown that a person can set, when left out), a table of lines' as the lines to add.
 *
 * `fromField` reads the words a record holds — a buyer's message, a visit's notes — at a press, with no box to paste in.
 *
 *   "suggest": {}
 *   "suggest": { "fields": ["name", "email", "phone", "contacts"], "label": "Fill from an e-mail", "from": ["text"] }
 *   "suggest": { "fromField": "message", "label": "Fill from the message", "fields": ["kind", "district", "budget"] }
 */
export const PageSuggestSchema = z
  .strictObject({
    /** The fields it may fill: every field it can set when left out. */
    fields: z.array(z.string().min(1)).min(1).optional(),
    /** What it reads: words pasted ("text"), files ("files"), or both. */
    from: z.array(z.enum(['text', 'files'], { error: 'from is "text" (words pasted), "files", or both' })).min(1).optional(),
    /** Its button's words: "Fill from an e-mail". */
    label: z.string().min(1).max(60).optional(),
    /** The words in its box before anything is pasted. */
    placeholder: z.string().min(1).max(200).optional(),
    /** A field of the record whose words it reads at a press — a buyer's message — with no box to paste in. */
    fromField: z.string().min(1).optional(),
  })
  .meta({ id: 'PageSuggest' });

export type PageSuggest = z.infer<typeof PageSuggestSchema>;

/**
 * A text field's tools (`options.rewrite` on a char, text or html field), each asking the data source's `rewrite`:
 * `draft` writes the field from the record — a reply to an enquiry from what it asks — and `polish` makes the words
 * the person wrote clearer (offered once there are some). An app's own tool is `{ "how": "shorter", "label": "Make it
 * shorter" }`, its `how` what the source is asked. `true` gives Draft and Polish. Each answer is shown under the field
 * to accept or reject.
 *
 *   "options": { "rewrite": ["draft", "polish"] }
 *   "options": { "rewrite": ["polish", { "how": "formal", "label": "More formal" }] }
 */
export type RewriteTool = 'draft' | 'polish' | { how: string; label: string };

