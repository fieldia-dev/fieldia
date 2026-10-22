import { checkPage, createMemoryDataSource, type GroupRequest, type ListNode, type ListRequest, type Page, type Values } from '@fieldia/core';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/** A chart of accounts too big for a page: its classes at the top, their accounts loaded as each opens. */
const chart: Page = {
  fieldia: '0.10',
  id: 'chart',
  title: 'Chart of accounts',
  records: { one: 'account', other: 'accounts' },
  data: { kind: 'record', model: 'account' },
  fields: { code: { type: 'char', label: 'Code' }, name: { type: 'char', label: 'Account' }, parent_id: { type: 'many2one', label: 'Under', relation: 'account' } },
  layout: { type: 'list', id: 'list', columns: ['name', 'code'], sort: [{ field: 'code' }], pageSize: 3, parentField: 'parent_id', loadChildren: true },
};
const link = (id: number, label: string) => ({ id, label });
const accounts = () => {
  const records: Record<number, Values> = {
    1: { code: '1', name: 'Assets', parent_id: null },
    2: { code: '2', name: 'Liabilities', parent_id: null },
    3: { code: '3', name: 'Equity', parent_id: null },
    4: { code: '4', name: 'Income', parent_id: null },
    10: { code: '11', name: 'Current assets', parent_id: link(1, 'Assets') },
    11: { code: '12', name: 'Fixed assets', parent_id: link(1, 'Assets') },
    20: { code: '111', name: 'Cash', parent_id: link(10, 'Current assets') },
  };
  // Current assets holds five banks: a page and more of them.
  for (let i = 0; i < 5; i++) records[30 + i] = { code: `112${i}`, name: `Bank ${i + 1}`, parent_id: link(10, 'Current assets') };
  return createMemoryDataSource({ records: { account: records } });
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions>, page: Page = chart) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, ...options });
  await until(() => host.querySelectorAll('.fd-list-row').length > 0);
  return host;
}
/** Each row on show, by its name, set in by its depth. */
const shown = (host: Element) =>
  [...host.querySelectorAll<HTMLElement>('.fd-list-row')].filter((tr) => !tr.hidden).map((tr) => `${'  '.repeat(Number(tr.dataset['depth'] ?? 0))}${tr.querySelector('td[data-col="name"]')?.textContent}`);
const row = (host: Element, name: string) => [...host.querySelectorAll<HTMLElement>('.fd-list-row')].find((tr) => tr.querySelector('td[data-col="name"]')?.textContent?.includes(name)) as HTMLElement;
const twisty = (tr: Element) => tr.querySelector('.fd-list-twisty') as HTMLButtonElement | null;

