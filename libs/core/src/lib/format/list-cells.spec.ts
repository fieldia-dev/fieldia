import { ListCellSchema, validatePage } from '../../index';

/**
 * A list drawn as a work tracker's backlog: its cells (a state's dot, a
 * kind's icon before a title, widths, the side numbers keep to), no box to
 * choose a row, a filter bar of a keyword and a list of values per field,
 * and rows nested under their parent. The page names it all by field, so a
 * missing or wrong field is refused before anything draws.
 */

const fields = {
  number: { type: 'integer', label: 'Order' },
  title: { type: 'char', label: 'Title' },
  description: { type: 'html', label: 'Description' },
  work_type: { type: 'selection', label: 'Work Item Type', options: [{ value: 'bug', label: 'Bug' }, { value: 'task', label: 'Task' }] },
  state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }] },
  area: { type: 'many2one', label: 'Area', relation: 'work.area' },
  tags: { type: 'many2many', label: 'Tags', relation: 'work.tag' },
  parent_id: { type: 'many2one', label: 'Parent', relation: 'work.item' },
  owner: { type: 'many2one', label: 'Owner', relation: 'res.users' },
};

const page = (list: Record<string, unknown>) => ({
  fieldia: '0.1',
  id: 'backlog',
  data: { kind: 'record', model: 'work.item' },
  fields,
  layout: { type: 'list', id: 'list', columns: ['number', 'work_type', 'title', 'state'], ...list },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a list drawn as a backlog', () => {
  it('takes cells, no box to choose, a filter bar of fields, and rows nested under their parent', () => {
    expect(
      problems(
        page({
          cells: {
            number: { align: 'end', width: 6 },
            work_type: { width: 4 },
            title: { lead: { field: 'work_type', looks: { bug: { icon: 'bug', colour: '#cc293d' }, task: { icon: 'task' } } } },
            state: { widget: 'dot', options: { colours: { new: '#b2b2b2', active: '#007acc' } } },
          },
          choose: false,
          search: 'fields',
          searchFields: ['title'],
          filterFields: ['work_type', 'state', 'area', 'tags'],
          parentField: 'parent_id',
        })
      )
    ).toEqual([]);
    // Each part on its own is optional: a list as it was stays valid.
    expect(problems(page({}))).toEqual([]);
    expect(problems(page({ search: 'bar' }))).toEqual([]);
    expect(problems(page({ search: 'fields' }))).toEqual([]);
  });

  it('refuses a cell of no column, a lead from no field, a colour that is none, a width out of range and a side that is none', () => {
    expect(problems(page({ cells: { owner: { width: 10 } } }))).toEqual(['layout.cells.owner: "owner" is no column of this list: its cells are for its columns']);
    expect(problems(page({ cells: { title: { lead: { field: 'kind', looks: { bug: { icon: 'bug' } } } } } }))).toEqual(['layout.cells.title.lead.field: no field "kind"']);
    expect(problems(page({ cells: { title: { lead: { field: 'work_type', looks: { bug: { icon: 'bug', colour: 'red' } } } } } }))).toEqual([
      'layout.cells.title.lead.looks.bug.colour: a colour is #rrggbb',
    ]);
    expect(problems(page({ cells: { title: { width: 0 } } }))[0]).toMatch(/^layout\.cells\.title\.width/);
    expect(problems(page({ cells: { title: { width: 201 } } }))[0]).toMatch(/^layout\.cells\.title\.width/);
    expect(problems(page({ cells: { title: { align: 'middle' } } }))[0]).toMatch(/^layout\.cells\.title\.align/);
    expect(problems(page({ cells: { title: { colour: '#000000' } } }))[0]).toMatch(/^layout\.cells\.title/);
  });

  it('takes a width in pixels for the whole column, 8px to 4000px, as a tracker sizes its grid', () => {
    expect(problems(page({ cells: { number: { width: '59px' }, work_type: { width: '36px' }, title: { width: '908px' }, state: { width: 8 } } }))).toEqual([]);
    for (const width of ['7px', '4001px', '12.5px', '120', 'px', '10em', '-20px']) {
      expect({ width, problems: problems(page({ cells: { title: { width } } })) }).toEqual({ width, problems: [expect.stringMatching(/^layout\.cells\.title\.width/)] });
    }
  });

  it('takes its header’s rule: none, or set in 0px to 400px from the column’s end, before a tracker’s room for row tools', () => {
    expect(problems(page({ cells: { number: { width: '59px', rule: false }, title: { width: '911px', rule: '42px' }, state: { rule: '0px' } } }))).toEqual([]);
    expect(ListCellSchema.safeParse({ rule: '400px' }).success).toBe(true);
    for (const rule of [true, '401px', '-1px', '4.5px', '42', 'px', '2em']) {
      expect({ rule, problems: problems(page({ cells: { title: { rule } } })) }).toEqual({ rule, problems: [expect.stringMatching(/^layout\.cells\.title\.rule/)] });
    }
  });

  it('keeps its rank when headers do not sort, and gives a filter a name of its own', () => {
    expect(problems(page({ sortable: false, sort: [{ field: 'number' }] }))).toEqual([]);
    expect(problems(page({ sortable: 'no' }))[0]).toMatch(/^layout\.sortable/);
    expect(problems(page({ search: 'fields', filterFields: ['state', 'area'], filterLabels: { area: 'Where' } }))).toEqual([]);
    // Only for a filter the bar offers, and never empty.
    expect(problems(page({ search: 'fields', filterFields: ['state'], filterLabels: { area: 'Where' } }))).toEqual([
      'layout.filterLabels.area: "area" is no field of filterFields: its name is for a filter the bar offers',
    ]);
    expect(problems(page({ search: 'fields', filterFields: ['area'], filterLabels: { area: '' } }))[0]).toMatch(/^layout\.filterLabels\.area/);
  });

  it('warns of a lead whose looks name no value of a choice', () => {
    expect(problems(page({ cells: { title: { lead: { field: 'work_type', looks: { epic: { icon: 'story' } } } } } }))).toEqual([
      'layout.cells.title.lead.looks.epic: "epic" is no value of "work_type"',
    ]);
  });

  it('refuses filter fields that are no field, that cannot list their values, or without the filter bar', () => {
    expect(problems(page({ search: 'fields', filterFields: ['kind'] }))).toEqual(['layout.filterFields[0]: no field "kind"']);
    expect(problems(page({ search: 'fields', filterFields: ['description'] }))).toEqual([
      'layout.filterFields[0]: "description" is a html; a filter lists the values of a choice, a link, links, a yes or no, text or a whole number',
    ]);
    expect(problems(page({ filterFields: ['state'] }))).toEqual(['layout.filterFields: the filter fields are for the "fields" search: add "search": "fields"']);
    expect(problems(page({ search: 'fields', filterFields: [] }))[0]).toMatch(/^layout\.filterFields/);
  });

  it('nests rows only under a link to the list’s own records', () => {
    expect(problems(page({ parentField: 'nope' }))).toEqual(['layout.parentField: no field "nope"']);
    expect(problems(page({ parentField: 'owner' }))).toEqual(['layout.parentField: "owner" links to res.users; a parent is a many2one to the list’s own model, work.item']);
    expect(problems(page({ parentField: 'state' }))).toEqual(['layout.parentField: "state" is a selection; a parent is a many2one to the list’s own model, work.item']);
  });

  it('refuses buttons for the rows chosen on a list with no box to choose one', () => {
    expect(problems(page({ choose: false, actions: [{ type: 'button', id: 'archive', label: 'Archive', action: 'archive' }] }))).toEqual([
      'layout.actions: a list’s buttons act on the rows chosen: with "choose": false there is no way to choose one',
    ]);
  });

  it('is a schema of its own, for a host that checks a cell alone', () => {
    expect(ListCellSchema.safeParse({ widget: 'dot', options: { colours: { active: '#007acc' } }, width: 12, align: 'end' }).success).toBe(true);
    expect(ListCellSchema.safeParse({ widht: 12 }).success).toBe(false);
    expect(ListCellSchema.safeParse({ width: '200px' }).success).toBe(true);
  });
});
