import type { Form, Page, Values } from '@fieldia/core';
import unitEnquiry from '../../examples/pages/unit-enquiry.page.json';

/**
 * A property enquiry shared as a link — a broker's WhatsApp message, a campaign, a listing's button
 * (examples/pages/unit-enquiry.page.json): the link fills the unit asked about, and hidden fields no one sees say who
 * sent the person (`utm_source`, `utm_campaign`, the broker's `agent` code), sent with the answers.
 */
export const unitEnquiryPage = (): Page => unitEnquiry as Page;

/** The link a broker sends: the unit, the campaign, and their own code. */
export const BROKER_LINK = '?page=unit-enquiry&utm_source=whatsapp&utm_campaign=autumn-launch&agent=mona&unit=B-12';

/** What a value reads as in the log: empty as "—", the rest as sent. */
const shown = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : typeof value === 'string' ? value : JSON.stringify(value));

/**
 * What the app was told with each response, under the form: every value sent, the hidden ones marked — as an app's
 * data source gets them (`SubmitRequest.values`). Opened plainly, the hidden fields are empty; opened from a broker's
 * link, they say who sent the person.
 */
export function sentLog(doc: Document, form: Form, page: Page): HTMLElement {
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
  element.append(title, tip, empty, list);
  const placed = new Set((JSON.stringify(page.layout).match(/"field":"[A-Za-z_]\w*"/g) ?? []).map((one) => one.slice(9, -1)));
  form.on('send', ({ values }: { values: Values }) => {
    empty.hidden = true;
    const item = doc.createElement('li');
    const rows = doc.createElement('dl');
    for (const [name, value] of Object.entries(values)) {
      const term = doc.createElement('dt');
      term.textContent = `${page.fields[name]?.label ?? name}${placed.has(name) ? '' : ' (hidden)'}`;
      const said = doc.createElement('dd');
      said.textContent = shown(value);
      rows.append(term, said);
    }
    item.append(rows);
    list.append(item);
  });
  return element;
}
