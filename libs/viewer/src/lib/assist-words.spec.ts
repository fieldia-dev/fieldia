import { assistStandIn, createMemoryDataSource, type DataSource, type ListRequest, type MemoryDataSource, type Page, type SearchToFilterResult } from '@fieldia/core';
import { assistPart, filtersPart, listPart } from './viewer-parts';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A list's search in plain words turned into filters (`searchToFilter`), as a buyer meets it: "villas in New Cairo
 * under 15M" — a ✦ beside the box while it holds words; pressed, the words become the list's own filters, shown and
 * taken away as any, with what they were read as and Undo, which puts the search and the words back.
 */

const homes = (search: 'bar' | 'fields' = 'bar', on = true): Page =>
  ({
    fieldia: '0.10',
    id: 'homes',
    data: { kind: 'record', model: 'home' },
    fields: {
      name: { type: 'char', label: 'Home' },
      kind: { type: 'selection', label: 'Type', options: [{ value: 'flat', label: 'Flat' }, { value: 'villa', label: 'Villa' }] },
      district: { type: 'selection', label: 'District', options: [{ value: 'zamalek', label: 'Zamalek' }, { value: 'new_cairo', label: 'New Cairo' }] },
      price: { type: 'monetary', label: 'Price', currency: 'EGP', digits: [12, 0] },
      bedrooms: { type: 'integer', label: 'Bedrooms' },
    },
    layout: {
      type: 'list',
      id: 'homes',
      columns: ['name', 'kind', 'district', 'price', 'bedrooms'],
      searchFields: ['name'],
      ...(search === 'fields' ? { search, filterFields: ['kind', 'district', 'price', 'bedrooms'], filterRanges: { bedrooms: {} } } : {}),
      searchToFilter: on,
    },
  }) as Page;

const records = () => ({
  home: {
    1: { name: 'Villa by the lake', kind: 'villa', district: 'new_cairo', price: 14_000_000, bedrooms: 5 },
    2: { name: 'Villa with a garden', kind: 'villa', district: 'new_cairo', price: 21_000_000, bedrooms: 6 },
    3: { name: 'Flat on the Nile', kind: 'flat', district: 'zamalek', price: 9_000_000, bedrooms: 2 },
  },
});
const source = () => createMemoryDataSource({ records: records(), assist: assistStandIn() });

let handle: ViewerHandle | null = null;
let host: HTMLElement;
beforeAll(() => Promise.all([assistPart.load(), listPart.load(), filtersPart.load()]));
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
const settle = () => new Promise((done) => setTimeout(done, 0));
/** Words as read: the pound as E£ or EGP, as the engine's Intl writes it, and its spaces plain. */
const plain = (text: string | null | undefined) => (text ?? '').replace('E£', 'EGP').replace(/[\u00a0\u202f]/g, ' ').trim();

