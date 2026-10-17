import { validatePage, type Field, type ListNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { listProperties } from './list-properties';

/**
 * A list's Import (off unless asked), as the designer sets it: a box in the
 * list's panel after Export and Edit, and the fields Import offers, brought
 * from the model and kept on the page while Import names them; a field no
 * file's cell can fill refused in words.
 */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Name', required: true },
  email: { type: 'char', label: 'Email' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'lead', label: 'Lead' }, { value: 'customer', label: 'Customer' }] },
  owner_id: { type: 'many2one', label: 'Owner', relation: 'res.users' },
  orders: { type: 'integer', label: 'Orders', readonly: true },
  photo: { type: 'image', label: 'Photo' },
};
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;
const contacts = () => {
  const designer = createDesigner({ page: blankPage('list', 'Contacts'), model });
  designer.addColumn('name');
  designer.addColumn('state');
  return designer;
};

describe('a list’s Import, by the designer', () => {
  it('offers Import when asked and takes it away, leaving the page as it was', () => {
    const designer = contacts();
    expect(list(designer).import).toBeUndefined();
    expect(designer.setListOptions({ import: true })).toBe(true);
    expect(list(designer).import).toBe(true);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ import: false })).toBe(true);
    expect(list(designer).import).toBeUndefined();
  });

  it('offers the fields it names, brought from the model and kept while it names them; refuses one no cell can fill', () => {
    const designer = contacts();
    expect(designer.setListOptions({ import: ['name', 'email', 'owner_id'] })).toBe(true);
    expect(list(designer).import).toEqual(['name', 'email', 'owner_id']);
    expect(designer.getPage().fields['email']).toEqual(model['email']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // Ticked again, it keeps the fields it names.
    expect(designer.setListOptions({ import: true })).toBe(true);
    expect(list(designer).import).toEqual(['name', 'email', 'owner_id']);
    expect(designer.setListOptions({ import: ['photo'] })).toBe(false);
    expect(designer.getState().issues).toEqual(['Import cannot fill Photo from a file: it is read-only, worked out, or not a value a cell’s words, number, date, choice or link can give']);
    expect(designer.setListOptions({ import: ['orders'] })).toBe(false);
    // Taken away, the fields only it named leave the page.
    expect(designer.setListOptions({ import: false })).toBe(true);
    expect(designer.getPage().fields['email']).toBeUndefined();
    expect(designer.getPage().fields['owner_id']).toBeUndefined();
  });

  it('the list’s panel: a box after Export, Edit and Print — what goes out, then what comes in', () => {
    const designer = contacts();
    const panel = listProperties(elementFactory(document), designer);
    document.body.replaceChildren(panel.element);
    const update = () => panel.update(designer.getPage());
    designer.subscribe(update);
    update();
    const imports = panel.element.querySelector<HTMLInputElement>('[aria-label="Import from Excel and CSV"]') as HTMLInputElement;
    expect(imports.checked).toBe(false);
    expect([...panel.element.querySelectorAll('[data-part]')].map((part) => part.getAttribute('data-part')).slice(2, 6)).toEqual(['export', 'bulk-edit', 'print', 'import']);
    imports.checked = true;
    imports.dispatchEvent(new Event('change', { bubbles: true }));
    expect(list(designer).import).toBe(true);
    expect(imports.checked).toBe(true);
    imports.checked = false;
    imports.dispatchEvent(new Event('change', { bubbles: true }));
    expect(list(designer).import).toBeUndefined();
  });
});
