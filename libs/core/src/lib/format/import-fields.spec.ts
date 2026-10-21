import { importFields, validatePage, type ListNode, type Page } from '../../index';

/**
 * A list's Import (off unless given): true offers every field of the page a
 * file's cell can fill, in the page's order; a list offers those named. The
 * page check refuses a field no cell can fill — a table of lines, a file, a
 * read-only or worked-out field, one the page lacks — and true on a page with
 * none to fill.
 */

const fields = {
  name: { type: 'char', label: 'Name', required: true },
  email: { type: 'char', label: 'Email' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'lead', label: 'Lead' }] },
  owner_id: { type: 'many2one', label: 'Owner', relation: 'res.users' },
  tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
  orders: { type: 'integer', label: 'Orders', readonly: true },
  total: { type: 'float', label: 'Total', compute: 'orders * 2' },
  photo: { type: 'image', label: 'Photo' },
  since: { type: 'date', label: 'Since' },
  newsletter: { type: 'boolean', label: 'Newsletter' },
};

const page = (list: Record<string, unknown>, own: Record<string, unknown> = fields) => ({
  fieldia: '0.9',
  id: 'contacts',
  data: { kind: 'record', model: 'contact' },
  fields: own,
  layout: { type: 'list', id: 'list', columns: ['name', 'state'], ...list },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const offered = (list: Record<string, unknown>) => {
  const p = page(list) as unknown as Page;
  return importFields(p, p.layout as ListNode);
};

describe('a list’s Import, as the page says it', () => {
  it('takes true, false or a list of fields', () => {
    expect(problems(page({ import: true }))).toEqual([]);
    expect(problems(page({ import: false }))).toEqual([]);
    expect(problems(page({ import: ['name', 'email', 'tag_ids'] }))).toEqual([]);
    expect(problems(page({ import: [] }))).not.toEqual([]);
    expect(problems(page({ import: 'yes' }))).not.toEqual([]);
  });

  it('offers nothing unless asked', () => {
    expect(offered({})).toEqual([]);
    expect(offered({ import: false })).toEqual([]);
  });

  it('with true, offers every field a cell can fill, in the page’s order — not only the columns', () => {
    expect(offered({ import: true })).toEqual(['name', 'email', 'state', 'owner_id', 'tag_ids', 'since', 'newsletter']);
  });

  it('with a list, offers those named that a cell can fill, in its order', () => {
    expect(offered({ import: ['since', 'name', 'name', 'orders'] })).toEqual(['since', 'name']);
  });

  it('refuses a field no cell can fill, one the page lacks, or one named twice, and says why', () => {
    expect(problems(page({ import: ['name', 'photo', 'orders', 'total', 'missing', 'name'] }))).toEqual([
      'layout.import[1]: "photo" is a image; a file\'s cell fills words, a number, money, a yes or no, a date, a choice, or a link or links by name',
      'layout.import[2]: "orders" is read-only; Import fills a field people can change',
      'layout.import[3]: "total" is worked out from other fields; Import fills a field people can change',
      expect.stringMatching(/^layout\.import\[4\]: .*missing/),
      'layout.import[5]: "name" is offered twice',
    ]);
  });

  it('refuses true on a page with no field a cell can fill', () => {
    expect(problems(page({ import: true, columns: ['photo'] }, { photo: { type: 'image', label: 'Photo' }, orders: { type: 'integer', label: 'Orders', readonly: true } }))).toEqual([
      'layout.import: Import fills the fields a file’s cell can, and this page has none: words, a number, money, yes or no, a date, a choice or a link people can change',
    ]);
  });
});
