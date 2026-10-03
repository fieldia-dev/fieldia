import { createForm, validatePage, type Field, type FieldNode, type SectionNode } from '@fieldia/core';
import { conditionToHold, readHolds } from './conditions';
import { blankPage, createDesigner } from './designer';

/** Rules beyond "show only when": required when a rule holds, read-only when one does. */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Name' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'blocked', label: 'Blocked' }] },
  reason: { type: 'text', label: 'Reason' },
  vip: { type: 'boolean', label: 'VIP' },
  credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP', required: true },
};

function sheet() {
  const designer = createDesigner({ page: blankPage('sheet', 'Customer'), model });
  for (const name of ['state', 'reason', 'vip', 'credit_limit']) designer.addModelField(name, { parent: 'section-1' });
  const node = (field: string) => ((designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children as FieldNode[]).find((n) => n.field === field) as FieldNode;
  return { designer, node };
}

describe('a rule as it reads', () => {
  it('is written as it holds, and read back', () => {
    const condition = { join: 'all' as const, rules: [{ field: 'state', op: 'is' as const, value: 'blocked' }, { field: 'vip', op: 'is not' as const, value: true }] };
    expect(conditionToHold(condition)).toBe("state == 'blocked' and vip != True");
    expect(readHolds("state == 'blocked' and vip != True")).toEqual(condition);
    expect(readHolds("state == 'blocked' or vip == True")).toEqual({ join: 'any', rules: [{ field: 'state', op: 'is', value: 'blocked' }, { field: 'vip', op: 'is', value: true }] });
    expect(readHolds(true)).toBe('always');
    expect(readHolds(undefined)).toBeNull();
    expect(readHolds('not (x)')).toBe('custom');
  });
});

describe('required when, read-only when', () => {
  it('makes a field required only when a rule holds, and the form asks for it only then', () => {
    const { designer, node } = sheet();
    expect(designer.setRule(node('reason').id, 'required', { field: 'state', equals: 'blocked' })).toBe(true);
    expect(node('reason').required).toBe("state == 'blocked'");
    expect(validatePage(designer.getPage()).ok).toBe(true);
    const form = createForm({ page: designer.getPage() });
    form.setValue('state', 'draft');
    expect(form.problem('reason')).toBeNull();
    form.setValue('state', 'blocked');
    expect(form.problem('reason')).toBe('Reason is required');
  });

  it('refuses to make a field the model always requires required only sometimes', () => {
    const { designer, node } = sheet();
    expect(designer.setRule(node('credit_limit').id, 'required', { field: 'state', equals: 'blocked' })).toBe(false);
    expect(designer.getState().issues).toEqual(['The model requires Credit limit always, so it cannot be required only sometimes']);
  });

  it('sets read-only when, and takes a rule away', () => {
    const { designer, node } = sheet();
    expect(designer.setRule(node('reason').id, 'readonly', { join: 'any', rules: [{ field: 'vip', op: 'is', value: true }, { field: 'state', op: 'is', value: 'blocked' }] })).toBe(true);
    expect(node('reason').readonly).toBe("vip == True or state == 'blocked'");
    const form = createForm({ page: designer.getPage() });
    form.setValue('vip', true);
    expect(form.node(node('reason').id).readonly).toBe(true);
    expect(designer.setRule(node('reason').id, 'readonly', null)).toBe(true);
    expect(node('reason').readonly).toBeUndefined();
  });

  it('refuses a field that tests its own answer', () => {
    const { designer, node } = sheet();
    expect(designer.setRule(node('state').id, 'required', { field: 'state', equals: 'blocked' })).toBe(false);
    expect(designer.getState().issues).toEqual(['A field cannot depend on its own answer']);
  });

  it('turns a field always required into one required only when the rule holds', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const coming = designer.addQuestion('yes-no', { parent: 'section-1' }) as string;
    const why = designer.addQuestion('paragraph', { parent: 'section-1' }) as string;
    designer.updateQuestion(why, { required: true });
    const nodes = () => (designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children as FieldNode[];
    const comingField = nodes().find((n) => n.id === coming)?.field as string;
    expect(designer.setRule(why, 'required', { field: comingField, equals: false })).toBe(true);
    const whyNode = nodes().find((n) => n.id === why) as FieldNode;
    expect(designer.getPage().fields[whyNode.field].required).toBeUndefined();
    expect(whyNode.required).toBe(`${comingField} == False`);
  });
});
