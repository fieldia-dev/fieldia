import { createMemoryDataSource, type OpenRequest, type OpenResult, type Page } from '@fieldia/core';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * Where a related list's rows and New open (`open`): a dialog of the page the app gives for the model, as in 0.25;
 * or, with `"open": "app"`, the app's own way first — its `onOpen`, or its host's `open` — asked as View all's is, with
 * the page it gives for the model (else the model's name), the row's record or a new one with its link to this record
 * filled in. Where the app's way does not take it, the dialog as ever; the list asks again once it is done.
 */

const invoices = {
  type: 'related',
  id: 'invoices',
  title: 'Invoices',
  model: 'invoice',
  field: 'partner_id',
  fields: {
    name: { type: 'char', label: 'Number' },
    amount: { type: 'integer', label: 'Total' },
    partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' },
  },
  columns: ['name', 'amount'],
  sort: [{ field: 'name' }],
};

const customer = (related: Record<string, unknown> = {}): Page =>
  ({
    fieldia: '0.4',
    id: 'customer',
    title: 'Customer',
    data: { kind: 'record', model: 'partner' },
    fields: { name: { type: 'char', label: 'Name' } },
    layout: { type: 'sheet', id: 'sheet', title: { field: 'name' }, children: [{ ...invoices, ...related }] },
  }) as unknown as Page;

/** The page the app gives for an invoice. */
const invoicePage = {
  fieldia: '0.4',
  id: 'invoice-form',
  title: 'Invoice',
  data: { kind: 'record', model: 'invoice' },
  fields: { name: { type: 'char', label: 'Number' }, amount: { type: 'integer', label: 'Total' }, partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' } },
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-partner', field: 'partner_id' }] },
} as unknown as Page;

const records = () => ({
  partner: { 1: { name: 'Acme' } },
  invoice: {
    11: { name: 'INV/1', amount: 100, partner_id: { id: 1, label: 'Acme' } },
    12: { name: 'INV/2', amount: 50, partner_id: { id: 1, label: 'Acme' } },
  },
});

const handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource({ records: records() });
  const handle = mountViewer(host, { page: customer({ open: 'app' }), dataSource, recordId: 1, ...options });
  handles.push(handle);
  await handle.drawn;
  await handle.form.settled();
  await until(() => host.querySelectorAll('[data-node="invoices"] .fd-list-row').length === 2);
  return { host, handle, dataSource };
}

const part = (host: HTMLElement) => host.querySelector('[data-node="invoices"]') as HTMLElement;
const firstRow = (host: HTMLElement) => part(host).querySelector('.fd-list-row') as HTMLElement;
const newButton = (host: HTMLElement) => [...part(host).querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'New');
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const lists = (source: { calls: { method: string }[] }) => source.calls.filter((call) => call.method === 'list').length;

/** The app's own way: each request kept, answered when the test says. */
function route(answer: (request: OpenRequest) => Promise<OpenResult> | undefined = () => Promise.resolve({ saved: true })) {
  const asked: OpenRequest[] = [];
  return { asked, onOpen: (request: OpenRequest) => (asked.push(request), answer(request)) };
}

describe('a related list’s rows and New, the app’s own way', () => {
  it('asks the app for a row’s record by the page it gives for the model, then asks for its records again', async () => {
    const app = route();
    const { host, dataSource } = await mount({ onOpen: app.onOpen, pages: { invoice: invoicePage } });
    expect(firstRow(host).classList.contains('fd-list-openable')).toBe(true);
    const before = lists(dataSource);
    firstRow(host).click();
    await until(() => app.asked.length === 1);
    expect(app.asked[0]).toEqual({ page: 'invoice-form', as: 'dialog', recordId: 11, title: 'INV/1' });
    expect(dialog()).toBeNull();
    await until(() => lists(dataSource) > before);
  });

  it('asks the app for New with its link to this record among the values', async () => {
    const app = route();
    const { host } = await mount({ onOpen: app.onOpen, pages: { invoice: invoicePage } });
    newButton(host)?.click();
    await until(() => app.asked.length === 1);
    expect(app.asked[0]).toEqual({ page: 'invoice-form', as: 'dialog', recordId: null, values: { partner_id: { id: 1, label: 'Acme' } }, title: 'New in Invoices' });
    expect(dialog()).toBeNull();
  });

  it('names the model where the app gives no page for it, rows and New offered for its way alone', async () => {
    const app = route();
    const { host } = await mount({ onOpen: app.onOpen });
    expect(newButton(host)).toBeDefined();
    firstRow(host).click();
    await until(() => app.asked.length === 1);
    expect(app.asked[0]).toMatchObject({ page: 'invoice', recordId: 11 });
  });

  it('opens the dialog as ever where the app’s way does not take it', async () => {
    const app = route(() => undefined);
    const { host } = await mount({ onOpen: app.onOpen, pages: { invoice: invoicePage } });
    firstRow(host).click();
    await until(() => dialog());
    expect(app.asked).toHaveLength(1);
    expect(dialog()?.querySelector('.fd-form-dialog-title')?.textContent).toBe('INV/1');
  });

  it('takes the app’s host’s open as its own way', async () => {
    const asked: OpenRequest[] = [];
    const { host } = await mount({ host: { open: (request) => (asked.push(request), Promise.resolve({ saved: false })) }, pages: { invoice: invoicePage } });
    firstRow(host).click();
    await until(() => asked.length === 1);
    expect(asked[0]).toMatchObject({ page: 'invoice-form', recordId: 11 });
    expect(dialog()).toBeNull();
  });

  it('keeps to the dialog unless the list says so: the app is not asked', async () => {
    const app = route();
    const { host } = await mount({ page: customer(), onOpen: app.onOpen, pages: { invoice: invoicePage } });
    firstRow(host).click();
    await until(() => dialog());
    expect(app.asked).toEqual([]);
  });

  it('offers neither rows nor New where the app has neither a way nor a page', async () => {
    const { host } = await mount();
    expect(firstRow(host).classList.contains('fd-list-openable')).toBe(false);
    expect(newButton(host)).toBeUndefined();
  });
});
