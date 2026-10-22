import type { ApprovalEntry, FormUser, MemoryApprovalRoute, Values } from '@fieldia/core';

/**
 * Approvals on a record, as an app's approval engine answers them through the data source's `approvals` and `decide` —
 * here the demos' memory source, routing each record as the routes below say: a purchase order over EGP 50,000 to
 * Finance, and one over EGP 150,000 then to the CFO (examples/pages/purchase-approval.page.json); an expense to the
 * employee's manager, then Finance (examples/pages/expense-approval.page.json). Who uses the demo is chosen over the
 * page (`?as=`): Finance's Mona Adel decides, the CFO decides after her, the buyer and the employee see where it stands.
 */

const MONA = { id: 21, name: 'Mona Adel' };
const KARIM = { id: 22, name: 'Karim Fathy' };
const SARA = { id: 26, name: 'Sara Nabil' };
const OMAR = { id: 27, name: 'Omar Said' };
const HANY = { id: 28, name: 'Hany Lotfy' };

const HOUR = 3600000;
const DAY = 24 * HOUR;
/** A moment so long before now, to the minute: the demo's history happened this week, whenever it is opened. */
const before = (ms: number) => new Date(Math.floor((Date.now() - ms) / 60000) * 60000).toISOString();
/** A day from today, as 2026-10-20. */
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

/** Who may use each demo, by the `as=` the address names: the first is who opens it. */
const PEOPLE: Record<string, { key: string; user: FormUser; role: string }[]> = {
  'purchase-approval': [
    { key: 'mona', user: MONA, role: 'Finance' },
    { key: 'sara', user: SARA, role: 'CFO' },
    { key: 'omar', user: OMAR, role: 'Buyer' },
  ],
  'expense-approval': [
    { key: 'omar', user: OMAR, role: 'Employee' },
    { key: 'karim', user: KARIM, role: 'Manager' },
    { key: 'mona', user: MONA, role: 'Finance' },
  ],
};

const person = (params: URLSearchParams) => {
  const people = PEOPLE[params.get('page') ?? ''];
  return people ? (people.find((one) => one.key === params.get('as')) ?? people[0]) : null;
};

/** The person using an approvals demo, as the app signs them in: the one `as=` names, else its first. */
export function approvalUser(params: URLSearchParams): { user?: FormUser } {
  const found = person(params);
  return found ? { user: found.user } : {};
}

/** A purchase order's total: its lines' quantities by their prices. */
const totalOf = (values: Values) => ((values['line_ids'] as { values: Values }[] | null) ?? []).reduce((sum, line) => sum + Number(line.values['qty'] ?? 0) * Number(line.values['price'] ?? 0), 0);

/** How each model's records are approved, as the app's engine routes them. */
export const APPROVAL_ROUTES: Record<string, (values: Values) => MemoryApprovalRoute | null> = {
  'purchase.order': (values) => {
    const total = totalOf(values);
    const asked = values['state'] === 'to_approve' || values['state'] === 'purchase';
    // Under its limit no level is asked: sent, it is a purchase order at once — "No approval needed".
    if (total <= 50000) return { levels: [], asked, approved: { state: 'purchase' } };
    const cfo = total > 150000;
    return {
      levels: [{ id: 'finance', name: 'Finance', approvers: [MONA, HANY] }, ...(cfo ? [{ id: 'cfo', name: 'CFO', approvers: [SARA] }] : [])],
      asked,
      why: cfo ? 'Orders over EGP 150,000 go to Finance, then the CFO.' : 'Orders over EGP 50,000 go to Finance.',
      approved: { state: 'purchase' },
      rejected: { state: 'rejected' },
    };
  },
  'hr.expense': (values) => ({
    levels: [
      { id: 'manager', name: 'Manager', approvers: [KARIM] },
      { id: 'finance', name: 'Finance', approvers: [MONA, HANY] },
    ],
    asked: values['state'] === 'submitted' || values['state'] === 'approved',
    why: 'An expense goes to your manager, then Finance.',
    approved: { state: 'approved' },
    rejected: { state: 'rejected' },
  }),
};

