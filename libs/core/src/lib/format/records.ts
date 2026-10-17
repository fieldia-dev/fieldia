import * as z from 'zod';

/**
 * What a page's records are called (`records` on a page), so Fieldia's own sentences name them as the business does:
 * "A customer with this phone already exists", "17 customers imported", "Are you sure you want to delete this
 * customer?", "New customer", "Select all 1,284 customers that match". Without it Fieldia says "record", or no noun at
 * all ("New"), as before.
 *
 *   "records": { "one": "customer", "other": "customers", "a": "a customer" }
 *   "records": { "one": "invoice", "other": "invoices", "a": "an invoice", "lowerLabels": true }
 *   "records": { "lowerLabels": true }
 *
 * `one` and `other` (both, or neither) are the word for one record and for more, as they stand inside a sentence
 * (lower case in English): a sentence that counts picks one of them as its language does for the number. `a` is the word for one
 * with its article, where the language puts one before it — "a customer", "an invoice", "un client", "une facture":
 * Fieldia never guesses an article, so a sentence that needs one says "A record …" until it is given. Other languages
 * come through the page's `translations`, as its other words do ("customer" → "عميل").
 *
 * `lowerLabels`: a field's label inside any of Fieldia's sentences — after a word of it — starts with a small letter:
 * "A customer with this phone already exists", "Choose at least 2 for interests", "Fix tax rate to see total", "Not
 * saved. Check: email". One that begins its sentence ("Phone is required", "Status: nothing is called …") keeps its
 * capital. Off unless said: a label is the page's own words, and only the page knows whether lower-casing it is right.
 * A label whose first word is a name ("IBAN", "VAT number", "WhatsApp", "E-mail") stays as written either way, as does
 * every label in a language that writes its nouns with a capital (German) or has no capitals (Arabic).
 */
export const PageRecordsSchema = z
  .strictObject({
    one: z.string().regex(/\S/, 'one is the word for one record: "customer"').max(60).optional(),
    other: z.string().regex(/\S/, 'other is the word for more than one record: "customers"').max(60).optional(),
    a: z.string().regex(/\S/, 'a is the word for one record with its article: "a customer", "an invoice"').max(80).optional(),
    lowerLabels: z.boolean().optional(),
  })
  // Both words or neither: a page may ask for its labels small alone, `{ "lowerLabels": true }`, its records unnamed.
  .superRefine((records, context) => {
    if ((records.one === undefined) !== (records.other === undefined)) context.addIssue({ code: 'custom', path: [records.one === undefined ? 'one' : 'other'], message: 'records are named by two words, one for one record and one for more: "customer" and "customers"' });
    if (records.a !== undefined && records.one === undefined) context.addIssue({ code: 'custom', path: ['a'], message: 'a names one record with its article: give one and other with it' });
  })
  .meta({ id: 'PageRecords', dependentRequired: { one: ['other'], other: ['one'], a: ['one', 'other'] } });

export type PageRecords = z.infer<typeof PageRecordsSchema>;
