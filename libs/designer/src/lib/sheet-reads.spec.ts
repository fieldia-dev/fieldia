import type { FieldNode, Page, SheetNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { button, choose, field, mount, openTab } from './test-editor';

/**
 * How a record sheet reads, set in the screen editor: read-only fields as
 * words, a choice as a coloured badge, stat buttons that format what they
 * show, links' pictures and colours, parts on one line, alerts with a field's
 * value and buttons, the statusbar's condition and steps, keys on buttons,
 * parts for editing or reading only, and several ribbons. Each command is
 * one undo step; what cannot be done is refused in words.
 */

function sheet(): Page {
  const page = blankPage('screen', 'Invoice');
  page.data = { kind: 'record', model: 'account.move' };
  page.fields = {
    name: { type: 'char', label: 'Number' },
    risk: { type: 'selection', label: 'Risk', options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }] },
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }] },
    total: { type: 'monetary', label: 'Total', currency: 'EGP' },
    hours: { type: 'float', label: 'Hours' },
    unit: { type: 'char', label: 'Unit' },
    partner: { type: 'many2one', label: 'Customer', relation: 'res.partner' },
    tags: { type: 'many2many', label: 'Tags', relation: 'tag' },
  };
  page.layout = {
    type: 'sheet',
    id: 'root',
    title: { field: 'name' },
    children: [{ type: 'section', id: 'main', children: [
      { type: 'field', id: 'f-risk', field: 'risk' },
      { type: 'field', id: 'f-state', field: 'state' },
      { type: 'field', id: 'f-total', field: 'total' },
      { type: 'field', id: 'f-hours', field: 'hours' },
      { type: 'field', id: 'f-unit', field: 'unit' },
      { type: 'field', id: 'f-partner', field: 'partner' },
      { type: 'field', id: 'f-tags', field: 'tags' },
    ] }],
  };
  return page;
}
const nodeOf = (page: Page, id: string) => ((page.layout as SheetNode).children[0] as { children: FieldNode[] }).children.find((n) => n.id === id) as FieldNode;
const pick = (host: Element, setting: string, words: string) =>
  ([...host.querySelectorAll<HTMLButtonElement>(`[data-setting="${setting}"] button`)].find((b) => b.textContent?.trim() === words) as HTMLButtonElement).click();

describe('read-only fields as words', () => {
  it('is the page’s, on the Look tab, and one undo step', () => {
    const designer = createDesigner({ page: sheet() });
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Look');
    pick(host, 'Read-only fields', 'As words');
    expect(designer.getPage().look?.readonlyShown).toBe('text');
    pick(host, 'Read-only fields', 'In boxes');
    expect(designer.getPage().look?.readonlyShown).toBe('box');
    designer.undo();
    designer.undo();
    expect(designer.getPage().look?.readonlyShown).toBeUndefined();
  });
});

describe('a choice as a coloured badge', () => {
  it('turns a dropdown into a badge, a colour for each option, and back', () => {
    const designer = createDesigner({ page: sheet() });
    designer.select('f-risk');
    const { host } = mount(designer, { mode: 'advanced' });
    (button(host, 'Coloured badge') as HTMLButtonElement).click();
    expect(nodeOf(designer.getPage(), 'f-risk').widget).toBe('badge');
    choose(field(host, 'Colour for High'), 'danger');
    choose(field(host, 'Colour for Low'), 'success');
    expect(nodeOf(designer.getPage(), 'f-risk').options).toEqual({ tones: { high: 'danger', low: 'success' } });
    choose(field(host, 'Colour for Low'), '');
    expect(nodeOf(designer.getPage(), 'f-risk').options).toEqual({ tones: { high: 'danger' } });
    designer.undo();
    expect(nodeOf(designer.getPage(), 'f-risk').options).toEqual({ tones: { high: 'danger', low: 'success' } });
    (button(host, 'Coloured badge') as HTMLButtonElement).click();
    expect(nodeOf(designer.getPage(), 'f-risk').widget).toBeUndefined();
    expect(nodeOf(designer.getPage(), 'f-risk').options).toBeUndefined();
  });

  it('refuses a badge on what is not one choice of a list', () => {
    const designer = createDesigner({ page: sheet() });
    expect(designer.setBadge('f-total', true)).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/one choice of a list/i);
  });
});
