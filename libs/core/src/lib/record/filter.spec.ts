import type { ResolvedFilter } from './data-source';
import { matchesFilter } from './filter';

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
