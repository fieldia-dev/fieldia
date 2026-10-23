import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { createMemoryChatter } from './memory';
import { CHATTER_LABELS } from './labels';
import { approvalEntries, chatterSlot } from './slot';

/**
 * A record's approval history in its conversation (a page with `approval`): who sent it for approval and who decided
 * at which level, and why, told among its messages by when each happened, newest first — as events, never posted to the
 * chatter's source — and kept up as a decision is taken. An app whose server posts each decision itself says
 * `approvals: false`.
 */

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const page = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));
const MONA = { id: 21, name: 'Mona Adel' };
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(check()).toBeTruthy();
}

let viewer: ViewerHandle | null = null;
afterEach(() => {
  viewer?.destroy();
  viewer = null;
  document.body.replaceChildren();
});

const dataSource = () =>
  createMemoryDataSource({
    records: { 'purchase.order': { 1: { name: 'PO-2026-0042', requested_by: 'Omar Said', state: 'to_approve', line_ids: [], notes: '' } } },
    approvals: {
      'purchase.order': (values) => ({
        levels: [
          { id: 'finance', name: 'Finance', approvers: [MONA] },
          { id: 'cfo', name: 'CFO', approvers: [{ id: 26, name: 'Sara Nabil' }] },
        ],
        asked: values['state'] !== 'draft',
      }),
    },
    approvalHistory: { 'purchase.order:1': [{ decision: 'requested', by: 'Omar Said', at: '2026-10-18T08:10:00.000Z' }] },
  });
const chatter = () =>
  createMemoryChatter({
    me: MONA,
    records: {
      'purchase.order:1': {
        messages: [
          { id: 2, kind: 'message', author: { id: 27, name: 'Omar Said' }, date: '2026-10-18T09:00:00Z', body: '<p>The vendor can deliver in three weeks.</p>' },
          { id: 1, kind: 'note', author: { id: 27, name: 'Omar Said' }, date: '2026-10-17T15:00:00Z', body: '<p>Quote attached.</p>' },
        ],
      },
    },
  });

function mount(more: Parameters<typeof chatterSlot>[0] extends infer O ? Partial<O> : never = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const source = chatter();
  viewer = mountViewer(host, { page: page('purchase-approval'), dataSource: dataSource(), recordId: 1, user: MONA, slots: { chatter: chatterSlot({ source, ...more }) } });
  const items = () => [...host.querySelectorAll('.fd-slot[data-slot="chatter"] .fd-message')].map((item) => `${item.querySelector('.fd-message-author')?.textContent}: ${item.querySelector('.fd-message-body')?.textContent}`);
  return { host, source, items };
}

describe('a record’s approval history in its conversation', () => {
  it('is told among its messages by when each happened, newest first, as events', async () => {
    const { items, host } = mount();
    await until(() => items().length === 3);
    expect(items()).toEqual(['Omar Said: The vendor can deliver in three weeks.', 'Omar Said: Asked for approval', 'Omar Said: Quote attached.']);
    // An event: nothing to answer or react to.
    const event = host.querySelectorAll('.fd-slot[data-slot="chatter"] .fd-message')[1];
    expect(event.classList.contains('fd-message-event')).toBe(true);
    expect(event.querySelector('.fd-message-reply')).toBeNull();
  });

  it('writes an entry’s time as the messages’ are — the page’s date boxes, on its clock: one way in the conversation', async () => {
    const { host, items } = mount();
    await until(() => items().length === 3);
    const times = [...host.querySelectorAll('.fd-slot[data-slot="chatter"] .fd-message')].map((item) => `${item.classList.contains('fd-message-event') ? 'entry' : 'message'} ${item.querySelector('time')?.textContent}`);
    // The purchase order's page is on Cairo's clock (+3 in October), its days written day first.
    expect(times).toEqual(['message 18 Oct 2026, 12:00', 'entry 18 Oct 2026, 11:10', 'message 17 Oct 2026, 18:00']);
  });

  it('is kept up as a decision is taken, its reason quoted, and never posted to the chatter’s source', async () => {
    const { items, source } = mount();
    await until(() => items().length === 3);
    await viewer?.form.decide('finance', 'rejected', 'Over the quarter’s budget');
    await until(() => items().length === 4);
    expect(items()[0]).toBe('Mona Adel: Rejected (Finance)Over the quarter’s budget');
    expect(source.posted).toEqual([]);
  });

  it('is not told where the app says its server posts the decisions itself', async () => {
    const { items } = mount({ approvals: false });
    await until(() => items().length === 2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(items()).toEqual(['Omar Said: The vendor can deliver in three weeks.', 'Omar Said: Quote attached.']);
  });

  it('is said in the chatter’s language, each level by its name', () => {
    const entries = approvalEntries(
      {
        state: 'told',
        status: 'rejected',
        levels: [{ id: 'finance', name: 'Finanzen', approvers: [], needs: 'any', state: 'rejected' }],
        together: false,
        history: [
          { decision: 'requested', by: 'Omar Said', at: '2026-10-18T08:10:00Z' },
          { decision: 'rejected', level: 'finance', by: 'Mona Adel', at: '2026-10-19T08:10:00Z', reason: 'Zu teuer' },
          { decision: 'approved', level: 'board', levelName: 'Vorstand', by: 'Karim Fathy', at: '2026-10-20T08:10:00Z' },
          { decision: 'notNeeded', by: 'Karim Fathy', at: '2026-10-21T08:10:00Z' },
        ],
        mine: [],
      },
      CHATTER_LABELS.de
    );
    expect(entries.map((entry) => entry.body)).toEqual(['<p>Hat um Genehmigung gebeten</p>', '<p>Abgelehnt (Finanzen)</p><blockquote><p>Zu teuer</p></blockquote>', '<p>Genehmigt (Vorstand)</p>', '<p>Keine Genehmigung nötig</p>']);
    expect(entries.every((entry) => entry.kind === 'event')).toBe(true);
  });

  it('tells a change made while it waited, or after a rejection, as a tracked change by who made it (the owner’s walk of 0.31)', () => {
    const [entry] = approvalEntries(
      {
        state: 'told',
        status: 'rejected',
        levels: [{ id: 'manager', name: 'Manager', approvers: [], needs: 'any', state: 'rejected' }],
        together: false,
        history: [{ decision: 'changed', by: 'Karim Fathy', at: '2026-10-21T08:10:00Z', changes: [{ field: 'amount', label: 'Amount', from: 1450, to: 9999 }, { field: 'notes', from: '', to: 'Fixed' }] }],
        mine: [],
      },
      CHATTER_LABELS.en,
      (_field, value) => (typeof value === 'number' ? `E£ ${value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : String(value))
    );
    expect(entry).toMatchObject({ kind: 'event', author: { name: 'Karim Fathy' }, tracking: [{ field: 'amount', label: 'Amount', from: 'E£ 1,450.00', to: 'E£ 9,999.00' }, { field: 'notes', label: 'notes', from: null, to: 'Fixed' }] });
  });
});
