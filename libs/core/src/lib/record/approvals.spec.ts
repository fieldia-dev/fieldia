import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { validatePage } from '../format/validate';
import { saveRefused, type Approvals, type DataSource } from './data-source';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { MemoryApprovalRoute } from './memory-approvals';
import { MESSAGES } from './messages';
import { approvalOf, approvalStatus, approvalWhen } from './form-approvals';

/**
 * Approvals on a record (`approval` on a record's page): the page setting and its checks, the data source's
 * `approvals` and `decide` (docs/plans/wave1-contract.md's style: each optional — without `approvals` nothing is asked
 * and nothing shows), what the form keeps of them, the record locked while it waits but for the fields the page leaves
 * open, a decision taken on the record as saved and the record loaded again after, a late answer laid on no other
 * record — and the memory source's answers, an approval engine's in small: in turn or together, any one or all, a
 * rejection ending the round, a record sent again starting another.
 */

const order = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.10',
    id: 'purchase-order',
    data: { kind: 'record', model: 'purchase.order' },
    fields: {
      name: { type: 'char', label: 'Reference' },
      vendor: { type: 'char', label: 'Vendor' },
      amount: { type: 'monetary', label: 'Total' },
      state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'to_approve', label: 'To approve' }, { value: 'purchase', label: 'Purchase order' }, { value: 'rejected', label: 'Rejected' }] },
      notes: { type: 'text', label: 'Notes' },
    },
    layout: { type: 'sections', id: 's', children: [{ type: 'section', id: 'g', children: ['name', 'vendor', 'amount', 'state', 'notes'].map((field) => ({ type: 'field', id: `f-${field}`, field })) }] },
    approval: { open: ['notes'] },
    ...more,
  }) as Page;

const MONA = { id: 21, name: 'Mona Adel' };
const SARA = { id: 26, name: 'Sara Nabil' };
const OMAR = { id: 27, name: 'Omar Said' };
const KARIM = { id: 22, name: 'Karim Fathy' };

/** Orders over 50,000 go to Finance, then the CFO; those over 500,000 to the board's two members as well, both of them. */
const route = (values: Record<string, unknown>): MemoryApprovalRoute | null =>
  Number(values['amount']) > 50000
    ? {
        levels: [
          { id: 'finance', name: 'Finance', approvers: [MONA, { id: 28, name: 'Hany Lotfy' }] },
          { id: 'cfo', name: 'CFO', approvers: [SARA] },
          ...(Number(values['amount']) > 500000 ? [{ id: 'board', name: 'Board', approvers: [KARIM, OMAR], needs: 'all' as const }] : []),
        ],
        asked: values['state'] === 'to_approve' || values['state'] === 'purchase',
        why: 'Orders over EGP 50,000 go to Finance, then the CFO.',
        approved: { state: 'purchase' },
        rejected: { state: 'rejected' },
      }
    : null;

const orders = () => ({
  1: { name: 'PO-0042', vendor: 'Nile Office Supply', amount: 184000, state: 'to_approve', notes: '' },
  2: { name: 'PO-0043', vendor: 'Delta Paper', amount: 12000, state: 'draft', notes: '' },
  3: { name: 'PO-0044', vendor: 'Cairo Fit-out', amount: 640000, state: 'draft', notes: '' },
});

const source = (more: Parameters<typeof createMemoryDataSource>[0] = {}) =>
  createMemoryDataSource({
    records: { 'purchase.order': orders() },
    approvals: { 'purchase.order': route },
    approvalHistory: { 'purchase.order:1': [{ decision: 'requested', by: 'Omar Said', at: '2026-10-18T08:10:00.000Z' }] },
    ...more,
  });

/** A record's page opened as the viewer opens it: its record loaded. */
const open = (dataSource: DataSource, recordId: number | null, user = MONA, page = order()) => {
  const form = createForm({ page, dataSource, recordId, user });
  if (recordId !== null) void form.load();
  return form;
};
const calls = (dataSource: ReturnType<typeof source>, method: string) => dataSource.calls.filter((call) => call.method === method);

