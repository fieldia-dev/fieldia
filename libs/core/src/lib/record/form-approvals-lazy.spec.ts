import type { Page } from '../format/page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { formApprovalsPart } from './approving';

/**
 * Before the approvals part has come (approving.ts, `formApprovalsPart`): a record's approvals — asked of the source,
 * a decision taken, its fields locked while it waits — come in a part a page with `approval` asks for. A form made
 * before it came asks as it comes, once its record is loaded; a page without approvals never loads it. This file starts
 * with no part loaded.
 */

const order = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.9',
    id: 'purchase-order',
    data: { kind: 'record', model: 'purchase.order' },
    fields: { vendor: { type: 'char', label: 'Vendor' }, notes: { type: 'text', label: 'Notes' } },
    layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-vendor', field: 'vendor' }, { type: 'field', id: 'f-notes', field: 'notes' }] },
    approval: { open: ['notes'] },
    ...more,
  }) as Page;

const source = () =>
  createMemoryDataSource({
    records: { 'purchase.order': { 1: { vendor: 'Nile Office Supply', notes: '' } } },
    approvals: { 'purchase.order': () => ({ levels: [{ id: 'finance', name: 'Finance', approvers: [{ id: 21, name: 'Mona Adel' }] }], asked: true }) },
  });

describe("a record's approvals part", () => {
  it('a page without approvals never loads it, and keeps none', async () => {
    const dataSource = source();
    const form = createForm({ page: order({ approval: undefined }), dataSource, recordId: 1 });
    await form.load();
    await form.settled();
    expect(form.getState().approval ?? null).toBeNull();
    expect(formApprovalsPart.loaded).toBeUndefined();
    expect(dataSource.calls.map((call) => call.method)).toEqual(['load']);
  });

  it('a form made before it came asks as it comes, once its record is loaded, and locks what waits', async () => {
    const dataSource = source();
    const form = createForm({ page: order(), dataSource, recordId: 1, user: { id: 21, name: 'Mona Adel' } });
    expect(form.getState().approval ?? null).toBeNull();
    await form.load();
    await form.settled();
    expect(formApprovalsPart.loaded).toBeDefined();
    expect(dataSource.calls.map((call) => call.method)).toEqual(['load', 'approvals']);
    expect(form.getState().approval).toMatchObject({ status: 'waiting', mine: ['finance'] });
    expect(form.node('f-vendor').readonly).toBe(true);
    expect(form.node('f-notes').readonly).toBe(false);
  });
});
