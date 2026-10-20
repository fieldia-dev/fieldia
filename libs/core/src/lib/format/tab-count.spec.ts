import { relatedInTab, validatePage } from '../../index';
import { checkPage } from './check-page';
import type { TabNode } from './layout';

/**
 * A tab's count: a field's (a number, lines, links, files), or the records of a related list it holds
 * (`{ "related": id }`), in its groups or tabs of its own — never a list elsewhere on the page, nor a field by that shape.
 */

const quotations = {
  type: 'related',
  id: 'quotations',
  model: 'quotation',
  field: 'partner_id',
  fields: { name: { type: 'char', label: 'Number' }, partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' } },
  columns: ['name'],
};

const customer = (count: unknown, children: unknown[] = [quotations]) => ({
  fieldia: '0.7',
  id: 'customer',
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' }, notes: { type: 'text', label: 'Notes' }, line_ids: { type: 'one2many', label: 'Lines', relation: 'line', fields: { name: { type: 'char', label: 'Name' } } } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    children: [
      { type: 'related', id: 'elsewhere', model: 'invoice', field: 'partner_id', fields: { name: { type: 'char', label: 'Number' } }, columns: ['name'] },
      {
        type: 'tabs',
        id: 'tabs',
        children: [
          { type: 'tab', id: 'tab-quotations', label: 'Quotations', count, children },
          { type: 'tab', id: 'tab-notes', label: 'Notes', children: [{ type: 'field', id: 'f-notes', field: 'notes' }] },
        ],
      },
    ],
  },
});

const issues = (input: unknown) => {
  const shape = validatePage(input);
  if (!shape.ok) return shape.issues.map((i) => `${i.path}: ${i.message}`);
  const r = checkPage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const at = 'layout.children[1].children[0].count';

describe('a tab’s count', () => {
  it('counts the records of a related list it holds, in its groups or tabs of its own', () => {
    expect(issues(customer({ related: 'quotations' }))).toEqual([]);
    expect(issues(customer({ related: 'quotations' }, [{ type: 'section', id: 'inside', children: [quotations] }]))).toEqual([]);
    expect(issues(customer({ related: 'quotations' }, [{ type: 'tabs', id: 'inner', children: [{ type: 'tab', id: 'inner-a', label: 'A', children: [quotations] }] }]))).toEqual([]);
  });

  it('refuses a related list it does not hold, by its id', () => {
    expect(issues(customer({ related: 'elsewhere' }))).toEqual([`${at}.related: "elsewhere" is no related list in this tab: a tab counts the records of one it holds`]);
    expect(issues(customer({ related: 'nothing' }))).toEqual([`${at}.related: "nothing" is no related list in this tab: a tab counts the records of one it holds`]);
  });

  it('still counts a field, and takes nothing else by the shape', () => {
    expect(issues(customer('line_ids'))).toEqual([]);
    expect(issues(customer({ related: 'quotations', more: true }))).toEqual([expect.stringMatching(/^layout\.children\[1\]\.children\[0\]\.count/)]);
    expect(issues(customer({ field: 'line_ids' }))).toEqual([expect.stringMatching(/^layout\.children\[1\]\.children\[0\]\.count/)]);
    expect(issues(customer({ related: '' }))).toEqual([expect.stringMatching(/^layout\.children\[1\]\.children\[0\]\.count/)]);
  });

  it('finds the list in a tab by its id, wherever in the tab it stands', () => {
    const tab = { type: 'tab', id: 't', label: 'T', children: [{ type: 'section', id: 's', children: [quotations] }] } as unknown as TabNode;
    expect(relatedInTab(tab, 'quotations')?.model).toBe('quotation');
    expect(relatedInTab(tab, 's')).toBeNull();
    expect(relatedInTab(tab, 'invoices')).toBeNull();
  });
});
