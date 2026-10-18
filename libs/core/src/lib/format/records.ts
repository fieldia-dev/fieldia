import * as z from 'zod';

/**
 * What a page's records are called (`records` on a page), so Fieldia's own sentences name them as the business does:
 * "A customer with this phone already exists", "17 customers imported", "Are you sure you want to delete this
 * customer?", "New customer", "Select all 1,284 customers that match". Without it Fieldia says "record", or no noun at
 * all ("New"), as before.
 *
 *   "records": { "one": "customer", "other": "customers", "a": "a customer" }
 *   "records": { "one": "invoice", "other": "invoices", "a": "an invoice" }
 *
 * `one` and `other` are the word for one record and for more, written as they stand inside a sentence (lower case in
 * English): a sentence that counts picks one of them as its language does for the number. `a` is the word for one
 * with its article, where the language puts one before it — "a customer", "an invoice", "un client", "une facture":
 * Fieldia never guesses an article, so a sentence that needs one says "A record …" until it is given. Other languages
 * come through the page's `translations`, as its other words do ("customer" → "عميل"). How a field's label is written
 * inside those sentences is the page's own `lowerLabels`, beside it.
 */
export const PageRecordsSchema = z
  .strictObject({
    one: z.string().regex(/\S/, 'one is the word for one record: "customer"').max(60),
    other: z.string().regex(/\S/, 'other is the word for more than one record: "customers"').max(60),
    a: z.string().regex(/\S/, 'a is the word for one record with its article: "a customer", "an invoice"').max(80).optional(),
  })
  .meta({ id: 'PageRecords' });

export type PageRecords = z.infer<typeof PageRecordsSchema>;
