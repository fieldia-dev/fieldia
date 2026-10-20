import type { Facet, OpenRequest, OpenResult, Page, ResolvedFilter, Values } from '@fieldia/core';
import { demoNow } from './calendar';

/**
 * What the related lists inside a record open (examples/pages/customer-account.page.json and property.page.json):
 * the page of one of their records — an invoice, a quotation, a viewing — for a row's dialog and New's, and on its own
 * from a list's row; the list View all opens a home's viewings in (a customer's invoices are the invoices demo's,
 * gone to by the app's own route); and the quotations and viewings themselves, sample data made round the demos'
 * clock. A customer's invoices are shared/invoices.ts's.
 */

const EGP = { id: 1, label: 'EGP' };

const invoiceFields = {
  name: { type: 'char', label: 'Number', required: true },
  partner_id: { type: 'many2one', label: 'Customer', relation: 'partner', required: true },
  invoice_date: { type: 'date', label: 'Invoice date', default: 'today' },
  due_date: { type: 'date', label: 'Due date' },
  state: {
    type: 'selection',
    label: 'Status',
    default: 'draft',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'sent', label: 'Sent' },
      { value: 'paid', label: 'Paid' },
    ],
  },
  currency_id: { type: 'many2one', label: 'Currency', relation: 'currency', default: EGP },
  amount: { type: 'monetary', label: 'Amount', currencyField: 'currency_id', money: { currency: 'code' } },
};

/** An invoice on its own: what a customer's invoice opens in, and what New makes, its customer filled in. */
export const invoicePage = {
  fieldia: '0.7',
  id: 'invoice',
  title: 'An invoice',
  data: { kind: 'record', model: 'invoice' },
  records: { one: 'invoice', other: 'invoices', a: 'an invoice' },
  fields: invoiceFields,
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name', placeholder: 'INV/2026/0001' },
    children: [
      {
        type: 'section',
        id: 'invoice-main',
        columns: 2,
        children: [
          { type: 'field', id: 'f-partner', field: 'partner_id' },
          { type: 'field', id: 'f-state', field: 'state' },
          { type: 'field', id: 'f-date', field: 'invoice_date' },
          { type: 'field', id: 'f-due', field: 'due_date' },
          { type: 'field', id: 'f-amount', field: 'amount' },
          { type: 'field', id: 'f-currency', field: 'currency_id' },
        ],
      },
    ],
  },
} as unknown as Page;

const quotationFields = {
  name: { type: 'char', label: 'Number', required: true },
  partner_id: { type: 'many2one', label: 'Customer', relation: 'partner', required: true },
  date: { type: 'date', label: 'Date', default: 'today' },
  valid_until: { type: 'date', label: 'Valid until' },
  state: {
    type: 'selection',
    label: 'Status',
    default: 'draft',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'sent', label: 'Sent' },
      { value: 'won', label: 'Won' },
      { value: 'lost', label: 'Lost' },
    ],
  },
  currency_id: { type: 'many2one', label: 'Currency', relation: 'currency', default: EGP },
  amount: { type: 'monetary', label: 'Total', currencyField: 'currency_id', money: { currency: 'code' } },
};

/** A quotation on its own. */
export const quotationPage = {
  fieldia: '0.7',
  id: 'quotation',
  title: 'A quotation',
  data: { kind: 'record', model: 'quotation' },
  records: { one: 'quotation', other: 'quotations', a: 'a quotation' },
  fields: quotationFields,
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name', placeholder: 'S/2026/0001' },
    children: [
      {
        type: 'section',
        id: 'quotation-main',
        columns: 2,
        children: [
          { type: 'field', id: 'f-partner', field: 'partner_id' },
          { type: 'field', id: 'f-state', field: 'state' },
          { type: 'field', id: 'f-date', field: 'date' },
          { type: 'field', id: 'f-valid', field: 'valid_until' },
          { type: 'field', id: 'f-amount', field: 'amount' },
          { type: 'field', id: 'f-currency', field: 'currency_id' },
        ],
      },
    ],
  },
} as unknown as Page;

