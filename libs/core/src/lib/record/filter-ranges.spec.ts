import { createMemoryDataSource, facetsToFilter, matchesFilter, validatePage, type Facet, type ListNode, type RangeDays } from '../../index';

/**
 * Filters a buyer and a sales team expect (Wave 4, w4-filters): a field's range as one chip — "Price: 1,000,000 –
 * 3,000,000", "Bedrooms: 2+" — read by any data source as `>=` and `<=`; the page's settings for ranges, counts and a
 * phone's sheet, checked; and each value's count asked of the source as it groups, tags under each of their links.
 */

const list: ListNode = { type: 'list', id: 'homes', columns: ['name'] };
const range = (field: string, op: '>=' | '<=' | 'between', value: unknown, label = ''): Facet => ({ kind: 'field', field, label: field, values: [{ op, value: value as never, label }] });

describe('a range is one chip, read as >= and <=', () => {
  it('reads from–to, from alone and to alone as the conditions any source reads', () => {
    expect(facetsToFilter([range('price', 'between', [1_000_000, 3_000_000])], list)).toEqual([
      { field: 'price', op: '>=', value: 1_000_000 },
      { field: 'price', op: '<=', value: 3_000_000 },
    ]);
    expect(facetsToFilter([range('bedrooms', '>=', 2, '2+')], list)).toEqual([{ field: 'bedrooms', op: '>=', value: 2 }]);
    expect(facetsToFilter([range('price', '<=', 3_000_000)], list)).toEqual([{ field: 'price', op: '<=', value: 3_000_000 }]);
    // An end left empty is no end.
    expect(facetsToFilter([range('price', 'between', [null, 5])], list)).toEqual([{ field: 'price', op: '<=', value: 5 }]);
  });

  it('keeps a range whole among other values of its field, any of which holds', () => {
    const facet: Facet = {
      kind: 'field',
      field: 'bedrooms',
      label: 'Bedrooms',
      values: [
        { op: '=', value: 1, label: '1' },
        { op: 'between', value: [3, 4], label: '3 – 4' },
      ],
    };
    expect(facetsToFilter([facet], list)).toEqual([{ any: [{ field: 'bedrooms', op: '=', value: 1 }, { all: [{ field: 'bedrooms', op: '>=', value: 3 }, { field: 'bedrooms', op: '<=', value: 4 }] }] }]);
    const homes = [1, 2, 3, 4, 5].map((bedrooms) => ({ bedrooms }));
    expect(homes.filter((home) => matchesFilter(home, facetsToFilter([facet], list))).map((home) => home.bedrooms)).toEqual([1, 3, 4]);
  });

  it('counts a date and time’s days as the list does, a date’s as they are', () => {
    // As a list counts them in Cairo: a day from its first moment to before the next day's.
    const days: RangeDays = (field, from, last) =>
      field === 'met_at' ? [...(from ? [{ field, op: '>=' as const, value: `${from}T00:00:00+03:00` }] : []), ...(last ? [{ field, op: '<' as const, value: `${last}+1` }] : [])] : null;
    expect(facetsToFilter([range('met_at', 'between', ['2026-10-01', '2026-10-15'])], list, undefined, days)).toEqual([
      { field: 'met_at', op: '>=', value: '2026-10-01T00:00:00+03:00' },
      { field: 'met_at', op: '<', value: '2026-10-15+1' },
    ]);
    expect(facetsToFilter([range('listed_on', 'between', ['2026-10-01', '2026-10-15'])], list, undefined, days)).toEqual([
      { field: 'listed_on', op: '>=', value: '2026-10-01' },
      { field: 'listed_on', op: '<=', value: '2026-10-15' },
    ]);
    // An instant already is one: the list's days are not asked.
    expect(facetsToFilter([range('met_at', '>=', '2026-10-01T08:00:00Z')], list, undefined, days)).toEqual([{ field: 'met_at', op: '>=', value: '2026-10-01T08:00:00Z' }]);
  });

  it('leaves every other value of a field as it was', () => {
    expect(facetsToFilter([{ kind: 'field', field: 'state', label: 'State', values: [{ op: '=', value: 'new', label: 'New' }] }], list)).toEqual([{ field: 'state', op: '=', value: 'new' }]);
    expect(facetsToFilter([{ kind: 'field', field: 'name', label: 'Name', values: [{ op: 'ilike', value: 'nile', label: 'nile' }, { op: 'ilike', value: 'delta', label: 'delta' }] }], list)).toEqual([
      { any: [{ field: 'name', op: 'ilike', value: 'nile' }, { field: 'name', op: 'ilike', value: 'delta' }] },
    ]);
  });
});

