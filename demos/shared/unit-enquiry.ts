import type { MemoryDataSource, Page, PayRequest, PayResult, SendCodeRequest, SubmitRequest } from '@fieldia/core';
import unitEnquiry from '../../examples/pages/unit-enquiry.page.json';

/**
 * A property enquiry shared as a link — a broker's WhatsApp message, a campaign, a listing's button
 * (examples/pages/unit-enquiry.page.json): the link fills the unit asked about, and hidden fields no one sees say who
 * sent the person (`utm_source`, `utm_campaign`, the broker's `agent` code), sent with the answers.
 */
export const unitEnquiryPage = (): Page => unitEnquiry as Page;

/** The link a broker sends: the unit, the campaign, and their own code. */
export const BROKER_LINK = '?page=unit-enquiry&utm_source=whatsapp&utm_campaign=autumn-launch&agent=mona&unit=B-12';

/** A file as the log names it: its name, and whether it is stored (a link) or still its bytes. */
const fileWords = (file: { name: string; url?: string }) => `${file.name} (${file.url ? 'stored' : 'its bytes'})`;
/** What a value reads as in the log: empty as "—", files by their names, the rest as sent. */
const shown = (value: unknown): string => {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return '—';
  if (typeof value === 'string') return value;
  const files = (Array.isArray(value) ? value : [value]) as { name?: unknown; url?: string }[];
  if (files.every((file) => file && typeof file === 'object' && typeof file.name === 'string')) return files.map((file) => fileWords(file as { name: string; url?: string })).join(', ');
  return JSON.stringify(value);
};

/**
 * What the app was told with each response, under the form: every value its data source got (`SubmitRequest.values`),
 * the hidden ones marked, and beside them the mobile's proof, the payment taken and, for a send kept without signal, when
 * it was kept — listed as the source takes each, so a send waiting on the device shows only once it went. Opened plainly,
 * the enquiry's hidden fields are empty; opened from a broker's link, they say who sent the person.
 */
export function sentLog(doc: Document, page: Page, dataSource: MemoryDataSource): HTMLElement {
  const element = doc.createElement('section');
  element.className = 'demo-error-log demo-sent-log';
  element.setAttribute('aria-labelledby', 'demo-sent-log-title');
  const title = doc.createElement('h2');
  title.id = 'demo-sent-log-title';
  title.textContent = 'What the app was told with each response';
  const empty = doc.createElement('p');
  empty.textContent = 'Nothing sent yet.';
  const link = doc.createElement('a');
  link.href = BROKER_LINK;
  link.textContent = 'Open it as Mona’s WhatsApp link';
  const tip = doc.createElement('p');
  tip.append(link, ' — the unit filled in, and who sent you kept in hidden fields.');
  const list = doc.createElement('ol');
  // The broker's link, on the enquiry it fills.
  element.append(title, ...(page.id === 'unit-enquiry' ? [tip] : []), empty, list);
  const placed = new Set((JSON.stringify(page.layout).match(/"field":"[A-Za-z_]\w*"/g) ?? []).map((one) => one.slice(9, -1)));
  const submit = dataSource.submit.bind(dataSource);
  dataSource.submit = async (request: SubmitRequest) => {
    const answer = await submit(request);
    empty.hidden = true;
    const item = doc.createElement('li');
    const rows = doc.createElement('dl');
    const besides: [string, string][] = [
      ...Object.entries(request.values).map(([name, value]): [string, string] => [`${page.fields[name]?.label ?? name}${placed.has(name) ? '' : ' (hidden)'}`, shown(value)]),
      ...Object.entries(request.verified ?? {}).map(([name, proved]): [string, string] => [`${page.fields[name]?.label ?? name} proved by a code`, proved.proof ?? 'yes']),
      ...(request.payment ? [['Payment taken', `${request.payment.currency} ${request.payment.amount.toLocaleString('en')} · ${request.payment.reference ?? ''}`] as [string, string]] : []),
      ...(request.queued ? [['Kept on the device without signal', `since ${new Date(request.queued.at).toLocaleTimeString('en-GB')}`] as [string, string]] : []),
    ];
    for (const [label, value] of besides) {
      const term = doc.createElement('dt');
      term.textContent = label;
      const said = doc.createElement('dd');
      said.textContent = value;
      rows.append(term, said);
    }
    item.append(rows);
    list.append(item);
    return answer;
  };
  return element;
}

