import type { FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';

/**
 * What keeps the designer quick on a big page, without changing what it does:
 * an edit leaves what it did not touch as the same objects, so the views skip
 * them; and what is worked out from a page is worked out once for it.
 */

function screen(fields: number): Page {
  const page = blankPage('screen', 'Big');
  const section = (page.layout as { children: SectionNode[] }).children[0];
  for (let i = 1; i <= fields; i++) {
    page.fields[`f${i}`] = { type: 'char', label: `Field ${i}` };
    section.children.push({ type: 'field', id: `n${i}`, field: `f${i}` });
  }
  return page;
}
const nodes = (page: Page) => (page.layout as { children: SectionNode[] }).children[0].children as FieldNode[];

describe('an edit on a big page', () => {
  it('keeps every field and part it did not touch as they were, the same objects', () => {
    const designer = createDesigner({ page: screen(20) });
    const before = designer.getPage();
    expect(designer.updateQuestion('n3', { label: 'Third' })).toBe(true);
    const after = designer.getPage();
    expect(after).not.toBe(before);
    expect(after.fields['f3']).toEqual({ type: 'char', label: 'Third' });
    expect(after.fields['f3']).not.toBe(before.fields['f3']);
    for (const name of Object.keys(before.fields).filter((n) => n !== 'f3')) expect(after.fields[name]).toBe(before.fields[name]);
    // Only a field's definition changed: the layout is the one before.
    expect(after.layout).toBe(before.layout);
  });

  it('keeps the other parts when one is added among them, and undo gives back the page before', () => {
    const designer = createDesigner({ page: screen(5) });
    const before = designer.getPage();
    const added = designer.addQuestion('short-answer', { after: 'n2' }) as string;
    const after = designer.getPage();
    expect(nodes(after).map((n) => n.id)).toEqual(['n1', 'n2', added, 'n3', 'n4', 'n5']);
    nodes(before).forEach((node) => expect(nodes(after)).toContain(node));
    designer.undo();
    expect(designer.getPage()).toBe(before);
  });

  it('works out whether the draft is published once for each page, however often the state is asked for', () => {
    const designer = createDesigner({ page: screen(20) });
    designer.updateQuestion('n1', { label: 'First' });
    designer.getState();
    const stringify = jest.spyOn(JSON, 'stringify');
    try {
      for (let i = 0; i < 10; i++) expect(designer.getState().unpublished).toBe(true);
      expect(stringify).not.toHaveBeenCalled();
    } finally {
      stringify.mockRestore();
    }
  });

  it('still says when the draft is the version published, and when it is not', async () => {
    const designer = createDesigner({ page: screen(2) });
    expect(designer.getState().unpublished).toBe(true);
    await designer.publish();
    expect(designer.getState().unpublished).toBe(false);
    designer.updateQuestion('n1', { label: 'First' });
    expect(designer.getState().unpublished).toBe(true);
    designer.undo();
    expect(designer.getState().unpublished).toBe(false);
  });

  it('works out the checks once for each page', () => {
    const designer = createDesigner({ page: screen(3) });
    designer.addQuestion('short-answer');
    const checks = designer.checks();
    expect(checks.length).toBeGreaterThan(0);
    expect(designer.checks()[0]).toBe(checks[0]);
    designer.select(null);
    expect(designer.checks()[0]).toBe(checks[0]);
    designer.updateQuestion('n1', { label: 'First' });
    expect(designer.checks()[0]).not.toBe(checks[0]);
    expect(designer.checks()).toEqual(checks);
  });
});
