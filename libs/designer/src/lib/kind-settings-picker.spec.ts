import type { Field, FieldNode, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { choose, mount } from './test-editor';

/**
 * The work tracker's pickers, set in the picked field itself: a link drawn as
 * a path in a tree with its separator, suggestions and tree; tags added from
 * a button; a dropdown in Fieldia's own list; a state's list with its dots or
 * a tick alone, and each state in a colour of its own. In Arabic too.
 */

const nodes = (designer: ReturnType<typeof createDesigner>) => (designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children as FieldNode[];
const nodeOf = (designer: ReturnType<typeof createDesigner>, id: string) => nodes(designer).find((n) => n.id === id) as FieldNode;
const change = (input: HTMLInputElement | null | undefined, value: string) => {
  if (!input) throw new Error('No box to type in');
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
};
const inline = (host: Element, name: string) => host.querySelector(`.fd-canvas-field.fd-editing [aria-label="${name}"]`) as HTMLInputElement & HTMLSelectElement;

function screenWith(kind: string, locale?: 'ar', model?: Record<string, Field>) {
  const designer = createDesigner({ page: blankPage('screen', 'Bug', locale ? { locale } : {}), model, ...(locale ? { locale } : {}) });
  const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
  const { host } = mount(designer);
  return { designer, id, host };
}

describe('the pickers’ settings in the picked field', () => {
  it('draws a link as a path in a tree, with what joins its names, how many it suggests and its tree', () => {
    const { designer, id, host } = screenWith('link');
    const path = inline(host, 'Path in a tree');
    expect(path.getAttribute('aria-checked')).toBe('false');
    expect(inline(host, 'Names joined by')?.closest('[hidden]')).not.toBeNull();
    path.click();
    expect(nodeOf(designer, id).widget).toBe('path');
    expect(inline(host, 'Path in a tree')?.getAttribute('aria-checked')).toBe('true');
    choose(inline(host, 'Names joined by') ?? undefined, '/');
    change(inline(host, 'Suggestions'), '3');
    inline(host, 'The tree under them').click();
    expect(nodeOf(designer, id)).toMatchObject({ widget: 'path', options: { separator: '/', suggestions: 3, tree: false } });
    // The usual ones are kept as nothing.
    choose(inline(host, 'Names joined by') ?? undefined, '\\');
    change(inline(host, 'Suggestions'), '5');
    inline(host, 'The tree under them').click();
    expect(nodeOf(designer, id).options).toBeUndefined();
    // Off again: a link as before, its path's settings gone with it.
    designer.setWidgetOptions(id, { separator: '/' });
    inline(host, 'Path in a tree').click();
    expect(nodeOf(designer, id).widget).toBeUndefined();
    expect(nodeOf(designer, id).options).toBeUndefined();
    expect(designer.getState().issues).toEqual([]);
  });

  it('adds tags from a button, on a link to several records and on keywords', () => {
    for (const kind of ['links', 'keywords']) {
      const { designer, id, host } = screenWith(kind);
      inline(host, 'Added from a button').click();
      expect(nodeOf(designer, id).options).toMatchObject({ adder: 'button' });
      expect(host.querySelector('.fd-canvas-field.fd-editing .fd-tags-adder')).not.toBeNull();
      inline(host, 'Added from a button').click();
      expect(nodeOf(designer, id).options?.['adder']).toBeUndefined();
    }
  });

  it('draws a dropdown in Fieldia’s own list', () => {
    const { designer, id, host } = screenWith('dropdown');
    inline(host, 'Fieldia’s own list').click();
    expect(nodeOf(designer, id).options).toMatchObject({ list: 'own' });
    inline(host, 'Fieldia’s own list').click();
    expect(nodeOf(designer, id).options?.['list']).toBeUndefined();
    expect(designer.getState().issues).toEqual([]);
  });

  it('lists a state’s values with a tick alone, and gives each its own colour, taken back by ×', () => {
    const { designer, id, host } = screenWith('state-dot');
    const dots = inline(host, 'Dots in its list');
    expect(dots.getAttribute('aria-checked')).toBe('true');
    dots.click();
    expect(nodeOf(designer, id).options).toMatchObject({ listDots: false });
    const colour = inline(host, 'Colour for In progress');
    colour.value = '#007ACC';
    colour.dispatchEvent(new Event('change', { bubbles: true }));
    expect(nodeOf(designer, id).options).toMatchObject({ colours: { normal: '#007acc' } });
    const clear = inline(host, 'No colour of its own for In progress');
    expect(clear.hidden).toBe(false);
    clear.click();
    expect(nodeOf(designer, id).options?.['colours']).toBeUndefined();
    // A colour that is not #rrggbb is refused, with why.
    expect(designer.setDotColour(id, 'normal', 'blue')).toBe(false);
    expect(designer.getState().issues).toEqual(['A colour is written as #rrggbb, such as #007acc']);
  });

  it('refuses a path on what is not a link, and colours on what is not a state’s dot', () => {
    const { designer, id } = screenWith('short-answer');
    expect(designer.setPathPicker(id, true)).toBe(false);
    expect(designer.setDotColour(id, 'a', '#000000')).toBe(false);
  });

  it('says it in Arabic', () => {
    const { host } = screenWith('link', 'ar');
    expect(inline(host, 'مسار في شجرة')).not.toBeNull();
  });
});