describe('a tree loaded as it opens', () => {
  it('lists the records with no parent a page at a time, and counts each one’s children in one ask', async () => {
    const source = accounts();
    const host = await mount({ dataSource: source });
    await until(() => twisty(row(host, 'Assets')));
    expect(shown(host)).toEqual(['Assets', 'Liabilities', 'Equity']);
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('1–3 of 4 accounts');
    const asked = source.calls.find((call) => call.method === 'list')?.request as ListRequest;
    expect(asked.filter).toEqual([{ field: 'parent_id', op: 'notset', value: null }]);
    const counted = source.calls.find((call) => call.method === 'groups')?.request as GroupRequest;
    expect(counted).toEqual(expect.objectContaining({ field: 'parent_id', filter: [{ field: 'parent_id', op: 'in', value: [1, 2, 3] }] }));
    // Assets opens; Liabilities has nothing under it: no toggle.
    expect(twisty(row(host, 'Assets'))?.getAttribute('aria-expanded')).toBe('false');
    expect(twisty(row(host, 'Liabilities'))).toBeNull();
    // Expand all would load the whole tree: not offered.
    expect((host.querySelector('[aria-label="Expand all"]') as HTMLElement).hidden).toBe(true);
  });

  it('asks for a parent’s children as it opens, a page at a time with Show more, and closes them', async () => {
    const source = accounts();
    const host = await mount({ dataSource: source });
    await until(() => twisty(row(host, 'Assets')));
    twisty(row(host, 'Assets'))!.click();
    await until(() => row(host, 'Current assets') && twisty(row(host, 'Current assets')));
    expect(shown(host)).toEqual(['Assets', '  Current assets', '  Fixed assets', 'Liabilities', 'Equity']);
    twisty(row(host, 'Current assets'))!.click();
    await until(() => row(host, 'Bank 2'));
    expect(shown(host)).toEqual(['Assets', '  Current assets', '    Cash', '    Bank 1', '    Bank 2', '  Fixed assets', 'Liabilities', 'Equity']);
    const more = host.querySelector('.fd-list-tree-more button') as HTMLButtonElement;
    expect(more.textContent).toBe('Show 3 more');
    more.click();
    await until(() => row(host, 'Bank 5'));
    expect(host.querySelector('.fd-list-tree-more')).toBeNull();
    // Closed: everything under it hides; opened again, as it was, asked no more.
    const asks = source.calls.filter((call) => call.method === 'list').length;
    twisty(row(host, 'Assets'))!.click();
    expect(shown(host)).toEqual(['Assets', 'Liabilities', 'Equity']);
    twisty(row(host, 'Assets'))!.click();
    await until(() => !row(host, 'Bank 5').hidden);
    expect(source.calls.filter((call) => call.method === 'list')).toHaveLength(asks);
  });

  it('opens and closes from the keys, and keeps what was open as the list asks again', async () => {
    const host = await mount({ dataSource: accounts() });
    await until(() => twisty(row(host, 'Assets')));
    const assets = row(host, 'Assets');
    assets.focus();
    assets.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await until(() => row(host, 'Fixed assets'));
    await handle?.reload();
    await until(() => row(host, 'Fixed assets') && !row(host, 'Fixed assets').hidden);
    expect(twisty(row(host, 'Assets'))?.getAttribute('aria-expanded')).toBe('true');
    row(host, 'Assets').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(shown(host)).toEqual(['Assets', 'Liabilities', 'Equity']);
  });

  it('shows a search’s matches whatever their depth, each with its parent named', async () => {
    const host = await mount({ dataSource: accounts() });
    const box = host.querySelector('.fd-search-input') as HTMLInputElement;
    box.value = 'bank';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await until(() => host.querySelector('[role="option"]'));
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await until(() => row(host, 'Bank 1'));
    expect(row(host, 'Bank 1').querySelector('.fd-list-tree-in')?.textContent).toBe('in Current assets');
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('1–3 of 5 accounts');
  });

  it('offers each row to open where the source cannot count, one with none losing its toggle as it opens', async () => {
    const source = accounts();
    delete (source as { groups?: unknown }).groups;
    const host = await mount({ dataSource: source });
    await until(() => twisty(row(host, 'Liabilities')));
    twisty(row(host, 'Liabilities'))!.click();
    await until(() => !twisty(row(host, 'Liabilities')));
    expect(row(host, 'Liabilities').querySelector('.fd-list-twisty-room')).not.toBeNull();
  });

  it('is checked: a tree’s, by the link its rows nest under', () => {
    const result = checkPage({ ...chart, layout: { ...(chart.layout as ListNode), parentField: undefined } as ListNode });
    expect(result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`)).toEqual(['layout.loadChildren: children load as a parent opens in a tree: name the link its rows nest under (parentField)']);
  });
});

describe('a tree’s toggles', () => {
  it('names each toggle by its row, at every depth', async () => {
    const host = await mount({ dataSource: accounts() });
    await until(() => twisty(row(host, 'Assets')));
    twisty(row(host, 'Assets'))!.click();
    await until(() => row(host, 'Current assets') && twisty(row(host, 'Current assets')));
    expect(twisty(row(host, 'Current assets'))?.getAttribute('aria-label')).toBe('Current assets');
  });
});
