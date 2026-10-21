import type { Page } from '../format/page';
import { lazyPart, type Part } from '../parts';
import type * as PayModule from './pay-part';

/** The pay part's form code (payment-form.ts): what a page's payment asks now, and the payment step it waits for. */
export type FormPayPart = typeof PayModule;

/**
 * A payment the answers wait for (`payment` on a page), the form's side: what is due now — the amount, its currency,
 * what it is for — and the step a send waits on, through the host's payment step (the viewer's) or the data source's
 * `pay` itself. Loaded by a form whose page asks for a payment, a send waiting for it: in the one-tag script, one script
 * with the viewer's pay part (fieldia.pay.js).
 */
export const formPayPart: Part<FormPayPart> = lazyPart('pay', () => import('./pay-part'));

/** Whether a page asks for a payment. */
export const asksPayment = (page: Page): boolean => !!page.payment;
