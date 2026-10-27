import { createMemoryDataSource, type ListRequest, type Page, type Values } from '@fieldia/core';
import { keepPlace } from './list-place';
import { windowDefaults, type WindowGeometry } from './list-window';
import { until } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * An endless list holding more rows than its window draws, asked again (0.36): its own rows asked again in place — a
 * press, an Undo, `reload()` — or come back to (Back): the rows in and near the view asked for first, the rows over
 * them as the view comes to them (or the keys, or Select all), those under them as it is scrolled on. 0.35 asked for
 * every row it had loaded, all at once: 2,000 rows for a press far down a long list. What the person sees is what the
 * list drawn whole shows: the rows in the view, in their places, the rows counted, its pager — the oracle's `same`
 * (list-window.spec.ts), here round a reload. jsdom lays nothing out: the view and the rows' heights are this test's.
 */

const VIEW = 600;
const ROW = 40;
let scrolled = 0;
const geometry: WindowGeometry = {
  view: (body) => (body.isConnected ? { top: scrolled, bottom: scrolled + VIEW } : null),
  height: (nodes) => nodes.reduce((sum, node) => sum + (node.classList.contains('fd-list-row') ? ROW : 0), 0),
  top: () => null,
};

const PEOPLE = 3000;
const people = (): Record<number, Values> => Object.fromEntries(Array.from({ length: PEOPLE }, (_, i) => [i + 1, { name: `Person ${String(i + 1).padStart(4, '0')}`, city: ['Cairo', 'Giza', 'Luxor'][i % 3] }]));
const page = {
  fieldia: '0.13',
  id: 'people',
  title: 'People',
  data: { kind: 'record', model: 'person' },
  fields: { name: { type: 'char', label: 'Name' }, city: { type: 'char', label: 'City' } },
  layout: { type: 'list', id: 'people-list', columns: ['name', 'city'], sort: [{ field: 'name' }], pageSize: 50, endless: true, searchFields: ['name'] },
} as unknown as Page;

const handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.replaceChildren();
  history.replaceState(null, '');
  scrolled = 0;
});

