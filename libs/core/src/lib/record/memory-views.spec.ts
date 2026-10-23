import { createMemoryDataSource } from './memory-data-source';
import { createMemoryDataSource as oneTagSource } from './memory-later';
import type { SavedView } from './data-source';

const list = { pageId: 'leads', model: 'lead', list: 'list' };
const team: SavedView = { id: 't1', name: 'Unassigned this week', shared: true, isDefault: true, by: 'Mona Adel', state: { facets: [] } };

describe('a memory source’s saved views', () => {
  it('has none of the three members unless it is given views, so a list keeps its favourites in the browser', () => {
    const plain = createMemoryDataSource();
    expect(plain.views).toBeUndefined();
    expect(plain.saveView).toBeUndefined();
    expect(plain.deleteView).toBeUndefined();
    expect(oneTagSource().views).toBeUndefined();
    expect(typeof oneTagSource({ views: {} }).views).toBe('function');
  });

  it('lists a page’s views, keeps the person’s own as theirs, and one default of each kind', async () => {
    const source = createMemoryDataSource({ views: { leads: [team] } });
    expect(await source.views!(list)).toEqual([team]);
    const mine = await source.saveView!({ ...list, view: { name: 'My late ones', isDefault: true, state: { facets: [], sort: [{ field: 'date' }] } } });
    expect(mine).toEqual({ id: 'view-1', name: 'My late ones', mine: true, isDefault: true, state: { facets: [], sort: [{ field: 'date' }] } });
    // The team's default stays: it is another kind.
    expect((await source.views!(list)).map((view) => [view.id, !!view.isDefault])).toEqual([['t1', true], ['view-1', true]]);
    // Another default of the person's own lets go of theirs; a shared default lets go of the team's.
    await source.saveView!({ ...list, view: { name: 'Mine again', isDefault: true, state: { facets: [] } } });
    await source.saveView!({ ...list, view: { name: 'Ours', shared: true, isDefault: true, state: { facets: [] } } });
    expect((await source.views!(list)).map((view) => [view.name, !!view.isDefault])).toEqual([['Unassigned this week', false], ['My late ones', false], ['Mine again', true], ['Ours', true]]);
    // Kept again by its id: in its place.
    await source.saveView!({ ...list, view: { id: 'view-1', name: 'My late ones', state: { facets: [], sort: [{ field: 'date', desc: true }] } } });
    expect((await source.views!(list))[1].state.sort).toEqual([{ field: 'date', desc: true }]);
    // Another page's are its own.
    expect(await source.views!({ ...list, pageId: 'deals' })).toEqual([]);
  });

  it('refuses to change or delete another’s view, and deletes the person’s own', async () => {
    const source = createMemoryDataSource({ views: { leads: [team] } });
    await expect(source.saveView!({ ...list, view: { id: 't1', name: 'Mine now', state: { facets: [] } } })).rejects.toThrow('Unassigned this week is Mona Adel’s view: save it under a name of your own.');
    await expect(source.deleteView!({ ...list, id: 't1' })).rejects.toThrow('Unassigned this week is Mona Adel’s view.');
    const mine = await source.saveView!({ ...list, view: { name: 'Mine', state: { facets: [] } } });
    await source.deleteView!({ ...list, id: mine.id });
    expect((await source.views!(list)).map((view) => view.id)).toEqual(['t1']);
    expect(source.calls.map((call) => call.method)).toEqual(['saveView', 'deleteView', 'saveView', 'deleteView', 'views']);
  });

  it('numbers a new view after those it was given, so a view kept on a visit before is never replaced nor doubled', async () => {
    const before: SavedView = { id: 'view-1', name: 'Kept last time', mine: true, state: { facets: [] } };
    const source = createMemoryDataSource({ views: { leads: [team, before], deals: [{ ...before, id: 'view-2' }] } });
    const made = await source.saveView!({ ...list, view: { name: 'New today', state: { facets: [] } } });
    expect(made.id).toBe('view-3');
    expect((await source.views!(list)).map((view) => view.name)).toEqual(['Unassigned this week', 'Kept last time', 'New today']);
    await source.deleteView!({ ...list, id: made.id });
    expect((await source.views!(list)).map((view) => view.id)).toEqual(['t1', 'view-1']);
  });
});
