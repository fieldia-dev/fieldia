import { createForm, validatePage, type Field, type FieldNode, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';

/**
 * The store's rules: a value worked out from others, values set when
 * something holds, and the rules an answer must keep — each one undo step,
 * typing in a box one step, and each refused in words when it cannot be.
 */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Name' },
  email: { type: 'char', label: 'Email' },
  price: { type: 'float', label: 'Price' },
  qty: { type: 'integer', label: 'Quantity' },
  total: { type: 'float', label: 'Total' },
  tax: { type: 'float', label: 'Tax' },
  kind: { type: 'char', label: 'Kind' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }] },
  topics: { type: 'selection', label: 'Topics', multiple: true, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
  born: { type: 'date', label: 'Born' },
  photo: { type: 'binary', label: 'Photo' },
};

/** A screen of the page's own fields, as if typed in: not the model's. */
function order() {
  const designer = createDesigner({ page: { ...blankPage('screen', 'Order'), fields: {} } });
  const page = designer.getPage();
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = Object.keys(model).map((name) => ({ type: 'field' as const, id: `f-${name}`, field: name }));
  page.fields = JSON.parse(JSON.stringify(model));
  const fresh = createDesigner({ page });
  const node = (field: string) => ((fresh.getPage().layout as unknown as { children: SectionNode[] }).children[0].children as FieldNode[]).find((n) => n.field === field) as FieldNode;
  return { designer: fresh, node, id: (field: string) => `f-${field}` };
}

describe('worked out from other fields', () => {
  it('sets a formula, worked out by the form, one undo step', () => {
    const { designer, id } = order();
    expect(designer.setCompute(id('total'), 'price * qty')).toBe(true);
    expect(designer.getPage().fields['total'].compute).toBe('price * qty');
    expect(validatePage(designer.getPage()).ok).toBe(true);
    const form = createForm({ page: designer.getPage() });
    form.setValue('price', 120);
    form.setValue('qty', 3);
    expect(form.getState().values['total']).toBe(360);
    designer.undo();
    expect(designer.getPage().fields['total'].compute).toBeUndefined();
  });

  it('makes typing in the box one undo step', () => {
    const { designer, id } = order();
    designer.setCompute(id('total'), 'price');
    designer.setCompute(id('total'), 'price * qty');
    designer.setCompute(id('total'), 'price * qty + tax');
    designer.undo();
    expect(designer.getPage().fields['total'].compute).toBeUndefined();
  });

  it('refuses a formula that does not read, saying what and where', () => {
    const { designer, id } = order();
    expect(designer.setCompute(id('total'), 'prise * qty')).toBe(false);
    expect(designer.getState().issues).toEqual(['Unknown field “prise” at 1–5']);
    expect(designer.setCompute(id('total'), 'price *')).toBe(false);
    expect(designer.getState().issues).toEqual(['Something is missing after “*” at 7']);
    expect(designer.getPage().fields['total'].compute).toBeUndefined();
  });

  it('refuses a field worked out from itself, directly or through others', () => {
    const { designer, id } = order();
    expect(designer.setCompute(id('total'), 'total + 1')).toBe(false);
    expect(designer.getState().issues).toEqual(['“Total” cannot be worked out from itself']);
    expect(designer.setCompute(id('tax'), 'total * 0.1')).toBe(true);
    expect(designer.setCompute(id('total'), 'price + tax')).toBe(false);
    expect(designer.getState().issues).toEqual(['“Total” would be worked out from itself: Total → Tax → Total']);
  });

  it('refuses a field that holds what a formula cannot give', () => {
    const { designer, id } = order();
    expect(designer.setCompute(id('photo'), 'name')).toBe(false);
    expect(designer.getState().issues).toEqual(['“Photo” holds a file, which cannot be worked out from other fields']);
  });

  it('takes the formula away, and the field can be typed in again', () => {
    const { designer, id } = order();
    designer.setCompute(id('total'), 'price * qty');
    expect(createForm({ page: designer.getPage() }).node(id('total')).readonly).toBe(true);
    expect(designer.setCompute(id('total'), null)).toBe(true);
    expect(designer.getPage().fields['total'].compute).toBeUndefined();
    expect(createForm({ page: designer.getPage() }).node(id('total')).readonly).toBe(false);
  });

  it('leaves the model’s fields to the model', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Order'), model });
    for (const name of ['price', 'qty', 'total']) designer.addModelField(name, { parent: 'section-1' });
    const total = ((designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children as FieldNode[]).find((n) => n.field === 'total') as FieldNode;
    expect(designer.setCompute(total.id, 'price * qty')).toBe(false);
    expect(designer.getState().issues).toEqual(['How “Total” is worked out comes from the model']);
  });
});

