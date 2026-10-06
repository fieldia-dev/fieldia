import { checkPage, pageJsonSchema, validatePage } from '../../index';
import Ajv2020 from 'ajv/dist/2020';

/**
 * What a press, a change or a moment of the form does, as data: steps in
 * order — open another page in a dialog, a panel or in its place and take its
 * answers back, set or empty a field, add a line, check the form, save, go to
 * a step, say something, ask, call one of the app's own actions, close.
 */

const order = (extra: { layout?: unknown[]; on?: unknown; header?: unknown } = {}) => ({
  fieldia: '0.1',
  id: 'order',
  data: { kind: 'record', model: 'sale.order' },
  fields: {
    customer_id: { type: 'many2one', label: 'Customer', relation: 'res.partner' },
    product: { type: 'char', label: 'Product' },
    quantity: { type: 'integer', label: 'Quantity' },
    price: { type: 'monetary', label: 'Price' },
    note: { type: 'text', label: 'Note' },
    lines: { type: 'one2many', label: 'Lines', relation: 'sale.order.line', fields: { name: { type: 'char', label: 'Name' }, qty: { type: 'integer', label: 'Qty' } } },
  },
  layout: {
    type: 'tabs',
    id: 'root',
    children: [
      { type: 'tab', id: 'main', label: 'Order', children: [{ type: 'field', id: 'c', field: 'customer_id' }, { type: 'field', id: 'p', field: 'product' }, ...(extra.layout ?? [])] },
      { type: 'tab', id: 'more', label: 'More', children: [{ type: 'field', id: 'n', field: 'note' }] },
    ],
  },
  ...(extra.on ? { on: extra.on } : {}),
});
const button = (steps: unknown[], more: Record<string, unknown> = {}) => ({ type: 'button', id: 'b', label: 'Go', steps, ...more });
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const quick = (input: unknown) => {
  const r = checkPage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a button’s steps', () => {
  it('open a page in a panel, start it, take its answers back, and go on', () => {
    const newCustomer = button([
      {
        do: 'open',
        page: 'customer',
        as: 'panel',
        title: 'New customer',
        values: { name: 'note' },
        into: { customer_id: 'id', note: "'Customer added'" },
        then: [{ do: 'say', message: 'Customer added', tone: 'success' }, { do: 'goTo', target: 'more' }],
      },
    ]);
    expect(problems(order({ layout: [newCustomer] }))).toEqual([]);
  });

  it('every kind of step, each only when its condition holds', () => {
    const all = button([
      { do: 'ask', message: 'Price it now?' },
      { do: 'call', action: 'check_stock', params: { warehouse: 'main', urgent: true } },
      { do: 'set', field: 'price', value: 'quantity * 12.5', when: 'quantity > 0' },
      { do: 'clear', field: 'note' },
      { do: 'addLine', field: 'lines', values: { name: 'product', qty: 'quantity' } },
      { do: 'check', fields: ['customer_id', 'quantity'] },
      { do: 'check' },
      { do: 'save' },
      { do: 'reset' },
      { do: 'goTo', target: 'main' },
      { do: 'say', message: 'Done' },
      { do: 'close' },
      { do: 'open', page: 'invoice', as: 'dialog', record: 'customer_id', version: 2 },
      { do: 'open', page: 'catalogue', as: 'page' },
    ]);
    expect(problems(order({ layout: [all] }))).toEqual([]);
    expect(quick(order({ layout: [all] }))).toEqual([]);
  });

  it('an app action alone still names it, and steps and an action go together', () => {
    expect(problems(order({ layout: [{ type: 'button', id: 'b', label: 'Approve', action: 'approve' }] }))).toEqual([]);
    expect(problems(order({ layout: [button([{ do: 'check' }], { action: 'approve', confirm: 'Approve it?' })] }))).toEqual([]);
  });

  it('a button with neither steps nor an action is said, in the quick check too', () => {
    const empty = { type: 'button', id: 'b', label: 'Nothing' };
    expect(problems(order({ layout: [empty] }))).toEqual(['layout.children[0].children[2]: a button needs steps, an action, or both']);
    expect(quick(order({ layout: [empty] }))).toEqual(['layout.children[0].children[2]: a button needs steps, an action, or both']);
  });

  it('names the fields it touches, reads its expressions, and goes only where there is a tab or a step', () => {
    const wrong = button([
      { do: 'set', field: 'ghost', value: '1' },
      { do: 'set', field: 'customer_id', value: '1' },
      { do: 'set', field: 'price', value: 'quantity *' },
      { do: 'clear', field: 'nobody' },
      { do: 'addLine', field: 'note' },
      { do: 'addLine', field: 'lines', values: { colour: "'red'" } },
      { do: 'check', fields: ['missing'] },
      { do: 'goTo', target: 'nowhere' },
      { do: 'open', page: 'customer', into: { ghost: 'id' }, then: [{ do: 'clear', field: 'nobody' }] },
      { do: 'open', page: 'order', as: 'page' },
      { do: 'say', message: 'x', when: 'ghost > 1' },
    ]);
    const at = 'layout.children[0].children[2].steps';
    expect(problems(order({ layout: [wrong] }))).toEqual([
      `${at}[0].field: no field "ghost"`,
      `${at}[1].field: a many2one cannot be set from an expression; text, numbers, yes or no, dates, choices and json can`,
      expect.stringMatching(new RegExp(`^${at.replace(/[[\].]/g, '\\$&')}\\[2\\]\\.value: cannot read "quantity \\*"`)),
      `${at}[3].field: no field "nobody"`,
      `${at}[4].field: "note" is a text; a line is added to a one2many`,
      `${at}[5].values.colour: "colour" is not a field of the lines of "lines"`,
      `${at}[6].fields[0]: no field "missing"`,
      `${at}[8].into.ghost: no field "ghost"`,
      `${at}[8].then[0].field: no field "nobody"`,
      `${at}[9].page: a page cannot open itself in its own place`,
      `${at}[10].when: "ghost > 1" reads "ghost", which is not a field of this page`,
      `${at}[7].target: no tab or wizard step "nowhere" on this page`,
    ]);
  });

  it('refuses a step it does not know, a key a step does not take, and an empty list of steps', () => {
    expect(problems(order({ layout: [button([{ do: 'launch' }])] }))).not.toEqual([]);
    expect(problems(order({ layout: [button([{ do: 'save', field: 'note' }])] }))).not.toEqual([]);
    expect(problems(order({ layout: [button([{ do: 'open', page: 'customer', as: 'drawer' }])] }))).not.toEqual([]);
    expect(problems(order({ layout: [button([])] }))).not.toEqual([]);
  });
});

