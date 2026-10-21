import { validatePage, type Field, type ListNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { listProperties } from './list-properties';

/**
 * A list whose cells are changed in place (off unless asked), as the designer sets it: a box in the list's panel after
 * Import, what is changed where it stands; refused in words where no column of the list can be changed in a cell, and
 * what the page says of it beyond true (its fields, no row added) kept as the box is ticked again.
 */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Service', required: true },
  price: { type: 'monetary', label: 'Price', currency: 'EGP' },
  code: { type: 'char', label: 'Code', readonly: true },
  photo: { type: 'image', label: 'Photo' },
};
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;
const prices = (columns = ['name', 'price']) => {
  const designer = createDesigner({ page: blankPage('list', 'Prices'), model });
  for (const column of columns) designer.addColumn(column);
  return designer;
};

describe('a list’s cells changed in place, by the designer', () => {
  it('changes them in place when asked and stops, leaving the page as it was', () => {
    const designer = prices();
    expect(list(designer).editable).toBeUndefined();
    expect(designer.setListOptions({ editable: true })).toBe(true);
    expect(list(designer).editable).toBe(true);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ editable: false })).toBe(true);
    expect(list(designer).editable).toBeUndefined();
  });

  it('refuses a list no cell of which can change, in words; keeps what the page says beyond true', () => {
    // A blank list shows its records' names: those taken away, only columns no cell can change.
    const designer = prices(['code', 'photo']);
    designer.removeColumn('name');
    expect(list(designer).columns).toEqual(['code', 'photo']);
    expect(designer.setListOptions({ editable: true })).toBe(false);
    expect(designer.getState().issues).toEqual(['No column of this list can be changed in a cell: words, a number, money, yes or no, a date, a choice or a link people can change']);
    expect(list(designer).editable).toBeUndefined();
    const named = prices();
    named.setPageJson(JSON.stringify({ ...named.getPage(), layout: { ...list(named), editable: { fields: ['price'], add: false } } }));
    expect(list(named).editable).toEqual({ fields: ['price'], add: false });
    expect(named.setListOptions({ editable: true })).toBe(true);
    expect(list(named).editable).toEqual({ fields: ['price'], add: false });
  });

  it('the list’s panel: a box after Import — what is changed where it stands', () => {
    const designer = prices();
    const panel = listProperties(elementFactory(document), designer);
    document.body.replaceChildren(panel.element);
    const update = () => panel.update(designer.getPage());
    designer.subscribe(update);
    update();
    const parts = [...panel.element.querySelectorAll('[data-part]')].map((part) => part.getAttribute('data-part'));
    expect(parts.indexOf('editable')).toBe(parts.indexOf('import') + 1);
    const box = panel.element.querySelector<HTMLInputElement>('[aria-label="Change cells in place"]') as HTMLInputElement;
    expect(box.checked).toBe(false);
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(list(designer).editable).toBe(true);
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(list(designer).editable).toBeUndefined();
  });
});
