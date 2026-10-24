import { checkPage, createMemoryDataSource, type Line, type ListNode, type Page } from '@fieldia/core';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/** Orders whose rows open to their lines, a section among them; and customers whose rows open to their invoices. */
const orders: Page = {
  fieldia: '0.12',
  id: 'orders',
  title: 'Orders',
  data: { kind: 'record', model: 'sale.order' },
  fields: {
    name: { type: 'char', label: 'Order' },
    total: { type: 'monetary', label: 'Total', currency: 'EGP' },
    line_ids: {
      type: 'one2many',
      label: 'Lines',
      relation: 'sale.order.line',
      lineKinds: { field: 'display_type', text: 'name' },
      fields: {
        sequence: { type: 'integer', label: 'Sequence' },
        display_type: { type: 'selection', label: 'Type', options: [{ value: 'section', label: 'Section' }, { value: 'note', label: 'Note' }] },
        name: { type: 'char', label: 'Description' },
        qty: { type: 'float', label: 'Quantity' },
        price: { type: 'monetary', label: 'Price', currency: 'EGP' },
      },
    },
  },
  layout: { type: 'list', id: 'list', columns: ['name', 'total'], sort: [{ field: 'name' }], detail: { lines: 'line_ids', columns: ['name', 'qty', 'price'], sort: [{ field: 'sequence' }], limit: 3 } },
};
const line = (id: number, sequence: number, name: string, qty?: number, price?: number): Line => ({ key: `l${id}`, id, values: { sequence, name, ...(qty === undefined || price === undefined ? { display_type: 'section' } : { qty, price }) } });
const ordersSource = () =>
  createMemoryDataSource({
    records: {
      'sale.order': {
        1: { name: 'S001', total: 4180, line_ids: [line(11, 30, 'Desk lamp', 2, 380), line(10, 10, 'Lighting'), line(12, 20, 'Floor lamp', 1, 1200), line(13, 40, 'Bulbs', 10, 22), line(14, 50, 'Cable', 3, 215)] },
        2: { name: 'S002', total: 1890, line_ids: [line(21, 10, 'Office chair', 1, 1890)] },
      },
    },
  });

const customers: Page = {
  fieldia: '0.12',
  id: 'customers',
  title: 'Customers',
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: {
    type: 'list',
    id: 'list',
    columns: ['name'],
    sort: [{ field: 'name' }],
    detail: { title: 'Invoices', model: 'invoice', field: 'partner_id', fields: { name: { type: 'char', label: 'Number' }, partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' }, amount: { type: 'monetary', label: 'Amount', currency: 'EGP' } }, columns: ['name', 'amount'], sort: [{ field: 'name' }] },
  },
};
const customersSource = () =>
  createMemoryDataSource({
    records: {
      partner: { 1: { name: 'Nile Traders' }, 2: { name: 'Amira Clinics' } },
      invoice: {
        1: { name: 'INV/1', partner_id: { id: 1, label: 'Nile Traders' }, amount: 100 },
        2: { name: 'INV/2', partner_id: { id: 2, label: 'Amira Clinics' }, amount: 250 },
        3: { name: 'INV/3', partner_id: { id: 1, label: 'Nile Traders' }, amount: 75 },
      },
    },
  });

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(page: Page, options: Partial<ViewerOptions>) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, ...options });
  await until(() => host.querySelectorAll('.fd-list-row').length > 0);
  return host;
}
const row = (host: Element, name: string) => [...host.querySelectorAll<HTMLTableRowElement>('.fd-list-row')].find((tr) => tr.textContent?.includes(name)) as HTMLTableRowElement;
const toggleOf = (tr: Element) => tr.querySelector('.fd-list-detail-toggle') as HTMLButtonElement;
const detailOf = (host: Element, id: number) => host.querySelector(`.fd-list-detail[data-detail-of="${id}"]`) as HTMLElement | null;
const shown = (detail: Element | null) => [...(detail?.querySelectorAll('[role="rowgroup"]:last-child > [role="row"]') ?? [])].map((r) => [...r.children].map((cell) => cell.textContent).join(' | '));

