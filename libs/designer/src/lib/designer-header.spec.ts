import { validatePage, type Field, type SheetNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Name' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }] },
  invoice_count: { type: 'integer', label: 'Invoices' },
  email: { type: 'char', label: 'Email' },
};
const sheet = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as SheetNode;
const customer = () => createDesigner({ page: blankPage('sheet', 'Customer'), model });

describe('a record’s header', () => {
  it('shows status steps from a field that holds one of a list, the model’s own taken as it is', () => {
    const designer = customer();
    expect(designer.setStatusbar('state')).toBe(true);
    expect(sheet(designer).statusbar).toEqual({ field: 'state' });
    expect(designer.getPage().fields['state']).toEqual(model['state']);
    // On the page now, so the toolbox no longer offers it.
    expect(designer.modelFields().map((f) => f.name)).not.toContain('state');
    expect(designer.setStatusbar('state', { clickable: true })).toBe(true);
    expect(sheet(designer).statusbar).toEqual({ field: 'state', clickable: true });
    // Not clickable is how steps are anyway: the page leaves it unsaid.
    designer.setStatusbar('state', { clickable: false });
    expect(sheet(designer).statusbar).toEqual({ field: 'state' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setStatusbar(null)).toBe(true);
    expect(sheet(designer).statusbar).toBeUndefined();
    expect(designer.getPage().fields['state']).toBeUndefined();
  });

  it('refuses status steps from a field that is not one of a list, and on a page that is not a sheet', () => {
    const designer = customer();
    expect(designer.setStatusbar('email')).toBe(false);
    expect(designer.getState().issues).toEqual(['Status steps show a field that holds one of a list; Email holds text']);
    expect(designer.setStatusbar('nothing')).toBe(false);
    expect(designer.getState().issues).toEqual(['There is no field "nothing"']);
    const screen = createDesigner({ page: blankPage('screen', 'Visit'), model });
    expect(screen.setStatusbar('state')).toBe(false);
    expect(screen.getState().issues).toEqual(['Only a record sheet has a header']);
  });

  it('adds buttons, counters and badges, each picked as it comes, with names the page does not use yet', () => {
    const designer = customer();
    const confirm = designer.addHeaderPart('button', 'Confirm') as string;
    const second = designer.addHeaderPart('button', 'Send by email') as string;
    const invoices = designer.addHeaderPart('stat', 'Invoices') as string;
    const vip = designer.addHeaderPart('badge', 'VIP') as string;
    expect(new Set([confirm, second, invoices, vip]).size).toBe(4);
    expect(designer.getState().selected).toBe(vip);
    const root = sheet(designer);
    expect(root.buttons).toEqual([
      { type: 'button', id: confirm, label: 'Confirm', action: 'confirm' },
      { type: 'button', id: second, label: 'Send by email', action: 'send_by_email' },
    ]);
    expect(root.statButtons).toEqual([{ id: invoices, label: 'Invoices', action: 'invoices' }]);
    expect(root.badges).toEqual([{ id: vip, label: 'VIP', tone: 'muted' }]);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // A section added later does not take a header part's id.
    const section = designer.addContainer('More') as string;
    expect([confirm, second, invoices, vip]).not.toContain(section);
  });

  it('changes a part: its words in one step of typing, its action, a button’s style, a badge’s tone, a counter’s number', () => {
    const designer = customer();
    const confirm = designer.addHeaderPart('button', 'Confirm') as string;
    designer.updateHeaderPart(confirm, { label: 'C' });
    designer.updateHeaderPart(confirm, { label: 'Confirm order' });
    expect(designer.updateHeaderPart(confirm, { style: 'primary', action: 'confirm_order', confirm: 'Confirm this order?' })).toBe(true);
    expect(sheet(designer).buttons?.[0]).toMatchObject({ label: 'Confirm order', style: 'primary', action: 'confirm_order', confirm: 'Confirm this order?' });
    // Nothing to ask: it acts at once, and the page says nothing about asking.
    designer.updateHeaderPart(confirm, { confirm: '' });
    expect(sheet(designer).buttons?.[0]).not.toHaveProperty('confirm');
    designer.undo();
    designer.undo();
    designer.undo();
    expect(sheet(designer).buttons?.[0].label).toBe('Confirm');
    const vip = designer.addHeaderPart('badge', 'VIP') as string;
    expect(designer.updateHeaderPart(vip, { tone: 'success' })).toBe(true);
    expect(sheet(designer).badges?.[0].tone).toBe('success');
    const invoices = designer.addHeaderPart('stat', 'Invoices') as string;
    expect(designer.updateHeaderPart(invoices, { field: 'invoice_count' })).toBe(true);
    expect(sheet(designer).statButtons?.[0].field).toBe('invoice_count');
    expect(designer.getPage().fields['invoice_count']).toEqual(model['invoice_count']);
  });

  it('refuses what a part cannot be', () => {
    const designer = customer();
    const confirm = designer.addHeaderPart('button', 'Confirm') as string;
    expect(designer.updateHeaderPart(confirm, { action: '  ' })).toBe(false);
    expect(designer.getState().issues).toEqual(['A button needs the name of its action, such as confirm']);
    expect(designer.updateHeaderPart(confirm, { tone: 'danger' })).toBe(false);
    expect(designer.getState().issues).toEqual(['Only a badge has a tone']);
    const invoices = designer.addHeaderPart('stat', 'Invoices') as string;
    expect(designer.updateHeaderPart(invoices, { field: 'email' })).toBe(false);
    expect(designer.getState().issues).toEqual(['A counter shows a number; Email holds text']);
    expect(designer.addHeaderPart('badge', '   ')).toBe(false);
    const vip = designer.addHeaderPart('badge', 'VIP') as string;
    expect(designer.updateHeaderPart(vip, { action: 'promote' })).toBe(false);
    expect(designer.getState().issues).toEqual(['A badge has no action']);
  });

  it('moves a part among its own kind, and takes it away', () => {
    const designer = customer();
    const a = designer.addHeaderPart('button', 'Confirm') as string;
    const b = designer.addHeaderPart('button', 'Cancel') as string;
    expect(designer.moveHeaderPart(b, -1)).toBe(true);
    expect(sheet(designer).buttons?.map((x) => x.id)).toEqual([b, a]);
    expect(designer.moveHeaderPart(b, -1)).toBe(false);
    expect(designer.moveHeaderPart(a, 1)).toBe(false);
    expect(designer.getState().issues).toEqual(['It cannot move further']);
    expect(designer.removeHeaderPart(b)).toBe(true);
    expect(sheet(designer).buttons?.map((x) => x.id)).toEqual([a]);
    expect(designer.removeHeaderPart(a)).toBe(true);
    // An empty list goes, as the format would not keep one.
    expect(sheet(designer).buttons).toBeUndefined();
  });

  it('shows a badge only for some records', () => {
    const designer = customer();
    designer.setStatusbar('state');
    const blocked = designer.addHeaderPart('badge', 'Blocked') as string;
    expect(designer.setCondition(blocked, { field: 'state', equals: 'blocked' })).toBe(true);
    expect(sheet(designer).badges?.[0].invisible).toBe("state != 'blocked'");
  });
});
