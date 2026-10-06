import { validatePage, type ButtonNode, type Field, type Page, type SheetNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { ar } from './locales/ar';

/**
 * What a press, a field's change or one of the form's moments does, as the
 * designer keeps it: each place writes its own part of the page, each edit is
 * one undo step, a button with only an app action is that one step, and a
 * button always does something.
 */

const fields: Record<string, Field> = {
  customer: { type: 'char', label: 'Customer' },
  product: { type: 'char', label: 'Product' },
  price: { type: 'float', label: 'Price' },
  quantity: { type: 'integer', label: 'Quantity' },
  vip: { type: 'boolean', label: 'VIP' },
  photo: { type: 'binary', label: 'Photo' },
  lines: { type: 'one2many', label: 'Lines', relation: 'order.line', fields: { item: { type: 'char', label: 'Item' }, qty: { type: 'integer', label: 'Qty' } } },
};

/** An order screen: its fields in one section, a body button, a sheet's header when asked, and tabs. */
function order(kind: 'screen' | 'sheet' = 'screen'): Page {
  const children = [
    ...Object.keys(fields).map((name) => ({ type: 'field' as const, id: `f-${name}`, field: name })),
    { type: 'button' as const, id: 'new-customer', label: 'New customer', action: 'button' },
  ];
  const section = { type: 'section' as const, id: 'section-1', columns: 2 as const, children };
  const tabs = { type: 'tabs' as const, id: 'tabs', children: [{ type: 'tab' as const, id: 'tab-lines', label: 'Lines', children: [{ type: 'section' as const, id: 'section-2', columns: 2 as const, children: [] }] }, { type: 'tab' as const, id: 'tab-notes', label: 'Notes', children: [{ type: 'section' as const, id: 'section-3', columns: 2 as const, children: [] }] }] };
  const layout =
    kind === 'sheet'
      ? ({ type: 'sheet', id: 'sheet', buttons: [{ type: 'button', id: 'confirm', label: 'Confirm', action: 'confirm', style: 'primary' }], statButtons: [{ id: 'invoices', label: 'Invoices', action: 'open_invoices' }], children: [section, tabs] } as SheetNode)
      : ({ type: 'sections', id: 'sections', children: [section] } as Page['layout']);
  return { ...blankPage('screen', 'Order'), id: 'order', fields: JSON.parse(JSON.stringify(fields)), layout };
}

const button = (page: Page, id = 'new-customer') => (page.layout as { children: { children: unknown[] }[] }).children[0].children.find((n) => (n as ButtonNode).id === id) as ButtonNode;

const newCustomer = { do: 'open', page: 'customer', as: 'panel', into: { customer: 'name' } } as const;

describe('a button’s steps: When clicked', () => {
  it('shows a button with only an app action as that one step', () => {
    const designer = createDesigner({ page: order() });
    expect(designer.steps({ press: 'new-customer' })).toEqual([{ do: 'call', action: 'button' }]);
  });

  it('adds a step after its action: the action becomes a step too, the button keeps no action of its own', () => {
    const designer = createDesigner({ page: order() });
    expect(designer.addStep({ press: 'new-customer' }, newCustomer)).toEqual([1]);
    const pressed = button(designer.getPage());
    expect(pressed.steps).toEqual([{ do: 'call', action: 'button' }, newCustomer]);
    expect(pressed.action).toBeUndefined();
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('writes one plain call back as the action, in its own place among the button’s keys', () => {
    const designer = createDesigner({ page: order() });
    designer.addStep({ press: 'new-customer' }, newCustomer);
    expect(designer.removeStep({ press: 'new-customer' }, [1])).toBe(true);
    const pressed = button(designer.getPage());
    expect(pressed).toEqual({ type: 'button', id: 'new-customer', label: 'New customer', action: 'button' });
    expect(designer.updateStep({ press: 'new-customer' }, [0], { action: 'new_customer' })).toBe(true);
    expect(Object.keys(button(designer.getPage()))).toEqual(['type', 'id', 'label', 'action']);
    expect(button(designer.getPage()).action).toBe('new_customer');
  });

  it('keeps a call that runs only sometimes as a step: an action always runs', () => {
    const designer = createDesigner({ page: order() });
    designer.updateStep({ press: 'new-customer' }, [0], { when: 'vip' });
    expect(button(designer.getPage())).toMatchObject({ steps: [{ do: 'call', action: 'button', when: 'vip' }] });
    expect(button(designer.getPage()).action).toBeUndefined();
  });

  it('refuses to leave a button with nothing to do, in words', () => {
    const designer = createDesigner({ page: order() });
    expect(designer.removeStep({ press: 'new-customer' }, [0])).toBe(false);
    expect(designer.getState().issues).toEqual(['“New customer” needs something to do: add another step before taking this one away.']);
    expect(button(designer.getPage()).action).toBe('button');
  });

  it('gives a record’s header buttons and its counters steps too', () => {
    const designer = createDesigner({ page: order('sheet') });
    expect(designer.steps({ press: 'confirm' })).toEqual([{ do: 'call', action: 'confirm' }]);
    designer.addStep({ press: 'confirm' }, { do: 'check' });
    designer.moveStep({ press: 'confirm' }, [1], 0);
    designer.addStep({ press: 'invoices' }, { do: 'goTo', target: 'tab-lines' });
    const sheet = designer.getPage().layout as SheetNode;
    expect(sheet.buttons?.[0]).toEqual({ type: 'button', id: 'confirm', label: 'Confirm', style: 'primary', steps: [{ do: 'check' }, { do: 'call', action: 'confirm' }] });
    expect(sheet.statButtons?.[0]).toEqual({ id: 'invoices', label: 'Invoices', steps: [{ do: 'call', action: 'open_invoices' }, { do: 'goTo', target: 'tab-lines' }] });
  });

  it('gives a list’s buttons steps', () => {
    const designer = createDesigner({ page: blankPage('list', 'Customers') });
    const id = designer.addListAction('Archive') as string;
    designer.addStep({ press: id }, { do: 'ask', message: 'Archive them?' });
    designer.moveStep({ press: id }, [1], 0);
    const list = designer.getPage().layout as { actions: ButtonNode[] };
    expect(list.actions[0].steps).toEqual([{ do: 'ask', message: 'Archive them?' }, { do: 'call', action: 'archive' }]);
  });
});

describe('a field’s steps: When it changes', () => {
  it('writes the page’s change steps under the field’s name', () => {
    const designer = createDesigner({ page: order() });
    expect(designer.addStep({ change: 'product' }, { do: 'call', action: 'check_stock' })).toEqual([0]);
    expect(designer.getPage().on).toEqual({ change: { product: [{ do: 'call', action: 'check_stock' }] } });
    // One plain call stays a step here: only a button has an action of its own.
    expect(designer.steps({ change: 'product' })).toEqual([{ do: 'call', action: 'check_stock' }]);
  });

  it('takes the page’s `on` away with its last step', () => {
    const designer = createDesigner({ page: order() });
    designer.addStep({ change: 'product' }, { do: 'call', action: 'check_stock' });
    designer.removeStep({ change: 'product' }, [0]);
    expect(designer.getPage().on).toBeUndefined();
  });

  it('keeps a field’s definition while steps still name it, and lets it go with them', () => {
    const designer = createDesigner({ page: order() });
    designer.addStep({ change: 'product' }, { do: 'set', field: 'price', value: 'quantity * 12.5', when: 'quantity > 0' });
    expect(designer.removeNode('f-product')).toBe(true);
    expect(designer.removeNode('f-price')).toBe(true);
    // Off the page, but still named: kept, so the steps can be seen and put right.
    expect(Object.keys(designer.getPage().fields)).toEqual(expect.arrayContaining(['product', 'price']));
    designer.removeStep({ change: 'product' }, [0]);
    expect(designer.getPage().fields['product']).toBeUndefined();
    expect(designer.getPage().fields['price']).toBeUndefined();
  });
});

describe('the form’s own moments', () => {
  it('writes before saving: check, then ask', () => {
    const designer = createDesigner({ page: order() });
    designer.addStep({ moment: 'beforeSave' }, { do: 'check' });
    designer.addStep({ moment: 'beforeSave' }, { do: 'ask', message: 'Send the order?' });
    designer.addStep({ moment: 'open' }, { do: 'set', field: 'quantity', value: '1' });
    designer.addStep({ moment: 'afterSave' }, { do: 'say', message: 'Order sent', tone: 'success' });
    expect(designer.getPage().on).toEqual({
      beforeSave: [{ do: 'check' }, { do: 'ask', message: 'Send the order?' }],
      open: [{ do: 'set', field: 'quantity', value: '1' }],
      afterSave: [{ do: 'say', message: 'Order sent', tone: 'success' }],
    });
  });

  it('writes a tab’s steps by its id, and lets them go with the tab', () => {
    const designer = createDesigner({ page: order('sheet') });
    designer.addStep({ show: 'tab-lines' }, { do: 'say', message: 'Add the lines', tone: 'info' });
    designer.addStep({ press: 'confirm' }, { do: 'goTo', target: 'tab-lines' });
    expect(designer.getPage().on?.show).toEqual({ 'tab-lines': [{ do: 'say', message: 'Add the lines', tone: 'info' }] });
    expect(designer.removeNode('tab-lines')).toBe(true);
    expect(designer.getPage().on).toBeUndefined();
    expect((designer.getPage().layout as SheetNode).buttons?.[0]).toMatchObject({ action: 'confirm' });
    designer.undo();
    expect(designer.getPage().on?.show?.['tab-lines']).toHaveLength(1);
  });
});

describe('a step’s own steps once its page is saved', () => {
  it('adds, moves and removes steps in an open step’s then', () => {
    const designer = createDesigner({ page: order() });
    const place = { press: 'new-customer' };
    designer.addStep(place, newCustomer);
    expect(designer.addStep(place, { do: 'say', message: 'Customer added', tone: 'success' }, { then: [1] })).toEqual([1, 0]);
    expect(designer.addStep(place, { do: 'check' }, { then: [1] })).toEqual([1, 1]);
    designer.moveStep(place, [1, 1], 0);
    expect(button(designer.getPage()).steps?.[1]).toEqual({ ...newCustomer, then: [{ do: 'check' }, { do: 'say', message: 'Customer added', tone: 'success' }] });
    designer.removeStep(place, [1, 0]);
    designer.removeStep(place, [1, 0]);
    // An empty then is no then.
    expect(button(designer.getPage()).steps?.[1]).toEqual(newCustomer);
  });

  it('refuses steps under a step that opens nothing', () => {
    const designer = createDesigner({ page: order() });
    expect(designer.addStep({ press: 'new-customer' }, { do: 'check' }, { then: [0] })).toBe(false);
    expect(designer.getState().issues).toEqual(['Only a step that opens a page has steps once it is saved.']);
  });
});

describe('each edit, one undo step', () => {
  it('undoes and redoes an add, a move and a removal', () => {
    const designer = createDesigner({ page: order() });
    const place = { moment: 'beforeSave' } as const;
    designer.addStep(place, { do: 'check' });
    designer.addStep(place, { do: 'ask', message: 'Send the order?' });
    designer.moveStep(place, [1], 0);
    designer.removeStep(place, [0]);
    expect(designer.steps(place)).toEqual([{ do: 'check' }]);
    designer.undo();
    expect(designer.steps(place)).toEqual([{ do: 'ask', message: 'Send the order?' }, { do: 'check' }]);
    designer.undo();
    expect(designer.steps(place)).toEqual([{ do: 'check' }, { do: 'ask', message: 'Send the order?' }]);
    designer.redo();
    expect(designer.steps(place)).toEqual([{ do: 'ask', message: 'Send the order?' }, { do: 'check' }]);
  });

  it('makes a run of typing in one box of one step one undo step, and another box another', () => {
    const designer = createDesigner({ page: order() });
    const place = { moment: 'afterSave' } as const;
    designer.addStep(place, { do: 'say', message: 'O' }, { typing: 'message' });
    designer.updateStep(place, [0], { message: 'Or' }, { typing: true });
    designer.updateStep(place, [0], { message: 'Order sent' }, { typing: true });
    designer.updateStep(place, [0], { tone: 'success' });
    designer.undo();
    expect(designer.steps(place)).toEqual([{ do: 'say', message: 'Order sent' }]);
    designer.undo();
    expect(designer.getPage().on).toBeUndefined();
  });
});

describe('what a step cannot be', () => {
  it('is refused in words: a field it has not got, nothing to say, a formula that does not read', () => {
    const designer = createDesigner({ page: order() });
    const place = { moment: 'open' } as const;
    const refused = (step: Parameters<typeof designer.addStep>[1]) => (designer.addStep(place, step) ? '' : designer.getState().issues[0]);
    expect(refused({ do: 'set', field: 'nope', value: '1' })).toBe('This page has no field it can take yet.');
    expect(refused({ do: 'set', field: 'photo', value: '1' })).toBe('This page has no field it can take yet.');
    expect(refused({ do: 'say', message: ' ' })).toBe('Type what it says.');
    expect(refused({ do: 'call', action: '' })).toBe('Type the action’s name.');
    expect(refused({ do: 'open', page: '' })).toBe('Pick the page it opens, or type its id.');
    expect(refused({ do: 'set', field: 'price', value: 'quantity *' })).toMatch(/./);
    expect(refused({ do: 'addLine', field: 'customer' })).toBe('This page has no field it can take yet.');
    expect(refused({ do: 'goTo', target: 'nowhere' })).toBe('The page has no tabs or wizard steps yet.');
    expect(designer.getPage().on).toBeUndefined();
  });

  it('is refused in Arabic for the designer in Arabic', () => {
    const designer = createDesigner({ page: order(), locale: 'ar' });
    expect(designer.addStep({ moment: 'open' }, { do: 'say', message: '' })).toBe(false);
    expect(designer.getState().issues).toEqual([ar.steps.needsWords]);
  });
});
