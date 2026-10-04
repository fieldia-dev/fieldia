import type { Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';
import { mount } from './test-editor';

/**
 * A group that folds by its title, as the format's `collapsible` and
 * `collapsed` have it: on a titled group's Content tab, in Simple too —
 * No, Starts open or Starts folded — refused for a group with no title, which
 * has nothing to fold by; marked on the canvas, and said for Publish.
 */

function screen() {
  const page = blankPage('screen', 'Supplier');
  const designer = createDesigner({ page });
  designer.addQuestion('short-answer', { parent: 'section-1' });
  const untitled = designer.addContainer('') as string;
  return { designer, titled: 'section-1', untitled, section: (id: string) => (designer.getPage().layout as unknown as { children: SectionNode[] }).children.find((s) => s.id === id) as SectionNode };
}

describe('a folding group, in the store', () => {
  it('folds starting open or starting folded, or not at all, each one undo step', () => {
    const { designer, titled, section } = screen();
    expect(designer.setFold(titled, 'open')).toBe(true);
    expect(section(titled)).toMatchObject({ collapsible: true });
    expect(section(titled).collapsed).toBeUndefined();
    expect(designer.setFold(titled, 'folded')).toBe(true);
    expect(section(titled)).toMatchObject({ collapsible: true, collapsed: true });
    designer.undo();
    expect(section(titled).collapsed).toBeUndefined();
    expect(designer.setFold(titled, 'no')).toBe(true);
    expect(section(titled).collapsible).toBeUndefined();
    expect(section(titled).collapsed).toBeUndefined();
  });

  it('is refused for a group with no title, which it folds by', () => {
    const { designer, untitled } = screen();
    expect(designer.setFold(untitled, 'open')).toBe(false);
    expect(designer.getState().issues).toEqual(['A group folds by its title: give it a title first']);
    // Taking it back is never refused.
    expect(designer.setFold(untitled, 'no')).toBe(true);
  });

  it('keeps the title of a group that folds, saying why', () => {
    const { designer, titled, section } = screen();
    designer.setFold(titled, 'open');
    expect(designer.renameContainer(titled, ' ')).toBe(false);
    expect(designer.getState().issues).toEqual(['“Section 1” folds by its title: set Folds to No to take the title away']);
    expect(section(titled).title).toBe('Section 1');
  });

  it('is said for Publish', () => {
    const { designer, titled } = screen();
    let before: Page = designer.getPage();
    designer.setFold(titled, 'open');
    expect(pageChanges(before, designer.getPage())).toEqual(['“Section 1”: folds by its title, starting open']);
    before = designer.getPage();
    designer.setFold(titled, 'folded');
    expect(pageChanges(before, designer.getPage())).toEqual(['“Section 1”: folds by its title, starting folded']);
    before = designer.getPage();
    designer.setFold(titled, 'no');
    expect(pageChanges(before, designer.getPage())).toEqual(['“Section 1”: no longer folds']);
  });
});

describe('a folding group, in the panel and on the canvas', () => {
  function editor(mode: 'simple' | 'advanced', pick: 'titled' | 'untitled' = 'titled') {
    const made = screen();
    const { host } = mount(made.designer, { mode });
    made.designer.select(made[pick]);
    const row = () => host.querySelector('.fd-properties [data-setting="Folds"]') as HTMLElement | null;
    const choices = () => [...(row()?.querySelectorAll<HTMLButtonElement>('[role="group"] button') ?? [])].filter((b) => !b.closest('[hidden]'));
    const pressed = () => choices().filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
    const press = (words: string) => (choices().find((b) => b.textContent === words) as HTMLButtonElement).click();
    const mark = (id: string) => host.querySelector(`.fd-canvas-section[data-node="${id}"] .fd-canvas-fold`) as HTMLElement | null;
    return { ...made, host, row, choices, pressed, press, mark };
  }

  it('is on a titled group’s Content tab, in Simple too, and marked on the canvas', () => {
    const { designer, titled, row, choices, pressed, press, mark, section } = editor('simple');
    expect(row()?.dataset['tab']).toBe('content');
    expect(choices().map((b) => b.textContent)).toEqual(['No', 'Starts open', 'Starts folded']);
    expect(pressed()).toEqual(['No']);
    expect(mark(titled)?.hidden).toBe(true);
    press('Starts folded');
    expect(section(titled)).toMatchObject({ collapsible: true, collapsed: true });
    expect(pressed()).toEqual(['Starts folded']);
    expect(mark(titled)?.hidden).toBe(false);
    expect(mark(titled)?.getAttribute('aria-label')).toBe('Folds, starting folded');
    press('Starts open');
    expect(mark(titled)?.getAttribute('aria-label')).toBe('Folds, starting open');
    press('No');
    expect(mark(titled)?.hidden).toBe(true);
    expect(designer.getPage()).toBeDefined();
  });

  it('says why an untitled group cannot fold, in place of the choices', () => {
    const { designer, untitled, row, choices } = editor('advanced', 'untitled');
    expect(choices()).toEqual([]);
    expect(row()?.querySelector('.fd-fold-why')?.textContent).toBe('A group folds by its title. Give it a title to let it fold.');
    designer.renameContainer(untitled, 'Bank');
    expect(choices().map((b) => b.textContent)).toEqual(['No', 'Starts open', 'Starts folded']);
    expect((row()?.querySelector('.fd-fold-why') as HTMLElement).hidden).toBe(true);
  });
});