/** The list mounted, windowed past `from` rows (Infinity: drawn whole), each ask of its source noted. */
async function mounted(from: number) {
  const host = document.body.appendChild(document.createElement('div'));
  const source = createMemoryDataSource({ records: { person: people() } });
  const asked: { offset: number; limit: number }[] = [];
  const list = source.list.bind(source);
  source.list = (request: ListRequest) => (asked.push({ offset: request.offset ?? 0, limit: request.limit ?? 0 }), list(request));
  windowDefaults.from = from;
  windowDefaults.geometry = geometry;
  const handle = mountViewer(host, { page, dataSource: source, onOpenRecord: () => undefined });
  windowDefaults.from = 100;
  delete windowDefaults.geometry;
  handles.push(handle);
  await until(() => host.querySelectorAll('.fd-list-row').length > 0);
  return { host, handle, asked };
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function settle() {
  for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  await frame();
  await frame();
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
const scrollTo = async (y: number) => {
  scrolled = y;
  document.dispatchEvent(new Event('scroll'));
  await settle();
};
/** Show more, pressed until `n` rows are loaded. */
const loaded = (host: Element) => {
  const counted = host.querySelector('.fd-list-table')?.getAttribute('aria-rowcount');
  return counted ? Number(counted) - 1 : rows(host).length;
};
async function load(host: Element, n: number) {
  while (loaded(host) < n) {
    (host.querySelector('.fd-list-more-rows button') as HTMLButtonElement).click();
    await settle();
  }
}
const rows = (host: Element) => [...host.querySelectorAll<HTMLTableRowElement>('.fd-list-table > tbody > tr.fd-list-row')];
const drawnAt = (host: Element): [number, string][] => rows(host).map((tr) => [Number(tr.getAttribute('aria-rowindex')), tr.querySelector('td[data-col="name"]')?.textContent ?? '']);
/** What the list says round its rows: its count of rows, its pager, its Show more, its choice. */
const around = (host: Element) => ({
  count: host.querySelector('.fd-list-table')?.getAttribute('aria-rowcount'),
  range: host.querySelector('.fd-pager-text')?.textContent,
  more: host.querySelector('.fd-list-more-rows button')?.textContent,
  chosen: host.querySelector('.fd-list-count')?.textContent,
});
/** The windowed list's rows in the page are the whole list's at the same places, and the same round them. */
function same(windowed: Element, whole: Element) {
  const all = new Map(rows(whole).map((tr, at) => [tr.querySelector('td[data-col="name"]')?.textContent ?? '', at + 2]));
  for (const [index, name] of drawnAt(windowed)) expect({ name, index }).toEqual({ name, index: all.get(name) });
  expect(around(windowed)).toEqual({ ...around(whole), count: String(rows(whole).length + 1) });
}

describe('an endless list asked again', () => {
  it('asks for the rows near its view first — never every row it loaded — and draws them where they stood', async () => {
    const a = await mounted(100);
    const b = await mounted(Infinity);
    for (const { host } of [a, b]) await load(host, 400);
    // Far down: the 300th row at the view's top.
    await scrollTo(299 * ROW);
    const before = drawnAt(a.host);
    expect(before.some(([index]) => index === 301)).toBe(true);
    a.asked.length = 0;
    b.asked.length = 0;
    await Promise.all([a.handle.reload(), b.handle.reload()]);
    await settle();
    // The window's list: the pages round its view, a margin over and under them; the whole list asks for all of them.
    expect(b.asked).toEqual([{ offset: 0, limit: 400 }]);
    expect(a.asked).toEqual([{ offset: 150, limit: 250 }]);
    // Where they stood: the same rows drawn, at the same places, its 400 rows still counted and said.
    expect(drawnAt(a.host)).toEqual(before);
    same(a.host, b.host);
    expect(around(a.host)).toMatchObject({ count: '401', range: '1–400 / 3,000', more: 'Show 50 more' });
  }, 60_000);

  it('asks for the rows over those it holds as the view comes to them, and keeps on loading under them', async () => {
    const a = await mounted(100);
    const b = await mounted(Infinity);
    for (const { host } of [a, b]) await load(host, 400);
    await scrollTo(299 * ROW);
    await Promise.all([a.handle.reload(), b.handle.reload()]);
    await settle();
    a.asked.length = 0;
    // Up, a view at a time: the pages over them asked for as the view nears them, a page or more each time.
    for (let y = 299 * ROW; y >= 0; y -= VIEW) {
      await scrollTo(y);
      same(a.host, b.host);
    }
    await scrollTo(0);
    same(a.host, b.host);
    expect(drawnAt(a.host)[0]).toEqual([2, 'Person 0001']);
    expect(a.asked.length).toBeGreaterThan(1);
    expect(a.asked.every((one) => one.limit >= 50 && one.offset % 50 === 0)).toBe(true);
    expect(a.asked.reduce((sum, one) => sum + one.limit, 0)).toBe(150);
    // Down to its end and on: Show more after the 400 loaded.
    await scrollTo(385 * ROW);
    for (const { host } of [a, b]) (host.querySelector('.fd-list-more-rows button') as HTMLButtonElement).click();
    await settle();
    expect(around(a.host)).toMatchObject({ count: '451', range: '1–450 / 3,000' });
    same(a.host, b.host);
  }, 120_000);

  it('jumped straight to its top, asks for every row over those it holds at once, and draws the first', async () => {
    const a = await mounted(100);
    await load(a.host, 1000);
    await scrollTo(899 * ROW);
    await a.handle.reload();
    await settle();
    a.asked.length = 0;
    await scrollTo(0);
    await settle();
    expect(a.asked).toEqual([{ offset: 0, limit: 750 }]);
    expect(drawnAt(a.host)[0]).toEqual([2, 'Person 0001']);
  }, 60_000);

  it('Up past the first row it holds: the page over it asked for, the keyboard on the row over', async () => {
    const a = await mounted(100);
    await load(a.host, 1000);
    await scrollTo(799 * ROW);
    a.asked.length = 0;
    await a.handle.reload();
    await settle();
    const first = a.asked[0].offset;
    a.asked.length = 0;
    // Up by the keys from the row at the view's top to the first row it holds: those are drawn as they are reached.
    rows(a.host)[0].focus();
    const at = () => Number((document.activeElement as HTMLElement).getAttribute('aria-rowindex'));
    while (at() > first + 2) (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    expect(a.asked).toEqual([]);
    // And past it: the page over it asked for, the keyboard on the row over.
    (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    await settle();
    expect(a.asked).toEqual([{ offset: first - 50, limit: 50 }]);
    expect(at()).toBe(first + 1);
  }, 60_000);

  it('Select all chooses every row loaded, those over the rows it holds asked for first', async () => {
    const a = await mounted(100);
    const b = await mounted(Infinity);
    for (const { host } of [a, b]) await load(host, 400);
    await scrollTo(299 * ROW);
    await Promise.all([a.handle.reload(), b.handle.reload()]);
    await settle();
    for (const { host } of [a, b]) (host.querySelector('thead .fd-list-checkbox') as HTMLInputElement).click();
    await until(() => around(a.host).chosen === '400 selected');
    await settle();
    expect(around(a.host).chosen).toBe('400 selected');
    same(a.host, b.host);
  }, 60_000);

  it('come back to (Back), asks for the rows near the one that was at its top first, and puts the keyboard on the row opened', async () => {
    const a = await mounted(100);
    await load(a.host, 900);
    await scrollTo(800 * ROW);
    const row = rows(a.host).find((tr) => tr.getAttribute('aria-rowindex') === '812') as HTMLTableRowElement;
    // Its record opened on a page of its own, where the list stands kept in the page's history entry — the row at its
    // top by its record and its place, the rows loaded, the row opened — and Back.
    keepPlace(document, 'people:people-list', { facets: [], keys: [], offset: 0, reach: 900, at: '801', top: 0, index: 800, open: row.getAttribute('data-id') as string });
    handles.splice(0).forEach((handle) => handle.destroy());
    a.host.remove();
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    const again = await mounted(100);
    await settle();
    expect(again.asked[0].offset).toBeGreaterThan(500);
    expect(again.asked[0].limit).toBeLessThanOrEqual(400);
    expect(again.host.querySelector('.fd-list-table')?.getAttribute('aria-rowcount')).toBe('901');
    expect((document.activeElement as HTMLElement).getAttribute('data-id')).toBe(row.getAttribute('data-id'));
  }, 60_000);
});
