import { createMemoryDataSource, saveRefused, type DataSource, type MemoryApprovalRoute, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A record's approvals as a person meets them (`approval` on a record's page): where it stands said over the record —
 * those still to decide at the level waiting, why it needs approval — its levels with who decided there, Approve and
 * Reject for those who may decide and no one else, Reject asking why, every field locked while it waits but those the
 * page leaves open (each lock saying why), and its history folded under a count. Nothing shows for a record that needs
 * none, for a new one, or where the source tells none.
 */

const MONA = { id: 21, name: 'Mona Adel' };
const HANY = { id: 28, name: 'Hany Lotfy' };
const SARA = { id: 26, name: 'Sara Nabil' };

const order = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.7',
    id: 'purchase-order',
    timeZone: 'UTC',
    data: { kind: 'record', model: 'purchase.order' },
    records: { one: 'purchase order', other: 'purchase orders' },
    fields: {
      name: { type: 'char', label: 'Reference' },
      vendor: { type: 'char', label: 'Vendor' },
      amount: { type: 'float', label: 'Total' },
      state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'to_approve', label: 'To approve' }, { value: 'purchase', label: 'Purchase order' }, { value: 'rejected', label: 'Rejected' }] },
      notes: { type: 'text', label: 'Notes' },
    },
    layout: {
      type: 'sheet',
      id: 'sheet',
      alerts: [{ id: 'a-late', message: 'Delivery is late', tone: 'warning' }],
      title: { field: 'name' },
      children: [{ type: 'section', id: 'g', children: ['vendor', 'amount', 'state', 'notes'].map((field) => ({ type: 'field', id: `f-${field}`, field })) }],
    },
    approval: { open: ['notes'] },
    ...more,
  }) as Page;

const route = (values: Record<string, unknown>): MemoryApprovalRoute | null =>
  Number(values['amount']) > 50000
    ? {
        levels: [
          { id: 'finance', name: 'Finance', approvers: [MONA, HANY] },
          { id: 'cfo', name: 'CFO', approvers: [SARA] },
        ],
        asked: values['state'] === 'to_approve' || values['state'] === 'purchase',
        why: 'Orders over EGP 50,000 go to Finance, then the CFO.',
        approved: { state: 'purchase' },
        rejected: { state: 'rejected' },
      }
    : null;

const source = () =>
  createMemoryDataSource({
    records: {
      'purchase.order': {
        1: { name: 'PO-0042', vendor: 'Nile Office Supply', amount: 184000, state: 'to_approve', notes: '' },
        2: { name: 'PO-0043', vendor: 'Delta Paper', amount: 12000, state: 'draft', notes: '' },
      },
    },
    approvals: { 'purchase.order': route },
    approvalHistory: { 'purchase.order:1': [{ decision: 'requested', by: 'Omar Said', at: '2026-10-18T08:10:00.000Z' }] },
  });