describe('a row opened in place', () => {
  it('opens to its record’s lines under it, a page at a time, a section across the row, and closes', async () => {
    const source = ordersSource();
    const opened: unknown[] = [];
    const host = await mount(orders, { dataSource: source, onOpenRecord: (id) => void opened.push(id) });
    const s001 = row(host, 'S001');
    const toggle = toggleOf(s001);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Lines of S001');
    toggle.click();
    // The toggle's own press: the record is not opened.
    expect(opened).toEqual([]);
    await until(() => shown(detailOf(host, 1)).length === 3);
    const detail = detailOf(host, 1) as HTMLElement;
    expect(s001.nextElementSibling).toBe(detail);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(detail.querySelector('[role="table"]')?.getAttribute('aria-label')).toBe('Lines of S001');
    expect([...detail.querySelectorAll('[role="columnheader"]')].map((h) => h.textContent)).toEqual(['Description', 'Quantity', 'Price']);
    expect(shown(detail)).toEqual(['Lighting', 'Floor lamp | 1.00 | E£ 1,200.00', 'Desk lamp | 2.00 | E£ 380.00']);
    // Asked once: the record's lines, loaded.
    expect(source.calls.filter((call) => call.method === 'load')).toHaveLength(1);
    expect(detail.querySelector('.fd-pager-text')?.textContent).toBe('1–3 / 5');
    (detail.querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    await until(() => shown(detail)[0]?.startsWith('Bulbs'));
    expect(shown(detail)).toEqual(['Bulbs | 10.00 | E£ 22.00', 'Cable | 3.00 | E£ 215.00']);
    expect(source.calls.filter((call) => call.method === 'load')).toHaveLength(1);
    toggle.click();
    expect(detailOf(host, 1)).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens and closes from the keys — Right and Left, the other way right to left — and the arrows pass over it', async () => {
    const host = await mount(orders, { dataSource: ordersSource() });
    const s001 = row(host, 'S001');
    s001.focus();
    s001.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await until(() => shown(detailOf(host, 1)).length === 3);
    // Down from the row: the next record's row, past what it opened.
    s001.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(row(host, 'S002'));
    s001.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(detailOf(host, 1)).toBeNull();
  });

  it('waits as every wait does: drawn the first time past the delay, another page of it a refresh, what is shown kept', async () => {
    const source = customersSource();
    const list = source.list.bind(source);
    source.list = (request) => (request.model === 'invoice' ? new Promise((done) => setTimeout(() => done(list(request)), 250)) : list(request));
    const layout = customers.layout as ListNode;
    const host = await mount({ ...customers, layout: { ...layout, detail: { ...layout.detail, limit: 1 } } } as Page, { dataSource: source });
    const waits: string[] = [];
    handle?.on('loadingstart', ({ moment, part }) => waits.push(`${moment} ${part}`));
    toggleOf(row(host, 'Nile Traders')).click();
    const box = () => detailOf(host, 1)?.querySelector('.fd-list-detail-box') as HTMLElement;
    expect(box().getAttribute('aria-busy')).toBe('true');
    expect(box().querySelector('.fd-loader')).toBeNull();
    await until(() => box().querySelector('.fd-loader[data-moment="first"]'));
    await until(() => shown(detailOf(host, 1)).length === 1);
    expect(box().hasAttribute('aria-busy')).toBe(false);
    // Its next page in place of the one shown: a refresh, the row shown kept under a bar until the next comes.
    (box().querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    await until(() => box().querySelector('.fd-loader[data-moment="refresh"]'));
    expect(shown(detailOf(host, 1))).toEqual(['INV/1 | E£ 100.00']);
    await until(() => shown(detailOf(host, 1))[0] === 'INV/3 | E£ 75.00');
    expect(waits).toEqual(['first list-detail', 'refresh list-detail']);
  });

  it('keeps a row open as the list asks again, asking what it opens to again', async () => {
    const source = ordersSource();
    const host = await mount(orders, { dataSource: source });
    toggleOf(row(host, 'S002')).click();
    await until(() => shown(detailOf(host, 2)).length === 1);
    await handle?.reload();
    await until(() => detailOf(host, 2)?.previousElementSibling === row(host, 'S002'));
    expect(toggleOf(row(host, 'S002')).getAttribute('aria-expanded')).toBe('true');
    await until(() => source.calls.filter((call) => call.method === 'load').length === 1);
  });

  it('opens to the records that point at it, asked of the source a page at a time', async () => {
    const source = customersSource();
    const host = await mount(customers, { dataSource: source });
    toggleOf(row(host, 'Nile Traders')).click();
    await until(() => shown(detailOf(host, 1)).length === 2);
    expect(shown(detailOf(host, 1))).toEqual(['INV/1 | E£ 100.00', 'INV/3 | E£ 75.00']);
    const asked = source.calls.filter((call) => call.method === 'list').at(-1)?.request;
    expect(asked).toEqual(expect.objectContaining({ model: 'invoice', filter: [{ field: 'partner_id', op: '=', value: 1 }], sort: [{ field: 'name' }], offset: 0, limit: 5 }));
    expect(toggleOf(row(host, 'Nile Traders')).getAttribute('aria-label')).toBe('Invoices of Nile Traders');
    // Another opened too: several at once.
    toggleOf(row(host, 'Amira Clinics')).click();
    await until(() => shown(detailOf(host, 2)).length === 1);
    expect(shown(detailOf(host, 1))).toHaveLength(2);
  });

  it('says what it could not load, the source’s words after its own, with Retry', async () => {
    const source = customersSource();
    const list = source.list.bind(source);
    let fail = true;
    source.list = (request) => (request.model === 'invoice' && fail ? Promise.reject(new Error('The archive is offline.')) : list(request));
    const host = await mount(customers, { dataSource: source });
    toggleOf(row(host, 'Nile Traders')).click();
    const failed = () => detailOf(host, 1)?.querySelector('.fd-list-detail-failed') as HTMLElement;
    await until(() => failed() && !failed().hidden);
    expect(failed().textContent).toBe('Could not load the records. The archive is offline. Retry');
    expect(detailOf(host, 1)?.querySelector('[aria-busy]')).toBeNull();
    fail = false;
    (failed().querySelector('button') as HTMLButtonElement).click();
    await until(() => shown(detailOf(host, 1)).length === 2);
    expect(failed().hidden).toBe(true);
  });

  it('opens nothing where the source cannot answer: no toggle, the rows as they were', async () => {
    const source = ordersSource();
    delete (source as { load?: unknown }).load;
    const host = await mount(orders, { dataSource: source });
    expect(host.querySelector('.fd-list-detail-toggle')).toBeNull();
  });

  it('is checked: lines of the page’s, columns of their fields, records pointing at the list’s model', () => {
    const issues = (detail: ListNode['detail']) => {
      const result = checkPage({ ...orders, layout: { ...(orders.layout as ListNode), detail } });
      return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
    };
    expect(issues({ lines: 'name', columns: ['name'] })).toEqual(['layout.detail.lines: "name" is a char; a row opens to a table of lines of the page\'s (a one2many with its fields)']);
    expect(issues({ lines: 'line_ids', columns: ['nowhere'] })).toEqual(['layout.detail.columns[0]: no field "nowhere"']);
    expect(issues({ model: 'invoice', field: 'order_id', fields: { order_id: { type: 'many2one', label: 'Order', relation: 'partner' } }, columns: ['order_id'] })).toEqual([
      'layout.detail.field: "order_id" links to partner; the records a row opens to point at it by a many2one to sale.order',
    ]);
  });
});