describe('the page setting: approval', () => {
  it('is read by both checks on a record’s own page, with or without fields left open', () => {
    for (const check of [validatePage, checkPage]) {
      expect(check(order()).ok).toBe(true);
      expect(check(order({ approval: {} })).ok).toBe(true);
      expect(check(order({ approval: { lock: false } })).ok).toBe(true);
    }
  });

  it('refuses a page of responses, a list, a field the page has not, one named twice, and fields left open where nothing locks', () => {
    for (const check of [validatePage, checkPage]) {
      const responses = check(order({ data: { kind: 'responses' } }));
      expect(responses.ok ? [] : responses.issues).toContainEqual({ path: 'approval', message: 'approvals are asked of a record: a page of responses keeps none to approve' });
      const list = check(order({ layout: { type: 'list', id: 'l', columns: ['name'] } as Page['layout'] }));
      expect(list.ok ? [] : list.issues).toContainEqual({ path: 'approval', message: 'approvals are said on a record’s own page, not on a list of records' });
      const named = check(order({ approval: { open: ['notes', 'memo', 'notes'] } }));
      expect(named.ok ? [] : named.issues).toEqual([
        { path: 'approval.open[1]', message: 'no field "memo"' },
        { path: 'approval.open[2]', message: '"notes" is named twice' },
      ]);
      const unlocked = check(order({ approval: { lock: false, open: ['notes'] } }));
      expect(unlocked.ok ? [] : unlocked.issues).toEqual([{ path: 'approval.open', message: 'nothing is locked while it waits (lock is false): no field needs to stay open' }]);
    }
  });

  it('refuses a setting of another shape where pages are made', () => {
    const found = validatePage(order({ approval: { open: 'notes', lock: 'yes' } as never }));
    expect(found.ok).toBe(false);
  });
});

