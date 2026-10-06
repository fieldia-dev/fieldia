import { blankPage, createDesigner } from './designer';
import { mount, openTab } from './test-editor';

/** Where help shows: under a field, behind a (?) by its label, or both — the page's way, and a field's own. */

function form() {
  const page = blankPage('screen', 'Contact');
  page.fields = { vat: { type: 'char', label: 'Tax ID', help: 'The number on the tax card, 9 digits.' }, name: { type: 'char', label: 'Name' } };
  (page.layout as { children: unknown[] }).children = [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-vat', field: 'vat' }, { type: 'field', id: 'f-name', field: 'name' }] }];
  return createDesigner({ page });
}
const pick = (host: Element, group: string, words: string) =>
  ([...host.querySelectorAll<HTMLButtonElement>(`[data-setting="${group}"] button`)].find((b) => b.textContent?.trim() === words) as HTMLButtonElement).click();

describe('where help shows', () => {
  it('is the page’s, on the Look tab, and one undo step', () => {
    const designer = form();
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Look');
    pick(host, 'Help', 'Behind a (?)');
    expect(designer.getPage().look?.helpShown).toBe('tooltip');
    designer.undo();
    expect(designer.getPage().look?.helpShown).toBeUndefined();
  });

  it('is a field’s own, offered only where the field has help', () => {
    const designer = form();
    designer.select('f-vat');
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Layout');
    pick(host, 'Help', 'Both');
    expect((designer.getPage().layout as { children: { children: { helpShown?: string }[] }[] }).children[0].children[0].helpShown).toBe('both');
    pick(host, 'Help', 'As page');
    expect('helpShown' in (designer.getPage().layout as { children: { children: object[] }[] }).children[0].children[0]).toBe(false);
    designer.select('f-name');
    expect((host.querySelector('[data-setting="Help"]') as HTMLElement).hidden).toBe(true);
  });
});
