import type { ActionRequest, ActionResult, RelatedRecord } from '@fieldia/core';
import { real } from './real';

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
 * Any other call is left alone.
 */
export function answerAction(request: ActionRequest, locale?: string): Promise<ActionResult | undefined> | undefined {
  // The real pages' own actions: each lane's answers (shared/real/).
  if (request.action !== 'check_stock') return real.action(request, locale) as Promise<ActionResult | undefined> | undefined;
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
