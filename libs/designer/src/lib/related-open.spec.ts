import { validatePage, type RelatedNode, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mount } from './test-editor';

/**
 * Where a related list's rows and New open, in the designer: a dialog (as ever, not written) or the app's own way
 * (`"open": "app"`), set by its panel's Rows and New open, and undone as any change.
 */

function withRelated() {
  const designer = createDesigner({ page: blankPage('sheet', 'Partner') });
  const id = designer.addBlock('related') as string;
  const node = () => {
    const sections = (designer.getPage().layout as { children: SectionNode[] }).children;
    return sections.flatMap((s) => s.children).find((n) => n.id === id) as RelatedNode;
  };
  return { designer, id, node };
}

describe('where a related list’s rows and New open, in the designer', () => {
  it('takes the app’s own way, and the dialog back, which is not written', () => {
    const { designer, id, node } = withRelated();
    expect(node().open).toBeUndefined();
    expect(designer.updateRelated(id, { open: 'app' })).toBe(true);
    expect(node().open).toBe('app');
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.updateRelated(id, { open: 'dialog' })).toBe(true);
    expect(node()).not.toHaveProperty('open');
    expect(designer.updateRelated(id, { open: 'app' })).toBe(true);
    // Undone as any change: back to the dialog.
    designer.undo();
    expect(node()).not.toHaveProperty('open');
  });

  it('is set in its panel, beside New, its choice pressed', () => {
    const { designer, id, node } = withRelated();
    const { host } = mount(designer, { mode: 'advanced' });
    designer.select(id);
    const group = host.querySelector('[role="group"][aria-label="Rows and New open"]') as HTMLElement;
    expect(group).not.toBeNull();
    const choice = (value: string) => group.querySelector(`[data-choice="${value}"]`) as HTMLButtonElement;
    expect(choice('dialog').getAttribute('aria-pressed')).toBe('true');
    expect(choice('app').textContent).toBe('Your app’s way');
    choice('app').click();
    expect(node().open).toBe('app');
    expect(choice('app').getAttribute('aria-pressed')).toBe('true');
    choice('dialog').click();
    expect(node()).not.toHaveProperty('open');
  });
});
