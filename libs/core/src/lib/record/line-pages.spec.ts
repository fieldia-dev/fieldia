import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';

/**
 * Lines with pages of their own, as Flectra's lists have them: a line opening
 * its own record's page (`lineOpens: "record"`), and a many2many shown as a
 * table of its records' fields (`fields` on the many2many, `columns` on its node).
 */
const matter = {
  fieldia: '0.1',
  id: 'matter',
  data: { kind: 'record', model: 'legal.matter' },
  fields: {
    hearing_ids: {
      type: 'one2many',
      label: 'Hearings',
      relation: 'legal.hearing',
      fields: { date: { type: 'date', label: 'Date' }, court: { type: 'char', label: 'Court' } },
    },
    compliance_ids: {
      type: 'many2many',
      label: 'Compliance',
      relation: 'legal.compliance',
      fields: {
        name: { type: 'char', label: 'Requirement' },
        due: { type: 'date', label: 'Due' },
        state: { type: 'selection', label: 'Status', options: [{ value: 'open', label: 'Open' }, { value: 'met', label: 'Met' }] },
      },
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-hearings', field: 'hearing_ids', lineOpens: 'record' },
      { type: 'field', id: 'f-compliance', field: 'compliance_ids', columns: ['name', 'due', 'state'] },
    ],
  },
} as unknown as Page;

const issues = (page: unknown) => {
  const result = validatePage(page as Page);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
};

describe('lines with pages of their own', () => {
  it('is a valid page: a line opens its record, a many2many shows its records’ fields', () => {
    expect(issues(matter)).toEqual([]);
  });

  it('refuses a column a many2many’s records do not have, and lineOpens on what is not a table of lines', () => {
    const wrong = structuredClone(matter) as unknown as { layout: { children: Record<string, unknown>[] } };
    wrong.layout.children[1]['columns'] = ['name', 'nothing'];
    wrong.layout.children[1]['lineOpens'] = 'record';
    expect(issues(wrong)).toEqual([
      'layout.children[1].lineOpens: lineOpens only applies to one2many fields; "compliance_ids" is a many2many',
      'layout.children[1].columns[1]: "nothing" is not a field of the records of "compliance_ids"',
    ]);
  });

  it('reads the fields a many2many’s table shows from the data source, by its records’ ids', async () => {
    const dataSource = createMemoryDataSource({
      records: {
        'legal.compliance': {
          1: { name: 'Anti-money laundering check', due: '2026-11-01', state: 'open', owner: 'Mona' },
          2: { name: 'Conflict search', due: '2026-10-01', state: 'met' },
          3: { name: 'Engagement letter', due: null, state: 'open' },
        },
      },
    });
    const form = createForm({ page: matter, dataSource });
    expect(await form.linkedValues('compliance_ids', [2, 1], ['name', 'state'])).toEqual([
      { id: 2, values: { name: 'Conflict search', state: 'met' } },
      { id: 1, values: { name: 'Anti-money laundering check', state: 'open' } },
    ]);
    expect(await form.linkedValues('compliance_ids', [], ['name'])).toEqual([]);
    // Without a data source that lists records, there is nothing to read.
    expect(await createForm({ page: matter }).linkedValues('compliance_ids', [1], ['name'])).toEqual([]);
  });
});
