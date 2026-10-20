import { createMemoryDataSource, type ActionRequest, type DataSource, type ListRequest, type ListResult, type Page, type Values } from '@fieldia/core';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A tab's count of a related list in it (`count: { related }`): how many records the list lists for the record
 * shown, asked of the data source's `list` with the list's own conditions and `limit: 1` as the record is shown —
 * the tab open or not, the list not drawn — in the tab's pill and its name ("Invoices, 3"). Hidden while not known:
 * before the answer, on a record not saved yet, while the list is hidden; never another record's. The list, once
 * drawn, counts again after New or a row's button that takes one away, and its tab says so.
 */

const invoices = {
  type: 'related',
  id: 'invoices',
  model: 'invoice',
  field: 'partner_id',
  fields: {
    name: { type: 'char', label: 'Number' },
    amount: { type: 'integer', label: 'Total' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }] },
    partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' },
  },
  columns: ['name', 'amount', 'state'],
  sort: [{ field: 'name' }],
  limit: 2,
};

/** A customer with its notes in its first tab, and its invoices — counted — in its second. */
const customer = (related: Record<string, unknown> = {}, tab: Record<string, unknown> = {}): Page =>
  ({
    fieldia: '0.7',
    id: 'customer',
    title: 'Customer',
    data: { kind: 'record', model: 'partner' },
    fields: { name: { type: 'char', label: 'Name' } },
    layout: {
      type: 'sheet',
      id: 'sheet',
      title: { field: 'name' },
      children: [
        {
          type: 'tabs',
          id: 'tabs',
          children: [
            { type: 'tab', id: 'tab-main', label: 'Main', children: [{ type: 'text', id: 'hello', text: 'Hello' }] },
            { type: 'tab', id: 'tab-invoices', label: 'Invoices', count: { related: 'invoices' }, children: [{ type: 'section', id: 'inside', children: [{ ...invoices, ...related }] }], ...tab },
          ],
        },
      ],
    },
  }) as unknown as Page;

