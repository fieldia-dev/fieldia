import { validatePage, type Field, type ListNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { listProperties } from './list-properties';

/**
 * A list's Export (on unless taken away) and its Edit of many rows at once
 * (off unless asked), as the designer sets them: two boxes in the list's
 * panel beside the box to choose a row, and the fields Edit offers, brought
 * from the model and kept on the page while Edit names them.
 */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Name' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'lead', label: 'Lead' }, { value: 'customer', label: 'Customer' }] },
  owner_id: { type: 'many2one', label: 'Owner', relation: 'res.users' },
  orders: { type: 'integer', label: 'Orders', readonly: true },
  tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
};
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;
const contacts = () => {
  const designer = createDesigner({ page: blankPage('list', 'Contacts'), model });
  designer.addColumn('name');
  designer.addColumn('state');
  return designer;
};

describe('a list’s Export and Edit, by the designer', () => {
  it('offers Export when asked and takes it away, leaving the page as it was: off unless asked, as Edit is', () => {
    const designer = contacts();
    expect(list(designer).export).toBeUndefined();
    expect(designer.setListOptions({ export: true })).toBe(true);
    expect(list(designer).export).toBe(true);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ export: false })).toBe(true);
    expect(list(designer).export).toBeUndefined();
  });

  it('offers Edit on its columns, or on the fields it names, brought from the model and kept while it names them', () => {
    const designer = contacts();
    expect(designer.setListOptions({ bulkEdit: true })).toBe(true);
    expect(list(designer).bulkEdit).toBe(true);
    expect(designer.setListOptions({ bulkEdit: ['state', 'owner_id'] })).toBe(true);
    expect(list(designer).bulkEdit).toEqual(['state', 'owner_id']);
    expect(designer.getPage().fields['owner_id']).toEqual(model['owner_id']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // Ticked again, it keeps the fields it names.
    expect(designer.setListOptions({ bulkEdit: true })).toBe(true);
    expect(list(designer).bulkEdit).toEqual(['state', 'owner_id']);
    // A field one value cannot set, refused in words.
    expect(designer.setListOptions({ bulkEdit: ['orders'] })).toBe(false);
    expect(designer.getState().issues).toEqual(['Edit cannot set Orders in many rows at once: it is read-only, worked out, or not a value one word, number, date, choice or link can give']);
    expect(designer.setListOptions({ bulkEdit: ['tag_ids'] })).toBe(false);
    // Taken away, the fields only it named leave the page.
    expect(designer.setListOptions({ bulkEdit: false })).toBe(true);
    expect(list(designer).bulkEdit).toBeUndefined();
    expect(designer.getPage().fields['owner_id']).toBeUndefined();
  });

  it('does not take the box to choose a row away while Edit needs it', () => {
    const designer = contacts();
    designer.setListOptions({ bulkEdit: true });
    expect(designer.setListOptions({ choose: false })).toBe(false);
    expect(designer.getState().issues.join(' ')).toContain('Edit changes the rows chosen');
    expect(list(designer).choose).toBeUndefined();
  });

  it('the list’s panel: a box for each, beside the box to choose a row', () => {
    const designer = contacts();
    const panel = listProperties(elementFactory(document), designer);
    document.body.replaceChildren(panel.element);
    const update = () => panel.update(designer.getPage());
    designer.subscribe(update);
    update();
    const control = (name: string) => panel.element.querySelector<HTMLInputElement>(`[aria-label="${name}"]`) as HTMLInputElement;
    const toggle = (box: HTMLInputElement) => {
      box.checked = !box.checked;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const exports = control('Export to Excel and CSV');
    const bulk = control('Edit many rows at once');
    expect([exports.checked, bulk.checked]).toEqual([false, false]);
    // In order: choose, sort, export, edit.
    expect([...panel.element.querySelectorAll('[data-part]')].map((part) => part.getAttribute('data-part')).slice(0, 4)).toEqual(['choose', 'sortable', 'export', 'bulk-edit']);
    toggle(exports);
    expect(list(designer).export).toBe(true);
    toggle(bulk);
    expect(list(designer).bulkEdit).toBe(true);
    expect([exports.checked, bulk.checked]).toEqual([true, true]);
    toggle(bulk);
    expect(list(designer).bulkEdit).toBeUndefined();
    // Refused, a box goes back to what the page says: the box to choose a row, while Edit needs it.
    toggle(bulk);
    toggle(control('A box to choose each row'));
    expect(control('A box to choose each row').checked).toBe(true);
  });
});
