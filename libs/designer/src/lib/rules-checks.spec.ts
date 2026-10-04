import type { Field, FieldNode, Page, SectionNode, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner, pageChecks } from './designer';

/**
 * The checks on a page's rules, each with a fix: two questions reading the
 * same on one page, a rule reading a field no longer on the page or a choice
 * no longer offered, a formula that no longer reads, an answer rule that
 * checks nothing, a value set that the field cannot hold.
 */

const said = (page: Page) => pageChecks(page).map((c) => [c.severity, c.text, c.at, c.fix?.label]);

const fields: Record<string, Field> = {
  price: { type: 'float', label: 'Price' },
  qty: { type: 'integer', label: 'Quantity' },
  total: { type: 'float', label: 'Total' },
  name: { type: 'char', label: 'Name' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }] },
};

function screen(change: (page: Page, nodes: FieldNode[]) => void = () => undefined) {
  const page = blankPage('screen', 'Order');
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = Object.keys(fields).map((name) => ({ type: 'field' as const, id: `f-${name}`, field: name }));
  page.fields = JSON.parse(JSON.stringify(fields));
  change(page, section.children as FieldNode[]);
  return createDesigner({ page });
}

describe('two questions that read the same', () => {
  it('are found on one page, with the second to rename', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Sign up') });
    designer.updateQuestion(designer.addQuestion('email') as string, { label: 'Email' });
    const again = designer.addQuestion('email') as string;
    designer.updateQuestion(again, { label: 'email' });
    expect(said(designer.getPage())).toEqual([['should', 'Two questions read “email”: people may not tell them apart.', again, 'Rename the second']]);
    // On pages of their own, each reads well where it is.
    designer.addContainer('Page 2', { after: (designer.getPage().layout as WizardNode).children[0].children[0].id });
    expect(said(designer.getPage())).toEqual([]);
  });
});

describe('a rule reading a field no longer on the page', () => {
  it('is named, and Remove the rule takes it away, and the field with it', () => {
    const designer = screen();
    designer.setCompute('f-total', 'price * qty');
    designer.removeNode('f-price');
    const checks = pageChecks(designer.getPage());
    expect(checks.map((c) => [c.severity, c.text, c.at, c.fix?.label])).toEqual([['should', '“Total”: “Worked out from Price × Quantity” reads Price, which is no longer on the page.', 'f-total', 'Remove the rule']]);
    expect(designer.fixCheck(checks[0])).toBe(true);
    expect(designer.getPage().fields['total'].compute).toBeUndefined();
    expect(designer.getPage().fields['price']).toBeUndefined();
    expect(pageChecks(designer.getPage())).toEqual([]);
  });

  it('stops a survey, where nothing else fills the field in, and takes only that part of a condition away', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Event') });
    const coming = designer.addQuestion('yes-no') as string;
    designer.updateQuestion(coming, { label: 'Coming?' });
    const guests = designer.addQuestion('yes-no') as string;
    designer.updateQuestion(guests, { label: 'Guests?' });
    const why = designer.addQuestion('paragraph') as string;
    designer.updateQuestion(why, { label: 'Why?' });
    const field = (id: string) => ((designer.getPage().layout as WizardNode).children[0].children.find((n) => n.id === id) as FieldNode).field;
    designer.setCondition(why, { join: 'all', rules: [{ field: field(coming), op: 'is', value: true }, { field: field(guests), op: 'is', value: true }] });
    expect(designer.removeNode(coming)).toBe(true);
    const [check] = pageChecks(designer.getPage());
    expect([check.severity, check.text, check.fix?.label]).toEqual(['must', '“Why?”: “Shows when Coming? is Yes and Guests? is Yes” reads Coming?, which is no longer on the page.', 'Remove the rule']);
    designer.fixCheck(check);
    expect(((designer.getPage().layout as WizardNode).children[0].children.find((n) => n.id === why) as FieldNode).invisible).toBe(`${field(guests)} != True`);
  });
});

