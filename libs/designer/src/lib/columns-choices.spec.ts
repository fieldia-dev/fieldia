import { checkPage, type Field, type FieldNode, type Page, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { button, choose, field, mount, tile, type } from './test-editor';

/**
 * A table's choice column in the designer: a kind of its own in the columns editor, its choices under its row —
 * written here, or one of the app's lists, changing with the line's other columns or the record's fields.
 */

type Lines = Field & { fields: Record<string, Field> };
const linesOf = (page: Page, id: string): Lines => {
  const node = (page.layout as { children: SectionNode[] }).children.flatMap((s) => s.children as FieldNode[]).find((n) => n.id === id) as FieldNode;
  return page.fields[node.field] as Lines;
};
const LISTS = [
  { name: 'connection_tools', label: 'Tools of the connection' },
  { name: 'sizes', label: 'Sizes' },
];

afterEach(() => document.body.replaceChildren());

describe('a table’s choice column, by the designer’s commands', () => {
  function table() {
    const designer = createDesigner({ page: blankPage('screen', 'Agent'), lists: LISTS });
    const lines = designer.addQuestion('lines') as string;
    designer.updateQuestion(designer.addQuestion('short-answer') as string, { label: 'Workspace' });
    const page = () => designer.getPage();
    return { designer, lines, page, tool: () => linesOf(page(), lines).fields['tool'] };
  }

  it('makes a choice column with one option to write over, and keeps its kind as the others change', () => {
    const { designer, lines, tool, page } = table();
    expect(designer.setLineColumns(lines, [{ name: 'name', label: 'Connection', kind: 'text' }, { label: 'Tool', kind: 'choice' }])).toBe(true);
    expect(tool()).toEqual({ type: 'selection', label: 'Tool', options: [{ value: 'option_1', label: 'Option 1' }] });
    expect(designer.setLineColumns(lines, [{ name: 'name', label: 'Connection', kind: 'text' }, { name: 'tool', label: 'Tool used', kind: 'choice' }])).toBe(true);
    expect(tool()).toMatchObject({ type: 'selection', label: 'Tool used' });
    expect(checkPage(page()).ok).toBe(true);
  });

  it('writes its options by their words, keeping the values the lines hold', () => {
    const { designer, lines, tool } = table();
    designer.setLineColumns(lines, [{ name: 'name', label: 'Connection', kind: 'text' }, { label: 'Tool', kind: 'choice' }]);
    expect(designer.setColumnChoices(lines, 'tool', { labels: ['Send an email', 'Search mail'] })).toBe(true);
    expect((tool() as { options: unknown }).options).toEqual([
      { value: 'option_1', label: 'Send an email' },
      { value: 'option_2', label: 'Search mail' },
    ]);
    expect(designer.setColumnChoices(lines, 'tool', { labels: [] })).toBe(false);
    expect(designer.getState().issues).toEqual(['Tool needs an option']);
    expect(designer.setColumnChoices(lines, 'name', { labels: ['A'] })).toBe(false);
    expect(designer.getState().issues).toEqual(['Connection is not a choice column']);
  });

  it('takes them from the app’s list, changing with the line’s columns and the record’s fields, and writes them here again', () => {
    const { designer, lines, tool, page } = table();
    designer.setLineColumns(lines, [{ name: 'name', label: 'Connection', kind: 'text' }, { label: 'Tool', kind: 'choice' }]);
    const workspace = Object.keys(page().fields).find((name) => page().fields[name].label === 'Workspace') as string;
    expect(designer.setColumnChoices(lines, 'tool', { from: { list: 'connection_tools', dependsOn: ['name', `parent.${workspace}`, 'tool', 'parent.nope', 'gone'] } })).toBe(true);
    // Itself, and what is no column or field, left out.
    expect((tool() as { optionsFrom: unknown }).optionsFrom).toEqual({ list: 'connection_tools', dependsOn: ['name', `parent.${workspace}`] });
    expect(checkPage(page()).ok).toBe(true);
    expect(designer.setColumnChoices(lines, 'tool', { from: null })).toBe(true);
    expect((tool() as { optionsFrom?: unknown }).optionsFrom).toBeUndefined();
    expect((tool() as { options: unknown[] }).options).toHaveLength(1);
  });
});

describe('a table’s choice column, in the panel', () => {
  it('is a kind of column, its options typed under its row, or one of the app’s lists with what it changes with', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Agent'), lists: LISTS });
    designer.updateQuestion(designer.addQuestion('short-answer') as string, { label: 'Workspace' });
    designer.select(null);
    const { host } = mount(designer, { mode: 'advanced' });
    tile(host, 'kind:lines').click();
    const lines = designer.getState().selected as string;
    const properties = host.querySelector('.fd-properties') as HTMLElement;
    type(field(properties, 'Column 1'), 'Connection');
    choose(field(properties, 'Kind of column 2'), 'choice');
    type(field(properties, 'Column 2'), 'Tool');
    const tool = () => Object.values(linesOf(designer.getPage(), lines).fields).find((f) => f.label === 'Tool') as Field & { options: { label: string }[]; optionsFrom?: unknown };
    expect(tool().type).toBe('selection');
    // Its choices under its row: written here, at first.
    const group = [...properties.querySelectorAll('[role="radiogroup"]')].find((g) => g.getAttribute('aria-label') === 'Choices of Tool') as HTMLElement;
    expect(group).toBeDefined();
    expect((group.querySelector('input[value="written"]') as HTMLInputElement).checked).toBe(true);
    type(field(properties, 'Option 1'), 'Send an email');
    button(properties, 'Add option')?.click();
    type(field(properties, 'Option 2'), 'Search mail');
    expect(tool().options.map((o) => o.label)).toEqual(['Send an email', 'Search mail']);
    button(properties, 'Remove option Search mail')?.click();
    expect(tool().options.map((o) => o.label)).toEqual(['Send an email']);
    // From the app's list: the first the app names, then another, and what it changes with.
    (group.querySelector('input[value="list"]') as HTMLInputElement).click();
    expect(tool().optionsFrom).toEqual({ list: 'connection_tools' });
    expect(field(properties, 'Option 1')).toBeUndefined();
    const boxes = [...properties.querySelectorAll<HTMLInputElement>('.fd-column-choices .fd-q-depends-pick input')].filter((box) => !box.closest('[hidden]'));
    expect(boxes.map((box) => box.parentElement?.textContent)).toEqual(['Connection', 'Workspace (the record)']);
    boxes[0].click();
    expect(tool().optionsFrom).toEqual({ list: 'connection_tools', dependsOn: [Object.keys(linesOf(designer.getPage(), lines).fields)[0]] });
    choose(field(properties, 'List'), 'sizes');
    expect((tool().optionsFrom as { list: string }).list).toBe('sizes');
    // Written here again.
    (group.querySelector('input[value="written"]') as HTMLInputElement).click();
    expect(tool().optionsFrom).toBeUndefined();
    expect(field(properties, 'Option 1')?.value).toBe('Send an email');
  });

  it('says it in Arabic', () => {
    const designer = createDesigner({ page: blankPage('screen', 'وكيل', { locale: 'ar' }), lists: LISTS, locale: 'ar' });
    const lines = designer.addQuestion('lines') as string;
    designer.setLineColumns(lines, [{ name: 'name', label: 'الاتصال', kind: 'text' }, { label: 'الأداة', kind: 'choice' }]);
    designer.select(lines);
    const { host } = mount(designer, { mode: 'advanced' });
    const properties = host.querySelector('.fd-properties') as HTMLElement;
    expect([...(field(properties, 'نوع العمود 2')?.options ?? [])].map((o) => o.textContent)).toContain('اختيار');
    expect(field(properties, 'نوع العمود 2')?.value).toBe('choice');
    const group = [...properties.querySelectorAll('[role="radiogroup"]')].find((g) => g.getAttribute('aria-label')?.startsWith('اختيارات')) as HTMLElement;
    expect(group.textContent).toContain('مكتوبة هنا');
    expect(button(properties, 'إضافة خيار')).toBeDefined();
    (group.querySelector('input[value="list"]') as HTMLInputElement).click();
    expect([...properties.querySelectorAll('.fd-column-choices .fd-q-depends-pick')].filter((p) => !p.closest('[hidden]')).map((p) => p.textContent)).toContain('الاتصال');
    expect(properties.textContent).toContain('يقدّم التطبيق لكل بند اختياراته');
  });
});
