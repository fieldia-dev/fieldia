import type { Page } from '@fieldia/core';
import { createMemoryDataSource } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { keepPlace, placeKept } from './list-place';

/**
 * Where a list stood as a row of it opened its record on a page of its own (0.35.1, the owner's walk of 0.35: far down
 * the activity log, an entry opened and Back started it again at its top), kept in the page's own history entry beside
 * what the app keeps there, and the list made again from it: its search, order and the rows it had loaded.
 */

const settled = () => new Promise((resolve) => setTimeout(resolve, 30));
let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  history.replaceState(null, '');
  document.body.replaceChildren();
});

const people: Page = {
  fieldia: '0.13',
  id: 'people',
  title: 'People',
  data: { kind: 'record', model: 'person' },
  fields: { name: { type: 'char', label: 'Name' }, city: { type: 'char', label: 'City' } },
  layout: { type: 'list', id: 'people-list', columns: ['name', 'city'], pageSize: 10, endless: true, searchFields: ['name'] },
} as Page;
const records = { person: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [i + 1, { name: `Person ${String(i + 1).padStart(2, '0')}`, city: ['Cairo', 'Giza'][i % 2] }])) };

describe('a list’s place in the page’s history entry', () => {
  it('is kept beside what the app keeps there, and let go alone', () => {
    history.replaceState({ usr: { from: 'router' }, key: 'k1' }, '');
    keepPlace(document, 'people:people-list', { facets: [], keys: [], offset: 0, reach: 40, at: '7', top: 120, open: '9' });
    expect(history.state).toMatchObject({ usr: { from: 'router' }, key: 'k1' });
    expect(placeKept(document, 'people:people-list')).toEqual({ facets: [], keys: [], offset: 0, reach: 40, at: '7', top: 120, open: '9' });
    expect(placeKept(document, 'people:other')).toBeNull();
    keepPlace(document, 'people:people-list', null);
    expect(placeKept(document, 'people:people-list')).toBeNull();
    expect(history.state).toMatchObject({ usr: { from: 'router' }, key: 'k1' });
  });

  it('is kept as a row opens its record on a page of its own, and the list made again opens with the rows it had loaded', async () => {
    const dataSource = createMemoryDataSource({ records });
    const opened: unknown[] = [];
    const host = document.body.appendChild(document.createElement('div'));
    handle = mountViewer(host, { page: people, dataSource, onOpenRecord: (id) => void opened.push(id) });
    await settled();
    // Thirty loaded, as scrolling would: Show more, twice.
    for (let i = 0; i < 2; i++) {
      (host.querySelector('.fd-list-more-rows button') as HTMLButtonElement).click();
      await settled();
    }
    expect(host.querySelectorAll('.fd-list-row')).toHaveLength(30);
    (host.querySelectorAll<HTMLElement>('.fd-list-row')[24].querySelector('td:not(.fd-list-check)') as HTMLElement).click();
    await settled();
    expect(opened).toEqual([25]);
    expect(placeKept(document, 'people:people-list')).toMatchObject({ reach: 30, open: '25' });
    // Drawn again in the page without coming back to it: as it would open, its place left for Back.
    handle.destroy();
    host.replaceChildren();
    handle = mountViewer(host, { page: people, dataSource: createMemoryDataSource({ records }), onOpenRecord: () => undefined });
    await settled();
    expect(host.querySelectorAll('.fd-list-row')).toHaveLength(10);
    expect(placeKept(document, 'people:people-list')).toMatchObject({ reach: 30, open: '25' });
    // Back (an app's router moving through the history): the page made again, in the same history entry.
    handle.destroy();
    host.replaceChildren();
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    const asked: number[] = [];
    const again = createMemoryDataSource({ records });
    const list = again.list.bind(again);
    again.list = (request) => (asked.push(request.limit), list(request));
    handle = mountViewer(host, { page: people, dataSource: again, onOpenRecord: () => undefined });
    await settled();
    expect(asked[0]).toBe(30);
    expect(host.querySelectorAll('.fd-list-row')).toHaveLength(30);
    expect(document.activeElement?.closest('.fd-list-row')?.getAttribute('data-id')).toBe('25');
    // Come back to once: let go.
    expect(placeKept(document, 'people:people-list')).toBeNull();
  });

  it('is merged into the state a router put in the entry, its own keys kept as they were, and never adds an entry', async () => {
    // React Router's own: `usr` (the app's state), `key` and `idx` (where the entry stands in its history).
    const router = { usr: { from: 'dashboard', filters: ['open'] }, key: 'x7k2pq', idx: 3 };
    history.replaceState(router, '');
    const entries = history.length;
    const pushed = jest.spyOn(history, 'pushState');
    const replaced = jest.spyOn(history, 'replaceState');
    try {
      const host = document.body.appendChild(document.createElement('div'));
      handle = mountViewer(host, { page: people, dataSource: createMemoryDataSource({ records }), onOpenRecord: () => undefined });
      await settled();
      (host.querySelectorAll<HTMLElement>('.fd-list-row')[3].querySelector('td:not(.fd-list-check)') as HTMLElement).click();
      await settled();
      // The list's place written beside the router's keys, each as the router left it.
      expect(history.state).toEqual({ ...router, 'fieldia:lists': { 'people:people-list': expect.objectContaining({ open: '4' }) } });
      // Come back to (the router's popstate) and drawn again: its place let go, the router's keys still as they were.
      handle.destroy();
      host.replaceChildren();
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
      handle = mountViewer(host, { page: people, dataSource: createMemoryDataSource({ records }), onOpenRecord: () => undefined });
      await settled();
      expect(history.state).toEqual({ ...router, 'fieldia:lists': {} });
      // Written in place, every time: never an entry of its own, which Back would have to pass through.
      expect(pushed).not.toHaveBeenCalled();
      expect(replaced).toHaveBeenCalled();
      expect(history.length).toBe(entries);
    } finally {
      pushed.mockRestore();
      replaced.mockRestore();
    }
  });

  it('is let go where the record opens over the list, which stays (the app answers with a promise)', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    handle = mountViewer(host, { page: people, dataSource: createMemoryDataSource({ records }), onOpenRecord: () => Promise.resolve() });
    await settled();
    let kept: unknown = undefined;
    handle.destroy();
    handle = mountViewer(host, { page: people, dataSource: createMemoryDataSource({ records }), onOpenRecord: () => ((kept = placeKept(document, 'people:people-list')), Promise.resolve()) });
    await settled();
    (host.querySelector('.fd-list-row td:not(.fd-list-check)') as HTMLElement).click();
    await settled();
    // Kept as it opened (the app may yet go to a page of its own), let go once the record came back over the list.
    expect(kept).toMatchObject({ open: '1' });
    expect(placeKept(document, 'people:people-list')).toBeNull();
  });
});