/** How a code's message reads on the phone, by the way it was sent. */
const APPS: Record<string, string> = { whatsapp: 'WhatsApp', sms: 'Messages' };

/**
 * A stand-in for the person's phone, over the form: each code the app sends (`sendCode`) arrives here as its WhatsApp
 * or SMS message would — "Palm Valley: your code is 482913" — for a person trying the demo to type, as an app's own
 * gateway would deliver it. The demo's memory source makes a new code each time, as a real one does.
 */
export function phoneBar(doc: Document, dataSource: MemoryDataSource): HTMLElement {
  const bar = doc.createElement('div');
  bar.className = 'demo-bar demo-panel-bar demo-meanwhile-bar fd-theme demo-phone-bar';
  const title = doc.createElement('strong');
  title.textContent = 'Your phone';
  const said = doc.createElement('span');
  said.className = 'demo-meanwhile-said demo-phone-message';
  said.setAttribute('role', 'status');
  said.textContent = 'A stand-in for WhatsApp and SMS: the codes the app sends arrive here.';
  bar.append(title, said);
  const send = dataSource.sendCode.bind(dataSource);
  dataSource.sendCode = async (request: SendCodeRequest) => {
    const answer = await send(request);
    const code = dataSource.codes[dataSource.codes.length - 1];
    if (code) said.textContent = `${APPS[request.by ?? ''] ?? 'Messages'} · Palm Valley: your code is ${code.code}. Do not share it.`;
    return answer;
  };
  return bar;
}

/**
 * A stand-in for an app's payment provider's checkout (Stripe Elements, Paymob's iframe, Fawry…), drawn in the payment
 * step's `slot` as an app draws its own: a test card, Pay or Decline. An app's own `pay` opens its provider's checkout
 * the same way — in the slot, or in a window of its own — and answers once it is over. Cancel aborts the request's
 * signal: the stand-in answers cancelled, as a provider's would.
 */
export function standInCheckout(request: PayRequest): Promise<PayResult> {
  const slot = request.slot as HTMLElement | undefined;
  if (!slot) return Promise.resolve({ status: 'paid', reference: `PAY-${Date.now().toString(36).toUpperCase()}` });
  const doc = slot.ownerDocument;
  return new Promise((settle) => {
    const box = doc.createElement('div');
    box.className = 'demo-checkout';
    const note = doc.createElement('p');
    note.textContent = 'A stand-in for your provider’s checkout (Stripe, Paymob, Fawry…). No card is charged.';
    const card = doc.createElement('input');
    card.className = 'fd-input';
    card.value = '4242 4242 4242 4242';
    card.setAttribute('aria-label', 'Card number');
    card.autocomplete = 'cc-number';
    const pay = doc.createElement('button');
    pay.type = 'button';
    pay.className = 'fd-button fd-button-primary';
    pay.textContent = 'Pay with this card';
    const decline = doc.createElement('button');
    decline.type = 'button';
    decline.className = 'fd-button';
    decline.textContent = 'Decline the card';
    const row = doc.createElement('div');
    row.className = 'demo-checkout-row';
    row.append(pay, decline);
    box.append(note, card, row);
    slot.append(box);
    const end = (result: PayResult) => {
      box.remove();
      settle(result);
    };
    pay.addEventListener('click', () => end({ status: 'paid', reference: `PAY-${1000 + Math.floor(Math.random() * 9000)}` }));
    decline.addEventListener('click', () => end({ status: 'failed', message: 'The card was declined.' }));
    request.signal?.addEventListener('abort', () => end({ status: 'cancelled' }));
  });
}