const viewingFields = {
  starts_at: { type: 'datetime', label: 'When', required: true },
  home_id: { type: 'many2one', label: 'Home', relation: 'home', required: true },
  client: { type: 'char', label: 'Client', required: true },
  phone: { type: 'char', label: 'Phone' },
  agent_id: { type: 'many2one', label: 'Agent', relation: 'agent' },
  state: {
    type: 'selection',
    label: 'Status',
    default: 'planned',
    options: [
      { value: 'planned', label: 'Planned' },
      { value: 'done', label: 'Done' },
      { value: 'no_show', label: 'No show' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
  },
  feedback: { type: 'char', label: 'Feedback' },
};

/** A viewing on its own: what a home's viewing opens in, and what New makes, its home filled in. */
export const viewingPage = {
  fieldia: '0.7',
  id: 'viewing',
  title: 'A viewing',
  data: { kind: 'record', model: 'viewing' },
  records: { one: 'viewing', other: 'viewings', a: 'a viewing' },
  phone: { country: 'EG' },
  fields: viewingFields,
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'client', placeholder: 'Client’s name' },
    children: [
      {
        type: 'section',
        id: 'viewing-main',
        columns: 2,
        children: [
          { type: 'field', id: 'f-home', field: 'home_id', colspan: 2 },
          { type: 'field', id: 'f-when', field: 'starts_at' },
          { type: 'field', id: 'f-state', field: 'state' },
          { type: 'field', id: 'f-phone', field: 'phone', widget: 'phone' },
          { type: 'field', id: 'f-agent', field: 'agent_id' },
          { type: 'field', id: 'f-feedback', field: 'feedback', colspan: 2 },
        ],
      },
    ],
  },
} as unknown as Page;

/** Every viewing, the list View all opens a home's in. */
export const viewingsPage = {
  fieldia: '0.7',
  id: 'viewings',
  title: 'Viewings',
  data: { kind: 'record', model: 'viewing' },
  records: { one: 'viewing', other: 'viewings', a: 'a viewing' },
  phone: { country: 'EG' },
  fields: viewingFields,
  layout: {
    type: 'list',
    id: 'viewings-list',
    columns: ['starts_at', 'home_id', 'client', 'phone', 'agent_id', 'state'],
    sort: [{ field: 'starts_at', desc: true }],
    pageSize: 10,
    searchFields: ['client', 'home_id', 'agent_id', 'state'],
    cells: { state: { widget: 'dot', options: { tones: { planned: 'info', done: 'success', no_show: 'warning', cancelled: 'muted' } } }, phone: { widget: 'phone' } },
    // On a phone, a card each: who, how it went, and when, where, the phone and the agent.
    card: { title: 'client', status: 'state', fields: ['starts_at', 'home_id', 'phone', 'agent_id'] },
    groupBy: ['agent_id', 'state', 'starts_at'],
  },
} as unknown as Page;

/** The same numbers every time: a demo that looks the same on each visit. */
function seeded(seed: number) {
  let n = seed;
  return () => {
    n = (n * 1103515245 + 12345) % 2147483648;
    return n / 2147483648;
  };
}
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The customers quoted, by their ids in the sample data: Nile Traders most, more than a page of them. */
const QUOTED: [id: number, name: string, count: number][] = [
  [1, 'Nile Traders', 7],
  [20, 'Amira Clinics', 2],
  [23, 'Delta Foods', 4],
  [25, 'Heliopolis Dental Care', 1],
  [28, 'Sahel Resorts', 3],
];

/** Quotations over the last five months up to now, the latest still open. */
export function sampleQuotations(now = demoNow()): Record<number, Values> {
  const random = seeded(7);
  const records: Record<number, Values> = {};
  let id = 1;
  for (const [partner, name, count] of QUOTED) {
    for (let i = 0; i < count; i++) {
      const back = Math.round(((count - i) * 150) / count - random() * 12);
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
      const valid = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 30);
      const state = back < 14 ? (random() < 0.5 ? 'draft' : 'sent') : random() < 0.6 ? 'won' : 'lost';
      records[id] = {
        name: `S/${date.getFullYear()}/${String(id).padStart(4, '0')}`,
        partner_id: { id: partner, label: name },
        date: dayKey(date),
        valid_until: dayKey(valid),
        state,
        currency_id: EGP,
        amount: 12000 + Math.round(random() * 600) * 250,
      };
      id++;
    }
  }
  return records;
}

/** The agents who show homes. */
export const AGENTS: Record<number, string> = { 41: 'Hana Fawzy', 42: 'Omar Said', 43: 'Rana Adel' };
const CLIENTS = ['Laila Hassan', 'Karim Mostafa', 'Nadia Ibrahim', 'Youssef Ali', 'Mariam Saleh', 'Tarek Nabil', 'Salma Farouk', 'Ahmed Zaki', 'Dina Kamel', 'Hossam Gaber'];
const FEEDBACK = ['Loved the light, asks about the price', 'Too far from her office', 'Wants a second visit with family', 'Asked for the service charge', 'Liked it; comparing with one in Maadi', ''];
/** How many viewings each home has had, the first home seven — more than a page — and some none. */
const VIEWINGS_PER_HOME = [7, 3, 0, 2, 5, 1, 4, 0, 2, 6];