describe('values set when something holds', () => {
  it('sets a list of values and when, checked as formulas are', () => {
    const { designer, id } = order();
    expect(designer.setSetWhen(id('kind'), [{ when: 'qty > 10', value: "'bulk'" }])).toBe(true);
    const form = createForm({ page: designer.getPage() });
    form.setValue('qty', 12);
    expect(form.getState().values['kind']).toBe('bulk');
    expect(designer.setSetWhen(id('kind'), [{ when: 'qtty > 10', value: "'bulk'" }])).toBe(false);
    expect(designer.getState().issues).toEqual(['When: Unknown field “qtty” at 1–4']);
    expect(designer.setSetWhen(id('kind'), null)).toBe(true);
    expect(designer.getPage().fields['kind'].setWhen).toBeUndefined();
  });

  it('refuses a value the field cannot hold', () => {
    const { designer, id } = order();
    expect(designer.setSetWhen(id('qty'), [{ when: "state == 'active'", value: "'bulk'" }])).toBe(false);
    expect(designer.getState().issues).toEqual(['“Quantity” holds a whole number, not “bulk”']);
    expect(designer.setSetWhen(id('state'), [{ when: 'qty > 1', value: "'closed'" }])).toBe(false);
    expect(designer.getState().issues).toEqual(['“Status” offers Draft and Active, not “closed”']);
    expect(designer.setSetWhen(id('state'), [{ when: 'qty > 1', value: "'active'" }])).toBe(true);
  });

  it('makes typing in one box one undo step, and another box another', () => {
    const { designer, id } = order();
    designer.setSetWhen(id('kind'), [{ when: 'qty > 1', value: "'b'" }]);
    designer.setSetWhen(id('kind'), [{ when: 'qty > 1', value: "'bu'" }]);
    designer.setSetWhen(id('kind'), [{ when: 'qty > 1', value: "'bulk'" }]);
    designer.setSetWhen(id('kind'), [{ when: 'qty > 10', value: "'bulk'" }]);
    designer.undo();
    expect(designer.getPage().fields['kind'].setWhen).toEqual([{ when: 'qty > 1', value: "'bulk'" }]);
    designer.undo();
    expect(designer.getPage().fields['kind'].setWhen).toEqual([{ when: 'qty > 1', value: "'b'" }]);
  });
});

