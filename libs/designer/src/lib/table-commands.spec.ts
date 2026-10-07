import { createForm, validatePage, type FieldNode, type Page, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';

/**
 * A table's own rules as the designer edits them: one undo step each, the
 * page kept valid, and what cannot be refused in words — English or Arabic.
 */
function sheet(locale?: 'ar') {
  const page = blankPage('sheet', 'Transfer');
  page.fields = {
    ...page.fields,
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'done', label: 'Done' }] },
    note: { type: 'char', label: 'Note' },
    move_ids: {
      type: 'one2many',
      label: 'Operations',
      relation: 'stock.move',
      fields: { product: { type: 'char', label: 'Product' }, demand: { type: 'float', label: 'Demand' }, quantity: { type: 'float', label: 'Quantity' }, scrapped: { type: 'boolean', label: 'Scrapped' } },
    },
  } as Page['fields'];
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = [
    { type: 'field', id: 'f-state', field: 'state' },
    { type: 'field', id: 'f-note', field: 'note' },
    { type: 'field', id: 'f-moves', field: 'move_ids' },
  ];
  const designer = createDesigner({ page, ...(locale ? { locale } : {}) });
  const node = (id: string) => (designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;
  return { designer, node };
}

describe('a column’s cells by their line', () => {
  it('sets each rule, one undo step each, and takes them away again', () => {
    const { designer, node } = sheet();
    expect(designer.setCellRule('f-moves', 'quantity', 'readonly', "parent.state == 'done'")).toBe(true);
    expect(designer.setCellRule('f-moves', 'quantity', 'hidden', "state == 'draft'")).toBe(true);
    expect(designer.setCellTones('f-moves', 'quantity', [{ tone: 'danger', when: 'quantity > demand' }])).toBe(true);
    expect(designer.setCellLook('f-moves', 'quantity', { badge: true, width: 12 })).toBe(true);
    expect(node('f-moves').cells).toEqual({ quantity: { readonly: "parent.state == 'done'", hidden: "state == 'draft'", tones: [{ tone: 'danger', when: 'quantity > demand' }], badge: true, width: 12 } });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    designer.undo();
    expect(node('f-moves').cells?.['quantity'].badge).toBeUndefined();
    for (const rule of ['readonly', 'hidden'] as const) designer.setCellRule('f-moves', 'quantity', rule, null);
    designer.setCellTones('f-moves', 'quantity', null);
    expect(node('f-moves').cells).toBeUndefined();
  });

  it('refuses a condition that does not read on its line, in words, and a column the table does not have', () => {
    const { designer, node } = sheet();
    expect(designer.setCellRule('f-moves', 'quantity', 'invisible', 'state == 1')).toBe(false);
    expect(designer.getState().issues).toEqual(['When: Unknown field “state” at 1–5']);
    // Read on the record, the column's hiding knows the record's fields.
    expect(designer.setCellRule('f-moves', 'quantity', 'hidden', "state == 'draft'")).toBe(true);
    expect(designer.setCellRule('f-moves', 'nothing', 'readonly', 'True')).toBe(false);
    expect(designer.getState().issues).toEqual(['“nothing” is not a column of this table']);
    expect(designer.setCellLook('f-moves', 'quantity', { width: 500 })).toBe(false);
    expect(designer.setCellRule('f-note', 'x', 'readonly', 'True')).toBe(false);
    expect(designer.getState().issues).toEqual(['Only a table of lines has rules for its lines, buttons and cards']);
    expect(node('f-moves').cells).toEqual({ quantity: { hidden: "state == 'draft'" } });
  });

  it('says so in Arabic', () => {
    const { designer } = sheet('ar');
    expect(designer.setCellRule('f-note', 'x', 'readonly', 'True')).toBe(false);
    expect(designer.getState().issues).toEqual(['قواعد البنود والأزرار والبطاقات لجدول البنود وحده']);
  });
});

describe('the lines’ tones, a field’s tone, and the widths a part is hidden at', () => {
  it('tones and bolds the lines and a field, and the form draws them', () => {
    const { designer, node } = sheet();
    designer.setRowTones('f-moves', [{ tone: 'muted', when: 'scrapped' }]);
    designer.setRowBold('f-moves', 'quantity > demand');
    designer.setFieldTones('f-state', [{ tone: 'success', when: "state == 'done'" }]);
    designer.setFieldBold('f-state', "state == 'done'");
    designer.setHideOn('f-note', ['wide', 'narrow']);
    expect(node('f-moves')).toMatchObject({ rowTones: [{ tone: 'muted', when: 'scrapped' }], rowBold: 'quantity > demand' });
    expect(node('f-note').hideOn).toEqual(['narrow', 'wide']);
    const form = createForm({ page: designer.getPage(), values: { state: 'done', move_ids: [{ key: 'a', values: { product: 'x', demand: 1, quantity: 2, scrapped: true } }] } as never });
    expect(form.fieldTone('f-state')).toEqual({ tone: 'success', bold: true });
    expect(form.lineState('f-moves', 'a')).toMatchObject({ tone: 'muted', bold: true });
    designer.setHideOn('f-note', null);
    expect(node('f-note').hideOn).toBeUndefined();
    expect(designer.setFieldTones('f-state', [{ tone: 'danger', when: 'nope > 1' }])).toBe(false);
  });
});

describe('a table’s buttons and its shape', () => {
  it('adds buttons in each place, keeps a button’s id and steps, and takes them away', () => {
    const { designer, node } = sheet();
    designer.setTableButtons('f-moves', 'rowButtons', [{ label: 'Serials', action: 'action_assign_serial', invisible: 'scrapped' }]);
    designer.setTableButtons('f-moves', 'selectedButtons', [{ label: 'Mark done' }]);
    designer.setTableButtons('f-moves', 'controlButtons', [{ label: 'Catalog', action: 'action_catalog', invisible: "state == 'done'" }]);
    const row = node('f-moves').rowButtons![0];
    expect(row).toMatchObject({ type: 'button', label: 'Serials', action: 'action_assign_serial', invisible: 'scrapped' });
    expect(node('f-moves').selectedButtons![0]).toMatchObject({ label: 'Mark done', action: 'action_mark_done' });
    designer.setTableButtons('f-moves', 'rowButtons', [{ id: row.id, label: 'Assign serials', action: 'action_assign_serial' }]);
    expect(node('f-moves').rowButtons).toEqual([{ type: 'button', id: row.id, label: 'Assign serials', action: 'action_assign_serial' }]);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // A row button's condition reads its line; one for chosen lines, the record.
    expect(designer.setTableButtons('f-moves', 'selectedButtons', [{ label: 'Done', invisible: 'scrapped' }])).toBe(false);
    expect(designer.setTableButtons('f-moves', 'controlButtons', [{ label: '  ' }])).toBe(false);
    designer.setTableButtons('f-moves', 'rowButtons', null);
    expect(node('f-moves').rowButtons).toBeUndefined();
  });

  it('opens a line’s own page, shows cards on a phone, fits its columns, and copies a line', () => {
    const { designer, node } = sheet();
    designer.setTableShape('f-moves', { lineOpens: 'record', cards: 'narrow', fit: 'content', copy: true });
    expect(node('f-moves')).toMatchObject({ lineOpens: 'record', cards: 'narrow', fit: 'content', options: { copy: true } });
    designer.setTableShape('f-moves', { lineOpens: null, cards: null, fit: null, copy: null });
    expect(node('f-moves').lineOpens).toBeUndefined();
    expect(node('f-moves').options).toBeUndefined();
  });
});
