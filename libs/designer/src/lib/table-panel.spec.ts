import type { FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { button, choose, field, mount, openTab, type } from './test-editor';

/** A table's own rules, a field's tone and the widths it is hidden at, in the panel: each found by its name, edited as a person does. */
function screen(pick: string, locale?: 'ar') {
  const page = blankPage('screen', 'Transfer');
  page.fields = {
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'done', label: 'Done' }] },
    move_ids: {
      type: 'one2many',
      label: 'Operations',
      relation: 'stock.move',
      fields: { product: { type: 'char', label: 'Product' }, demand: { type: 'float', label: 'Demand' }, quantity: { type: 'float', label: 'Quantity' } },
    },
  } as Page['fields'];
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = [
    { type: 'field', id: 'f-state', field: 'state' },
    { type: 'field', id: 'f-moves', field: 'move_ids' },
  ];
  const designer = createDesigner({ page, ...(locale ? { locale } : {}) });
  designer.select(pick);
  const { host } = mount(designer, { mode: 'advanced' });
  const panel = () => host.querySelector('.fd-properties') as HTMLElement;
  const row = (name: string) => panel().querySelector(`[data-setting="${name}"]`) as HTMLElement;
  const node = (id: string) => (designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;
  return { designer, host, panel, row, node };
}

