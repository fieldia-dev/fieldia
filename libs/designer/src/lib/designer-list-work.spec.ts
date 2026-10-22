import { validatePage, type Field, type ListNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { listProperties } from './list-properties';

/** A list's rows a person works in, as the designer sets them (w6-lists): what a row opens to in place. */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Order' },
  total: { type: 'monetary', label: 'Total', currency: 'EGP' },
  line_ids: {
    type: 'one2many',
    label: 'Order lines',
    relation: 'sale.order.line',
    sequenceField: 'sequence',
    fields: {
      sequence: { type: 'integer', label: 'Sequence' },
      product: { type: 'char', label: 'Product' },
      qty: { type: 'float', label: 'Quantity' },
      price: { type: 'monetary', label: 'Price', currency: 'EGP' },
      note: { type: 'html', label: 'Note' },
    },
  },
};
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;
const orders = () => {
  const designer = createDesigner({ page: blankPage('list', 'Orders'), model });
  designer.addColumn('name');
  designer.addColumn('total');
  return designer;
};

describe('a list’s rows a person works in, by the designer', () => {
  it('opens a row to a table of lines, its plain fields as columns, the field kept on the page', () => {
    const designer = orders();
    expect(designer.setListOptions({ detail: { lines: 'line_ids', columns: ['product', 'qty', 'price'] } })).toBe(true);
    expect(list(designer).detail).toEqual({ lines: 'line_ids', columns: ['product', 'qty', 'price'] });
    // Not a column, yet kept: the list opens to it.
    expect(designer.getPage().fields['line_ids']?.type).toBe('one2many');
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ detail: null })).toBe(true);
    expect(list(designer).detail).toBeUndefined();
    expect(designer.getPage().fields['line_ids']).toBeUndefined();
  });

  it('refuses what is no table of lines, and a column its lines do not have', () => {
    const designer = orders();
    expect(designer.setListOptions({ detail: { lines: 'total', columns: ['name'] } })).toBe(false);
    expect(designer.getState().issues[0]).toBe('A row opens to a table of lines of the page’s; Total is not one');
    expect(designer.setListOptions({ detail: { lines: 'line_ids', columns: ['colour'] } })).toBe(false);
    expect(designer.getState().issues[0]).toBe('Order lines has no field “colour” to show');
    expect(list(designer).detail).toBeUndefined();
  });

  it('offers the page’s tables of lines in the list’s panel, the first plain fields their columns', () => {
    const designer = orders();
    // A table of lines of the model, though no column shows it: the panel offers it.
    const panel = listProperties(elementFactory(document), designer);
    panel.update(designer.getPage());
    const opens = panel.element.querySelector('[data-part="detail"] select') as HTMLSelectElement;
    expect([...opens.options].map((option) => option.textContent)).toEqual(['Nothing: a press opens the record', 'Order lines']);
    expect(opens.value).toBe('');
    opens.value = 'line_ids';
    opens.dispatchEvent(new Event('change'));
    // Its order and its notes left out.
    expect(list(designer).detail).toEqual({ lines: 'line_ids', columns: ['product', 'qty', 'price'] });
  });
});

describe('rows ranked by hand, by the designer', () => {
  const queue = () => {
    const designer = createDesigner({ page: blankPage('list', 'Waiting room'), model: { name: { type: 'char', label: 'Patient' }, turn: { type: 'integer', label: 'Turn' }, seen: { type: 'date', label: 'Seen on' } } });
    designer.addColumn('name');
    designer.setListOptions({ sort: [{ field: 'seen' }] });
    return designer;
  };

  it('ranks the rows by a whole number, the list opening in its order, and lets it go', () => {
    const designer = queue();
    expect(designer.setListOptions({ sequenceField: 'turn' })).toBe(true);
    expect(list(designer).sequenceField).toBe('turn');
    expect(list(designer).sort).toEqual([{ field: 'turn' }, { field: 'seen' }]);
    expect(designer.getPage().fields['turn']?.type).toBe('integer');
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ sequenceField: null })).toBe(true);
    expect(list(designer).sequenceField).toBeUndefined();
  });

  it('refuses what is no whole number', () => {
    const designer = queue();
    expect(designer.setListOptions({ sequenceField: 'seen' })).toBe(false);
    expect(designer.getState().issues[0]).toBe('Rows are ranked by a whole number; Seen on is not one');
  });

  it('offers the whole numbers in the list’s panel', () => {
    const designer = queue();
    const panel = listProperties(elementFactory(document), designer);
    panel.update(designer.getPage());
    const ranks = panel.element.querySelector('[data-part="rank"] select') as HTMLSelectElement;
    expect([...ranks.options].map((option) => option.textContent)).toEqual(['Nothing: the list keeps its order', 'Turn']);
    ranks.value = 'turn';
    ranks.dispatchEvent(new Event('change'));
    expect(list(designer).sequenceField).toBe('turn');
  });
});

describe('rows loaded as the list is scrolled, by the designer', () => {
  it('asks for it from the list’s panel, and takes it away', () => {
    const designer = orders();
    const panel = listProperties(elementFactory(document), designer);
    panel.update(designer.getPage());
    const box = panel.element.querySelector('[data-part="endless"] input') as HTMLInputElement;
    expect(box.checked).toBe(false);
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(list(designer).endless).toBe(true);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ endless: false })).toBe(true);
    expect(list(designer).endless).toBeUndefined();
  });
});

describe('a tree loaded as it opens, by the designer', () => {
  const chart = () => {
    const designer = createDesigner({ page: { ...blankPage('list', 'Accounts'), data: { kind: 'record', model: 'account' } }, model: { name: { type: 'char', label: 'Account' }, parent_id: { type: 'many2one', label: 'Under', relation: 'account' } } });
    designer.addColumn('name');
    return designer;
  };

  it('loads a tree’s children as a parent opens, only once its rows nest under a parent, and lets it go with the parent', () => {
    const designer = chart();
    expect(designer.setListOptions({ loadChildren: true })).toBe(false);
    expect(designer.getState().issues[0]).toBe('Children load as a parent opens in a tree: choose the link the rows nest under first');
    expect(designer.setListOptions({ parentField: 'parent_id' })).toBe(true);
    const panel = listProperties(elementFactory(document), designer);
    panel.update(designer.getPage());
    const box = panel.element.querySelector('[data-part="load-children"] input') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(list(designer).loadChildren).toBe(true);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ parentField: null })).toBe(true);
    expect(list(designer).loadChildren).toBeUndefined();
  });
});