describe('answer rules', () => {
  it('adds, changes and removes a rule, each one undo step', () => {
    const { designer, id, node } = order();
    expect(designer.addAnswerRule(id('email'), { endsWith: '@acme.com' })).toBe(true);
    expect(designer.updateAnswerRule(id('email'), 0, { level: 'warning', message: 'Use your work address' })).toBe(true);
    expect(node('email').validate).toEqual([{ endsWith: '@acme.com', level: 'warning', message: 'Use your work address' }]);
    const form = createForm({ page: designer.getPage() });
    form.setValue('email', 'a@b.com');
    expect(form.getState().warnings['email']).toBe('Use your work address');
    expect(designer.updateAnswerRule(id('email'), 0, { message: null, level: null })).toBe(true);
    expect(node('email').validate).toEqual([{ endsWith: '@acme.com' }]);
    expect(designer.removeAnswerRule(id('email'), 0)).toBe(true);
    expect(node('email').validate).toBeUndefined();
    designer.undo();
    expect(node('email').validate).toEqual([{ endsWith: '@acme.com' }]);
  });

  it('makes typing in one box of a rule one undo step', () => {
    const { designer, id, node } = order();
    designer.addAnswerRule(id('email'), { endsWith: '@' });
    designer.updateAnswerRule(id('email'), 0, { endsWith: '@a' });
    designer.updateAnswerRule(id('email'), 0, { endsWith: '@acme.com' });
    designer.undo();
    expect(node('email').validate).toEqual([{ endsWith: '@' }]);
  });

  it('refuses a rule that does not fit the field, asks nothing, or has a pattern that does not read', () => {
    const { designer, id } = order();
    expect(designer.addAnswerRule(id('qty'), { minLength: 2 })).toBe(false);
    expect(designer.getState().issues).toEqual(['“Quantity” holds a whole number: a length does not fit it']);
    expect(designer.addAnswerRule(id('name'), { message: 'Hm' })).toBe(false);
    expect(designer.getState().issues).toEqual(['A rule asks for something: a length, an ending, a pattern, a range, how many are ticked or a date']);
    expect(designer.addAnswerRule(id('name'), { pattern: '([a-z' })).toBe(false);
    expect(designer.getState().issues).toEqual(['The pattern “([a-z” cannot be read']);
    expect(designer.addAnswerRule(id('topics'), { atLeast: 1, atMost: 2 })).toBe(true);
    expect(designer.addAnswerRule(id('born'), { date: 'past' })).toBe(true);
    expect(designer.addAnswerRule(id('photo'), { minLength: 1 })).toBe(false);
  });

  it('refuses a range that runs backwards', () => {
    const { designer, id } = order();
    expect(designer.addAnswerRule(id('price'), { min: 10, max: 1 })).toBe(false);
    expect(designer.getState().issues).toEqual(['The smallest, 10, is more than the largest, 1']);
    expect(designer.addAnswerRule(id('name'), { minLength: 5, maxLength: 2 })).toBe(false);
    expect(designer.getState().issues).toEqual(['The shortest, 5, is longer than the longest, 2']);
  });

  it('holds only when a condition does, and refuses one that does not read', () => {
    const { designer, id, node } = order();
    expect(designer.addAnswerRule(id('name'), { minLength: 2, when: "state == 'active'" })).toBe(true);
    expect(node('name').validate?.[0].when).toBe("state == 'active'");
    expect(designer.updateAnswerRule(id('name'), 0, { when: 'stat == 1' })).toBe(false);
    expect(designer.getState().issues).toEqual(['Only when: Unknown field “stat” at 1–4']);
    expect(designer.updateAnswerRule(id('name'), 0, { when: null })).toBe(true);
    expect(node('name').validate?.[0].when).toBeUndefined();
  });

  it('refuses a rule that is not there', () => {
    const { designer, id } = order();
    expect(designer.updateAnswerRule(id('name'), 0, { minLength: 1 })).toBe(false);
    expect(designer.getState().issues).toEqual(['“Name” has no rule 1']);
    expect(designer.removeAnswerRule('nope', 0)).toBe(false);
  });
});

describe('a field a rule reads, taken off the page', () => {
  it('goes, and its definition stays while a rule reads it', () => {
    const { designer, id } = order();
    designer.setCompute(id('total'), 'price * qty');
    expect(designer.removeNode(id('price'))).toBe(true);
    expect(designer.getPage().fields['price']).toEqual(model['price']);
    // The rule taken away, nothing reads it: it goes with the next edit that takes it away.
    expect(designer.setCompute(id('total'), 'qty * 2')).toBe(true);
    expect(designer.getPage().fields['price']).toBeUndefined();
  });

  it('goes with nothing kept when nothing reads it', () => {
    const { designer, id } = order();
    expect(designer.removeNode(id('price'))).toBe(true);
    expect(designer.getPage().fields['price']).toBeUndefined();
  });
});

describe('the words before publishing', () => {
  it('says what is worked out, what no longer is, and each rule added', () => {
    const { designer, id } = order();
    const before = designer.getPage();
    designer.setCompute(id('total'), 'price * qty');
    designer.addAnswerRule(id('email'), { endsWith: '@acme.com', level: 'warning' });
    designer.setSetWhen(id('kind'), [{ when: 'qty > 10', value: "'bulk'" }]);
    // Field by field, in reading order.
    expect(pageChanges(before, designer.getPage())).toEqual([
      '“Email”: a rule — Must end with @acme.com (only warns)',
      '“Total” is worked out from Price × Quantity',
      '“Kind” is set to “bulk” when Quantity > 10',
    ]);
    const after = designer.getPage();
    designer.setCompute(id('total'), null);
    designer.removeAnswerRule(id('email'), 0);
    designer.setSetWhen(id('kind'), null);
    expect(pageChanges(after, designer.getPage())).toEqual(['“Email”: removed the rule — Must end with @acme.com (only warns)', '“Total” is no longer worked out', '“Kind” is no longer set by a rule']);
  });
});
