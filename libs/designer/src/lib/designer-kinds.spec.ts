import { validatePage, type Field, type FieldNode, type Page, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, kindOfField, QUESTION_KINDS, SCREEN_KINDS } from './designer';

const nodes = (page: Page) => (page.layout as { children: SectionNode[] }).children.flatMap((s) => s.children as FieldNode[]);
const fieldOf = (page: Page, id: string) => page.fields[(nodes(page).find((n) => n.id === id) as FieldNode).field];

describe('the kinds of field a screen offers', () => {
  it('adds every kind to a screen, each one valid, and knows each again from its field', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Everything') });
    for (const kind of [...QUESTION_KINDS, ...SCREEN_KINDS]) {
      const id = designer.addQuestion(kind.id) as string;
      expect(id).toBeTruthy();
      const node = nodes(designer.getPage()).find((n) => n.id === id) as FieldNode;
      expect(kindOfField(designer.getPage().fields[node.field], node)).toBe(kind.id);
    }
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('starts a link, a table of lines and an amount with what they need', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Order') });
    // Added first, then read: the page changes with each edit.
    const added = (kind: string) => {
      const id = designer.addQuestion(kind) as string;
      return fieldOf(designer.getPage(), id);
    };
    expect(added('link')).toMatchObject({ type: 'many2one', relation: 'contact' });
    expect(added('links')).toMatchObject({ type: 'many2many', relation: 'tag' });
    const lines = added('lines') as Field & { fields: Record<string, Field> };
    expect(lines).toMatchObject({ type: 'one2many', relation: 'line' });
    expect(Object.values(lines.fields).map((f) => `${f.label}:${f.type}`)).toEqual(['Description:char', 'Quantity:float']);
    expect(added('amount')).toMatchObject({ type: 'monetary', currency: 'USD' });
  });

  it('refuses a link or a table of lines in a survey, which has no records', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    expect(designer.addQuestion('link')).toBe(false);
    expect(designer.getState().issues).toEqual(['A survey has no records to link to or list: this kind is for app screens']);
  });

  it('says which model a link, links or lines point to, and refuses that for a text field', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Order') });
    const link = designer.addQuestion('link') as string;
    expect(designer.setRelation(link, 'company')).toBe(true);
    expect(fieldOf(designer.getPage(), link)).toMatchObject({ relation: 'company' });
    expect(designer.setRelation(link, '  ')).toBe(false);
    expect(designer.getState().issues).toEqual(['Say which records it points to, such as contact']);
    const text = designer.addQuestion('short-answer') as string;
    expect(designer.setRelation(text, 'company')).toBe(false);
    expect(designer.getState().issues).toEqual(['Only a link, links or a table of lines point to records']);
  });

  it('sets an amount’s currency, three capital letters', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Order') });
    const amount = designer.addQuestion('amount') as string;
    expect(designer.setCurrency(amount, 'egp')).toBe(true);
    expect(fieldOf(designer.getPage(), amount)).toMatchObject({ currency: 'EGP' });
    expect(designer.setCurrency(amount, 'EG')).toBe(false);
  });

  it('edits a table’s columns: renames, adds, changes a kind and takes one away, keeping the names stored records use', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Order') });
    const lines = designer.addQuestion('lines') as string;
    const columns = () => Object.entries((fieldOf(designer.getPage(), lines) as Field & { fields: Record<string, Field> }).fields).map(([name, f]) => `${name}=${f.label}:${f.type}`);
    expect(columns()).toEqual(['name=Description:char', 'quantity=Quantity:float']);
    expect(
      designer.setLineColumns(lines, [
        { name: 'name', label: 'Item', kind: 'text' },
        { name: 'quantity', label: 'Qty', kind: 'number' },
        { label: 'Unit price', kind: 'number' },
        { label: 'Delivered', kind: 'yes-no' },
      ])
    ).toBe(true);
    expect(columns()).toEqual(['name=Item:char', 'quantity=Qty:float', 'unit_price=Unit price:float', 'delivered=Delivered:boolean']);
    expect(designer.setLineColumns(lines, [{ name: 'name', label: 'Item', kind: 'text' }, { name: 'delivered', label: 'Delivered on', kind: 'date' }])).toBe(true);
    expect(columns()).toEqual(['name=Item:char', 'delivered=Delivered on:date']);
    expect(designer.setLineColumns(lines, [])).toBe(false);
    expect(designer.getState().issues).toEqual(['A table of lines needs a column']);
  });

  it('keeps a column of a kind it does not offer, and a whole number whole, when the others change', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Order') });
    const lines = designer.addQuestion('lines') as string;
    const page = designer.getPage();
    const def = fieldOf(page, lines) as Field & { fields: Record<string, Field> };
    def.fields['product_id'] = { type: 'many2one', label: 'Product', relation: 'product' };
    def.fields['quantity'] = { type: 'integer', label: 'Quantity' };
    const loaded = createDesigner({ page });
    expect(loaded.setLineColumns(lines, [{ name: 'product_id', label: 'Item', kind: 'other' }, { name: 'quantity', label: 'Qty', kind: 'number' }])).toBe(true);
    expect((fieldOf(loaded.getPage(), lines) as Field & { fields: Record<string, Field> }).fields).toEqual({
      product_id: { type: 'many2one', label: 'Item', relation: 'product' },
      quantity: { type: 'integer', label: 'Qty' },
    });
    expect(loaded.setLineColumns(lines, [{ label: 'New', kind: 'other' }])).toBe(false);
  });

  it('changes a short answer into a link, keeping its label', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Order') });
    const id = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(id, { label: 'Customer' });
    expect(designer.changeKind(id, 'link')).toBe(true);
    expect(fieldOf(designer.getPage(), id)).toMatchObject({ type: 'many2one', label: 'Customer', relation: 'contact' });
  });
});
