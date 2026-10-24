import { createMemoryDataSource, type Page, type PayRequest, type PayResult } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * The payment step, as the viewer draws it (the pay part): Submit's checks passed, the questions give way to what is due
 * and Pay; Pay hands it to the app's `pay` inside the press, with a slot to draw its checkout in; paid, the answers go
 * and the ending shows; failed or cancelled, it says nothing was sent, with Pay again and Back to the answers.
 */

const reserve: Page = {
  fieldia: '0.13',
  id: 'reserve',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name', required: true } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
  payment: { label: 'Reservation fee', amount: 10000, currency: 'EGP', description: 'Taken off the price.' },
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const settled = () => new Promise((done) => setTimeout(done, 0));
const button = (host: HTMLElement, name: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((one) => one.textContent?.replace(/\s/g, ' ') === name && !one.hidden && !one.closest('[hidden]'));

/** A payment provider whose answer the test gives, and the requests it was given in the press. */
function provider() {
  const asked: PayRequest[] = [];
  let settle: (result: PayResult) => void = () => undefined;
  const dataSource = createMemoryDataSource({
    pay: (request) => {
      asked.push(request);
      return new Promise<PayResult>((done) => (settle = done));
    },
  });
  return { asked, dataSource, answer: (result: PayResult) => settle(result) };
}

describe('a payment the answers wait for', () => {
  it('shows what is due once the answers pass, pays through the app, and sends them paid', async () => {
    const { asked, dataSource, answer } = provider();
    const host = document.body.appendChild(document.createElement('div'));
    handle = mountViewer(host, { page: reserve, dataSource });
    const step = host.querySelector('.fd-pay') as HTMLElement;
    expect(step.hidden).toBe(true);
    // Answers that do not pass their checks never reach the payment.
    button(host, 'Submit')?.click();
    await settled();
    expect(step.hidden).toBe(true);
    handle.form.setValue('name', 'Mona');
    button(host, 'Submit')?.click();
    await settled();
    await settled();
    expect(step.hidden).toBe(false);
    expect(step.querySelector('.fd-pay-title')?.textContent).toBe('Reservation fee');
    expect(step.querySelector('.fd-pay-amount')?.textContent?.replace(/\s/g, ' ')).toBe('EGP 10,000.00');
    expect(step.querySelector('.fd-pay-words')?.textContent).toBe('Taken off the price.');
    expect((host.querySelector('.fd-sections, .fd-content > :not(.fd-pay):not(.fd-banner)') as HTMLElement | null)?.closest('[hidden]')).not.toBeNull();
    button(host, 'Pay EGP 10,000.00')?.click();
    await settled();
    // Asked of the app with a slot for the provider's checkout and a signal to stop it.
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ amount: 10000, currency: 'EGP', label: 'Reservation fee', values: { name: 'Mona' } });
    expect(asked[0].slot).toBe(step.querySelector('.fd-pay-slot'));
    expect(step.querySelector('.fd-pay-said')?.textContent).toBe('Waiting for the payment…');
    expect(button(host, 'Cancel')).toBeDefined();
    answer({ status: 'paid', reference: 'PAY-42' });
    await settled();
    await settled();
    expect(dataSource.responses[0].payment).toMatchObject({ amount: 10000, currency: 'EGP', reference: 'PAY-42' });
    expect((host.querySelector('.fd-done') as HTMLElement).hidden).toBe(false);
  });

  it('says a declined or cancelled payment sent nothing, pays again, and goes back to the answers', async () => {
    const { asked, dataSource, answer } = provider();
    const host = document.body.appendChild(document.createElement('div'));
    handle = mountViewer(host, { page: reserve, dataSource, values: { name: 'Sara' } });
    button(host, 'Submit')?.click();
    await settled();
    await settled();
    const step = host.querySelector('.fd-pay') as HTMLElement;
    button(host, 'Pay EGP 10,000.00')?.click();
    await settled();
    answer({ status: 'failed', message: 'The card was declined.' });
    await settled();
    expect(step.querySelector('.fd-pay-said')?.textContent).toBe('The payment did not go through: The card was declined. Nothing was sent.');
    button(host, 'Pay again')?.click();
    await settled();
    button(host, 'Cancel')?.click();
    expect((asked[1].signal as AbortSignal).aborted).toBe(true);
    answer({ status: 'cancelled' });
    await settled();
    expect(step.querySelector('.fd-pay-said')?.textContent).toBe('The payment was cancelled: nothing was sent.');
    button(host, 'Back to the answers')?.click();
    await settled();
    expect(step.hidden).toBe(true);
    expect(dataSource.responses).toEqual([]);
    expect((host.querySelector('[data-node="f-name"]') as HTMLElement).closest('[hidden]')).toBeNull();
  });

  it('asks for nothing where the source cannot pay', async () => {
    const dataSource = createMemoryDataSource();
    const host = document.body.appendChild(document.createElement('div'));
    handle = mountViewer(host, { page: reserve, dataSource: { submit: (request) => dataSource.submit(request) }, values: { name: 'Omar' } });
    expect(host.querySelector('.fd-pay')).toBeNull();
    button(host, 'Submit')?.click();
    await settled();
    await settled();
    expect(dataSource.responses).toHaveLength(1);
  });
});
