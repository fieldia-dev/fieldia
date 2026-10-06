import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm, type FormUser } from './form';
import { createMemoryDataSource } from './memory-data-source';

/** An order whose parts are shown by the record's id, by the person, and by their roles. */
const order: Page = {
  fieldia: '0.1',
  id: 'order',
  title: 'Order',
  data: { kind: 'record', model: 'sale.order' },
  fields: {
    name: { type: 'char', label: 'Number' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'sale', label: 'Order' }] },
    user_id: { type: 'many2one', label: 'Salesperson', relation: 'res.users' },
    margin: { type: 'float', label: 'Margin', required: true },
    note: { type: 'text', label: 'Note' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    buttons: [
      // Flectra's `invisible="not id"`: nothing to cancel before the order is saved.
      { type: 'button', id: 'cancel', label: 'Cancel', action: 'cancel', invisible: 'not id' },
      { type: 'button', id: 'lock', label: 'Lock', action: 'lock', roles: ['sales.manager'] },
      { type: 'button', id: 'proforma', label: 'Pro-forma', action: 'proforma', roles: ['sales.proforma', '!portal'] },
      { type: 'button', id: 'help', label: 'Help', action: 'help', roles: ['!portal'] },
    ],
    statButtons: [{ id: 'invoices', label: 'Invoices', action: 'invoices', roles: ['account.invoice'] }],
    children: [
      {
        type: 'section',
        id: 'main',
        children: [
          { type: 'field', id: 'f-name', field: 'name' },
          { type: 'field', id: 'f-user', field: 'user_id' },
          // Only the salesperson's own order shows the note.
          { type: 'field', id: 'f-note', field: 'note', invisible: 'user_id != user.id' },
        ],
      },
      {
        type: 'tabs',
        id: 'tabs',
        children: [
          { type: 'tab', id: 'tab-lines', label: 'Lines', children: [] },
          { type: 'tab', id: 'tab-margin', label: 'Margin', roles: ['sales.manager'], children: [{ type: 'field', id: 'f-margin', field: 'margin' }] },
          { type: 'tab', id: 'tab-mine', label: 'Mine', invisible: "not ('sales.manager' in user.roles)", children: [] },
        ],
      },
    ],
  },
};

const source = () =>
  createMemoryDataSource({
    records: {
      'sale.order': { 7: { name: 'S00007', state: 'draft', user_id: { id: 4, label: 'Nour' }, margin: null, note: 'Call first' } },
      'res.users': { 4: { name: 'Nour' }, 5: { name: 'Hany' } },
    },
  });

const nour: FormUser = { id: 4, name: 'Nour', roles: ['sales.user'] };
const manager: FormUser = { id: 5, name: 'Hany', roles: ['sales.user', 'sales.manager', 'account.invoice'] };

describe('conditions read the record’s id and the person', () => {
  it('reads `id` as the record’s id, empty while it is new', async () => {
    expect(validatePage(order).ok).toBe(true);
    const fresh = createForm({ page: order, dataSource: source() });
    expect(fresh.node('cancel').invisible).toBe(true);
    const saved = createForm({ page: order, dataSource: source(), recordId: 7 });
    await saved.load();
    expect(saved.node('cancel').invisible).toBe(false);
  });

  it('shows `not id` parts once a new record is saved', async () => {
    const form = createForm({ page: order, dataSource: source(), values: { margin: 12 } });
    expect(form.node('cancel').invisible).toBe(true);
    await form.save();
    expect(form.getState().recordId).not.toBeNull();
    expect(form.node('cancel').invisible).toBe(false);
  });

  it('reads `user` as the person the app says is using the form', async () => {
    const mine = createForm({ page: order, dataSource: source(), recordId: 7, user: nour });
    await mine.load();
    expect(mine.node('f-note').invisible).toBe(false);
    const theirs = createForm({ page: order, dataSource: source(), recordId: 7, user: manager });
    await theirs.load();
    expect(theirs.node('f-note').invisible).toBe(true);
    expect(theirs.node('tab-mine').invisible).toBe(false);
    expect(mine.node('tab-mine').invisible).toBe(true);
  });

  it('gives a page’s own field of that name before the built-in one', () => {
    const own: Page = { ...order, fields: { ...order.fields, id: { type: 'integer', label: 'ID' } } };
    const form = createForm({ page: own, values: { id: 99 } });
    expect(form.node('cancel').invisible).toBe(false);
  });
});

describe('roles: a part shown only to people in them', () => {
  it('shows a part to people holding any of its roles, as Flectra’s groups=', async () => {
    const form = createForm({ page: order, dataSource: source(), recordId: 7, user: manager });
    await form.load();
    expect(form.node('lock').invisible).toBe(false);
    expect(form.node('invoices').invisible).toBe(false);
    expect(form.node('tab-margin').invisible).toBe(false);
    const salesperson = createForm({ page: order, dataSource: source(), recordId: 7, user: nour });
    await salesperson.load();
    expect(salesperson.node('lock').invisible).toBe(true);
    expect(salesperson.node('invoices').invisible).toBe(true);
    // A tab hidden by its roles hides what is in it.
    expect(salesperson.node('tab-margin').invisible).toBe(true);
    expect(salesperson.node('f-margin').invisible).toBe(true);
  });

  it('hides a part from people holding a `!` role, whatever else they hold', () => {
    const portal = createForm({ page: order, user: { id: 9, roles: ['portal', 'sales.proforma'] } });
    expect(portal.node('help').invisible).toBe(true);
    expect(portal.node('proforma').invisible).toBe(true);
    const proforma = createForm({ page: order, user: { id: 4, roles: ['sales.proforma'] } });
    expect(proforma.node('proforma').invisible).toBe(false);
    // Only `!` roles: everyone else sees it.
    expect(proforma.node('help').invisible).toBe(false);
  });

  it('grants no role when the app names no person', () => {
    const form = createForm({ page: order });
    expect(form.node('lock').invisible).toBe(true);
    expect(form.node('help').invisible).toBe(false);
    expect(form.node('f-note').invisible).toBe(false);
  });

  it('asks nothing of a field its roles hide: required, it does not stop a save', async () => {
    const form = createForm({ page: order, dataSource: source(), recordId: 7, user: nour });
    await form.load();
    expect(form.validate()).toBe(true);
    const manages = createForm({ page: order, dataSource: source(), recordId: 7, user: manager });
    await manages.load();
    expect(manages.validate()).toBe(false);
    expect(manages.problem('margin')).not.toBeNull();
  });
});

describe('the page check knows the person and roles', () => {
  it('lets a condition read `id`, `user.id`, `user.name` and `user.roles`', () => {
    expect(validatePage(order).ok).toBe(true);
  });

  it('refuses what the person does not have, and roles that are not names', () => {
    const typo: Page = { ...order, layout: { ...(order.layout as object), buttons: [{ type: 'button', id: 'b', label: 'B', action: 'b', invisible: "'x' in user.role" }] } as Page['layout'] };
    const issues = validatePage(typo);
    expect(issues.ok).toBe(false);
    expect(JSON.stringify(issues)).toMatch(/user\.role.*id, name or roles/);
    for (const roles of [[], [''], ['two words'], ['!!x'], ['a,b']]) {
      const bad: Page = { ...order, layout: { ...(order.layout as object), buttons: [{ type: 'button', id: 'b', label: 'B', action: 'b', roles }] } as Page['layout'] };
      expect(validatePage(bad).ok).toBe(false);
    }
  });
});
