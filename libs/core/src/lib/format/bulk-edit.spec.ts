import { bulkEditFields, validatePage, type ListNode, type Page } from '../../index';

/**
 * A list's Export (on unless false) and Edit (off unless given): Edit offers
 * the fields one value can set in many records, and the page check refuses
 * one it cannot — a table of lines, a read-only or worked-out field, a field
 * the page lacks — or Edit where no row can be chosen.
 */

const fields = {
  name: { type: 'char', label: 'Name' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'active', label: 'Active' }] },
  owner_id: { type: 'many2one', label: 'Owner', relation: 'res.users' },
  orders: { type: 'integer', label: 'Orders', readonly: true },
  total: { type: 'float', label: 'Total', compute: 'orders * 2' },
  tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
  since: { type: 'date', label: 'Since' },
};

const page = (list: Record<string, unknown>) => ({
  fieldia: '0.11',
  id: 'contacts',
  data: { kind: 'record', model: 'contact' },
  fields,
  layout: { type: 'list', id: 'list', columns: ['name', 'state', 'owner_id', 'orders', 'total', 'tag_ids'], ...list },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const offered = (list: Record<string, unknown>) => {
  const p = page(list) as unknown as Page;
  return bulkEditFields(p, p.layout as ListNode);
};

describe('a list’s Export and Edit, as the page says them', () => {
  it('takes Export as true (off unless asked) or false, and Edit as true or a list of fields', () => {
    expect(problems(page({ export: true }))).toEqual([]);
    expect(problems(page({ export: false }))).toEqual([]);
    expect(problems(page({ bulkEdit: true }))).toEqual([]);
    expect(problems(page({ bulkEdit: ['state', 'owner_id', 'since'] }))).toEqual([]);
  });

  it('offers no Edit unless asked; with true, the columns one value can set; with a list, those of it', () => {
    expect(offered({})).toEqual([]);
    expect(offered({ bulkEdit: false })).toEqual([]);
    // Read-only, worked out, and links of many: not offered.
    expect(offered({ bulkEdit: true })).toEqual(['name', 'state', 'owner_id']);
    expect(offered({ bulkEdit: ['since', 'state'] })).toEqual(['since', 'state']);
  });

  it('refuses a field Edit cannot set, one the page lacks, one named twice, and Edit with no box to choose a row', () => {
    expect(problems(page({ bulkEdit: ['tag_ids', 'orders', 'total', 'nope', 'state', 'state'] }))).toEqual([
      'layout.bulkEdit[0]: "tag_ids" is a many2many; one value set in many records is words, a number, money, a yes or no, a date, a choice or a link',
      'layout.bulkEdit[1]: "orders" is read-only; Edit sets a field people can change',
      'layout.bulkEdit[2]: "total" is worked out from other fields; Edit sets a field people can change',
      expect.stringMatching(/^layout\.bulkEdit\[3\]: .*nope/),
      'layout.bulkEdit[5]: "state" is offered twice',
    ]);
    expect(problems(page({ bulkEdit: true, choose: false }))).toEqual(['layout.bulkEdit: Edit changes the rows chosen: with "choose": false there is no way to choose one']);
    expect(problems({ ...page({ bulkEdit: true }), layout: { type: 'list', id: 'list', columns: ['orders', 'tag_ids'], bulkEdit: true } })).toEqual([
      'layout.bulkEdit: Edit offers the columns one value can set, and none of these can: name the fields it offers',
    ]);
  });

  it('refuses an export that is not yes or no, and Edit that names no field', () => {
    expect(problems(page({ export: 'xlsx' }))).toEqual([expect.stringMatching(/^layout\.export: /)]);
    expect(problems(page({ bulkEdit: [] }))).toEqual([expect.stringMatching(/^layout\.bulkEdit/)]);
  });
});
