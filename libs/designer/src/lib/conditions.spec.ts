import { createForm, evaluateModifier, type FieldNode, type WizardNode } from '@fieldia/core';
import { conditionToHide, readCondition, type Condition } from './conditions';
import { blankPage, createDesigner } from './designer';

const hidden = (condition: Condition, values: Record<string, unknown>) => evaluateModifier(conditionToHide(condition), values);

describe('conditions', () => {
  const comes: Condition = { join: 'all', rules: [{ field: 'comes', op: 'is', value: true }, { field: 'role', op: 'is not', value: 'manager' }] };

  it('shows a question only when all of its rules hold', () => {
    expect(hidden(comes, { comes: true, role: 'developer' })).toBe(false);
    expect(hidden(comes, { comes: true, role: 'manager' })).toBe(true);
    expect(hidden(comes, { comes: false, role: 'developer' })).toBe(true);
  });

  it('or when any of them does', () => {
    const any: Condition = { ...comes, join: 'any' };
    expect(hidden(any, { comes: false, role: 'developer' })).toBe(false);
    expect(hidden(any, { comes: true, role: 'manager' })).toBe(false);
    expect(hidden(any, { comes: false, role: 'manager' })).toBe(true);
  });

  it('reads back what it writes, quotes and numbers too, and knows a condition written by hand', () => {
    const tricky: Condition = { join: 'any', rules: [{ field: 'band', op: 'is', value: 'rock and roll' }, { field: 'score', op: 'is not', value: 3 }] };
    expect(readCondition(conditionToHide(tricky))).toEqual(tricky);
    expect(readCondition(conditionToHide(comes))).toEqual(comes);
    expect(readCondition(conditionToHide({ join: 'any', rules: [comes.rules[0]] }))).toEqual({ join: 'all', rules: [comes.rules[0]] });
    expect(readCondition(undefined)).toBeNull();
    expect(readCondition("not (a == 1 and b == 2)")).toBe('custom');
    expect(readCondition('a != 1 and b != 2 or c != 3')).toBe('custom');
    expect(readCondition(true)).toBe('custom');
  });
});

describe('setCondition on a question', () => {
  function survey() {
    const designer = createDesigner({ page: blankPage('survey', 'Event') });
    const comes = designer.addQuestion('yes-no') as string;
    designer.updateQuestion(comes, { label: 'Will you come?' });
    const why = designer.addQuestion('paragraph') as string;
    designer.updateQuestion(why, { label: 'Why not?' });
    const field = (id: string) => ((designer.getPage().layout as WizardNode).children[0].children.find((n) => n.id === id) as FieldNode).field;
    return { designer, comes, why, field };
  }

  it('shows a question only for some answers, live in the form', () => {
    const { designer, comes, why, field } = survey();
    expect(designer.setCondition(why, { join: 'all', rules: [{ field: field(comes), op: 'is', value: false }] })).toBe(true);
    const form = createForm({ page: designer.getPage() });
    // A yes-or-no answer starts unanswered: neither yes nor no, so "Why not?" waits for a No.
    expect(form.node(why).invisible).toBe(true);
    form.setValue(field(comes), true);
    expect(form.node(why).invisible).toBe(true);
    form.setValue(field(comes), false);
    expect(form.node(why).invisible).toBe(false);
    form.setValue(field(comes), true);
    expect(form.node(why).invisible).toBe(true);
  });

  it('takes the single rule of before, and refuses a question that depends on itself', () => {
    const { designer, comes, why, field } = survey();
    expect(designer.setCondition(why, { field: field(comes), equals: true })).toBe(true);
    expect(readCondition(((designer.getPage().layout as WizardNode).children[0].children[1] as FieldNode).invisible)).toEqual({ join: 'all', rules: [{ field: field(comes), op: 'is', value: true }] });
    expect(designer.setCondition(comes, { join: 'all', rules: [{ field: field(comes), op: 'is', value: true }] })).toBe(false);
    expect(designer.getState().issues).toEqual(['A question cannot depend on its own answer']);
    expect(designer.setCondition(why, { join: 'all', rules: [] })).toBe(true);
    expect(((designer.getPage().layout as WizardNode).children[0].children[1] as FieldNode).invisible).toBeUndefined();
  });
});
