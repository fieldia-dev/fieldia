import { createMemoryDataSource, formApprovalsPart, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { approvalsPart, partsFor } from './viewer-parts';

/**
 * A record's approvals come in parts: its form's (@fieldia/core's `formApprovalsPart`: asked, decided, its fields
 * locked while it waits) and the viewer's (`approvalsPart`: where it stands drawn over it, Approve and Reject, its
 * history) — one script in the one-tag script — for a record's own page with `approval`. A page without asks for
 * neither. This file starts with no part loaded (src/test-parts.ts leaves it so), its tests in order.
 */

const order = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.10',
    id: 'purchase-order',
    data: { kind: 'record', model: 'purchase.order' },
    fields: { vendor: { type: 'char', label: 'Vendor' }, notes: { type: 'text', label: 'Notes' } },
    layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-vendor', field: 'vendor' }, { type: 'field', id: 'f-notes', field: 'notes' }] },
    approval: { open: ['notes'] },
    ...more,
  }) as Page;

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
async function until(ready: () => unknown) {
  for (let turn = 0; turn < 200 && !ready(); turn++) await new Promise((done) => setTimeout(done, 5));
  expect(ready()).toBeTruthy();
}

describe("a record's approvals parts", () => {
  it('are asked for by a page with approval, both — its check keeps it to a record’s own page — never by another', () => {
    expect(partsFor(order())).toEqual([approvalsPart, formApprovalsPart]);
    expect(partsFor(order({ approval: undefined }))).toEqual([]);
  });

  it('a record waiting is drawn once both came: its band over it, its fields locked but those left open', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const dataSource = createMemoryDataSource({
      records: { 'purchase.order': { 1: { vendor: 'Nile Office Supply', notes: '' } } },
      approvals: { 'purchase.order': () => ({ levels: [{ id: 'finance', name: 'Finance', approvers: [{ id: 21, name: 'Mona Adel' }] }], asked: true }) },
    });
    handle = mountViewer(host, { page: order(), dataSource, recordId: 1, user: { id: 21, name: 'Mona Adel' } });
    // Nothing drawn before they came: no field is typed in that would lock.
    expect(host.querySelector('.fd-field')).toBeNull();
    await until(() => host.querySelector('.fd-approval:not([hidden]) .fd-approval-title')?.textContent);
    expect(approvalsPart.loaded).toBeDefined();
    expect(formApprovalsPart.loaded).toBeDefined();
    expect(host.querySelector('.fd-approval-title')?.textContent).toBe('Waiting for Finance: Mona Adel');
    expect((host.querySelector('[data-node="f-vendor"] input') as HTMLInputElement).readOnly).toBe(true);
    expect((host.querySelector('[data-node="f-notes"] textarea') as HTMLTextAreaElement).readOnly).toBe(false);
    expect(document.getElementById('fieldia-approvals-styles')).not.toBeNull();
  });
});
