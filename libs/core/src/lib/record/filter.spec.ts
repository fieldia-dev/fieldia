import type { ResolvedFilter } from './data-source';
import { matchesFilter, resolveFilter } from './filter';

/** A record as a data source holds it: a link is an { id, label }. */
const mona = { name: 'Mona Adel', job: 'Head of design', grade: 7, joined: '2019-03-01', manager_id: { id: 24, label: 'Youssef Kamal' }, phone: null, tag_ids: [] };

describe('matchesFilter', () => {
  it('compares values, and a link by its id', () => {
    expect(matchesFilter(mona, [{ field: 'grade', op: '=', value: 7 }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'grade', op: '!=', value: 7 }])).toBe(false);
    expect(matchesFilter(mona, [{ field: 'grade', op: '>=', value: 7 }, { field: 'grade', op: '<', value: 8 }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'manager_id', op: '=', value: 24 }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'manager_id', op: 'in', value: [1, 24] }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'manager_id', op: 'not in', value: [24] }])).toBe(false);
  });

  it('finds text inside, at the start or at the end, the last two whatever the case', () => {
    expect(matchesFilter(mona, [{ field: 'job', op: 'like', value: 'of d' }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'job', op: 'like', value: 'OF D' }])).toBe(false);
    expect(matchesFilter(mona, [{ field: 'job', op: 'ilike', value: 'OF D' }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'job', op: 'startswith', value: 'head of' }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'job', op: 'startswith', value: 'design' }])).toBe(false);
    expect(matchesFilter(mona, [{ field: 'job', op: 'endswith', value: 'DESIGN' }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'job', op: 'endswith', value: 'head' }])).toBe(false);
  });

  it('finds text in a link by its record’s name, as a search by name does', () => {
    expect(matchesFilter(mona, [{ field: 'manager_id', op: 'ilike', value: 'yous' }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'manager_id', op: 'startswith', value: 'kamal' }])).toBe(false);
    expect(matchesFilter(mona, [{ field: 'manager_id', op: 'endswith', value: 'kamal' }])).toBe(true);
  });

  it('tells a field that is set from one that is not: empty text and an empty list count as not set', () => {
    expect(matchesFilter(mona, [{ field: 'job', op: 'set', value: null }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'phone', op: 'set', value: null }])).toBe(false);
    expect(matchesFilter(mona, [{ field: 'phone', op: 'notset', value: null }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'tag_ids', op: 'notset', value: null }])).toBe(true);
    expect(matchesFilter({ ...mona, job: '' }, [{ field: 'job', op: 'notset', value: null }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'missing', op: 'notset', value: null }])).toBe(true);
  });

  it('takes a value between two, both ends included, numbers and dates alike', () => {
    expect(matchesFilter(mona, [{ field: 'grade', op: 'between', value: [5, 7] }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'grade', op: 'between', value: [8, 9] }])).toBe(false);
    expect(matchesFilter(mona, [{ field: 'joined', op: 'between', value: ['2019-01-01', '2019-12-31'] }])).toBe(true);
    expect(matchesFilter(mona, [{ field: 'joined', op: 'between', value: ['2020-01-01', '2020-12-31'] }])).toBe(false);
    expect(matchesFilter(mona, [{ field: 'phone', op: 'between', value: [1, 9] }])).toBe(false);
  });

  it('holds when any of a group holds, and groups nest', () => {
    const headOrManager: ResolvedFilter[] = [{ any: [{ field: 'job', op: 'startswith', value: 'Head of' }, { field: 'job', op: 'endswith', value: 'manager' }] }];
    expect(matchesFilter(mona, headOrManager)).toBe(true);
    expect(matchesFilter({ ...mona, job: 'Project manager' }, headOrManager)).toBe(true);
    expect(matchesFilter({ ...mona, job: 'Site engineer' }, headOrManager)).toBe(false);
    const nested: ResolvedFilter[] = [{ any: [{ all: [{ field: 'grade', op: '>', value: 5 }, { field: 'phone', op: 'set', value: null }] }, { field: 'job', op: 'like', value: 'design' }] }];
    expect(matchesFilter(mona, nested)).toBe(true);
    expect(matchesFilter({ ...mona, job: 'Clerk' }, nested)).toBe(false);
    expect(matchesFilter(mona, [])).toBe(true);
  });
});

