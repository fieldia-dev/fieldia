import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { PaidPayment, PaymentDue, PayRequest } from './data-source';

/**
 * A payment the answers wait for (`payment`), as the form keeps it: what is due — a fixed amount or a field's, its
 * currency, only while its condition holds — taken before anything is sent, through the host's payment step or the
 * source's own `pay`; nothing sent unpaid; a send that failed after paying sent again without paying twice; and nothing
 * asked where the source cannot `pay`.
 */

const enquiry = (payment: Page['payment'] = { label: 'Reservation fee', amount: 10000, currency: 'EGP', when: "visit == 'reserve'" }): Page => ({
  fieldia: '0.9',
  id: 'enquiry',
  data: { kind: 'responses' },
  fields: {
    name: { type: 'char', label: 'Your name' },
    visit: { type: 'selection', label: 'Visit', options: [{ value: 'viewing', label: 'Viewing' }, { value: 'reserve', label: 'Reserve' }] },
    deposit: { type: 'monetary', label: 'Deposit', currency: 'USD' },
    nights: { type: 'integer', label: 'Nights' },
    currency: { type: 'selection', label: 'Currency', options: [{ value: 'EUR', label: 'Euro' }] },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-visit', field: 'visit' }] },
  ...(payment ? { payment } : {}),
});

/** A host whose payment step answers as told, keeping what it was asked. */
function host(answer: (due: PaymentDue) => PaidPayment | null) {
  const asked: { due: PaymentDue; request: PayRequest }[] = [];
  return {
    asked,
    host: {
      open: async () => ({ saved: false }),
      say: () => undefined,
      ask: async () => true,
      pay: async (due: PaymentDue, request: PayRequest) => {
        asked.push({ due, request });
        return answer(due);
      },
    },
  };
}

describe('a payment the answers wait for', () => {
  it('asks what is due only while its condition holds, in its currency, with a key of its own', () => {
    const form = createForm({ page: enquiry(), dataSource: createMemoryDataSource() });
    expect(form.joined('pay')?.due()).toBeNull();
    form.setValue('visit', 'reserve');
    expect(form.joined('pay')?.due()).toMatchObject({ amount: 10000, currency: 'EGP', label: 'Reservation fee' });
    expect(form.joined('pay')?.due()?.key).toMatch(/^pay-/);
    // A field's amount, a money field's own currency; another field's currency; nothing above 0, nothing due.
    const deposit = createForm({ page: enquiry({ label: 'Deposit', amount: 'deposit' }), dataSource: createMemoryDataSource() });
    expect(deposit.joined('pay')?.due()).toBeNull();
    deposit.setValue('deposit', 250);
    expect(deposit.joined('pay')?.due()).toMatchObject({ amount: 250, currency: 'USD' });
    const nights = createForm({ page: enquiry({ label: 'Stay', amount: 'nights', currency: 'currency' }), dataSource: createMemoryDataSource() });
    nights.setValues({ nights: 3, currency: 'EUR' });
    expect(nights.joined('pay')?.due()).toMatchObject({ amount: 3, currency: 'EUR' });
    // No `pay` in the source: nothing is asked.
    const none = createForm({ page: enquiry({ label: 'Fee', amount: 5, currency: 'EGP' }), dataSource: { submit: async () => ({}) } });
    expect(none.joined('pay')?.due()).toBeNull();
  });

  it('sends nothing until it is paid, and sends the payment taken with the answers', async () => {
    const dataSource = createMemoryDataSource();
    let answer: PaidPayment | null = null;
    const { asked, host: steps } = host((due) => answer && { ...answer, key: due.key });
    const form = createForm({ page: enquiry(), dataSource, host: steps });
    form.setValues({ name: 'Mona', visit: 'reserve' });
    // The person went back to the answers: nothing sent, nothing said wrong.
    expect(await form.save()).toBe(false);
    expect(dataSource.responses).toEqual([]);
    expect(form.getState().saveProblem).toBeNull();
    expect(asked[0].request).toMatchObject({ pageId: 'enquiry', amount: 10000, currency: 'EGP', label: 'Reservation fee', values: { name: 'Mona', visit: 'reserve' }, language: 'en' });
    answer = { amount: 10000, currency: 'EGP', key: '', reference: 'PAY-7' };
    expect(await form.save()).toBe(true);
    expect(asked).toHaveLength(2);
    // The same key for every try of one response's payment.
    expect(asked[1].due.key).toBe(asked[0].due.key);
    expect(dataSource.responses[0].payment).toEqual({ amount: 10000, currency: 'EGP', key: asked[0].due.key, reference: 'PAY-7' });
    // Started again: a new response, a new payment with a new key.
    form.reset();
    expect(form.getState().paid).toBeNull();
    form.setValues({ name: 'Sara', visit: 'reserve' });
    expect(form.joined('pay')?.due()?.key).not.toBe(asked[0].due.key);
  });

  it('hands the checkout the values as they will be sent: the hidden fields a link filled among them', async () => {
    const dataSource = createMemoryDataSource();
    const { asked, host: steps } = host((due) => ({ amount: due.amount, currency: due.currency, key: due.key, reference: 'PAY-8' }));
    // A campaign's code no question shows, filled from the link the page was opened with (prefill): the checkout may price by it.
    const page: Page = { ...enquiry(), fields: { ...enquiry().fields, campaign: { type: 'char', label: 'Campaign' } }, prefill: { fromUrl: [{ param: 'utm_campaign', field: 'campaign' }] } };
    const form = createForm({ page, dataSource, host: steps, url: 'https://homes.example/enquiry?utm_campaign=open-day' });
    await form.settle();
    form.setValues({ name: 'Mona', visit: 'reserve' });
    expect(await form.save()).toBe(true);
    expect(asked[0].request.values).toEqual({ name: 'Mona', visit: 'reserve', campaign: 'open-day' });
    // What was sent is what the checkout was handed.
    expect(dataSource.responses[0].values).toEqual(asked[0].request.values);
  });

  it('sends again without paying twice where the send failed after the payment', async () => {
    let fail = true;
    const memory = createMemoryDataSource();
    const dataSource = { ...memory, submit: (request: Parameters<typeof memory.submit>[0]) => (fail ? Promise.reject(new TypeError('Failed to fetch')) : memory.submit(request)) };
    const { asked, host: steps } = host((due) => ({ amount: due.amount, currency: due.currency, key: due.key, reference: 'PAY-9' }));
    const form = createForm({ page: enquiry(), dataSource, host: steps });
    form.setValues({ visit: 'reserve' });
    expect(await form.save()).toBe(false);
    expect(form.getState().saveProblem?.kind).toBe('network');
    expect(form.getState().paid?.reference).toBe('PAY-9');
    fail = false;
    expect(await form.save()).toBe(true);
    expect(asked).toHaveLength(1);
    expect(memory.responses[0].payment?.reference).toBe('PAY-9');
  });

  it('asks the source’s pay itself where no host draws a payment step, and sends as before where none is due', async () => {
    const declined = createMemoryDataSource({ pay: () => ({ status: 'failed', message: 'Declined' }) });
    const form = createForm({ page: enquiry(), dataSource: declined });
    form.setValues({ visit: 'reserve' });
    expect(await form.save()).toBe(false);
    expect(declined.payments).toMatchObject([{ amount: 10000, result: { status: 'failed', message: 'Declined' } }]);
    expect(declined.responses).toEqual([]);
    form.setValues({ visit: 'viewing' });
    expect(await form.save()).toBe(true);
    expect(declined.responses[0]).not.toHaveProperty('payment');
    const paying = createMemoryDataSource();
    const paid = createForm({ page: enquiry(), dataSource: paying });
    paid.setValues({ visit: 'reserve' });
    expect(await paid.save()).toBe(true);
    expect(paying.responses[0].payment).toMatchObject({ amount: 10000, currency: 'EGP', reference: 'PAY-1' });
  });

  it('refuses a payment its page cannot take', () => {
    const said = (page: Page) => {
      const checked = checkPage(page);
      return checked.ok ? [] : checked.issues.map((issue) => `${issue.path}: ${issue.message}`);
    };
    expect(said(enquiry({ label: 'Fee', amount: 'name', currency: 'visits' }))).toEqual(['payment.amount: "name" is a char: the amount is a number, or a number or money field', 'payment.currency: no field "visits"']);
    expect(said(enquiry({ label: 'Fee', amount: 'nights' }))).toEqual(['payment.currency: say its currency: a code of three capitals ("EGP"), or a field holding one']);
    expect(said(enquiry({ label: 'Fee', amount: 5, currency: 'EGP', when: 'colour == 1' }))[0]).toMatch(/^payment\.when: /);
    expect(said(enquiry())).toEqual([]);
  });
});