async function mount(page: Page, dataSource: DataSource) {
  host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource });
  await handle.drawn;
  await settle();
  return handle;
}
const words = () => host.querySelector<HTMLButtonElement>('.fd-assist-words');
const line = () => host.querySelector<HTMLElement>('.fd-assist-read');
const typeIn = (input: HTMLInputElement, text: string) => {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const shown = () => [...host.querySelectorAll('.fd-list-row')].map((row) => row.getAttribute('data-id'));
const lastFilter = (ds: MemoryDataSource) => (ds.calls.filter((call) => call.method === 'list').at(-1)?.request as ListRequest).filter;

describe('a search in plain words read as filters', () => {
  it('offers ✦ beside the search bar’s box while it holds words, and makes its chips', async () => {
    const ds = source();
    await mount(homes(), ds);
    const input = host.querySelector('.fd-search-input') as HTMLInputElement;
    expect(words()?.hidden).toBe(true);
    typeIn(input, 'villas');
    expect(words()?.hidden).toBe(true);
    typeIn(input, 'villas in New Cairo under 15M');
    expect(words()?.hidden).toBe(false);
    expect(words()?.getAttribute('aria-label')).toBe('Turn these words into filters');
    words()?.click();
    await settle();
    await settle();
    // The amount as the page writes it, in its currency (E£, or EGP, as the engine's Intl writes the pound).
    const chips = [...host.querySelectorAll('.fd-facet-text')].map((chip) => plain(chip.textContent));
    expect(chips).toEqual(['Type: Villa', 'District: New Cairo', 'Price: up to EGP 15,000,000']);
    expect(input.value).toBe('');
    expect(plain(line()?.textContent)).toContain('Read as filters: Type: Villa · District: New Cairo · Price: up to EGP 15,000,000');
    expect(line()?.textContent).toContain('Stand-in AI, no model');
    expect(lastFilter(ds)).toEqual([
      { field: 'kind', op: '=', value: 'villa' },
      { field: 'district', op: '=', value: 'new_cairo' },
      { field: 'price', op: '<=', value: 15_000_000 },
    ]);
    await settle();
    expect(shown()).toEqual(['1']);
    // Undo: the search as it was, the words back in the box.
    [...(line()?.querySelectorAll('button') ?? [])].find((b) => b.textContent === 'Undo')?.click();
    await settle();
    expect(host.querySelectorAll('.fd-facet')).toHaveLength(0);
    expect(input.value).toBe('villas in New Cairo under 15M');
    expect(line()?.hidden).toBe(true);
  });

  it('ticks the filter bar’s values and sets its ranges, Undo putting back the keyword', async () => {
    const ds = source();
    await mount(homes('fields'), ds);
    const input = host.querySelector('.fd-filter-keyword') as HTMLInputElement;
    typeIn(input, '4+ bedrooms villas under 15M');
    words()?.click();
    await settle();
    await settle();
    const buttons = [...host.querySelectorAll('.fd-filter-field button[data-picked]')].map((b) => plain(b.textContent));
    expect(buttons).toEqual(['Type: Villa', 'Price: up to EGP 15,000,000', 'Bedrooms: 4+']);
    expect(input.value).toBe('');
    expect(lastFilter(ds)).toEqual([
      { field: 'kind', op: '=', value: 'villa' },
      { field: 'price', op: '<=', value: 15_000_000 },
      { field: 'bedrooms', op: '>=', value: 4 },
    ]);
    [...(line()?.querySelectorAll('button') ?? [])].find((b) => b.textContent === 'Undo')?.click();
    await settle();
    expect(host.querySelectorAll('.fd-filter-field button[data-picked]')).toHaveLength(0);
    expect(input.value).toBe('4+ bedrooms villas under 15M');
  });

  it('is hidden where the source cannot read words, or the list does not ask', async () => {
    await mount(homes(), createMemoryDataSource({ records: records() }));
    expect(words()).toBeNull();
    handle?.destroy();
    await mount(homes('bar', false), source());
    expect(words()).toBeNull();
  });

  it('leaves an answer unheard once the person types on, and says when nothing was found', async () => {
    let answer: (result: SearchToFilterResult) => void = () => undefined;
    const slow = { ...source(), searchToFilter: () => new Promise<SearchToFilterResult>((resolve) => (answer = resolve)) };
    await mount(homes(), slow);
    const input = host.querySelector('.fd-search-input') as HTMLInputElement;
    typeIn(input, 'villas please now');
    words()?.click();
    await settle();
    expect(line()?.textContent).toContain('Reading your words…');
    typeIn(input, 'flats please now');
    answer({ filter: [{ field: 'kind', op: '=', value: 'villa' }] });
    await settle();
    expect(host.querySelectorAll('.fd-facet')).toHaveLength(0);
    handle?.destroy();
    await mount(homes(), source());
    const box = host.querySelector('.fd-search-input') as HTMLInputElement;
    typeIn(box, 'something nice');
    words()?.click();
    await settle();
    await settle();
    expect(line()?.textContent).toContain('Read as filters: something nice');
    expect([...host.querySelectorAll('.fd-facet-text')].map((chip) => chip.textContent)).toEqual(['Home: something nice']);
  });
});

describe('a search read as filters, kept by name', () => {
  const asked = (ds: MemoryDataSource) => ds.calls.filter((call) => call.method === 'searchToFilter').length;
  const chips = () => [...host.querySelectorAll('.fd-facet-text')].map((chip) => plain(chip.textContent));
  const press = (root: Element, name: string) => ([...root.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name && !b.closest('[hidden]')) as HTMLButtonElement).click();
  const until = async (check: () => unknown) => {
    for (let turn = 0; turn < 200 && !check(); turn++) await new Promise((done) => setTimeout(done, 5));
    expect(check()).toBeTruthy();
  };
  /** The search bar's menu, opened where it is not. */
  const menuOpen = () => {
    if (host.querySelector('.fd-search-panel')?.closest('[hidden]') ?? !host.querySelector('.fd-search-panel')) press(host, 'Search options');
  };
  const READ = ['Type: Villa', 'District: New Cairo', 'Price: up to EGP 15,000,000'];
  const FILTER = [
    { field: 'kind', op: '=', value: 'villa' },
    { field: 'district', op: '=', value: 'new_cairo' },
    { field: 'price', op: '<=', value: 15_000_000 },
  ];
  /** The words read as filters by the ✦, then kept by a name from the search bar's menu. */
  async function readAndKeep(ds: MemoryDataSource) {
    typeIn(host.querySelector('.fd-search-input') as HTMLInputElement, 'villas in New Cairo under 15M');
    words()?.click();
    await until(() => chips().length === 3);
    expect(chips()).toEqual(READ);
    menuOpen();
    press(host, 'Save current search');
    (host.querySelector('.fd-favourite-form input.fd-input') as HTMLInputElement).value = 'Villas under 15M';
    press(host.querySelector('.fd-favourite-form') as HTMLElement, 'Save');
    // The search taken away again: the list's own.
    for (let left = 3; left > 0 && host.querySelector('.fd-facet-remove'); left--) (host.querySelector('.fd-facet-remove') as HTMLButtonElement).click();
    await until(() => chips().length === 0 && (lastFilter(ds) ?? []).length === 0);
    expect(asked(ds)).toBe(1);
  }

  it('a view on the app’s server keeps the filters the ✦ made, and putting it on never asks the model again', async () => {
    const ds = createMemoryDataSource({ records: records(), assist: assistStandIn(), views: { homes: [] } });
    await mount(homes(), ds);
    await readAndKeep(ds);
    await until(() => ds.calls.some((call) => call.method === 'saveView'));
    const saved = ds.calls.find((call) => call.method === 'saveView')?.request as { view: { state: { facets: unknown[] } } };
    expect(saved.view.state.facets).toHaveLength(3);
    menuOpen();
    await until(() => host.querySelector('.fd-favourite .fd-search-option'));
    (host.querySelector('.fd-favourite .fd-search-option') as HTMLButtonElement).click();
    await until(() => chips().length === 3);
    expect(chips()).toEqual(READ);
    await until(() => (lastFilter(ds) ?? []).length === 3);
    expect(lastFilter(ds)).toEqual(FILTER);
    expect(asked(ds)).toBe(1);
  });

  it('a favourite kept in the browser does the same where the source keeps no views', async () => {
    const ds = source();
    await mount(homes(), ds);
    await readAndKeep(ds);
    menuOpen();
    press(host, 'Villas under 15M');
    await until(() => chips().length === 3);
    expect(chips()).toEqual(READ);
    await until(() => (lastFilter(ds) ?? []).length === 3);
    expect(lastFilter(ds)).toEqual(FILTER);
    expect(asked(ds)).toBe(1);
  });
});
