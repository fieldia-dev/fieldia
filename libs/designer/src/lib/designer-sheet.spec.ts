import { validatePage, type FieldNode, type LayoutNode, type Page, type SectionNode, type SheetNode, type TabsNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';

const sheet = (page: Page) => page.layout as SheetNode;
const kinds = (nodes: LayoutNode[]) => nodes.map((n) => `${n.type}:${n.id}`);
const sectionFields = (section: SectionNode) => section.children.filter((n): n is FieldNode => n.type === 'field').map((n) => n.field);

describe('a record sheet in the designer', () => {
  it('starts with a name as its title and one section, and it validates', () => {
    const page = blankPage('sheet', 'Customer');
    expect(validatePage(page).ok).toBe(true);
    expect(sheet(page).title).toEqual({ field: 'name', placeholder: 'Name' });
    expect(page.fields['name']).toEqual({ type: 'char', label: 'Name', required: true });
    expect(kinds(sheet(page).children)).toEqual(['section:section-1']);
    expect(page.data).toEqual({ kind: 'record', model: 'customer' });
  });

  it('turns a screen of sections into a sheet and back, keeping its fields', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const field = designer.addQuestion('short-answer') as string;
    expect(designer.setLayoutKind('sheet')).toBe(true);
    expect(designer.getPage().layout.type).toBe('sheet');
    expect(sheet(designer.getPage()).children[0].type).toBe('section');
    expect(designer.setLayoutKind('sections')).toBe(true);
    expect(designer.getPage().layout.type).toBe('sections');
    expect((designer.getPage().layout as { children: SectionNode[] }).children[0].children.map((n) => n.id)).toEqual([field]);
    designer.undo();
    designer.undo();
    expect(designer.getPage().layout.type).toBe('sections');
  });

  it('makes a text field the title, out of its section, and puts it back first in the first section', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const company = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(company, { label: 'Company' });
    const date = designer.addQuestion('date') as string;
    designer.setLayoutKind('sheet');
    const name = (sheet(designer.getPage()).children[0] as SectionNode).children.find((n) => n.id === company) as FieldNode;
    expect(designer.setTitleField(company)).toBe(true);
    expect(sheet(designer.getPage()).title).toEqual({ field: name.field, placeholder: 'Company' });
    expect(sectionFields(sheet(designer.getPage()).children[0] as SectionNode)).not.toContain(name.field);
    expect(designer.getPage().fields[name.field]).toBeDefined();
    expect(designer.setTitleField(date)).toBe(false);
    expect(designer.getState().issues).toEqual(['A title is a text field']);
    expect(designer.setTitleField(null)).toBe(true);
    expect(sheet(designer.getPage()).title).toBeUndefined();
    expect(sectionFields(sheet(designer.getPage()).children[0] as SectionNode)[0]).toBe(name.field);
  });

  it('swaps titles: the field that was the title takes the new one’s place', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer') });
    const email = designer.addQuestion('short-answer', { parent: 'section-1' }) as string;
    const phone = designer.addQuestion('phone', { parent: 'section-1' }) as string;
    const emailField = ((sheet(designer.getPage()).children[0] as SectionNode).children[0] as FieldNode).field;
    expect(designer.setTitleField(email)).toBe(true);
    expect(sheet(designer.getPage()).title?.field).toBe(emailField);
    const section = sheet(designer.getPage()).children[0] as SectionNode;
    expect(sectionFields(section)).toEqual(['name', ((section.children[1] as FieldNode).field)]);
    expect(section.children[1].id).toBe(phone);
  });

  it('turns back into sections with its title as the first field, and refuses while it has tabs', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer') });
    designer.addTabs();
    expect(designer.setLayoutKind('sections')).toBe(false);
    expect(designer.getState().issues).toEqual(['Take the tabs out first: a screen of sections has none']);
    designer.undo();
    expect(designer.setLayoutKind('sections')).toBe(true);
    const first = (designer.getPage().layout as { children: SectionNode[] }).children[0];
    expect(sectionFields(first)).toEqual(['name']);
  });

  it('adds tabs, each with a section to put fields in, and fields into a tab’s section', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer') });
    const tabs = designer.addTabs() as string;
    const page = () => designer.getPage();
    const block = () => sheet(page()).children.find((n) => n.id === tabs) as TabsNode;
    expect(block().children.map((t) => t.label)).toEqual(['Tab 1']);
    expect(kinds(block().children[0].children)).toEqual(['section:section-2']);
    const notes = designer.addTab(tabs, 'Notes') as string;
    expect(block().children.map((t) => t.label)).toEqual(['Tab 1', 'Notes']);
    const extra = designer.addContainer('More', { parent: notes }) as string;
    expect(kinds(block().children[1].children)).toEqual(['section:section-3', `section:${extra}`]);
    const field = designer.addQuestion('paragraph', { parent: extra }) as string;
    expect((block().children[1].children[1] as SectionNode).children.map((n) => n.id)).toEqual([field]);
    expect(designer.renameContainer(notes, 'Internal notes')).toBe(true);
    expect(block().children[1].label).toBe('Internal notes');
    expect(validatePage(page()).ok).toBe(true);
  });

  it('takes a tab away with its fields, and the tabs with their last tab', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer') });
    const tabs = designer.addTabs() as string;
    const block = () => sheet(designer.getPage()).children.find((n) => n.id === tabs) as TabsNode | undefined;
    const first = block()!.children[0].id;
    const second = designer.addTab(tabs, 'Notes') as string;
    const inside = designer.addQuestion('paragraph', { parent: (block()!.children[1].children[0] as SectionNode).id }) as string;
    const field = (block()!.children[1].children[0] as SectionNode).children.find((n) => n.id === inside) as FieldNode;
    expect(designer.removeNode(second)).toBe(true);
    expect(designer.getPage().fields[field.field]).toBeUndefined();
    expect(block()!.children.map((t) => t.id)).toEqual([first]);
    expect(designer.removeNode(first)).toBe(true);
    expect(block()).toBeUndefined();
    expect(kinds(sheet(designer.getPage()).children)).toEqual(['section:section-1']);
    expect(designer.removeNode('section-1')).toBe(false);
    expect(designer.getState().issues).toEqual(['A page needs at least one step or section']);
  });

  it('moves a section and the tabs up and down the sheet', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer') });
    const tabs = designer.addTabs() as string;
    const second = designer.addContainer('Address') as string;
    expect(kinds(sheet(designer.getPage()).children)).toEqual(['section:section-1', `tabs:${tabs}`, `section:${second}`]);
    expect(designer.moveNode(second, -1)).toBe(true);
    expect(kinds(sheet(designer.getPage()).children)).toEqual(['section:section-1', `section:${second}`, `tabs:${tabs}`]);
    expect(designer.moveNode(tabs, -2)).toBe(true);
    expect(kinds(sheet(designer.getPage()).children)).toEqual([`tabs:${tabs}`, 'section:section-1', `section:${second}`]);
    expect(designer.moveNode(tabs, -1)).toBe(false);
  });
});