/** Viewings of the sample homes, the past ones done, missed or called off, the coming ones planned, round now. */
export function sampleViewings(homes: Record<number, Values>, now = demoNow()): Record<number, Values> {
  const random = seeded(31);
  const records: Record<number, Values> = {};
  let id = 1;
  for (const [key, home] of Object.entries(homes)) {
    const homeId = Number(key);
    const count = VIEWINGS_PER_HOME[(homeId - 1) % VIEWINGS_PER_HOME.length];
    for (let i = 0; i < count; i++) {
      // From four weeks ago to ten days on, each on a day of its own, at a round hour of the working day.
      const span = 38 / count;
      const day = Math.round(-28 + span * i + random() * span * 0.8);
      const starts = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, 10 + Math.floor(random() * 8), random() < 0.5 ? 0 : 30);
      const past = starts.getTime() < now.getTime();
      const roll = random();
      const state = !past ? (roll < 0.1 ? 'cancelled' : 'planned') : roll < 0.7 ? 'done' : roll < 0.85 ? 'no_show' : 'cancelled';
      const agent = 41 + Math.floor(random() * 3);
      // Each a client of their own for the home: none seen twice.
      const client = CLIENTS[(homeId * 3 + i) % CLIENTS.length];
      records[id] = {
        starts_at: starts.toISOString(),
        home_id: { id: homeId, label: String(home['name']) },
        client,
        phone: `+2010${String(10000000 + Math.floor(random() * 89999999))}`,
        agent_id: { id: agent, label: AGENTS[agent] },
        state,
        feedback: state === 'done' ? FEEDBACK[Math.floor(random() * FEEDBACK.length)] : '',
      };
      id++;
    }
  }
  return records;
}

/** The list pages the app opens by its own route — View all of a customer's invoices — by their ids. */
const ROUTED = new Set(['invoices']);
/** The record pages the app opens by its own route — a customer's quotation, a row's and New's (`"open": "app"`). */
const ROUTED_RECORDS = new Set(['quotation']);

/**
 * The app's own way to open a page a step, View all, or a related list's row or New asks for (`onOpen`): a list of a
 * customer's invoices goes to that list's own address, its search in it as chips a person may take away (`search=`,
 * View all's "Customer: Nile Traders") or else its conditions kept (`filter=`); a quotation to its own page's, a new
 * one's values in it (`record=new&values=`), as an app's router would; anything else is the viewer's to open
 * (undefined).
 */
export function openByRoute(params: URLSearchParams, request: OpenRequest): Promise<OpenResult> | undefined {
  const list = ROUTED.has(request.page) && !!request.filter;
  if (!list && !ROUTED_RECORDS.has(request.page)) return undefined;
  const next = new URLSearchParams();
  // The reader's look and language go along; the record does not.
  for (const key of ['skin', 'theme', 'locale', 'dir', 'now']) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  next.set('page', request.page);
  if (list && request.search) next.set('search', JSON.stringify(request.search));
  else if (list) next.set('filter', JSON.stringify(request.filter));
  else {
    next.set('record', request.recordId == null ? 'new' : String(request.recordId));
    if (request.values) next.set('values', JSON.stringify(request.values));
  }
  location.search = next.toString();
  // The page goes: nothing comes back.
  return new Promise<OpenResult>(() => undefined);
}

/** What a new record's address fills in (`values=`, as `openByRoute` writes a related list's New's), or none. */
export function valuesFromQuery(params: URLSearchParams): Values | undefined {
  const given = params.get('record') === 'new' ? params.get('values') : null;
  if (!given) return undefined;
  try {
    const read = JSON.parse(given) as unknown;
    return read && typeof read === 'object' && !Array.isArray(read) ? (read as Values) : undefined;
  } catch {
    return undefined;
  }
}

/** The conditions a list's address keeps it to (`filter=`, as `openByRoute` writes them), or none. */
export function filterFromQuery(params: URLSearchParams): ResolvedFilter[] | undefined {
  const given = params.get('filter');
  if (!given) return undefined;
  try {
    const read = JSON.parse(given) as unknown;
    return Array.isArray(read) ? (read as ResolvedFilter[]) : undefined;
  } catch {
    return undefined;
  }
}

/** The search a list's address opens it with (`search=`, as `openByRoute` writes View all's), or none. */
export function searchFromQuery(params: URLSearchParams): Facet[] | undefined {
  const given = params.get('search');
  if (!given) return undefined;
  try {
    const read = JSON.parse(given) as unknown;
    return Array.isArray(read) ? (read as Facet[]) : undefined;
  } catch {
    return undefined;
  }
}

export const relatedLists = {
  /** Pages `?page=` opens: a record each a row opens, by its model's name. */
  pages: { invoice: invoicePage, quotation: quotationPage, viewing: viewingPage },
  /** A record of these models in a dialog: a row's, New's. */
  related: { invoice: invoicePage, quotation: quotationPage, viewing: viewingPage } as Record<string, Page>,
  /** The list View all opens a home's viewings in, by its id. */
  opened: { viewings: viewingsPage } as Record<string, Page>,
};