let handle: ViewerHandle | null = null;
let host: HTMLElement;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
async function until(ready: () => unknown) {
  for (let turn = 0; turn < 200 && !ready(); turn++) await new Promise((done) => setTimeout(done, 5));
  expect(ready()).toBeTruthy();
}
async function mount(dataSource: DataSource, recordId: number | null = 1, options: Partial<ViewerOptions> = {}) {
  host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: order(), dataSource, recordId, user: MONA, ...options });
  if (recordId !== null) await until(() => handle?.form.getState().approval?.state === 'told' || handle?.form.getState().approval?.state === 'failed');
  return handle;
}
const band = () => host.querySelector<HTMLElement>('.fd-approval');
const text = (selector: string) => band()?.querySelector(selector)?.textContent ?? null;
const shownButtons = () => [...(band()?.querySelectorAll<HTMLButtonElement>('.fd-approval-actions button') ?? [])].map((b) => b.textContent);
const button = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === name && !b.closest('[hidden]')) as HTMLButtonElement;
const field = (id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement;
const lockWords = (id: string) => {
  const lock = field(id).querySelector<HTMLElement>('.fd-lock-wrap');
  return lock && !lock.hidden ? (lock.querySelector('[role="tooltip"]')?.textContent ?? null) : null;
};

describe('a record waiting for approval', () => {
  it('says who it waits for, why, and its levels with their states, under the sheet’s alerts', async () => {
    await mount(source());
    expect(band()?.hidden).toBe(false);
    expect(band()?.getAttribute('data-status')).toBe('waiting');
    expect(text('.fd-approval-title')).toBe('Waiting for Finance: Mona Adel or Hany Lotfy');
    expect(text('.fd-approval-why')).toBe('Orders over EGP 50,000 go to Finance, then the CFO.');
    expect([...(band()?.querySelectorAll('.fd-approval-level') ?? [])].map((li) => li.textContent)).toEqual(['FinanceWaiting', 'CFOLater']);
    // Under the alerts, in the sheet's card, before its title.
    const card = host.querySelector('.fd-card') as HTMLElement;
    expect(band()?.parentElement).toBe(card);
    expect(band()?.previousElementSibling?.classList.contains('fd-alert')).toBe(true);
    // Its region is named by what it says.
    expect(band()?.getAttribute('aria-labelledby')).toBe(band()?.querySelector('.fd-approval-title')?.id);
  });

  it('locks every field but those the page leaves open, each lock saying why, and says what stays open', async () => {
    await mount(source());
    expect(text('.fd-approval-open')).toBe('While it waits, only Notes can be changed.');
    expect(field('f-vendor').querySelector('input')?.readOnly).toBe(true);
    expect(lockWords('f-vendor')).toBe('Locked while it waits for approval');
    expect(field('f-notes').querySelector('textarea')?.readOnly).toBe(false);
    expect(lockWords('f-notes')).toBeNull();
  });

  it('offers Approve and Reject to an approver of the level waiting, and to no one else', async () => {
    await mount(source());
    expect(shownButtons()).toEqual(['Approve', 'Reject']);
    handle?.destroy();
    document.body.replaceChildren();
    await mount(source(), 1, { user: SARA });
    expect(shownButtons()).toEqual([]);
  });

  it('approves: the next level waits, and its approver is named; nothing more for this person to decide', async () => {
    const dataSource = source();
    await mount(dataSource);
    button('Approve').click();
    await until(() => text('.fd-approval-title') === 'Waiting for CFO: Sara Nabil');
    expect(shownButtons()).toEqual([]);
    expect([...(band()?.querySelectorAll('.fd-approval-level') ?? [])].map((li) => li.textContent)).toEqual(['FinanceApproved by Mona Adel', 'CFOWaiting']);
    expect(host.querySelector('.fd-announce')?.textContent ?? '').toMatch(/Approv/);
  });

  it('asks why before it rejects: none given is refused under the box, a reason rejects it and opens the record again', async () => {
    const dataSource = source();
    await mount(dataSource);
    button('Reject').click();
    const dialog = host.querySelector<HTMLElement>('.fd-approval-reject') as HTMLElement;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.querySelector('h2')?.textContent).toBe('Reject this purchase order?');
    expect(dialog.querySelector('.fd-approval-reject-ask')?.textContent).toBe('Say why it is rejected for Finance. The reason is kept in its history.');
    const box = dialog.querySelector('textarea') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(box);
    (dialog.querySelector('.fd-actions .fd-button-danger') as HTMLButtonElement).click();
    await until(() => !(dialog.querySelector('.fd-error') as HTMLElement).hidden);
    expect(dialog.querySelector('.fd-error')?.textContent).toBe('Say why it is rejected');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(dataSource.calls.filter((call) => call.method === 'decide')).toEqual([]);
    box.value = 'The quote is out of date: ask for a new one';
    box.dispatchEvent(new Event('input'));
    (dialog.querySelector('.fd-actions .fd-button-danger') as HTMLButtonElement).click();
    await until(() => text('.fd-approval-title') === 'Rejected by Mona Adel (Finance)');
    expect(dialog.isConnected).toBe(false);
    expect(band()?.getAttribute('data-status')).toBe('rejected');
    expect(text('.fd-approval-reason')).toBe('The quote is out of date: ask for a new one');
    expect(handle?.form.getState().values['state']).toBe('rejected');
    // Rejected, it may be put right: nothing is locked by it now.
    expect(field('f-vendor').querySelector('input')?.readOnly).toBe(false);
    expect(band()?.querySelector('.fd-approval-open')?.hasAttribute('hidden')).toBe(true);
  });

  it('keeps Reject’s question open with the source’s refusal said in it, the reason kept', async () => {
    const dataSource = source();
    dataSource.decide = () => Promise.reject(saveRefused({ kind: 'rule', message: 'Finance closes its books today' }));
    await mount(dataSource);
    button('Reject').click();
    const dialog = host.querySelector<HTMLElement>('.fd-approval-reject') as HTMLElement;
    const box = dialog.querySelector('textarea') as HTMLTextAreaElement;
    box.value = 'Too much';
    (dialog.querySelector('.fd-actions .fd-button-danger') as HTMLButtonElement).click();
    await until(() => !(dialog.querySelector('.fd-error') as HTMLElement).hidden);
    expect(dialog.querySelector('.fd-error')?.textContent).toBe('Not rejected: Finance closes its books today');
    expect(box.value).toBe('Too much');
    // Escape lets it go, and the focus goes back to Reject.
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dialog.isConnected).toBe(false);
    expect(document.activeElement?.textContent).toBe('Reject');
  });

  it('says beside its buttons why an approval did not go through', async () => {
    const dataSource = source();
    dataSource.decide = () => Promise.reject(saveRefused({ kind: 'rule', message: 'Finance closes its books today' }));
    await mount(dataSource);
    button('Approve').click();
    await until(() => text('.fd-approval-said'));
    expect(text('.fd-approval-said')).toBe('Not approved: Finance closes its books today');
    expect(band()?.querySelector('.fd-approval-said')?.getAttribute('role')).toBe('alert');
  });

  it('folds its history under a count: who asked, who decided, when, and why', async () => {
    const dataSource = source();
    await mount(dataSource);
    const toggle = band()?.querySelector('.fd-approval-toggle') as HTMLButtonElement;
    expect(toggle.textContent).toBe('Approval history (1)');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect((band()?.querySelector('.fd-approval-history') as HTMLElement).hidden).toBe(true);
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const entries = () => [...(band()?.querySelectorAll('.fd-approval-entry') ?? [])];
    expect(entries().map((li) => li.querySelector('.fd-approval-entry-what')?.textContent)).toEqual(['Omar Said asked for approval']);
    expect(entries()[0].querySelector('time')?.textContent).toMatch(/^18 Oct 2026, 08:10/);
    button('Reject').click();
    const dialog = host.querySelector<HTMLElement>('.fd-approval-reject') as HTMLElement;
    (dialog.querySelector('textarea') as HTMLTextAreaElement).value = 'Over budget';
    (dialog.querySelector('.fd-actions .fd-button-danger') as HTMLButtonElement).click();
    await until(() => entries().length === 2);
    expect(toggle.textContent).toBe('Approval history (2)');
    expect(entries()[1].querySelector('.fd-approval-entry-what')?.textContent).toBe('Mona Adel rejected it for Finance');
    expect(entries()[1].querySelector('q')?.textContent).toBe('Over budget');
  });
});

