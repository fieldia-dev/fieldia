import type { LineField, RecordId, RelatedRecord, Value } from '@fieldia/core';
import { displayValue } from './display';
import { fillIn, maker, wordsFor } from './kind-parts';
import { formatMoney, formatNumber } from './numbers';
import { popup } from './popup';
import type { WidgetFactory } from './widgets';

/**
 * The payments made on a record: Flectra's invoice_payments_widget. The app
 * gives each payment — Flectra's own value (`{ content: [...] }`) or a plain
 * list — with its `date`, `amount`, `name`, `journal_name` and `ref`; each is
 * shown as "Paid on …" and its amount, and its button opens a small popover
 * of its details, with Open where the app gives a page for payments
 * (`options.model`, "account.payment"). `options.dueField` names the amount
 * still due, shown under them; money is in the currency of
 * `options.currencyField`.
 */

interface Payment {
  date: string;
  amount: number;
  name: string;
  journal: string;
  memo: string;
  id: RecordId | null;
}

const text = (value: unknown) => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

function paymentsOf(value: Value | undefined): Payment[] {
  const list = Array.isArray(value) ? value : value && typeof value === 'object' && Array.isArray((value as { content?: unknown }).content) ? (value as { content: unknown[] }).content : [];
  return (list as Record<string, unknown>[])
    .filter((p) => p && typeof p === 'object')
    .map((p) => ({
      date: text(p['date']),
      amount: typeof p['amount'] === 'number' ? p['amount'] : Number(p['amount']) || 0,
      name: text(p['name']),
      journal: text(p['journal_name'] ?? p['journal']),
      memo: text(p['ref'] ?? p['memo']),
      id: (p['account_payment_id'] ?? p['payment_id'] ?? p['id'] ?? null) as RecordId | null,
    }));
}

export const paymentsWidget: WidgetFactory = ({ node, id, document, labels, locale = 'en', dialogs }) => {
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const options = node.options ?? {};
  const currencyField = typeof options['currencyField'] === 'string' ? (options['currencyField'] as string) : null;
  const dueField = typeof options['dueField'] === 'string' ? (options['dueField'] as string) : null;
  const model = typeof options['model'] === 'string' ? (options['model'] as string) : 'account.payment';
  const list = make('ul', { class: 'fd-payments-list' });
  const due = make('div', { class: 'fd-payment-due', hidden: '' });
  const element = make('div', { id, class: 'fd-payments' }, list, due);
  const dateField = { type: 'date', label: '' } as LineField;
  let drawn = '';
  let closeOpen: (() => void) | null = null;

  return {
    element,
    focus: () => list.querySelector('button')?.focus(),
    destroy: () => closeOpen?.(),
    update(state) {
      const holder = currencyField ? state.values[currencyField] : null;
      const code = holder && typeof holder === 'object' && 'label' in holder ? (holder as RelatedRecord).label : typeof holder === 'string' ? holder : '';
      const money = (n: number) => (/^[A-Z]{3}$/.test(code) ? formatMoney(n, code, 2, locale) : formatNumber(n, 2, locale));
      const payments = paymentsOf(state.value);
      const owed = dueField ? state.values[dueField] : null;
      const key = JSON.stringify([payments, code, owed]);
      if (key === drawn) return;
      drawn = key;
      closeOpen?.();
      list.replaceChildren(
        ...payments.map((payment, n) => {
          const amount = money(payment.amount);
          const info = make('button', { type: 'button', class: 'fd-payment-info', 'aria-label': fillIn(words.paymentOf, { amount }), 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': `${id}-payment-${n}` }, 'i');
          const detail = (label: string, value: string) => (value ? [make('dt', {}, label), make('dd', {}, value)] : []);
          const open = payment.id !== null && dialogs?.canOpen(model) ? make('button', { type: 'button', class: 'fd-button fd-button-link fd-payment-open' }, words.openPayment) : null;
          const details = make(
            'div',
            { id: `${id}-payment-${n}`, class: 'fd-payment-details', role: 'dialog', 'aria-label': fillIn(words.paymentOf, { amount }), tabindex: '-1', hidden: '' },
            make('strong', {}, payment.name || amount),
            make('span', { class: 'fd-payment-details-amount' }, amount),
            make('dl', {}, ...detail(words.journal, payment.journal), ...detail(words.memo, payment.memo)),
            ...(open ? [open] : [])
          );
          const row = make('li', { class: 'fd-payment' }, info, make('span', { class: 'fd-payment-date' }, fillIn(words.paidOn, { date: displayValue(dateField, payment.date, {}, locale) })), make('span', { class: 'fd-payment-amount' }, amount), details);
          let refocus = false;
          const floating = popup(row, info, details, () => {
            if (refocus) info.focus();
            refocus = false;
            if (closeOpen === shut) closeOpen = null;
          });
          const shut = () => floating.close();
          info.addEventListener('click', () => {
            if (floating.isOpen()) return shut();
            closeOpen?.();
            floating.open();
            closeOpen = shut;
            (open ?? details).focus();
          });
          details.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            refocus = true;
            shut();
          });
          open?.addEventListener('click', () => {
            shut();
            void dialogs?.openRecord(model, { recordId: payment.id as RecordId, title: payment.name || amount });
          });
          return row;
        })
      );
      due.hidden = owed === null || owed === undefined;
      due.replaceChildren(make('span', {}, words.amountDue), make('strong', {}, typeof owed === 'number' ? money(owed) : ''));
    },
  };
};
