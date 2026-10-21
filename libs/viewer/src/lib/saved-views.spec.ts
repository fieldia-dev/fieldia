import { createMemoryDataSource, type ListNode, type ListRequest, type Page, type SavedView, type SaveViewRequest } from '@fieldia/core';
import { openingView } from './saved-views';
import { customers, partners, until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/** The customers, a column a person may hide among them: what a view keeps of the columns. */
const page: Page = { ...customers, layout: { ...(customers.layout as ListNode), pageSize: 4, optionalColumns: { country_id: 'show', state: 'show' } } };

/** The team's views and the person's own, as the app's server keeps them. */
const kept = (): Record<string, SavedView[]> => ({
  customers: [
    { id: 'v1', name: 'Active in Egypt', shared: true, by: 'Mona Adel', state: { facets: [{ kind: 'filters', ids: ['active'], labels: ['Active'] }], sort: [{ field: 'credit_limit', desc: true }] } },
    {
      id: 'v2',
      name: 'Mine, by country',
      mine: true,
      isDefault: true,
      state: {
        facets: [{ kind: 'filters', ids: ['blocked'], labels: ['Blocked'] }],
        sort: [{ field: 'country_id' }, { field: 'credit_limit', desc: true }],
        columns: [
          { colId: 'name', width: null, hide: false },
          { colId: 'credit_limit', width: 140, hide: false },
          { colId: 'country_id', width: null, hide: false },
          { colId: 'state', width: null, hide: true },
        ],
      },
    },
  ],
});

/** The customers' source, keeping their views. */
const withViews = (views: Record<string, SavedView[]> = kept()) => {
  const records = partners().records;
  return createMemoryDataSource({ records, views });
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions>) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr, .fd-list-empty:not([hidden])'));
  return host;
}
const heads = (host: Element) => [...host.querySelectorAll<HTMLElement>('.fd-list-table thead th[data-col]')].filter((th) => !th.hidden).map((th) => th.querySelector('.fd-list-head')?.textContent);
const chips = (host: Element) => [...host.querySelectorAll('.fd-facet-text')].map((chip) => chip.textContent);
const lists = (source: ReturnType<typeof withViews>) => source.calls.filter((call) => call.method === 'list').map((call) => call.request as ListRequest);
const button = (root: Element, name: string) => [...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name && !b.closest('[hidden]')) as HTMLButtonElement | undefined;
const menu = (host: Element) => host.querySelector('.fd-search-panel [data-group-kind="favourites"]') as HTMLElement;

