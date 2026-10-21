import type { Page } from '../format/page';
import { lazyPart, type Part } from '../parts';
import type * as VerifyModule from './verify-part';

/** The verify part's form code (verify-form.ts): which fields ask for a code, and those not proved. */
export type FormVerifyPart = typeof VerifyModule;

/**
 * Proof of an email or a phone by a code (`options.verify`), the form's side: which shown fields ask for one, and the
 * words a send is refused with while one is not proved — loaded by a form whose page has such a field, a send waiting
 * for it: in the one-tag script, one script with the viewer's verify part (fieldia.verify.js).
 */
export const formVerifyPart: Part<FormVerifyPart> = lazyPart('verify', () => import('./verify-part'));

/** Whether a page has a field that asks for a code (`options.verify`, not false). */
export const asksForCodes = (page: Page): boolean => /"verify":(?!false)/.test(JSON.stringify(page.layout));
