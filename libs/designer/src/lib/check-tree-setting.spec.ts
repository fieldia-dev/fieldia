import { validatePage, type FieldNode, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mount } from './test-editor';

/** Links to several records of a tree drawn as a tree to tick, as the designer sets it: on, what it keeps, its search. */

afterEach(() => document.body.replaceChildren());

const nodeOf = (designer: ReturnType<typeof createDesigner>, id: string) => (designer.getPage().layout as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;

describe('a tree to tick in the designer', () => {
  it('draws links as a tree to tick, keeps a whole branch as itself, and leaves its search out', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Search alert') });
    const id = designer.addQuestion('links', { parent: 'section-1' }) as string;
    designer.select(id);
    const { host } = mount(designer, { mode: 'simple' });
    const card = host.querySelector('.fd-canvas-field.fd-editing') as HTMLElement;
    const on = card.querySelector('[role="switch"][aria-label="A tree to tick: a branch ticks all under it"]') as HTMLButtonElement;
    on.click();
    expect(nodeOf(designer, id).widget).toBe('tree');
    const keeps = card.querySelector('[aria-label="Keeps"]') as HTMLSelectElement;
    expect([...keeps.options].map((o) => o.textContent)).toEqual(['Every one ticked', 'A whole branch as itself', 'The last ones alone']);
    keeps.value = 'top';
    keeps.dispatchEvent(new Event('change', { bubbles: true }));
    (card.querySelector('[role="switch"][aria-label="A search over it"]') as HTMLButtonElement).click();
    expect(nodeOf(designer, id).options).toEqual({ keeps: 'top', search: false });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    on.click();
    expect(nodeOf(designer, id).widget).toBeUndefined();
    expect(nodeOf(designer, id).options).toBeUndefined();
  });

  it('refuses a tree to tick on a link to one record', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Lead') });
    const id = designer.addQuestion('link', { parent: 'section-1' }) as string;
    expect(designer.setCheckTree(id, true)).toBe(false);
  });
});
