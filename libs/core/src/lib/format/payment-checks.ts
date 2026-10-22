import type { Page } from './page';
import type { FieldTools } from './part-checks';

/** What a page's payment is checked with: a field's tools, and the reference check's own reading of conditions. */
export interface PaymentTools extends FieldTools {
  checkModifiers(owner: object, path: string, keys?: readonly string[]): void;
}

/**
 * A page's payment (`payment`): a form people send — never a list of records — its amount a number or a number or money
 * field of the page, its currency a code or a text or choice field, or else its money field's own, and its condition one
 * the page can read. In the one-tag script these checks come with the pay part, which a page asking for a payment asks
 * for (later-checks.ts).
 */
export function checkPayment(page: Page, tools: PaymentTools): void {
  const payment = page.payment;
  if (!payment) return;
  if (page.layout.type === 'list') return tools.report('payment', 'a payment is taken as a form’s answers are sent: a list of records sends none');
  const amount = typeof payment.amount === 'string' ? tools.need(payment.amount, 'payment.amount') : undefined;
  if (amount && amount.type !== 'integer' && amount.type !== 'float' && amount.type !== 'monetary') tools.report('payment.amount', `"${payment.amount}" is a ${amount.type}: the amount is a number, or a number or money field`);
  const currency = payment.currency;
  if (currency !== undefined && !/^[A-Z]{3}$/.test(currency)) {
    const def = tools.need(currency, 'payment.currency');
    if (def && def.type !== 'char' && def.type !== 'selection' && def.type !== 'many2one') tools.report('payment.currency', `"${currency}" is a ${def.type}: a currency is held as its code, in a text or a choice field`);
  }
  if (currency === undefined && (amount?.type !== 'monetary' || (amount.currency === undefined && amount.currencyField === undefined))) tools.report('payment.currency', 'say its currency: a code of three capitals ("EGP"), or a field holding one');
  if (payment.when !== undefined) tools.checkModifiers(payment, 'payment', ['when']);
}
