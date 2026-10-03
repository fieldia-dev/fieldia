import type { Field, FieldNode, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { button, choose, field, mount } from './test-editor';

/** Required when, and read-only when, from the field's panel. */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Name' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'blocked', label: 'Blocked' }] },
  reason: { type: 'text', label: 'Reason' },
};

function sheet() {
  const designer = createDesigner({ page: blankPage('sheet', 'Customer'), model });
  designer.addModelField('state', { parent: 'section-1' });
  designer.addModelField('reason', { parent: 'section-1' });
  const node = (name: string) => ((designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children as FieldNode[]).find((n) => n.field === name) as FieldNode;
  designer.select(node('reason').id);
  const { host } = mount(designer);
  const panel = () => host.querySelector('.fd-properties') as HTMLElement;
  return { designer, node, panel };
}

describe('screen editor — required when, read-only when', () => {
  it('makes a field required only when a rule holds, and the Required box takes it back', () => {
    const { node, panel } = sheet();
    (button(panel(), 'Required only when…') as HTMLButtonElement).click();
    expect(node('reason').required).toBe("state == 'draft'");
    choose(field(panel(), 'When the answer is'), 'is:blocked');
    expect(node('reason').required).toBe("state == 'blocked'");
    expect((field(panel(), 'Required when') as HTMLSelectElement).value).toBe('state');
    expect((field(panel(), 'Required') as HTMLInputElement).checked).toBe(false);
    expect(button(panel(), 'Required only when…')).toBeUndefined();
    // Required always: the rule goes.
    (field(panel(), 'Required') as HTMLInputElement).click();
    expect(node('reason').required).toBe(true);
    expect(field(panel(), 'Required when')).toBeUndefined();
  });

  it('makes a field read-only when a rule holds, and Always takes it away', () => {
    const { node, panel } = sheet();
    (button(panel(), 'Read-only when…') as HTMLButtonElement).click();
    expect(node('reason').readonly).toBe("state == 'draft'");
    expect(button(panel(), 'Read-only when…')).toBeUndefined();
    choose(field(panel(), 'Read-only when'), '');
    expect(node('reason').readonly).toBeUndefined();
    expect(button(panel(), 'Read-only when…')).toBeDefined();
  });
});
