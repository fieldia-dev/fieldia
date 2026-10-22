import { functionTable } from '../expression/app-functions';
import { compileModifier, type CompiledModifier } from '../expression/modifier';
import type { PaidPayment, PaymentDue, PayRequest } from './data-source';
import type { FormJoin, JoinHost } from './joins';

/** A payment step that shows what is due and settles once it is paid, or with null once the person goes back. */
export type PayStep = (due: PaymentDue, request: PayRequest) => Promise<PaidPayment | null>;

/** A form's payment code, made for it (`join`; `form.joined('pay')`). */
export interface FormPayment extends FormJoin {
  /** What is due now, or null: no payment asked, its condition not holding, nothing above 0, or no source to pay through. */
  due(): PaymentDue | null;
  /** Whether what was paid covers what is due now. */
  covered(due: PaymentDue): boolean;
  /**
   * Pay what is due before a send: through the payment step drawn with the page (`step`, the viewer's), else the host's
   * (`ActionHost.pay`), else the data source's `pay` itself. Paid, it is kept (`state.paid`) and the send carries it;
   * else null — nothing is sent.
   */
  pay(due: PaymentDue): Promise<PaidPayment | null>;
  /** The payment step a viewer drew with the page: what `pay` shows. */
  step(step: PayStep): void;
}

/** A key no other payment has: the provider's idempotency key, the same for every try of one response's payment. */
const newKey = () => `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * The pay part's side of a form (`payment` on its page): what is due — the amount, a number or a field's; its currency,
 * a code or a field's, else a money field's own; while `when` holds, above 0 — taken before the answers go, once the
 * form's own checks found nothing; not taken, nothing is sent; taken, the send carries it (`payment`).
 */
export function join(host: JoinHost): FormPayment {
  const { form, page, options, messages, set } = host;
  const payment = page.payment;
  const source = options.dataSource;
  let key = newKey();
  let shown: PayStep | undefined;
  let when: CompiledModifier | undefined;
  /** A field's value by name, where the page has that field; else the setting itself. */
  const read = (setting: string | number | undefined) => (typeof setting === 'string' && setting in page.fields ? form.getState().values[setting] : setting);
  const kit: FormPayment = {
    due() {
      if (!payment || !source?.pay) return null;
      if (payment.when) {
        const { context, env } = host.reading();
        if (!(when ??= compileModifier(payment.when, functionTable(options.functions))).evaluate(context, env)) return null;
      }
      const amount = read(payment.amount);
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
      const field = typeof payment.amount === 'string' ? page.fields[payment.amount] : undefined;
      const own = field?.type === 'monetary' ? (field.currency ?? (field.currencyField ? form.getState().values[field.currencyField] : undefined)) : undefined;
      const written = payment.currency !== undefined ? read(payment.currency) : own;
      const currency = typeof written === 'string' ? written : written && typeof written === 'object' && 'label' in written ? String((written as { label: unknown }).label) : '';
      if (!/^[A-Z]{3}$/.test(currency)) return null;
      return { amount, currency, label: payment.label, ...(payment.description ? { description: payment.description } : {}), key };
    },
    covered(due) {
      const paid = form.getState().paid;
      return !!paid && paid.key === due.key && paid.amount === due.amount && paid.currency === due.currency;
    },
    async pay(due) {
      const state = form.getState();
      const request: PayRequest = {
        pageId: page.id,
        model: page.data.kind === 'record' ? page.data.model : '',
        recordId: state.recordId ?? null,
        amount: due.amount,
        currency: due.currency,
        label: due.label,
        ...(due.description ? { description: due.description } : {}),
        key: due.key,
        // The answers shown, as a send carries them: what a checkout may fill its own boxes from.
        values: Object.fromEntries(form.shownFields().map((name) => [name, state.values[name] ?? null])),
        language: page.language ?? messages.locale,
      };
      let paid: PaidPayment | null = null;
      const step = shown ?? options.host?.pay;
      if (step) paid = await step(due, request);
      else if (source?.pay) {
        const answer = await source.pay(request);
        paid = answer.status === 'paid' ? { amount: due.amount, currency: due.currency, key: due.key, ...(answer.reference ? { reference: answer.reference } : {}) } : null;
      }
      if (paid) set({ paid });
      return paid;
    },
    step(step) {
      shown = step;
    },
    // Before a send the form's own checks let go: what is due taken, or nothing sent.
    async before(problems) {
      if (Object.keys(problems).length) return;
      const due = kit.due();
      if (due && !kit.covered(due) && !(await kit.pay(due))) return false;
      return undefined;
    },
    around(kind, sent, go) {
      const paid = form.getState().paid;
      return go(kind !== 'upload' && paid ? { ...sent, payment: paid } : sent);
    },
    // Another response, or another record: a payment of its own, by a new key.
    reset() {
      key = newKey();
      set({ paid: null });
    },
  };
  return kit;
}
