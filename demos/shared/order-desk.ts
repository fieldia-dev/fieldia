import type { ActionRequest, ActionResult, RelatedRecord } from '@fieldia/core';
import { real } from './real';
import { answerBusiness } from './business';
import { answerBill } from './vendor-bill';
import { sayWhatTheAppGot, type Told } from './app-told';

/** What the shop has left of each product, by id; the standing desk none. */
const STOCK: Record<number, number> = { 1: 12, 2: 40, 3: 7, 4: 0, 5: 120 };
const PRICES: Record<number, number> = { 1: 1890, 2: 380, 3: 749, 4: 6425, 5: 215 };
/** An answer comes after a moment, as one from a server does. */
const ANSWER_MS = 250;

/**
 * The app's answers to the pages' `call` steps, as a server would give them,
 * the same in every framework's demo: “Order by phone” checks the stock of
 * the product picked — the price and how many are left, or a stop with words
 * for one out of stock. The words in the page's language, English or Arabic.
 * Any other call is left alone — but, given the page and its records (`told`),
 * a button's press with nothing to show says what the app was given
 * (shared/app-told.ts): "The app was asked to send a reminder for INV/2026/0042."
 */
export function answerAction(request: ActionRequest, locale?: string, told?: Told): Promise<ActionResult | undefined> | undefined {
  const answer = answerOf(request, locale);
  return told ? sayWhatTheAppGot(told, request, answer) : answer;
}

function answerOf(request: ActionRequest, locale?: string): Promise<ActionResult | undefined> | undefined {
  // The vendor bill's gear menu: a debit note made, a bill printed; its Confirm, a draft numbered.
  const billed = request.id.startsWith('m-') || request.action === 'number_bill' ? answerBill(request) : undefined;
  if (billed) return Promise.resolve(billed);
  // The real pages' own actions: each lane's answers (shared/real/).
  // The business widgets' task: its timer's Start and Stop.
  const business = answerBusiness(request, locale);
  if (business) return Promise.resolve(business);
  if (request.action !== 'check_stock') return real.action(request, locale);
  const arabic = locale?.startsWith('ar') ?? false;
  const product = request.values['product'] as RelatedRecord | null;
  const answer = (): ActionResult => {
    if (!product) return { values: { price: null } };
    const left = STOCK[Number(product.id)] ?? 0;
    if (!left) {
      return {
        values: { price: null },
        stop: arabic ? `نفد «${product.label}» من المخزون حتى نوفمبر.` : `${product.label} is out of stock until November.`,
      };
    }
    return { values: { price: PRICES[Number(product.id)] }, say: { message: arabic ? `في المخزون: ${left}` : `In stock: ${left}`, tone: 'info' } };
  };
  return new Promise((resolve) => setTimeout(() => resolve(answer()), ANSWER_MS));
}