describe('the form’s moments', () => {
  it('opened, a field changed, before and after saving, a tab shown', () => {
    const on = {
      open: [{ do: 'call', action: 'load_defaults' }],
      change: { product: [{ do: 'call', action: 'check_stock' }, { do: 'set', field: 'price', value: 'quantity * 10' }] },
      beforeSave: [{ do: 'check' }, { do: 'ask', message: 'Send the order?' }],
      afterSave: [{ do: 'say', message: 'Saved', tone: 'success' }, { do: 'close' }],
      show: { more: [{ do: 'say', message: 'Anything else?' }] },
    };
    expect(problems(order({ on }))).toEqual([]);
    expect(quick(order({ on }))).toEqual([]);
  });

  it('a change named by a field of the page, a shown one by a tab or a step, and their steps checked', () => {
    const on = { change: { ghost: [{ do: 'save' }] }, show: { elsewhere: [{ do: 'clear', field: 'nobody' }] } };
    expect(problems(order({ on }))).toEqual([
      'on.change.ghost: no field "ghost"',
      'on.show.elsewhere[0].field: no field "nobody"',
      'on.show.elsewhere: no tab or wizard step "elsewhere" on this page',
    ]);
  });

  it('a change inside a saved form placed here, named by the part’s name, as its answers are', () => {
    const placed = { type: 'form', id: 'home', page: 'address', name: 'home_address' };
    const on = { change: { home_address: [{ do: 'call', action: 'price_delivery' }] } };
    expect(problems(order({ layout: [placed], on }))).toEqual([]);
    expect(quick(order({ layout: [placed], on }))).toEqual([]);
    // The part's id is no name of its answers.
    expect(quick(order({ layout: [placed], on: { change: { home: [{ do: 'save' }] } } }))).toEqual(['on.change.home: no field "home"']);
  });

  it('refuses a moment the format does not have', () => {
    expect(problems(order({ on: { hover: [{ do: 'save' }] } }))).not.toEqual([]);
  });
});

describe('the header’s buttons, the stat buttons and a list’s actions', () => {
  it('take steps as body buttons do, and are checked as they are', () => {
    const sheet = {
      fieldia: '0.1',
      id: 'customer',
      data: { kind: 'record', model: 'res.partner' },
      fields: { name: { type: 'char', label: 'Name' }, orders: { type: 'integer', label: 'Orders' } },
      layout: {
        type: 'sheet',
        id: 'root',
        buttons: [{ type: 'button', id: 'mail', label: 'Send by email', steps: [{ do: 'check' }, { do: 'call', action: 'send_mail' }] }],
        statButtons: [{ id: 'orders', label: 'Orders', field: 'orders', steps: [{ do: 'open', page: 'orders', as: 'page' }] }],
        children: [{ type: 'field', id: 'n', field: 'name' }],
      },
    };
    expect(problems(sheet)).toEqual([]);
    const broken = { ...sheet, layout: { ...sheet.layout, buttons: [{ type: 'button', id: 'mail', label: 'Send', steps: [{ do: 'clear', field: 'ghost' }] }], statButtons: [{ id: 'orders', label: 'Orders' }] } };
    expect(problems(broken)).toEqual(['layout.buttons[0].steps[0].field: no field "ghost"', 'layout.statButtons[0]: a button needs steps, an action, or both']);
    const list = {
      fieldia: '0.1',
      id: 'customers',
      data: { kind: 'record', model: 'res.partner' },
      fields: { name: { type: 'char', label: 'Name' } },
      layout: { type: 'list', id: 'root', columns: ['name'], actions: [{ type: 'button', id: 'archive', label: 'Archive', steps: [{ do: 'ask', message: 'Archive them?' }, { do: 'call', action: 'archive' }] }] },
    };
    expect(problems(list)).toEqual([]);
  });
});

describe('the JSON Schema', () => {
  it('takes a page with steps and moments, and refuses a step it does not know', () => {
    const validate = new Ajv2020({ strict: false }).compile(pageJsonSchema());
    const good = order({
      layout: [button([{ do: 'open', page: 'customer', as: 'panel', into: { customer_id: 'id' }, then: [{ do: 'save' }] }])],
      on: { change: { product: [{ do: 'call', action: 'check_stock' }] } },
    });
    expect(validate(good)).toBe(true);
    expect(validate(order({ layout: [button([{ do: 'launch' }])] }))).toBe(false);
  });
});
