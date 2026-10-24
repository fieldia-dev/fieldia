import { checkPage, createMemoryDataSource, type ListNode, type Page, type WriteManyRequest } from '@fieldia/core';
import { newRanks } from './list-rank';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/** A clinic's waiting room, its patients in the order they are seen: ranked by hand. */
const queue: Page = {
  fieldia: '0.12',
  id: 'queue',
  title: 'Waiting room',
  data: { kind: 'record', model: 'visit' },
  fields: {
    name: { type: 'char', label: 'Patient' },
    doctor: { type: 'char', label: 'Doctor' },
    turn: { type: 'integer', label: 'Turn' },
  },
  layout: { type: 'list', id: 'list', columns: ['name', 'doctor'], sort: [{ field: 'turn' }], sequenceField: 'turn' },
};
const patients = (turns: number[] = [10, 20, 30, 40]) =>
  createMemoryDataSource({
    records: { visit: Object.fromEntries(['Omar Nabil', 'Hana Wael', 'Tamer Said', 'Laila Mostafa'].map((name, i) => [i + 1, { name, doctor: 'Dr Salma', turn: turns[i] }])) },
  });

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions>, page: Page = queue) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, ...options });
  await until(() => host.querySelectorAll('.fd-list-row').length === 4);
  return host;
}
const names = (host: Element) => [...host.querySelectorAll('.fd-list-row')].map((tr) => tr.querySelector('td[data-col="name"]')?.textContent);
const row = (host: Element, name: string) => [...host.querySelectorAll<HTMLElement>('.fd-list-row')].find((tr) => tr.textContent?.includes(name)) as HTMLElement;
const alt = (tr: HTMLElement, key: 'ArrowUp' | 'ArrowDown') => tr.dispatchEvent(new KeyboardEvent('keydown', { key, altKey: true, bubbles: true }));
const writes = (source: ReturnType<typeof patients>) => source.calls.filter((call) => call.method === 'writeMany').map((call) => (call.request as WriteManyRequest).ids.map((id) => [id, (call.request as WriteManyRequest).values['turn']]).flat());
const turns = (source: ReturnType<typeof patients>) => Object.values(source.records['visit']).map((values) => values['turn']);

describe('the ranks a move gives', () => {
  const ranks = (...values: number[]) => values.map((rank, i) => ({ id: i + 1, rank }));
  it('takes one between its neighbours where they leave room, nothing else changing', () => {
    // 1 moved between 2 and 3: [2, 1, 3, 4] in the new order, ranks 20, 10, 30, 40.
    expect(newRanks([{ id: 2, rank: 20 }, { id: 1, rank: 10 }, { id: 3, rank: 30 }, { id: 4, rank: 40 }], 1, true)).toEqual([{ id: 1, rank: 25 }]);
  });

  it('takes one after the record before it where there is no room, and moves on those it would fall behind', () => {
    expect(newRanks([{ id: 2, rank: 1 }, { id: 1, rank: 1 }, { id: 3, rank: 1 }, { id: 4, rank: 9 }], 1, true)).toEqual([
      { id: 1, rank: 2 },
      { id: 3, rank: 3 },
    ]);
  });

  it('goes before the first, one less on the first page; at the end, one more than the last', () => {
    expect(newRanks(ranks(40, 10, 20, 30), 0, true)).toEqual([{ id: 1, rank: 9 }]);
    expect(newRanks(ranks(10, 20, 30, 5), 3, true)).toEqual([{ id: 4, rank: 31 }]);
    // On a later page, never before what an earlier page ends with: the first one's rank, and those after moved on.
    expect(newRanks(ranks(40, 10, 20), 0, false)).toEqual([
      { id: 1, rank: 10 },
      { id: 2, rank: 11 },
    ]);
  });
});