describe('a list of links that holds a value: contains', () => {
  const stage = { name: 'Review', project_ids: [{ id: 3, label: 'Fit-out' }, { id: 5, label: 'Lobby' }], type_ids: [7, 9], none_ids: [] };

  it('holds when the list holds the value, or one of several, as Flectra’s = and in on a many2many', () => {
    expect(matchesFilter(stage, [{ field: 'project_ids', op: 'contains', value: 5 }])).toBe(true);
    expect(matchesFilter(stage, [{ field: 'project_ids', op: 'contains', value: 4 }])).toBe(false);
    expect(matchesFilter(stage, [{ field: 'project_ids', op: 'contains', value: [4, 3] }])).toBe(true);
    expect(matchesFilter(stage, [{ field: 'type_ids', op: 'contains', value: 9 }])).toBe(true);
    expect(matchesFilter(stage, [{ field: 'none_ids', op: 'contains', value: 9 }])).toBe(false);
    expect(matchesFilter(stage, [{ field: 'project_ids', op: 'not contains', value: 5 }])).toBe(false);
    expect(matchesFilter(stage, [{ field: 'project_ids', op: 'not contains', value: [1, 2] }])).toBe(true);
    // A stage of no matter type, or of this one: Flectra's ['|', ('type_ids', '=', False), ('type_ids', 'in', type_id)].
    const either: ResolvedFilter[] = [{ any: [{ field: 'none_ids', op: 'notset', value: null }, { field: 'none_ids', op: 'contains', value: 9 }] }];
    expect(matchesFilter(stage, either)).toBe(true);
  });

  it('tests a record’s own id against a list the form holds', () => {
    const journal = { id: 4, name: 'Bank' };
    expect(matchesFilter(journal, [{ field: 'id', op: 'in', value: [2, 4] }])).toBe(true);
    expect(matchesFilter(journal, [{ field: 'id', op: 'in', value: [2] }])).toBe(false);
  });
});

describe('resolveFilter', () => {
  const context = { company_id: 1, project_id: null, partner_id: 0, journal_ids: [2, 4], parent: { currency_id: 3 } };

  it('gives a many2many’s ids, as the form reads it, to a filter that takes them', () => {
    expect(resolveFilter([{ field: 'id', op: 'in', valueFrom: 'journal_ids' }], context)).toEqual([{ field: 'id', op: 'in', value: [2, 4] }]);
  });

  it('leaves out a =? condition whose value is empty, and keeps it as = when it has one', () => {
    expect(resolveFilter([{ field: 'company_id', op: '=?', valueFrom: 'company_id' }], context)).toEqual([{ field: 'company_id', op: '=', value: 1 }]);
    expect(resolveFilter([{ field: 'project_id', op: '=?', valueFrom: 'project_id' }, { field: 'active', op: '=', value: true }], context)).toEqual([{ field: 'active', op: '=', value: true }]);
    // Zero is a value: only nothing, false, empty text or an empty list is empty.
    expect(resolveFilter([{ field: 'partner_id', op: '=?', valueFrom: 'partner_id' }], context)).toEqual([{ field: 'partner_id', op: '=', value: 0 }]);
    expect(resolveFilter([{ field: 'x', op: '=?', value: [] }], context)).toEqual([]);
  });

  it('keeps the groups right around a =? left out: an any group with one always holding holds, an all group left empty holds', () => {
    // (project = ? or active): the left side always holds, so the group goes.
    expect(resolveFilter([{ any: [{ field: 'project_id', op: '=?', valueFrom: 'project_id' }, { field: 'active', op: '=', value: true }] }], context)).toEqual([]);
    expect(resolveFilter([{ all: [{ field: 'project_id', op: '=?', valueFrom: 'project_id' }] }, { field: 'a', op: '=', value: 1 }], context)).toEqual([{ field: 'a', op: '=', value: 1 }]);
    expect(resolveFilter([{ any: [{ field: 'company_id', op: '=?', valueFrom: 'company_id' }, { field: 'b', op: '=', value: 2 }] }], context)).toEqual([
      { any: [{ field: 'company_id', op: '=', value: 1 }, { field: 'b', op: '=', value: 2 }] },
    ]);
  });
});