describe('approvals not shown', () => {
  it('for a record that needs none, a new one, or a source that tells none', async () => {
    await mount(source(), 2);
    expect(band()?.hidden).toBe(true);
    handle?.destroy();
    document.body.replaceChildren();
    await mount(source(), null);
    expect(band()?.hidden).toBe(true);
    handle?.destroy();
    document.body.replaceChildren();
    const { approvals: _, decide: __, ...plain } = source();
    host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: order(), dataSource: plain as DataSource, recordId: 1, user: MONA });
    await until(() => handle?.form.getState().status === 'ready');
    expect(band()?.hidden).toBe(true);
    expect(field('f-vendor').querySelector('input')?.readOnly).toBe(false);
  });

  it('with no Approve and Reject where the source takes no decisions', async () => {
    const { decide: _, ...told } = source();
    await mount(told as DataSource);
    expect(text('.fd-approval-title')).toBe('Waiting for Finance: Mona Adel or Hany Lotfy');
    expect(shownButtons()).toEqual([]);
  });

  it('says it could not read them, with Retry', async () => {
    const dataSource = source();
    const real = dataSource.approvals.bind(dataSource);
    let fails = true;
    dataSource.approvals = (request) => (fails ? Promise.reject(new Error('The approvals service is down')) : real(request));
    await mount(dataSource);
    expect(band()?.getAttribute('data-status')).toBe('failed');
    expect(text('.fd-approval-title')).toBe('The approvals could not be read: The approvals service is down');
    fails = false;
    button('Retry').click();
    await until(() => text('.fd-approval-title') === 'Waiting for Finance: Mona Adel or Hany Lotfy');
  });
});

describe('approvals on a page of sections, and needing approval', () => {
  it('stand over its sections; before it is sent, it needs approval from its levels in turn, and nothing locks', async () => {
    const dataSource = source();
    dataSource.records['purchase.order'][1]['state'] = 'draft';
    host = document.createElement('div');
    document.body.append(host);
    const page = order({ layout: { type: 'sections', id: 's', children: [{ type: 'section', id: 'g', children: ['vendor', 'amount', 'notes'].map((name) => ({ type: 'field', id: `f-${name}`, field: name })) }] } as Page['layout'] });
    handle = mountViewer(host, { page, dataSource, recordId: 1, user: MONA });
    await until(() => handle?.form.getState().approval?.state === 'told');
    expect(text('.fd-approval-title')).toBe('Needs approval from Finance, then CFO');
    expect(band()?.getAttribute('data-status')).toBe('needed');
    expect(band()?.nextElementSibling?.querySelector(':scope > [data-node="s"]')).not.toBeNull();
    expect(field('f-vendor').querySelector('input')?.readOnly).toBe(false);
    expect(shownButtons()).toEqual([]);
  });
});
