import type { Page } from '../format/page';
import type { DataSource, PaidPayment, PaymentDue } from './data-source';
import type { FormState } from './form';
import type { ActionHost } from './run';
import type { Values } from './values';

/** What a form's payment code asks of the form it is made for. */
export interface PayHost {
  readonly page: Page;
  readonly dataSource: DataSource | undefined;
  readonly host: ActionHost | undefined;
  state(): FormState;
  set(patch: Partial<FormState>): void;
  /** Whether a condition holds on the record now, as the form reads its conditions. */
  holds(condition: string): boolean;
  /** The answers as a send would carry them. */
  values(): Values;
  /** The page's language, by tag. */
  language(): string;
}

/** A form's payment code, made for it (`formPayment`). */
export interface FormPayment {
  /** What is due now, or null: no payment asked, its condition not holding, nothing above 0, or no source to pay through. */
  due(): PaymentDue | null;
  /** Whether what was paid covers what is due now. */
  covered(due: PaymentDue): boolean;
  /**
   * Pay what is due before a send: through the host's payment step (the viewer's), else the data source's `pay` itself.
   * Paid, it is kept (`state.paid`) and the send carries it; else null — nothing is sent.
   */
  pay(due: PaymentDue): Promise<PaidPayment | null>;
  /** Started again: a new response, a new payment. */
  reset(): void;
}

/** A key no other payment has: the provider's idempotency key, the same for every try of one response's payment. */
const newKey = () => `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * The form's side of a page's payment (`payment`): what is due — the amount, a number or a field's; its currency, a
 * code or a field's, else a money field's own; while `when` holds, above 0 — and paying it before the answers go.
 */
export function formPayment(host: PayHost): FormPayment {
  const payment = host.page.payment;
  let key = newKey();
  /** A field's value by name, where the page has that field; else the setting itself. */
  const read = (setting: string | number | undefined) => {
    if (typeof setting !== 'string' || !(setting in host.page.fields)) return setting;
    return host.state().values[setting];
  };
  return {
    due() {
      if (!payment || !host.dataSource?.pay) return null;
      if (payment.when && !host.holds(payment.when)) return null;
      const amount = read(payment.amount);
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
      const field = typeof payment.amount === 'string' ? host.page.fields[payment.amount] : undefined;
      const own = field?.type === 'monetary' ? field.currency ?? (field.currencyField ? host.state().values[field.currencyField] : undefined) : undefined;
      const written = payment.currency !== undefined ? read(payment.currency) : own;
      const currency = typeof written === 'string' ? written : written && typeof written === 'object' && 'label' in written ? String((written as { label: unknown }).label) : '';
      if (!/^[A-Z]{3}$/.test(currency)) return null;
      return { amount, currency, label: payment.label, ...(payment.description ? { description: payment.description } : {}), key };
    },
    covered(due) {
      const paid = host.state().paid;
      return !!paid && paid.key === due.key && paid.amount === due.amount && paid.currency === due.currency;
    },
    async pay(due) {
      const state = host.state();
      const request = {
        pageId: host.page.id,
        model: host.page.data.kind === 'record' ? host.page.data.model : '',
        recordId: state.recordId ?? null,
        amount: due.amount,
        currency: due.currency,
        label: due.label,
        ...(due.description ? { description: due.description } : {}),
        key: due.key,
        values: host.values(),
        language: host.language(),
      };
      let paid: PaidPayment | null = null;
      if (host.host?.pay) paid = await host.host.pay(due, request);
      else if (host.dataSource?.pay) {
        const answer = await host.dataSource.pay(request);
        paid = answer.status === 'paid' ? { amount: due.amount, currency: due.currency, key: due.key, ...(answer.reference ? { reference: answer.reference } : {}) } : null;
      }
      if (paid) host.set({ paid });
      return paid;
    },
    reset() {
      key = newKey();
      host.set({ paid: null });
    },
  };
}