describe('rows re-ranked by hand', () => {
  it('moves a row with Alt and an arrow, writes its new rank through writeMany, and says where it went', async () => {
    const source = patients();
    const host = await mount({ dataSource: source });
    expect(names(host)).toEqual(['Omar Nabil', 'Hana Wael', 'Tamer Said', 'Laila Mostafa']);
    const omar = row(host, 'Omar Nabil');
    expect(omar.hasAttribute('data-ranks')).toBe(true);
    expect(omar.getAttribute('aria-keyshortcuts')).toBe('Alt+ArrowUp Alt+ArrowDown');
    omar.focus();
    alt(omar, 'ArrowDown');
    expect(names(host)).toEqual(['Hana Wael', 'Omar Nabil', 'Tamer Said', 'Laila Mostafa']);
    expect(document.activeElement).toBe(omar);
    expect(host.querySelector('.fd-list > .fd-sr-only[role="status"]')?.textContent).toBe('Omar Nabil moved to place 2 of 4');
    await until(() => writes(source).length === 1);
    expect(writes(source)).toEqual([[1, 25]]);
    expect(turns(source)).toEqual([25, 20, 30, 40]);
    // Up at the top moves nothing; the source keeps the order the rows show.
    alt(row(host, 'Hana Wael'), 'ArrowUp');
    await handle?.reload();
    expect(names(host)).toEqual(['Hana Wael', 'Omar Nabil', 'Tamer Said', 'Laila Mostafa']);
  });

  it('numbers again those a move leaves no room for, by save where the source writes no many', async () => {
    const source = patients([1, 1, 1, 1]);
    delete (source as { writeMany?: unknown }).writeMany;
    const host = await mount({ dataSource: source });
    const laila = row(host, 'Laila Mostafa');
    alt(laila, 'ArrowUp');
    alt(laila, 'ArrowUp');
    await until(() => source.calls.filter((call) => call.method === 'save').length >= 3);
    await handle?.reload();
    expect(names(host)).toEqual(['Omar Nabil', 'Laila Mostafa', 'Hana Wael', 'Tamer Said']);
  });

  it('says why a new order was not kept, and shows the order the source keeps', async () => {
    const source = patients();
    source.writeMany = async (request) => ({ failed: request.ids.map((id) => ({ id, message: 'The queue is closed for the day.' })) });
    const host = await mount({ dataSource: source });
    alt(row(host, 'Omar Nabil'), 'ArrowDown');
    await until(() => names(host)[0] === 'Omar Nabil' && host.querySelector('.fd-say'));
    expect(host.querySelector('.fd-say')?.textContent).toContain('The new order was not kept: The queue is closed for the day.');
  });

  it('moves nothing while the list is in another order, and gives no grip to a record the person may not change', async () => {
    const source = createMemoryDataSource({
      records: { visit: { 1: { name: 'Omar Nabil', turn: 10 }, 2: { name: 'Hana Wael', turn: 20 }, 3: { name: 'Tamer Said', turn: 30 }, 4: { name: 'Laila Mostafa', turn: 40 } } },
      can: { visit: (values) => (values['name'] === 'Tamer Said' ? { edit: false, reason: 'Seen already' } : undefined) },
    });
    const host = await mount({ dataSource: source });
    expect(row(host, 'Tamer Said').querySelector('.fd-list-rank')).toBeNull();
    expect(row(host, 'Omar Nabil').querySelector('.fd-list-rank')).not.toBeNull();
    // By another header: no row is ranked, the arrows only move the focus.
    ([...host.querySelectorAll<HTMLElement>('thead th')].find((th) => th.textContent === 'Patient')?.querySelector('button') as HTMLButtonElement).click();
    await until(() => !row(host, 'Omar Nabil').hasAttribute('data-ranks'));
    alt(row(host, 'Omar Nabil'), 'ArrowDown');
    expect(source.calls.some((call) => call.method === 'writeMany')).toBe(false);
  });

  it('is checked: a whole number the list opens in the order of', () => {
    const issues = (layout: Partial<ListNode>) => {
      const result = checkPage({ ...queue, layout: { ...(queue.layout as ListNode), ...layout } });
      return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
    };
    expect(issues({})).toEqual([]);
    expect(issues({ sequenceField: 'name', sort: [{ field: 'name' }] })).toEqual(['layout.sequenceField: "name" is a char; a list\'s records are ranked by a whole number']);
    expect(issues({ sort: [{ field: 'name' }] })).toEqual(['layout.sequenceField: the list opens in another order: put "turn" first in its sort, ascending, so its rows can be moved']);
  });
});