describe('the page says which filters take a range, count, and fold into a sheet on a phone', () => {
  const fields = {
    name: { type: 'char', label: 'Home' },
    kind: { type: 'selection', label: 'Type', options: [{ value: 'flat', label: 'Flat' }] },
    price: { type: 'monetary', label: 'Price', currency: 'EGP' },
    bedrooms: { type: 'integer', label: 'Bedrooms' },
    area: { type: 'float', label: 'Area' },
    listed_on: { type: 'date', label: 'Listed on' },
    met_at: { type: 'datetime', label: 'Met at' },
    notes: { type: 'html', label: 'Notes' },
  };
  const page = (more: Record<string, unknown>) => ({ fieldia: '0.9', id: 'homes', data: { kind: 'record', model: 'home' }, fields, layout: { type: 'list', id: 'homes', columns: ['name'], ...more } });
  const problems = (input: unknown) => {
    const r = validatePage(input);
    return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
  };

  it('takes a number’s and a date’s range in the filter bar, counts and a sheet', () => {
    expect(
      problems(
        page({
          search: 'fields',
          filterFields: ['kind', 'price', 'area', 'bedrooms', 'listed_on', 'met_at'],
          filterRanges: { bedrooms: { atLeast: [1, 2, 3, 4] }, price: {}, listed_on: {} },
          filterCounts: true,
          filterSheet: true,
        })
      )
    ).toEqual([]);
    // Counts are the search bar's too: its named filters' ("Late 5").
    expect(problems(page({ filterCounts: true }))).toEqual([]);
  });

  it('refuses a range of no filter, of a field with none, presses on a date, and least values out of order', () => {
    expect(problems(page({ search: 'fields', filterFields: ['kind'], filterRanges: { price: {} } }))).toEqual(['layout.filterRanges.price: "price" is no field of filterFields: a range is for a filter the bar offers']);
    expect(problems(page({ search: 'fields', filterFields: ['kind'], filterRanges: { kind: {} } }))).toEqual(['layout.filterRanges.kind: "kind" is a selection; a range is a number\'s or a date\'s']);
    expect(problems(page({ search: 'fields', filterFields: ['listed_on'], filterRanges: { listed_on: { atLeast: [1] } } }))).toEqual([
      'layout.filterRanges.listed_on.atLeast: "listed_on" is a date; the presses for a least value are a number\'s',
    ]);
    expect(problems(page({ search: 'fields', filterFields: ['bedrooms'], filterRanges: { bedrooms: { atLeast: [1.5] } } }))).toEqual(['layout.filterRanges.bedrooms.atLeast: "bedrooms" holds whole numbers: each least value is one']);
    expect(problems(page({ search: 'fields', filterFields: ['bedrooms'], filterRanges: { bedrooms: { atLeast: [2, 1] } } }))).toEqual(['layout.filterRanges.bedrooms.atLeast: the least values go from the smallest to the largest, each once']);
    expect(problems(page({ search: 'fields', filterFields: ['bedrooms'], filterRanges: { bedrooms: { atLeast: [] } } }))[0]).toMatch(/^layout\.filterRanges\.bedrooms\.atLeast/);
    expect(problems(page({ search: 'fields', filterFields: ['notes'] }))).toEqual([
      'layout.filterFields[0]: "notes" is a html; a filter lists the values of a choice, a link, links, a yes or no, text or a whole number, or takes the range of a number or a date',
    ]);
  });

  it('keeps the sheet to the filter bar', () => {
    expect(problems(page({ filterSheet: true }))).toEqual(['layout.filterSheet: the filter sheet is the filter bar\'s on a phone: add "search": "fields"']);
    expect(problems(page({ search: 'fields', filterSheet: 'phone' }))[0]).toMatch(/^layout\.filterSheet/);
  });
});

describe('a value’s count, as the source groups and totals', () => {
  const source = () =>
    createMemoryDataSource({
      records: {
        home: {
          1: { kind: 'flat', amenities: [{ id: 1, label: 'Garden' }, { id: 2, label: 'Pool' }] },
          2: { kind: 'villa', amenities: [{ id: 1, label: 'Garden' }] },
          3: { kind: 'flat', amenities: [] },
        },
      },
    });

  it('counts tags under each of their links, those with none under nothing', async () => {
    const groups = await source().groups({ model: 'home', field: 'amenities', filter: [] });
    expect(groups.map((group) => [group.value, group.label, group.count])).toEqual([
      [1, 'Garden', 2],
      [2, 'Pool', 1],
      [null, '', 1],
    ]);
  });

  it('counts the records a filter finds with totals of nothing', async () => {
    const answer = await source().totals({ model: 'home', filter: [{ field: 'kind', op: '=', value: 'flat' }], totals: {} });
    expect(answer.count).toBe(2);
  });
});
