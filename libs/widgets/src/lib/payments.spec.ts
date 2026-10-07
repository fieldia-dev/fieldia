import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { press } from './test-kinds';
import { createWidget, type WidgetDialogs } from './widgets';

/** Flectra's invoice_payments_widget: each payment's date and amount, its details in a small popover. */
const PAYMENTS = {
  title: 'Less Payment',
  outstanding: false,
  content: [
    { name: 'PBNK1/2026/0012', journal_name: 'Bank', amount: 600, date: '2026-10-01', ref: 'INV/2026/0042', account_payment_id: 12 },
    { name: 'PCSH1/2026/0003', journal_name: 'Cash', amount: 400.5, date: '2026-10-05', ref: '', account_payment_id: 13 },
  ],
};

function mount(dialogs?: WidgetDialogs, value: unknown = PAYMENTS) {
  const page = {
    fieldia: '0.1',
    id: 'invoice',
    data: { kind: 'record', model: 'account.move' },
    fields: {
      invoice_payments_widget: { type: 'json', label: 'Payments' },
      amount_residual: { type: 'monetary', label: 'Amount due', currencyField: 'currency_id' },
      currency_id: { type: 'many2one', label: 'Currency', relation: 'res.currency' },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-pay', field: 'invoice_payments_widget', widget: 'payments', options: { currencyField: 'currency_id', dueField: 'amount_residual' } }] },
  } as unknown as Page;
  const form = createForm({ page, values: { invoice_payments_widget: value, amount_residual: 140, currency_id: { id: 1, label: 'EGP' } } as never });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'invoice_payments_widget', field: page.fields['invoice_payments_widget'] as Field, node, id: 'fd-pay', document, labels: WIDGET_LABELS.en, dialogs });
  const host = document.createElement('div');
  host.append(widget.element);
  document.body.replaceChildren(host);
  widget.update({ value: form.getState().values['invoice_payments_widget'], values: form.getState().values, readonly: true, required: false, invalid: false });
  return { el: widget.element };
}

const rows = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('li.fd-payment')];

describe('a list of payments', () => {
  it('shows each payment’s date and amount, and the amount still due', () => {
    const { el } = mount();
    expect(rows(el).map((row) => row.querySelector('.fd-payment-date')?.textContent)).toEqual(['Paid on 1 Oct 2026', 'Paid on 5 Oct 2026']);
    expect(rows(el).map((row) => row.querySelector('.fd-payment-amount')?.textContent)).toEqual(['E£600.00', 'E£400.50']);
    expect(el.querySelector('.fd-payment-due')?.textContent).toBe('Amount dueE£140.00');
  });

  it('opens a payment’s details by its button, and closes them with Escape', () => {
    const { el } = mount();
    const info = rows(el)[0].querySelector('button') as HTMLButtonElement;
    expect(info.getAttribute('aria-label')).toBe('Payment of E£600.00');
    expect(info.getAttribute('aria-expanded')).toBe('false');
    info.click();
    const details = document.querySelector('.fd-payment-details') as HTMLElement;
    expect(details.hidden).toBe(false);
    expect(details.getAttribute('role')).toBe('dialog');
    expect(details.textContent).toContain('PBNK1/2026/0012');
    expect(details.textContent).toContain('Bank');
    expect(details.textContent).toContain('INV/2026/0042');
    press(document.activeElement as Element, 'Escape');
    expect(details.hidden).toBe(true);
    expect(document.activeElement).toBe(info);
  });

  it('opens the payment itself when the app gives a page for payments', async () => {
    const opened: unknown[] = [];
    const dialogs = { canOpen: (model: string) => model === 'account.payment', openRecord: async (model: string, request: unknown) => (opened.push([model, request]), null), searchMore: async () => null, editValues: async () => null } as WidgetDialogs;
    const { el } = mount(dialogs);
    (rows(el)[1].querySelector('button') as HTMLButtonElement).click();
    (document.querySelector('.fd-payment-details:not([hidden]) .fd-payment-open') as HTMLButtonElement).click();
    expect(opened).toEqual([['account.payment', { recordId: 13, title: 'PCSH1/2026/0003' }]]);
  });

  it('offers no Open without such a page, and takes a plain list of payments too', () => {
    const { el } = mount(undefined, [{ date: '2026-09-30', amount: 50, name: 'Cheque 118' }]);
    (rows(el)[0].querySelector('button') as HTMLButtonElement).click();
    expect(document.querySelector('.fd-payment-details .fd-payment-open')).toBeNull();
    expect(rows(el)).toHaveLength(1);
  });
});
