import type { Field, FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { button, choose, field, mount, type } from './test-screen';

const fieldOf = (page: Page, id: string) => {
  const node = (page.layout as { children: SectionNode[] }).children.flatMap((s) => s.children as FieldNode[]).find((n) => n.id === id) as FieldNode;
  return page.fields[node.field] as Field & { relation?: string; currency?: string; fields?: Record<string, Field> };
};
const palette = (host: Element) => host.querySelector('.fd-palette') as HTMLElement;
const card = (host: Element, id: string) => host.querySelector(`.fd-canvas-field[data-node="${id}"]`) as HTMLElement;
const headers = (host: Element, id: string) => [...card(host, id).querySelectorAll('th')].map((th) => th.textContent?.trim()).filter(Boolean);

describe('screen editor — the kinds of field for a screen', () => {
  it('lists the palette in groups, and draws a table of lines with its columns', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Order') });
    const { host } = mount(designer);
    expect([...palette(host).querySelectorAll('.fd-palette-heading')].map((h) => h.textContent)).toEqual(['Basic', 'Records', 'More']);
    button(palette(host), 'Table of lines').click();
    const id = designer.getState().selected as string;
    expect(headers(host, id)).toEqual(['Description', 'Quantity']);
    // The kind picker offers the same groups.
    expect([...(field(host, 'Kind of field') as HTMLSelectElement).querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Basic', 'Records', 'More']);
    expect(field(host, 'Kind of field').value).toBe('lines');
  });

  it('points a link at its records, and gives an amount its currency', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Order') });
    const { host } = mount(designer);
    button(palette(host), 'Link to a record').click();
    const link = designer.getState().selected as string;
    expect(field(host, 'Links to').value).toBe('contact');
    expect(field(host, 'Currency')).toBeUndefined();
    type(field(host, 'Links to'), 'company');
    expect(fieldOf(designer.getPage(), link).relation).toBe('company');
    button(palette(host), 'Amount').click();
    const amount = designer.getState().selected as string;
    expect(field(host, 'Links to')).toBeUndefined();
    type(field(host, 'Currency'), 'eu');
    expect(fieldOf(designer.getPage(), amount).currency).toBe('USD');
    type(field(host, 'Currency'), 'eur');
    expect(fieldOf(designer.getPage(), amount).currency).toBe('EUR');
  });

  it('edits a table’s columns from the properties, and the card follows', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Order') });
    const { host } = mount(designer);
    button(palette(host), 'Table of lines').click();
    const lines = designer.getState().selected as string;
    const properties = host.querySelector('.fd-properties') as HTMLElement;
    button(properties, 'Add column').click();
    type(field(host, 'Column 3'), 'Unit price');
    choose(field(host, 'Kind of column 3'), 'number');
    type(field(host, 'Column 1'), 'Item');
    const columns = () => Object.values(fieldOf(designer.getPage(), lines).fields ?? {}).map((f) => `${f.label}:${f.type}`);
    expect(columns()).toEqual(['Item:char', 'Quantity:float', 'Unit price:float']);
    expect(headers(host, lines)).toEqual(['Item', 'Quantity', 'Unit price']);
    button(properties, 'Remove column Quantity').click();
    expect(columns()).toEqual(['Item:char', 'Unit price:float']);
    expect(button(properties, 'Remove column Item')).toBeTruthy();
    button(properties, 'Remove column Unit price').click();
    // The last column stays.
    expect(button(properties, 'Remove column Item')).toBeUndefined();
  });
});
