import * as z from 'zod';
import { FIELD_NAME } from './names';

/**
 * A payment the answers wait for (`payment` on a page): a reservation fee, a deposit, a retainer — paid through the
 * app's own provider before anything is sent. Fieldia holds no keys and no provider's code: as Submit is pressed and the
 * answers pass their checks, a payment step shows what is due — its words, the amount in its currency — and Pay hands
 * it to the data source's `pay`, which opens the app's checkout (a window of its own) or draws it in the step (its
 * `slot`), and answers paid, failed or cancelled. Paid, the answers go with the payment's reference; failed or
 * cancelled, nothing is sent and the step says so, with Pay again. Without the source's `pay`, nothing is asked and the
 * page sends as before.
 *
 *   "payment": { "label": "Reservation fee", "amount": 10000, "currency": "EGP" }
 *   "payment": { "label": "Deposit", "amount": "deposit", "currency": "currency_code", "when": "visit == 'viewing'",
 *                "description": "Taken off the price; refunded if the unit is no longer available." }
 *
 * `amount` is a number, or the name of a number or money field holding it; `currency` a code of three capitals, or the
 * name of a field holding one — left out, a money field's own currency. Nothing is due while `when` does not hold, or
 * the amount is empty or not above 0.
 */
export interface PagePayment {
  /** What it is for, in the page's words: "Reservation fee". */
  label: string;
  /** How much: a number, or a number or money field's name. */
  amount: number | string;
  /** Its currency: "EGP", or a field holding the code; a money field's own when left out. */
  currency?: string;
  /** Words under the amount: what it covers, whether it is refunded. */
  description?: string;
  /** Asked for only while this holds on the answers. */
  when?: string;
}

export const PagePaymentSchema = z
  .strictObject({
    label: z.string().regex(/\S/, 'label says what the payment is for: "Reservation fee"').max(120),
    amount: z.union([z.number().positive({ error: 'an amount above 0' }), z.string().regex(FIELD_NAME, { error: 'amount is a number, or the name of a field holding it' })]),
    currency: z.union([z.string().regex(/^[A-Z]{3}$/), z.string().regex(FIELD_NAME)], { error: 'currency is a code of three capitals ("EGP"), or the name of a field holding one' }).optional(),
    description: z.string().regex(/\S/).max(500).optional(),
    when: z.string().min(1).optional(),
  })
  .meta({ id: 'PagePayment' });