/** The page the app gives for an invoice: what New makes. */
const invoicePage = {
  fieldia: '0.7',
  id: 'invoice',
  title: 'Invoice',
  data: { kind: 'record', model: 'invoice' },
  fields: { name: { type: 'char', label: 'Number' }, amount: { type: 'integer', label: 'Total' }, partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' } },
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-partner', field: 'partner_id' }] },
} as unknown as Page;

const records = () => ({
  partner: { 1: { name: 'Acme' }, 2: { name: 'Globex' } },
  invoice: {
    11: { name: 'INV/1', amount: 100, state: 'posted', partner_id: { id: 1, label: 'Acme' } },
    12: { name: 'INV/2', amount: 50, state: 'draft', partner_id: { id: 1, label: 'Acme' } },
    13: { name: 'INV/3', amount: 70, state: 'posted', partner_id: { id: 2, label: 'Globex' } },
    14: { name: 'INV/4', amount: 20, state: 'posted', partner_id: { id: 1, label: 'Acme' } },
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
  const handle = mountViewer(host, { page: customer(), dataSource: createMemoryDataSource({ records: records() }), recordId: 1, ...options });
  handles.push(handle);
  await handle.drawn;
  await handle.form.settled();
  return { host, handle };
}

const tab = (host: HTMLElement) => host.querySelector('[data-node="tab-invoices"]') as HTMLButtonElement;
const pill = (host: HTMLElement) => tab(host).querySelector('.fd-tab-count') as HTMLElement;
/** What the tab shows and is named: its count, or null with none shown. */
const counted = (host: HTMLElement) => ({ count: pill(host).hidden ? null : pill(host).textContent, name: tab(host).getAttribute('aria-label') });
const rows = (host: HTMLElement) => host.querySelectorAll('[data-node="invoices"] .fd-list-row').length;
const lists = (source: { calls: { method: string; request: unknown }[] }) => source.calls.filter((call) => call.method === 'list').map((call) => call.request as ListRequest);

/** A source whose lists wait to be answered, each in turn. */
function held(memory = createMemoryDataSource({ records: records() })) {
  const waiting: { request: ListRequest; go: () => void }[] = [];
  let loading: Promise<void> | null = null;
  const dataSource: DataSource = {
    ...memory,
    load: async (request) => {
      if (loading) await loading;
      return memory.load!(request);
    },
    list: (request) => new Promise<ListResult>((resolve) => waiting.push({ request, go: () => void memory.list!(request).then(resolve) })),
  };
  return { dataSource, waiting, hold: () => new Promise<() => void>((ready) => (loading = new Promise((resolve) => ready(resolve)))) };
}

describe('a tab’s count of a related list in it', () => {
  it('asks for one record of them as the record is shown, its tab not open, and shows how many there are', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const { host } = await mount({ dataSource });
    await until(() => counted(host).count === '3');
    expect(counted(host)).toEqual({ count: '3', name: 'Invoices, 3' });
    // One ask, of a single record, with the list's own conditions: never Globex's; the list itself not drawn.
    expect(lists(dataSource)).toEqual([expect.objectContaining({ model: 'invoice', filter: [{ field: 'partner_id', op: '=', value: 1 }], offset: 0, limit: 1 })]);
    expect(rows(host)).toBe(0);
    expect(tab(host).getAttribute('aria-selected')).toBe('false');
    // Its tab opened: the list asks for its own page, and says the same.
    tab(host).click();
    await until(() => rows(host) === 2);
    expect(counted(host)).toEqual({ count: '3', name: 'Invoices, 3' });
  });

  it('shows none while it is not known, and keeps to its list’s own conditions', async () => {
    const { dataSource, waiting } = held();
    const { host } = await mount({ dataSource, page: customer({ filter: [{ field: 'state', op: '=', value: 'posted' }] }) });
    await until(() => waiting.length === 1);
    expect(counted(host)).toEqual({ count: null, name: null });
    expect(waiting[0].request.filter).toEqual([{ field: 'partner_id', op: '=', value: 1 }, { field: 'state', op: '=', value: 'posted' }]);
    waiting[0].go();
    await until(() => counted(host).count === '2');
    expect(counted(host)).toEqual({ count: '2', name: 'Invoices, 2' });
  });

  it('asks nothing for a record not saved yet; once saved, counts it: none yet', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const { host, handle } = await mount({ dataSource, recordId: null });
    expect(counted(host)).toEqual({ count: null, name: null });
    expect(lists(dataSource)).toEqual([]);
    handle.form.setValue('name', 'Initech');
    expect(await handle.save()).toBe(true);
    await until(() => counted(host).count === '0');
    expect(counted(host)).toEqual({ count: '0', name: 'Invoices, 0' });
  });

  it('never lays one record’s count on another: Acme’s answered while Globex is on its way', async () => {
    const { dataSource, waiting, hold } = held();
    const { host, handle } = await mount({ dataSource });
    await until(() => waiting.length === 1);
    const loaded = await hold();
    const moved = handle.form.openRecord(2);
    await until(() => handle.form.getState().status === 'loading');
    waiting[0].go();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(counted(host)).toEqual({ count: null, name: null });
    // Globex's asked once its values have come, and its own said.
    loaded();
    await moved;
    await until(() => waiting.length === 2);
    expect(waiting[1].request.filter).toEqual([{ field: 'partner_id', op: '=', value: 2 }]);
    waiting[1].go();
    await until(() => counted(host).count === '1');
  });

  it('counts again as the record is loaded again', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const { host, handle } = await mount({ dataSource });
    await until(() => counted(host).count === '3');
    dataSource.records['invoice'][15] = { name: 'INV/5', amount: 5, state: 'draft', partner_id: { id: 1, label: 'Acme' } };
    await handle.reload();
    await until(() => counted(host).count === '4');
  });

  it('follows its list: one made with New, one a row’s button takes away', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const asked: ActionRequest[] = [];
    const drop = { rowButtons: [{ type: 'button', id: 'drop', label: 'Drop', action: 'drop' }] };
    const { host } = await mount({
      dataSource,
      page: customer(drop),
      pages: { invoice: invoicePage },
      // The app takes the invoice away.
      onAction: (request) => {
        asked.push(request);
        for (const id of request.recordIds ?? []) delete dataSource.records['invoice'][id as number];
      },
    });
    await until(() => counted(host).count === '3');
    tab(host).click();
    await until(() => rows(host) === 2);
    const neu = [...host.querySelectorAll<HTMLButtonElement>('[data-node="invoices"] button')].find((b) => b.textContent === 'New') as HTMLButtonElement;
    neu.click();
    await until(() => document.querySelector('[role="dialog"]'));
    const name = document.querySelector('[role="dialog"] [data-node="f-name"] input') as HTMLInputElement;
    name.value = 'INV/0';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    ([...document.querySelectorAll('[role="dialog"] .fd-form-dialog-foot button')].find((b) => b.textContent === 'Save & Close') as HTMLButtonElement).click();
    await until(() => !document.querySelector('[role="dialog"]') && counted(host).count === '4');
    expect(counted(host).name).toBe('Invoices, 4');
    (host.querySelector('[data-node="invoices"] [data-action="drop"]') as HTMLButtonElement).click();
    await until(() => asked.length === 1 && counted(host).count === '3');
  });

  it('shows none while its list is hidden by its rule, and counts once it shows', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const { host, handle } = await mount({ dataSource, page: customer({ invisible: "name == 'Acme'" }) });
    expect(counted(host)).toEqual({ count: null, name: null });
    expect(lists(dataSource)).toEqual([]);
    handle.form.setValue('name', 'Acme Ltd');
    await until(() => counted(host).count === '3');
  });

  it('keeps an icon alone’s name while none is known, and groups a large count as its language does', async () => {
    const many: Record<number, Values> = {};
    for (let i = 0; i < 1284; i++) many[100 + i] = { name: `INV/${i}`, amount: i, state: 'draft', partner_id: { id: 1, label: 'Acme' } };
    const { dataSource, waiting } = held(createMemoryDataSource({ records: { ...records(), invoice: many } }));
    const { host } = await mount({ dataSource, page: customer({}, { icon: 'file', iconOnly: true }) });
    await until(() => waiting.length === 1);
    expect(counted(host)).toEqual({ count: null, name: 'Invoices' });
    waiting[0].go();
    await until(() => counted(host).count === '1,284');
    expect(counted(host).name).toBe('Invoices, 1,284');
  });

  it('counts nothing where the source cannot list records', async () => {
    const { list: _list, ...noList } = createMemoryDataSource({ records: records() });
    const { host } = await mount({ dataSource: noList as DataSource });
    expect(counted(host)).toEqual({ count: null, name: null });
  });
});