/** The records the demos open: a purchase order over its limit waiting for Finance, one under it, and an expense rejected. */
export function approvalRecords(): Record<string, Record<string, Values>> {
  return {
    'purchase.order': {
      1: {
        name: 'PO-2026-0042',
        partner_id: { id: 1, label: 'Nile Traders' },
        date_order: day(-2),
        date_planned: day(19),
        requested_by: 'Omar Said',
        line_ids: [
          { key: 'p1', id: 7101, values: { product: 'Office chair, ergonomic', qty: 40, price: 3200, subtotal: 128000 } },
          { key: 'p2', id: 7102, values: { product: 'Standing desk 160 × 80', qty: 8, price: 7000, subtotal: 56000 } },
        ],
        amount_total: 184000,
        state: 'to_approve',
        notes: 'Deliver to Nile Towers, 12th floor, by the freight lift, 08:00 to 10:00.',
      },
      2: {
        name: 'PO-2026-0043',
        partner_id: { id: 21, label: 'Bayt Interiors' },
        date_order: day(-1),
        date_planned: day(10),
        requested_by: 'Omar Said',
        line_ids: [{ key: 'p1', id: 7103, values: { product: 'Desk lamp, LED', qty: 6, price: 380, subtotal: 2280 } }],
        amount_total: 2280,
        state: 'draft',
        notes: '',
      },
    },
    'hr.expense': {
      1: {
        name: 'Client dinner, Zamalek',
        employee: 'Omar Said',
        // Whose claim it is, as the app signs them in: only they submit it (the page's rule for its button).
        employee_user_id: { id: OMAR.id, label: OMAR.name },
        date: day(-6),
        category: 'meals',
        total_amount: 4850,
        guests: 'Four of us, two from Nile Traders',
        state: 'rejected',
        notes: '',
      },
    },
  };
}

/** What happened to them so far, oldest first. */
export function approvalHistory(): Record<string, ApprovalEntry[]> {
  return {
    'purchase.order:1': [{ decision: 'requested', by: 'Omar Said', at: before(2 * DAY + 3 * HOUR) }],
    'hr.expense:1': [
      { decision: 'requested', by: 'Omar Said', at: before(5 * DAY + 2 * HOUR) },
      { decision: 'approved', level: 'manager', by: 'Karim Fathy', at: before(4 * DAY + 6 * HOUR) },
      {
        decision: 'rejected',
        level: 'finance',
        by: 'Mona Adel',
        at: before(3 * DAY + 1 * HOUR),
        reason: 'Four of us for two guests is over the meals policy: claim the dinner for you and the two from Nile Traders, and name them.',
      },
    ],
  };
}

/**
 * A bar over an approvals demo saying who uses it, with the others to sign in as — the address's `as=`, so a decision
 * taken as one is seen as the next: what was decided is kept in the tab (shared/kept.ts).
 */
export function signedInBar(params: URLSearchParams): HTMLElement | null {
  const people = PEOPLE[params.get('page') ?? ''];
  const now = person(params);
  if (!people || !now) return null;
  const bar = document.createElement('div');
  bar.className = 'demo-bar demo-panel-bar demo-signed-in fd-theme';
  const said = document.createElement('span');
  said.className = 'demo-signed-in-said';
  said.textContent = `Signed in as ${now.user.name}, ${now.role}.`;
  const others = document.createElement('nav');
  others.className = 'demo-links';
  others.setAttribute('aria-label', 'Sign in as');
  for (const one of people) {
    const link = document.createElement('a');
    const next = new URLSearchParams(params);
    next.set('as', one.key);
    link.href = `?${next}`;
    link.textContent = `${one.user.name} (${one.role})`;
    if (one === now) link.setAttribute('aria-current', 'page');
    others.append(link);
  }
  bar.append(said, others);
  return bar;
}
