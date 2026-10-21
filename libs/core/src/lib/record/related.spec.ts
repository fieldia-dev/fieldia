import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';

/**
 * What a related list asks the data source's `list` for (`form.relatedFilter`): the records whose link is the record
 * shown, and those its filter lets through, read from that record — nothing before its first save, and the next
 * record's once the form shows another. No new member of the source: its `list` answers it.
 */

const customer = (filter?: unknown[]): Page => {
  const checked = validatePage({
    fieldia: '0.8',
    id: 'customer',
    data: { kind: 'record', model: 'partner' },
    fields: { name: { type: 'char', label: 'Name' }, company_id: { type: 'many2one', label: 'Company', relation: 'company' } },
    layout: {
      type: 'sheet',
      id: 'sheet',
      title: { field: 'name' },
      children: [
        { type: 'field', id: 'f-company', field: 'company_id' },
        {
          type: 'related',
          id: 'invoices',
          model: 'invoice',
          field: 'partner_id',
          fields: { name: { type: 'char', label: 'Number' }, amount: { type: 'float', label: 'Total' } },
          columns: ['name', 'amount'],
          ...(filter ? { filter } : {}),
        },
      ],
    },
  });
  if (!checked.ok) throw new Error(checked.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
  return checked.page;
};

const records = () => ({
  partner: { '1': { name: 'Acme', company_id: { id: 7, label: 'North' } }, '2': { name: 'Globex', company_id: { id: 8, label: 'South' } } },
  invoice: {
    '11': { name: 'INV/1', amount: 100, partner_id: { id: 1, label: 'Acme' }, company_id: 7, state: 'posted' },
    '12': { name: 'INV/2', amount: 50, partner_id: { id: 1, label: 'Acme' }, company_id: 8, state: 'posted' },
    '13': { name: 'INV/3', amount: 70, partner_id: { id: 2, label: 'Globex' }, company_id: 8, state: 'cancel' },
    '14': { name: 'INV/4', amount: 20, partner_id: { id: 1, label: 'Acme' }, company_id: 7, state: 'cancel' },
  },
});

describe('a related list’s records', () => {
  it('are those whose link is the record shown, and none before its first save', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const form = createForm({ page: customer(), dataSource });
    expect(form.relatedFilter('invoices')).toBeNull();
    form.setValue('name', 'Initech');
    expect(await form.save()).toBe(true);
    const id = form.getState().recordId;
    expect(form.relatedFilter('invoices')).toEqual([{ field: 'partner_id', op: '=', value: id }]);
    // No related list of that id, or a part of another kind.
    expect(form.relatedFilter('nothing')).toBeNull();
    expect(form.relatedFilter('f-company')).toBeNull();
  });

  it('are listed by the source’s own list, and move with the record shown', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const form = createForm({ page: customer(), dataSource, recordId: 1 });
    await form.load();
    const ask = async () => (await dataSource.list!({ model: 'invoice', fields: ['name'], filter: form.relatedFilter('invoices') ?? [], sort: [{ field: 'name' }], offset: 0, limit: 5 })).records.map((r) => r.values['name']);
    expect(await ask()).toEqual(['INV/1', 'INV/2', 'INV/4']);
    await form.openRecord(2);
    expect(form.relatedFilter('invoices')).toEqual([{ field: 'partner_id', op: '=', value: 2 }]);
    expect(await ask()).toEqual(['INV/3']);
  });

  it('keep to its filter, each valueFrom read from the record shown: its fields, its id, the person, the app’s values', async () => {
    const dataSource = createMemoryDataSource({ records: records() });
    const page = customer([
      { field: 'state', op: '!=', value: 'cancel' },
      { field: 'company_id', op: '=', valueFrom: 'company_id' },
      { field: 'id', op: '!=', valueFrom: 'id' },
      { any: [{ field: 'user_id', op: '=', valueFrom: 'user.id' }, { field: 'branch', op: '=?', valueFrom: 'context.branch' }] },
    ]);
    const form = createForm({ page, dataSource, recordId: 1, user: { id: 5, name: 'Mona' } });
    await form.load();
    expect(form.relatedFilter('invoices')).toEqual([
      { field: 'partner_id', op: '=', value: 1 },
      { field: 'state', op: '!=', value: 'cancel' },
      { field: 'company_id', op: '=', value: 7 },
      { field: 'id', op: '!=', value: 1 },
      // An empty =? always holds, and so the group it is in: left out.
    ]);
    const answer = await dataSource.list!({ model: 'invoice', fields: ['name'], filter: form.relatedFilter('invoices') ?? [], sort: [], offset: 0, limit: 5 });
    expect(answer.records.map((r) => r.values['name'])).toEqual(['INV/1']);
    // Read as the record is now: another company typed in.
    form.setValue('company_id', { id: 8, label: 'South' });
    expect(form.relatedFilter('invoices')?.[2]).toEqual({ field: 'company_id', op: '=', value: 8 });
  });
});