describe('a rule waiting for a choice no longer offered', () => {
  it('is named for required when, and the fix takes that part away', () => {
    const designer = screen();
    designer.setRule('f-name', 'required', { field: 'state', equals: 'closed' });
    designer.setOptions('f-state', ['Draft', 'Active']);
    const checks = pageChecks(designer.getPage());
    expect(checks.map((c) => [c.severity, c.text, c.fix?.label])).toEqual([['should', '“Name”: the rule “Status is closed” can never hold, as Status no longer offers it.', 'Remove the rule']]);
    designer.fixCheck(checks[0]);
    expect((designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children[3]).not.toHaveProperty('required');
  });
});

describe('a formula that no longer reads', () => {
  it('says what is wrong, once, and the fix takes the formula away', () => {
    const designer = screen((page) => {
      page.fields['total'] = { type: 'float', label: 'Total', compute: 'price *' };
    });
    const checks = pageChecks(designer.getPage());
    expect(checks.map((c) => [c.severity, c.text, c.fix?.label])).toEqual([['must', '“Total”: its formula no longer reads — Something is missing after “*” at 7.', 'Remove the formula']]);
    designer.fixCheck(checks[0]);
    expect(designer.getPage().fields['total'].compute).toBeUndefined();
  });

  it('names a field worked out from itself', () => {
    const designer = screen((page) => {
      page.fields['total'] = { type: 'float', label: 'Total', compute: 'total + 1' };
    });
    expect(said(designer.getPage())).toEqual([['must', '“Total”: its formula no longer reads — “Total” cannot be worked out from itself.', 'f-total', 'Remove the formula']]);
  });
});

describe('an answer rule that checks nothing', () => {
  it('is named when what it asks does not fit the field any more', () => {
    const designer = screen();
    designer.addAnswerRule('f-name', { minLength: 2 });
    designer.changeKind('f-name', 'number');
    const checks = pageChecks(designer.getPage());
    expect(checks.map((c) => [c.severity, c.text, c.fix?.label])).toEqual([['should', '“Name”: the rule “At least 2 letters” checks nothing, as Name holds a number.', 'Remove the rule']]);
    designer.fixCheck(checks[0]);
    expect((designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children[3]).not.toHaveProperty('validate');
  });

  it('is named when it asks for nothing, or its pattern does not read', () => {
    const designer = screen((_, nodes) => {
      nodes[3].validate = [{ message: 'Hm' }, { pattern: '([a-z' }];
    });
    expect(said(designer.getPage())).toEqual([
      ['must', '“Name”: the rule’s pattern “([a-z” cannot be read.', 'f-name', 'Remove the rule'],
      ['should', '“Name”: a rule asks for nothing, so it checks nothing.', 'f-name', 'Remove the rule'],
    ]);
  });
});

describe('a value set that the field cannot hold', () => {
  it('is named, and the fix takes it away', () => {
    const designer = screen();
    designer.setSetWhen('f-state', [{ when: 'qty > 10', value: "'closed'" }]);
    designer.setOptions('f-state', ['Draft', 'Active']);
    const checks = pageChecks(designer.getPage());
    expect(checks.map((c) => [c.severity, c.text, c.fix?.label])).toEqual([['must', '“Status”: “Set to closed when Quantity > 10” sets a value it cannot hold — “Status” offers Draft and Active, not “closed”.', 'Remove it']]);
    designer.fixCheck(checks[0]);
    expect(designer.getPage().fields['state'].setWhen).toBeUndefined();
  });
});

describe('the cases a mutation pass found unguarded', () => {
  const nodeOf = (page: Page, id: string) => (page.layout as unknown as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;

  it('names two fields gone at once', () => {
    const designer = screen();
    designer.setCompute('f-total', 'price * qty');
    designer.removeNode('f-price');
    designer.removeNode('f-qty');
    expect(pageChecks(designer.getPage()).map((c) => c.text)).toEqual(['“Total”: “Worked out from Price × Quantity” reads Price and Quantity, which are no longer on the page.']);
  });

  it('finds a read-only rule waiting for a choice gone, and takes it away', () => {
    const designer = screen();
    designer.setRule('f-name', 'readonly', { field: 'state', equals: 'closed' });
    designer.setOptions('f-state', ['Draft', 'Active']);
    const checks = pageChecks(designer.getPage());
    expect(checks.map((c) => c.text)).toEqual(['“Name”: the rule “Status is closed” can never hold, as Status no longer offers it.']);
    designer.fixCheck(checks[0]);
    expect(nodeOf(designer.getPage(), 'f-name')).not.toHaveProperty('readonly');
  });

  it('leaves alone a rule that a choice gone only makes always hold', () => {
    const designer = screen();
    designer.setRule('f-name', 'required', { join: 'all', rules: [{ field: 'state', op: 'is not', value: 'closed' }] });
    designer.setOptions('f-state', ['Draft', 'Active']);
    expect(pageChecks(designer.getPage())).toEqual([]);
  });

  it('takes away a whole answer rule, or a whole value set, whose “only when” waits for a choice gone', () => {
    const designer = screen();
    designer.addAnswerRule('f-name', { minLength: 2, when: "state == 'closed'" });
    designer.setSetWhen('f-name', [{ when: "state == 'closed'", value: "'x'" }]);
    designer.setOptions('f-state', ['Draft', 'Active']);
    const checks = pageChecks(designer.getPage());
    expect(checks.map((c) => [c.text, c.fix?.label])).toEqual([
      ['“Name”: the rule “Status is closed” can never hold, as Status no longer offers it.', 'Remove the rule'],
      ['“Name”: the rule “Status is closed” can never hold, as Status no longer offers it.', 'Remove the rule'],
    ]);
    designer.fixCheck(checks[0]);
    designer.fixCheck(pageChecks(designer.getPage())[0]);
    expect(nodeOf(designer.getPage(), 'f-name')).not.toHaveProperty('validate');
    expect(designer.getPage().fields['name'].setWhen).toBeUndefined();
  });

  it('reads a condition written by hand without tripping, and takes it away whole when it reads a field gone', () => {
    const designer = screen((_, nodes) => {
      nodes[3].required = "state == 'closed' and qty > 1";
      nodes[0].invisible = 'qty > 1';
    });
    expect(pageChecks(designer.getPage())).toEqual([]);
    designer.removeNode('f-qty');
    const gone = pageChecks(designer.getPage()).find((c) => c.at === 'f-price') as NonNullable<ReturnType<typeof pageChecks>[number]>;
    expect(gone.text).toBe('“Price”: “Hidden when Quantity > 1” reads Quantity, which is no longer on the page.');
    designer.fixCheck(gone);
    expect(nodeOf(designer.getPage(), 'f-price')).not.toHaveProperty('invisible');
  });

  it('says a value set that no longer reads, once', () => {
    const designer = screen((page) => {
      page.fields['name'] = { type: 'char', label: 'Name', setWhen: [{ when: 'price > 1', value: 'qty *' }] };
    });
    expect(said(designer.getPage())).toEqual([['must', '“Name”: “Set to Quantity × when Price > 1” no longer reads — Something is missing after “*” at 5.', 'f-name', 'Remove it']]);
  });

  it('says a pattern that does not read once, in words', () => {
    const designer = screen((_, nodes) => {
      nodes[3].validate = [{ pattern: '([a-z' }];
    });
    expect(said(designer.getPage())).toEqual([['must', '“Name”: the rule’s pattern “([a-z” cannot be read.', 'f-name', 'Remove the rule']]);
  });

  it('does nothing for a fix whose rule is gone already', () => {
    const designer = screen();
    designer.setCompute('f-total', 'price * qty');
    designer.removeNode('f-price');
    const [check] = pageChecks(designer.getPage());
    designer.setCompute('f-total', null);
    expect(designer.fixCheck(check)).toBe(false);
  });

  it('still says what is wrong with a list in the page’s own words', () => {
    const page: Page = { fieldia: '0.1', id: 'l', data: { kind: 'record', model: 'x' }, fields: { name: { type: 'char', label: 'Name' } }, layout: { type: 'list', id: 'l', columns: ['ghost'] } };
    expect(pageChecks(page).map((c) => [c.severity, c.text])).toEqual([['must', expect.stringMatching(/ghost/)]]);
  });
});