describe('a field’s tone, in the panel', () => {
  it('adds a tone with its condition and a bold, on the Rules tab', () => {
    const { host, row, node } = screen('f-state');
    openTab(host, 'Rules');
    expect(row('Tone').hidden).toBe(false);
    expect(row('Line rules').hidden).toBe(true);
    (button(row('Tone'), 'Add a tone') as HTMLButtonElement).click();
    choose(field(row('Tone'), 'Tone'), 'success');
    type(field(row('Tone'), 'When'), "state == 'done'");
    expect(node('f-state').tones).toEqual([{ tone: 'success', when: "state == 'done'" }]);
    type(field(row('Tone'), 'Bold when'), "state == 'done'");
    expect(node('f-state').bold).toBe("state == 'done'");
    (button(row('Tone'), 'Remove tone 1') as HTMLButtonElement).click();
    expect(node('f-state').tones).toBeUndefined();
  });

  it('hides a field on a phone, on the Layout tab', () => {
    const { host, row, node } = screen('f-state');
    openTab(host, 'Layout');
    (button(row('Hidden on'), 'Phone') as HTMLButtonElement).click();
    expect(node('f-state').hideOn).toEqual(['narrow']);
    expect(button(row('Hidden on'), 'Phone')?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('a column’s cells drawn by a widget, in the panel', () => {
  it('offers the widgets that suit the column, and none for one that has none', () => {
    const { host, row, node, designer } = screen('f-moves');
    openTab(host, 'Rules');
    choose(field(row('Line rules'), 'Column'), 'quantity');
    const shown = field(row('Line rules'), 'Shown as') as HTMLSelectElement;
    expect([...shown.options].map((o) => o.textContent)).toEqual(['As its kind shows it', 'Hours and minutes', 'Percentage', 'Progress']);
    choose(shown, 'duration');
    expect(node('f-moves').cells).toEqual({ quantity: { widget: 'duration' } });
    designer.undo();
    expect(node('f-moves').cells).toBeUndefined();
    choose(field(row('Line rules'), 'Column'), 'product');
    // Text has no widget of its own: the choice is not shown.
    expect(field(row('Line rules'), 'Shown as')).toBeUndefined();
  });

  it('refuses a widget that does not suit the column, saying why in Arabic', () => {
    const { designer } = screen('f-moves', 'ar');
    expect(designer.setCellLook('f-moves', 'product', { widget: 'duration' })).toBe(false);
    expect(designer.getState().issues[0]).toBe('لا يمكن عرض «Product» بشكل ساعات ودقائق: فهو لا يحمل ما يعرضه');
  });
});

describe('a table’s own rules, in the panel', () => {
  it('sets a column’s cells by their line, the column hidden by the record, a pill and a width', () => {
    const { host, row, node } = screen('f-moves');
    openTab(host, 'Rules');
    expect(row('Tone').hidden).toBe(true);
    choose(field(row('Line rules'), 'Column'), 'quantity');
    type(field(row('Line rules'), 'Read-only when'), "parent.state == 'done'");
    type(field(row('Line rules'), 'Column hidden when'), "state == 'draft'");
    const toned = row('Line rules').querySelector('.fd-table-column-rules') as HTMLElement;
    (button(toned, 'Add a tone') as HTMLButtonElement).click();
    type(field(toned, 'When'), 'quantity > demand');
    (field(toned, 'As a pill') as HTMLInputElement).click();
    const width = field(toned, 'Width, in characters') as HTMLInputElement;
    width.value = '14';
    width.dispatchEvent(new Event('change', { bubbles: true }));
    expect(node('f-moves').cells).toEqual({ quantity: { readonly: "parent.state == 'done'", hidden: "state == 'draft'", tones: [{ tone: 'danger', when: 'quantity > demand' }], badge: true, width: 14 } });
    // Another column shows its own, none.
    choose(field(row('Line rules'), 'Column'), 'product');
    expect((field(row('Line rules'), 'Read-only when') as HTMLInputElement).value).toBe('');
  });

  it('says what is wrong with a line’s condition under its box, and keeps the page as it was', () => {
    const { host, row, node } = screen('f-moves');
    openTab(host, 'Rules');
    type(field(row('Line rules'), 'Read-only when'), 'stat == 1');
    expect(row('Line rules').querySelector('.fd-formula-problem:not([hidden])')?.textContent).toContain('Unknown field “stat”');
    expect(node('f-moves').cells).toBeUndefined();
  });

  it('adds buttons on each line and for the lines chosen, and sets the table’s shape', () => {
    const { host, row, node } = screen('f-moves');
    openTab(host, 'Content');
    const onEach = row('Table buttons').querySelector('[data-place="rowButtons"]')!.parentElement as HTMLElement;
    (button(onEach, 'Add a button') as HTMLButtonElement).click();
    type(field(onEach, 'Words'), 'Serials');
    expect(node('f-moves').rowButtons).toMatchObject([{ type: 'button', label: 'Serials' }]);
    openTab(host, 'Layout');
    choose(field(row('Table'), 'A line opens'), 'record');
    choose(field(row('Table'), 'On a phone'), 'narrow');
    choose(field(row('Table'), 'Column widths'), 'content');
    (field(row('Table'), 'Copy a line') as HTMLInputElement).click();
    expect(node('f-moves')).toMatchObject({ lineOpens: 'record', cards: 'narrow', fit: 'content', options: { copy: true } });
  });

  it('speaks Arabic', () => {
    const { host, row } = screen('f-moves', 'ar');
    openTab(host, 'القواعد');
    expect(row('Line rules').querySelector('.fd-prop-name')?.textContent).toBe('قواعد البنود');
    expect(field(row('Line rules'), 'العمود')).toBeDefined();
  });
});

describe('no value twice in a column, as an answer rule', () => {
  it('is offered for a table, kept once its column is chosen, and said in words', async () => {
    const { host, row, node, panel } = screen('f-moves');
    openTab(host, 'Rules');
    (button(row('Answer rules'), 'Add a rule') as HTMLButtonElement).click();
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((i) => i.textContent === 'No value twice in a column');
    expect(item).toBeDefined();
    item!.click();
    expect(node('f-moves').validate).toBeUndefined();
    choose(field(row('Answer rules'), 'Column'), 'product');
    expect(node('f-moves').validate).toEqual([{ distinct: 'product' }]);
    expect(panel().querySelector('.fd-answer-rule-say')?.textContent).toBe('No Product twice');
  });
});
