import { createMemoryDataSource, type DataSource, type ListRequest, type Page } from '@fieldia/core';
import { listPart } from './viewer-parts';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A list page's first page of records is asked for as its part is (the performance audit's M2): before the part has
 * come, not once it has come and run — and taken by the list, never asked for twice, where its first request is the
 * very one asked. Where the page alone cannot say what the list asks first (a card's lines, a person's starred search),
 * the list asks as ever. In a `-lazy` file: no part is in before the test.
 */

const customers = (layout: Record<string, unknown> = {}): Page =>
  ({
    fieldia: '0.11',
    id: 'customers',
    title: 'Customers',
    data: { kind: 'record', model: 'partner' },
    fields: { name: { type: 'char', label: 'Name' }, email: { type: 'char', label: 'Email' }, credit: { type: 'monetary', label: 'Credit', currencyField: 'currency_id' }, currency_id: { type: 'many2one', label: 'Currency', relation: 'currency' } },
    layout: { type: 'list', id: 'people', columns: ['name', 'email', 'credit'], sort: [{ field: 'name' }], pageSize: 20, ...layout },
  }) as unknown as Page;

const records = { partner: { 1: { name: 'Nile Traders', email: 'a@nile.example', credit: 1500, currency_id: { id: 1, label: 'EGP' } }, 2: { name: 'Delta Foods', email: 'b@delta.example', credit: 800, currency_id: { id: 1, label: 'EGP' } } } };

/** A source whose lists are counted, each with whether the list part had come when it was asked. */
function counted() {
  const source = createMemoryDataSource({ records });
  const asked: { request: ListRequest; partIn: boolean }[] = [];
  const list = source.list.bind(source);
  const counting: DataSource = { ...source, list: (request) => (asked.push({ request, partIn: !!listPart.loaded }), list(request)) };
  return { counting, asked };
}

const handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.replaceChildren();
});
const until = async (check: () => unknown) => {
  for (let waited = 0; !check() && waited < 3000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
};
const mount = (page: Page, dataSource: DataSource) => {
  const host = document.createElement('div');
  document.body.append(host);
  handles.push(mountViewer(host, { page, dataSource }));
  return host;
};
const names = (host: Element) => [...host.querySelectorAll('.fd-list-row')].map((row) => row.querySelector('td[data-col="name"]')?.textContent);

describe('a list page’s first records', () => {
  it('are asked for before the list’s part has come, once, and drawn from that answer — where the page alone says what the list asks first', async () => {
    expect(listPart.loaded).toBeUndefined();
    const plain = counted();
    const toned = counted();
    const first = mount(customers(), plain.counting);
    // A row's tone reads a field more: what the list asks first is its own to say.
    const second = mount(customers({ rowTones: [{ tone: 'danger', when: 'credit > 1000' }] }), toned.counting);
    // Asked as the page is mounted, its part still on its way.
    expect(plain.asked).toHaveLength(1);
    expect(plain.asked[0]).toMatchObject({ partIn: false, request: { model: 'partner', fields: ['name', 'email', 'credit', 'currency_id'], filter: [], sort: [{ field: 'name' }], offset: 0, limit: 20 } });
    expect(toned.asked).toHaveLength(0);
    await until(() => names(first).length === 2 && names(second).length === 2);
    expect(names(first)).toEqual(['Delta Foods', 'Nile Traders']);
    expect(names(second)).toEqual(['Delta Foods', 'Nile Traders']);
    // The list took that answer: its first page asked for once. The other asked once its part had come, as ever.
    expect(plain.asked.filter((one) => one.request.offset === 0)).toHaveLength(1);
    expect(toned.asked.filter((one) => one.request.offset === 0)).toEqual([expect.objectContaining({ partIn: true })]);
  });
});
