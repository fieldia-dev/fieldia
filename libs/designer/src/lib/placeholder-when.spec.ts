import type { FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { button, field, mount, openTab, type } from './test-editor';

/** Words in a field's empty box chosen by a condition, set in the Placeholder row as a person does. */
function screen(locale?: 'ar') {
  const page = blankPage('screen', 'Contact');
  page.fields = { is_company: { type: 'boolean', label: 'Is a company' }, name: { type: 'char', label: 'Name' } } as Page['fields'];
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = [{ type: 'field', id: 'f-company', field: 'is_company' }, { type: 'field', id: 'f-name', field: 'name', placeholder: 'e.g. Brandom Freeman' }];
  const designer = createDesigner({ page, ...(locale ? { locale } : {}) });
  designer.select('f-name');
  const { host } = mount(designer, { mode: 'advanced' });
  const row = () => host.querySelector('[data-setting="Placeholder"]') as HTMLElement;
  const node = () => (designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children.find((n) => n.id === 'f-name') as FieldNode;
  return { designer, host, row, node };
}

describe('words in an empty box chosen by a condition, in the panel', () => {
  it('adds words with the condition that shows them, kept once both are there', () => {
    const { host, row, node, designer } = screen();
    openTab(host, 'Content');
    (button(row(), 'Add words for a condition') as HTMLButtonElement).click();
    type(field(row(), 'Words'), 'e.g. Lumber Inc');
    expect(node().placeholderWhen).toBeUndefined();
    type(field(row(), 'While'), 'is_company');
    expect(node().placeholderWhen).toEqual([{ when: 'is_company', text: 'e.g. Lumber Inc' }]);
    expect(designer.setPlaceholderWhen('f-name', [{ when: 'is_compny', text: 'x' }])).toBe(false);
    (button(row(), 'Remove words 1') as HTMLButtonElement).click();
    expect(node().placeholderWhen).toBeUndefined();
  });

  it('speaks Arabic', () => {
    const { host, row } = screen('ar');
    openTab(host, 'المحتوى');
    expect(button(row(), 'إضافة نص لشرط')).toBeDefined();
  });
});

describe('the field that takes the focus as the record opens, in the panel', () => {
  it('is ticked on the Content tab, and unticked takes it away', () => {
    const { host, node, designer } = screen();
    openTab(host, 'Content');
    const box = field(host.querySelector('[data-setting="Focused as the record opens"]') as HTMLElement, 'Focused as the record opens') as HTMLInputElement;
    box.click();
    expect(node().focus).toBe(true);
    box.click();
    expect(node().focus).toBeUndefined();
    designer.undo();
    expect(node().focus).toBe(true);
  });

  it('speaks Arabic', () => {
    const { host } = screen('ar');
    openTab(host, 'المحتوى');
    expect(host.querySelector('[data-setting="Focused as the record opens"] .fd-prop-name')?.textContent).toBe('يأخذ التركيز عند فتح السجل');
  });
});