describe('a record’s approvals, as the form keeps them', () => {
  it('asks once a saved record is loaded, and keeps its levels, history, why and the levels this person may decide', async () => {
    const dataSource = source();
    const form = open(dataSource, 1);
    await form.settled();
    expect(calls(dataSource, 'approvals').map((call) => call.request)).toEqual([{ model: 'purchase.order', recordId: 1, user: { id: 21, name: 'Mona Adel' } }]);
    const approval = form.getState().approval;
    expect(approval).toMatchObject({ state: 'told', status: 'waiting', together: false, mine: ['finance'], why: 'Orders over EGP 50,000 go to Finance, then the CFO.' });
    expect(approval?.levels.map((level) => [level.id, level.state, level.needs])).toEqual([
      ['finance', 'waiting', 'any'],
      ['cfo', 'later', 'any'],
    ]);
    expect(approval?.history).toEqual([{ decision: 'requested', by: 'Omar Said', at: '2026-10-18T08:10:00.000Z' }]);
  });

  it('locks every field while it waits but those the page leaves open, its lock saying why', async () => {
    const form = open(source(), 1);
    await form.settled();
    expect(form.node('f-vendor').readonly).toBe(true);
    expect(form.node('f-amount').readonly).toBe(true);
    expect(form.node('f-notes').readonly).toBe(false);
    expect(form.fieldReadonly('vendor')).toBe(true);
    expect(form.fieldReadonly('notes')).toBe(false);
    expect(form.approvalLock('vendor')).toBe('Locked while it waits for approval');
    expect(form.approvalLock('notes')).toBeNull();
  });

  it('locks nothing where the page says lock: false, nor a record that does not wait', async () => {
    const unlocked = open(source(), 1, MONA, order({ approval: { lock: false } }));
    await unlocked.settled();
    expect(unlocked.getState().approval?.status).toBe('waiting');
    expect(unlocked.node('f-vendor').readonly).toBe(false);
    // Under the limit: no levels, nothing said, nothing locked.
    const small = open(source(), 2);
    await small.settled();
    expect(small.getState().approval).toMatchObject({ state: 'told', status: 'none', levels: [], mine: [] });
    expect(small.node('f-vendor').readonly).toBe(false);
    // Over it, still a draft: it needs approval, and nothing waits.
    const draft = open(source(), 3);
    await draft.settled();
    expect(draft.getState().approval?.status).toBe('needed');
    expect(draft.getState().approval?.levels.map((level) => level.state)).toEqual(['later', 'later', 'later']);
    expect(draft.node('f-vendor').readonly).toBe(false);
  });

  it('asks nothing where the source has no approvals, nor on a page without approval, nor for a new record', async () => {
    const dataSource = source();
    const { approvals: _, decide: __, ...without } = dataSource;
    const plain = open(without as DataSource, 1);
    await plain.settled();
    expect(plain.getState().approval ?? null).toBeNull();
    expect(plain.node('f-vendor').readonly).toBe(false);
    const noSetting = open(dataSource, 1, MONA, order({ approval: undefined }));
    await noSetting.settled();
    expect(noSetting.getState().approval ?? null).toBeNull();
    const fresh = open(dataSource, null);
    await fresh.settled();
    expect(fresh.getState().approval ?? null).toBeNull();
    expect(calls(dataSource, 'approvals')).toEqual([]);
  });

  it('offers no decisions where the source takes none: the levels are said, Approve and Reject hidden', async () => {
    const dataSource = source();
    const { decide: _, ...without } = dataSource;
    const form = open(without as DataSource, 1);
    await form.settled();
    expect(form.getState().approval).toMatchObject({ status: 'waiting', mine: [] });
    await expect(form.decide('finance', 'approved')).rejects.toThrow('The data source has no decide()');
  });

  it('says it could not read them where the source fails, and locks nothing by them', async () => {
    const dataSource = source();
    dataSource.approvals = () => Promise.reject(new Error('The approvals service is down'));
    const form = open(dataSource, 1);
    await form.settled();
    expect(form.getState().approval).toMatchObject({ state: 'failed', status: 'none', error: 'The approvals service is down' });
    expect(form.node('f-vendor').readonly).toBe(false);
  });

  it('asks again after a save, keeping what it told meanwhile: what waits stays locked while it asks', async () => {
    const dataSource = source();
    const form = open(dataSource, 1);
    await form.settled();
    let answer: (told: Approvals) => void = () => undefined;
    const real = dataSource.approvals.bind(dataSource);
    dataSource.approvals = (request) => new Promise((resolve) => (answer = resolve)).then(() => real(request));
    form.setValue('notes', 'Deliver to the 12th floor');
    await form.save();
    expect(form.getState().approval).toMatchObject({ state: 'asking', status: 'waiting' });
    expect(form.node('f-vendor').readonly).toBe(true);
    answer({ levels: [] });
    await form.settled();
    expect(form.getState().approval?.state).toBe('told');
  });

  it('lays an answer for a record no longer shown on none', async () => {
    const dataSource = source();
    const slow: ((value: void) => void)[] = [];
    const real = dataSource.approvals.bind(dataSource);
    dataSource.approvals = async (request) => {
      if (request.recordId === 1) await new Promise<void>((resolve) => slow.push(resolve));
      return real(request);
    };
    const form = open(dataSource, 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await form.openRecord(2);
    slow.forEach((resolve) => resolve());
    await form.settled();
    expect(form.getState().recordId).toBe(2);
    expect(form.getState().approval).toMatchObject({ status: 'none', levels: [] });
  });

  it('keeps only what it can say of a source’s answer: levels with an id and a state it knows, approvers with a name', () => {
    const kept = approvalOf(
      {
        levels: [
          { id: 'finance', name: '', approvers: [{ name: 'Mona Adel' }, { name: '' } as never], state: 'waiting' },
          { id: '', name: 'Nobody', approvers: [], state: 'waiting' },
          { id: 'legal', name: 'Legal', approvers: [], state: 'pending' as never },
        ],
        history: [{ decision: 'approved', level: 'finance', by: '', at: '2026-10-18T08:10:00Z' }, { decision: 'nodded' as never, by: 'X', at: 'Y' }],
        mine: ['finance', 'legal', 'finance'],
      },
      true
    );
    expect(kept.levels).toEqual([{ id: 'finance', name: 'finance', approvers: [{ name: 'Mona Adel' }], needs: 'any', state: 'waiting' }]);
    expect(kept.history).toEqual([]);
    expect(kept.mine).toEqual(['finance']);
    expect(approvalOf({ levels: [], mine: ['finance'] }, true).mine).toEqual([]);
  });

  it('works out where it stands as a whole: a rejection ends it, a level waiting is waited for, levels not needed left aside', () => {
    const level = (state: string) => ({ id: state, name: state, approvers: [], state }) as never;
    expect(approvalStatus([])).toBe('none');
    expect(approvalStatus([level('skipped')])).toBe('none');
    expect(approvalStatus([level('approved'), level('waiting'), level('rejected')])).toBe('rejected');
    expect(approvalStatus([level('approved'), level('waiting')])).toBe('waiting');
    expect(approvalStatus([level('approved'), level('skipped')])).toBe('approved');
    expect(approvalStatus([level('later'), level('later')])).toBe('needed');
  });

  it('writes a moment of its history as the page’s date boxes write a day, on its clock', () => {
    const page = order({ timeZone: 'UTC' });
    expect(approvalWhen('2026-10-18T08:10:00.000Z', MESSAGES.en, page)).toMatch(/^18 Oct 2026, 08:10( UTC)?$/);
    expect(approvalWhen('2026-10-18T08:10:00.000Z', MESSAGES.en, order({ timeZone: 'UTC', look: { dateOrder: 'mdy' } }))).toMatch(/^Oct 18, 2026, 08:10( UTC)?$/);
    expect(approvalWhen('soon', MESSAGES.en, page)).toBe('soon');
  });
});

describe('a decision, as the form takes it', () => {
  it('approves at a level this person may decide: the source told who, the record loaded again, the next level waiting', async () => {
    const dataSource = source();
    const form = open(dataSource, 1);
    await form.settled();
    const loads = calls(dataSource, 'load').length;
    await form.decide('finance', 'approved');
    await form.settled();
    expect(calls(dataSource, 'decide').map((call) => call.request)).toEqual([{ model: 'purchase.order', recordId: 1, level: 'finance', decision: 'approved', user: { id: 21, name: 'Mona Adel' } }]);
    expect(calls(dataSource, 'load').length).toBe(loads + 1);
    const approval = form.getState().approval;
    expect(approval?.levels.map((level) => [level.id, level.state])).toEqual([
      ['finance', 'approved'],
      ['cfo', 'waiting'],
    ]);
    expect(approval?.levels[0].approvers[0]).toMatchObject({ name: 'Mona Adel', decision: 'approved' });
    // The CFO's level is not hers: she sees it wait, and decides nothing there.
    expect(approval?.mine).toEqual([]);
    await expect(form.decide('cfo', 'approved')).rejects.toThrow('CFO is not yours to decide now');
  });

  it('moves the record on once its last level approved it: its state as the route says, nothing locked', async () => {
    const dataSource = source({ approvalHistory: { 'purchase.order:1': [{ decision: 'requested', by: 'Omar Said', at: '2026-10-18T08:10:00.000Z' }, { decision: 'approved', level: 'finance', by: 'Mona Adel', at: '2026-10-19T09:00:00.000Z' }] } });
    const form = open(dataSource, 1, SARA);
    await form.settled();
    expect(form.getState().approval?.mine).toEqual(['cfo']);
    await form.decide('cfo', 'approved');
    await form.settled();
    expect(form.getState().values['state']).toBe('purchase');
    expect(form.getState().approval?.status).toBe('approved');
    expect(form.node('f-vendor').readonly).toBe(false);
    expect(form.getState().approval?.history.map((entry) => [entry.decision, entry.level ?? null, entry.by])).toEqual([
      ['requested', null, 'Omar Said'],
      ['approved', 'finance', 'Mona Adel'],
      ['approved', 'cfo', 'Sara Nabil'],
    ]);
  });

  it('refuses a rejection that says no reason, in words, asking nothing of the source', async () => {
    const dataSource = source();
    const form = open(dataSource, 1);
    await form.settled();
    await expect(form.decide('finance', 'rejected')).rejects.toThrow('Say why you reject it');
    await expect(form.decide('finance', 'rejected', '   ')).rejects.toThrow('Say why you reject it');
    expect(calls(dataSource, 'decide')).toEqual([]);
  });

  it('rejects with why: the round ends, the record moves on, the reason kept in its history', async () => {
    const dataSource = source();
    const form = open(dataSource, 1);
    await form.settled();
    await form.decide('finance', 'rejected', '  Over the quarter’s budget  ');
    await form.settled();
    expect(calls(dataSource, 'decide')[0].request).toMatchObject({ decision: 'rejected', reason: 'Over the quarter’s budget' });
    expect(form.getState().values['state']).toBe('rejected');
    const approval = form.getState().approval;
    expect(approval?.status).toBe('rejected');
    expect(approval?.levels.map((level) => level.state)).toEqual(['rejected', 'later']);
    expect(approval?.history.at(-1)).toMatchObject({ decision: 'rejected', level: 'finance', by: 'Mona Adel', reason: 'Over the quarter’s budget' });
    // Rejected, it is open again to be put right.
    expect(form.node('f-vendor').readonly).toBe(false);
  });

  it('decides on the record as saved: what was typed in a field left open is saved first', async () => {
    const dataSource = source();
    const form = open(dataSource, 1);
    await form.settled();
    form.setValue('notes', 'Split the delivery in two');
    await form.decide('finance', 'approved');
    await form.settled();
    const order = dataSource.calls.map((call) => call.method).filter((method) => method === 'save' || method === 'decide');
    expect(order).toEqual(['save', 'decide']);
    expect(dataSource.records['purchase.order'][1]['notes']).toBe('Split the delivery in two');
  });

  it('takes a second press while the save before it goes as the same press: one save, one decision', async () => {
    const dataSource = source();
    const form = open(dataSource, 1);
    await form.settled();
    form.setValue('notes', 'Split the delivery in two');
    const first = form.decide('finance', 'approved');
    const second = form.decide('finance', 'approved');
    await Promise.all([first, second]);
    await form.settled();
    expect(dataSource.calls.map((call) => call.method).filter((method) => method === 'save' || method === 'decide')).toEqual(['save', 'decide']);
  });

  it('says the source’s refusal in its words, and nothing is decided', async () => {
    const dataSource = source();
    dataSource.decide = () => Promise.reject(saveRefused({ kind: 'rule', message: 'Finance closes its books today: decide tomorrow' }));
    const form = open(dataSource, 1);
    await form.settled();
    await expect(form.decide('finance', 'approved')).rejects.toThrow('Finance closes its books today: decide tomorrow');
    expect(form.getState().approval).toMatchObject({ status: 'waiting', deciding: null, mine: ['finance'] });
  });

  it('marks a decision on its way, one at a time', async () => {
    const dataSource = source();
    let answer: () => void = () => undefined;
    const real = dataSource.decide.bind(dataSource);
    dataSource.decide = (request) => new Promise<void>((resolve) => (answer = resolve)).then(() => real(request));
    const form = open(dataSource, 1);
    await form.settled();
    const first = form.decide('finance', 'approved');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(form.getState().approval?.deciding).toEqual({ level: 'finance', decision: 'approved' });
    await form.decide('finance', 'approved');
    answer();
    await first;
    await form.settled();
    // The second press decided nothing more: one decision reached the source.
    expect(calls(dataSource, 'decide').length).toBe(1);
    expect(form.getState().approval?.levels[0].state).toBe('approved');
  });
});

describe('the memory source’s approvals', () => {
  const ask = (dataSource: ReturnType<typeof source>, recordId: number, user: { id: number; name: string } = MONA) => dataSource.approvals({ model: 'purchase.order', recordId, user });

  it('asks its levels in turn: the next waits once the one before approved', async () => {
    const dataSource = source();
    expect((await ask(dataSource, 1)).levels.map((level) => level.state)).toEqual(['waiting', 'later']);
    await dataSource.decide({ model: 'purchase.order', recordId: 1, level: 'finance', decision: 'approved', user: MONA });
    expect((await ask(dataSource, 1, SARA)).levels.map((level) => level.state)).toEqual(['approved', 'waiting']);
    expect((await ask(dataSource, 1, SARA)).mine).toEqual(['cfo']);
  });

  it('asks them together where the route says so, and a level of all its approvers waits for every one', async () => {
    const together = (values: Record<string, unknown>) => ({ ...(route(values) as MemoryApprovalRoute), together: true });
    const dataSource = source({ approvals: { 'purchase.order': together } });
    dataSource.records['purchase.order'][3]['state'] = 'to_approve';
    const told = await ask(dataSource, 3, KARIM);
    expect(told.together).toBe(true);
    expect(told.levels.map((level) => [level.id, level.state])).toEqual([
      ['finance', 'waiting'],
      ['cfo', 'waiting'],
      ['board', 'waiting'],
    ]);
    expect(told.mine).toEqual(['board']);
    await dataSource.decide({ model: 'purchase.order', recordId: 3, level: 'board', decision: 'approved', user: KARIM });
    const after = await ask(dataSource, 3, OMAR);
    expect(after.levels[2]).toMatchObject({ state: 'waiting', needs: 'all' });
    expect(after.levels[2].approvers).toEqual([{ ...KARIM, decision: 'approved', at: expect.any(String) }, OMAR]);
    expect(after.mine).toEqual(['board']);
    expect((await ask(dataSource, 3, KARIM)).mine).toEqual([]);
    await dataSource.decide({ model: 'purchase.order', recordId: 3, level: 'board', decision: 'approved', user: OMAR });
    expect((await ask(dataSource, 3)).levels[2].state).toBe('approved');
  });

  it('finds the person by id, else by name', async () => {
    const dataSource = source();
    expect((await dataSource.approvals({ model: 'purchase.order', recordId: 1, user: { id: 21 } as never })).mine).toEqual(['finance']);
    expect((await dataSource.approvals({ model: 'purchase.order', recordId: 1, user: { id: null, name: 'Mona Adel' } })).mine).toEqual(['finance']);
    expect((await dataSource.approvals({ model: 'purchase.order', recordId: 1 })).mine).toEqual([]);
  });

  it('refuses a decision at a level not waiting, by someone not its approver, twice, or a rejection with no reason', async () => {
    const dataSource = source();
    const decide = (more: Partial<Parameters<typeof dataSource.decide>[0]>) => dataSource.decide({ model: 'purchase.order', recordId: 1, level: 'finance', decision: 'approved', user: MONA, ...more });
    await expect(decide({ level: 'cfo', user: SARA })).rejects.toThrow('CFO is not waiting for a decision');
    await expect(decide({ user: OMAR })).rejects.toThrow('Omar Said may not decide for Finance now');
    await expect(decide({ decision: 'rejected' })).rejects.toThrow('A rejection says why');
    await decide({});
    await expect(decide({})).rejects.toThrow('Finance is not waiting for a decision');
  });

  it('never lets the person who sent a record for approval decide a level of that round: they are none of its approvers', async () => {
    // The owner's walk of 0.29: a manager sent his employee's rejected claim again, and approved it himself.
    const dataSource = source();
    const HANY = { id: 28, name: 'Hany Lotfy' };
    await dataSource.decide({ model: 'purchase.order', recordId: 1, level: 'finance', decision: 'rejected', reason: 'Quote is out of date', user: MONA });
    dataSource.records['purchase.order'][1]['state'] = 'draft';
    await ask(dataSource, 1);
    // Mona, one of Finance's approvers, sends it again herself.
    dataSource.records['purchase.order'][1]['state'] = 'to_approve';
    const sent = await ask(dataSource, 1, MONA);
    expect(sent.history?.at(-1)).toMatchObject({ decision: 'requested', by: 'Mona Adel' });
    expect(sent.levels[0]).toMatchObject({ id: 'finance', state: 'waiting', approvers: [HANY] });
    expect(sent.mine).toEqual([]);
    await expect(dataSource.decide({ model: 'purchase.order', recordId: 1, level: 'finance', decision: 'approved', user: MONA })).rejects.toThrow('Mona Adel asked for this approval, so may not decide it');
    // By name alone, the same.
    expect((await dataSource.approvals({ model: 'purchase.order', recordId: 1, user: { id: null, name: 'Mona Adel' } })).mine).toEqual([]);
    expect((await ask(dataSource, 1, HANY)).mine).toEqual(['finance']);
    await dataSource.decide({ model: 'purchase.order', recordId: 1, level: 'finance', decision: 'approved', user: HANY });
    expect((await ask(dataSource, 1, SARA)).levels.map((level) => level.state)).toEqual(['approved', 'waiting']);
  });

  it('moves a record its rules ask no level of on at once as it is sent: its approved values, and “no approval needed” told', async () => {
    // The owner's walk of 0.29: an order under its limit, asked for approval, stood at "To approve" with no one asked.
    const none = (values: Record<string, unknown>): MemoryApprovalRoute => route(values) ?? { levels: [], asked: values['state'] === 'to_approve' || values['state'] === 'purchase', approved: { state: 'purchase' } };
    const dataSource = source({ approvals: { 'purchase.order': none } });
    const form = open(dataSource, 2, OMAR);
    await form.settled();
    expect(form.getState().approval?.status).toBe('none');
    form.setValue('state', 'to_approve');
    expect(await form.save()).toBe(true);
    await form.settled();
    expect(form.getState().values['state']).toBe('purchase');
    expect(dataSource.records['purchase.order'][2]['state']).toBe('purchase');
    expect(form.getState().approval).toMatchObject({ status: 'none', levels: [] });
    expect(form.getState().approval?.history.map((entry) => [entry.decision, entry.by])).toEqual([
      ['requested', 'Omar Said'],
      ['notNeeded', 'Omar Said'],
    ]);
    // Saved again, as it is: nothing more happens.
    form.setValue('notes', 'Two lamps for the front desk');
    await form.save();
    await form.settled();
    expect(form.getState().approval?.history).toHaveLength(2);
    expect(approvalOf({ levels: [], history: [{ decision: 'notNeeded', by: 'Omar Said', at: '2026-10-22T09:00:00.000Z' }] }, true).history).toHaveLength(1);
  });

  it('starts a round each time the record is sent again: a rejection put right, then asked anew', async () => {
    const dataSource = source();
    await dataSource.decide({ model: 'purchase.order', recordId: 1, level: 'finance', decision: 'rejected', reason: 'Quote is out of date', user: MONA });
    const rejected = await ask(dataSource, 1);
    expect(rejected.levels.map((level) => level.state)).toEqual(['rejected', 'later']);
    expect(dataSource.records['purchase.order'][1]['state']).toBe('rejected');
    // Put right as a draft, then sent again.
    dataSource.records['purchase.order'][1]['state'] = 'draft';
    expect((await ask(dataSource, 1)).levels.map((level) => level.state)).toEqual(['rejected', 'later']);
    dataSource.records['purchase.order'][1]['state'] = 'to_approve';
    const again = await ask(dataSource, 1, OMAR);
    expect(again.levels.map((level) => level.state)).toEqual(['waiting', 'later']);
    expect(again.history?.map((entry) => entry.decision)).toEqual(['requested', 'rejected', 'requested']);
    expect(again.history?.at(-1)).toMatchObject({ by: 'Omar Said' });
  });
});