describe('a list’s views kept on the app’s server', () => {
  it('opens on the person’s own default view — its search, its order and its columns — asked before any record', async () => {
    const source = withViews();
    const host = await mount({ dataSource: source });
    await until(() => chips(host).length === 1);
    expect(source.calls[0]).toEqual({ method: 'views', request: { pageId: 'customers', model: 'partner', list: 'list' } });
    // Its records asked once, already in the view's search and order: never the list's own first.
    expect(lists(source)).toHaveLength(1);
    expect(lists(source)[0].sort).toEqual([{ field: 'country_id' }, { field: 'credit_limit', desc: true }, { field: 'name' }]);
    expect(lists(source)[0].filter).toEqual([{ field: 'state', op: '=', value: 'blocked' }]);
    expect(chips(host)).toEqual(['Blocked']);
    expect(heads(host)).toEqual(['Name', 'Credit limit', 'Country']);
    expect(host.querySelector('th[data-col="country_id"]')?.getAttribute('aria-sort')).toBe('ascending');
    expect(host.querySelector('th[data-col="credit_limit"]')?.getAttribute('data-sort')).toBe('descending');
  });

  it('opens on the team’s default where the person has none of their own', () => {
    const team: SavedView = { id: 't', name: 'Team', shared: true, isDefault: true, state: { facets: [] } };
    const own: SavedView = { id: 'o', name: 'Own', mine: true, state: { facets: [] } };
    expect(openingView([team, own])).toBe(team);
    expect(openingView([team, { ...own, isDefault: true }])?.id).toBe('o');
    expect(openingView([own])).toBeNull();
  });

  it('lists the person’s own and the team’s, the team’s marked with who made it, and puts one on with a press', async () => {
    const source = withViews();
    const host = await mount({ dataSource: source });
    await until(() => chips(host).length === 1);
    button(host, 'Search options')!.click();
    const items = [...menu(host).querySelectorAll('.fd-favourite')];
    expect(items.map((item) => item.querySelector('.fd-view-name')?.textContent)).toEqual(['Active in Egypt', 'Mine, by country']);
    expect(items[0].querySelector('.fd-view-whose')?.textContent).toBe('Shared by Mona Adel');
    // Another's shared view is only put on: no ×; the person's own default starred.
    expect(items[0].querySelector('.fd-favourite-remove')).toBeNull();
    expect(items[1].querySelector('.fd-favourite-remove')).not.toBeNull();
    expect(items[1].querySelector('[data-default="true"]')).not.toBeNull();
    (items[0].querySelector('.fd-search-option') as HTMLButtonElement).click();
    await until(() => chips(host)[0] === 'Active');
    await until(() => lists(source).at(-1)?.sort[0]?.field === 'credit_limit');
    expect(lists(source).at(-1)?.sort).toEqual([{ field: 'credit_limit', desc: true }, { field: 'name' }]);
    expect(lists(source).at(-1)?.filter).toEqual([{ field: 'state', op: '=', value: 'active' }]);
    // Its columns left as they stood: the team's view keeps none.
    expect(heads(host)).toEqual(['Name', 'Credit limit', 'Country']);
  });

  it('saves the list as it stands, shared with the team, and lists it again as the server kept it', async () => {
    const source = withViews();
    const host = await mount({ dataSource: source });
    await until(() => chips(host).length === 1);
    button(host, 'Search options')!.click();
    button(menu(host), 'Save current search')!.click();
    const form = menu(host).querySelector('.fd-favourite-form') as HTMLElement;
    (form.querySelector('input.fd-input') as HTMLInputElement).value = 'Blocked, by country';
    const [, share] = [...form.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    share.click();
    button(form, 'Save')!.click();
    await until(() => menu(host).querySelectorAll('.fd-favourite').length === 3);
    const saved = source.calls.find((call) => call.method === 'saveView')?.request as SaveViewRequest;
    expect(saved.view).toEqual({
      name: 'Blocked, by country',
      shared: true,
      state: {
        facets: [{ kind: 'filters', ids: ['blocked'], labels: ['Blocked'] }],
        sort: [{ field: 'country_id' }, { field: 'credit_limit', desc: true }],
        columns: [
          { colId: 'name', width: null, hide: false },
          { colId: 'credit_limit', width: 140, hide: false },
          { colId: 'country_id', width: null, hide: false },
          { colId: 'state', width: null, hide: true },
        ],
      },
    });
    const mine = menu(host).querySelectorAll('.fd-favourite')[2];
    expect(mine.querySelector('.fd-view-whose')?.textContent).toBe('Shared with the team');
    expect(form.hidden).toBe(true);
  });

  it('says why a view was not saved, under its form, and keeps what was typed', async () => {
    const source = withViews();
    source.saveView = async () => {
      throw new Error('Views are full for this list.');
    };
    const host = await mount({ dataSource: source });
    await until(() => chips(host).length === 1);
    button(host, 'Search options')!.click();
    button(menu(host), 'Save current search')!.click();
    const form = menu(host).querySelector('.fd-favourite-form') as HTMLElement;
    const name = form.querySelector('input.fd-input') as HTMLInputElement;
    name.value = 'Late ones';
    button(form, 'Save')!.click();
    await until(() => !(form.querySelector('.fd-view-refused') as HTMLElement).hidden);
    expect(form.querySelector('.fd-view-refused')?.textContent).toBe('The view was not saved: Views are full for this list.');
    expect(form.hidden).toBe(false);
    expect(name.value).toBe('Late ones');
  });

  it('asks before deleting a view shared with the team, then lists them again', async () => {
    const views = kept();
    views['customers'].push({ id: 'v3', name: 'Ours', mine: true, shared: true, state: { facets: [] } });
    const source = withViews(views);
    const asked: string[] = [];
    const host = await mount({ dataSource: source, confirm: async (message) => (asked.push(message), true) });
    await until(() => chips(host).length === 1);
    button(host, 'Search options')!.click();
    button(menu(host), 'Delete Ours')!.click();
    await until(() => menu(host).querySelectorAll('.fd-favourite').length === 2);
    expect(asked).toEqual(['Delete “Ours” for everyone on the team?']);
    expect(source.calls.filter((call) => call.method === 'deleteView').map((call) => call.request)).toEqual([{ pageId: 'customers', model: 'partner', list: 'list', id: 'v3' }]);
  });

  it('says the views could not be loaded, opens on the list’s own search, and asks again on Retry', async () => {
    const source = withViews();
    let fail = true;
    const views = source.views!.bind(source);
    source.views = (request) => (fail ? Promise.reject(new Error('down')) : views(request));
    const host = await mount({ dataSource: source });
    await until(() => host.querySelectorAll('.fd-list-row').length === 4);
    button(host, 'Search options')!.click();
    const failed = menu(host).querySelector('.fd-views-failed') as HTMLElement;
    expect(failed.hidden).toBe(false);
    fail = false;
    button(failed, 'Retry')!.click();
    await until(() => menu(host).querySelectorAll('.fd-favourite').length === 2);
    expect(failed.hidden).toBe(true);
  });

  it('keeps favourites in the browser where the source keeps no views', async () => {
    const source = partners();
    expect(source.views).toBeUndefined();
    const host = await mount({ dataSource: source });
    button(host, 'Search options')!.click();
    expect(menu(host).querySelector('.fd-view-list')).toBeNull();
    expect(menu(host).querySelector('.fd-favourites-none')?.textContent).toBe('No saved searches yet.');
    // Use by default alone: nothing to share with.
    expect(menu(host).querySelectorAll('.fd-favourite-form input[type=checkbox]')).toHaveLength(1);
    expect(source.calls.some((call) => (call.method as string) === 'views')).toBe(false);
  });
});
