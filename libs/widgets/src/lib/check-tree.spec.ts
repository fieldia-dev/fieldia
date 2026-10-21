import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page, type RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/**
 * A checkbox tree (`"widget": "tree"` on a many2many): several areas picked from a tree, a branch ticking all under it,
 * part-ticked while some are; what the field keeps — every one ticked, a whole branch as itself, the last ones alone;
 * the search over it, the keys of a tree, and a value the tree does not show kept as it is.
 */

const path = (...names: string[]) => names;
const AREAS = {
  1: { name: 'Cairo', path: path('Cairo') },
  2: { name: 'Nasr City', path: path('Cairo', 'Nasr City') },
  3: { name: 'District 7', path: path('Cairo', 'Nasr City', 'District 7') },
  4: { name: 'District 8', path: path('Cairo', 'Nasr City', 'District 8') },
  5: { name: 'New Cairo', path: path('Cairo', 'New Cairo') },
  6: { name: 'Fifth Settlement', path: path('Cairo', 'New Cairo', 'Fifth Settlement') },
  7: { name: 'Rehab', path: path('Cairo', 'New Cairo', 'Rehab') },
  8: { name: 'Madinaty', path: path('Cairo', 'New Cairo', 'Madinaty') },
  9: { name: 'Sheikh Zayed', path: path('Giza', 'Sheikh Zayed') },
};

async function mount(options: Record<string, string | boolean> = {}, value: RelatedRecord[] = []) {
  const page = {
    fieldia: '0.1',
    id: 'alert',
    data: { kind: 'responses' },
    fields: { areas: { type: 'many2many', label: 'Areas wanted', relation: 'area' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'areas', widget: 'tree', options }] },
  } as unknown as Page;
  const dataSource = createMemoryDataSource({ records: { area: AREAS }, shows: { area: { path: 'path' } } });
  const form = createForm({ page, dataSource, values: { areas: value } });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'areas', field: page.fields['areas'] as Field, node, id: 'fd-n', document, labels: WIDGET_LABELS.en });
  const host = document.createElement('div');
  host.append(widget.element);
  document.body.replaceChildren(host);
  const refresh = () => widget.update({ value: form.getState().values['areas'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const row = (name: string) => [...host.querySelectorAll<HTMLElement>('[role=treeitem]')].find((item) => item.querySelector('.fd-tree-name')?.textContent === name) as HTMLElement;
  const names = () => [...host.querySelectorAll('[role=treeitem] .fd-tree-name')].map((item) => item.textContent);
  const held = () => ((form.getState().values['areas'] as RelatedRecord[] | null) ?? []).map((record) => record.label);
  const key = (target: Element, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  return { form, host, row, names, held, key };
}

describe('a checkbox tree', () => {
  it('draws the tree folded, a branch opened by its twist, each row a box to tick', async () => {
    const { names, row, host } = await mount();
    expect(names()).toEqual(['Cairo', 'Giza']);
    expect(host.querySelector('[role=tree]')?.getAttribute('aria-multiselectable')).toBe('true');
    (row('Cairo').querySelector('.fd-tree-twist') as HTMLElement).click();
    expect(names()).toEqual(['Cairo', 'Nasr City', 'New Cairo', 'Giza']);
    expect(row('Cairo').getAttribute('aria-expanded')).toBe('true');
    expect(row('Nasr City').getAttribute('aria-level')).toBe('2');
  });

  it('ticks all under a branch, part-ticks its parent, and keeps every one ticked', async () => {
    const { row, held } = await mount();
    (row('Cairo').querySelector('.fd-tree-twist') as HTMLElement).click();
    row('Nasr City').click();
    expect(held()).toEqual(['Nasr City', 'District 7', 'District 8']);
    expect(row('Nasr City').getAttribute('aria-checked')).toBe('true');
    expect(row('Cairo').getAttribute('aria-checked')).toBe('mixed');
    (row('New Cairo').querySelector('.fd-tree-twist') as HTMLElement).click();
    row('Rehab').click();
    expect(held()).toEqual(['Nasr City', 'District 7', 'District 8', 'Rehab']);
    expect(row('New Cairo').getAttribute('aria-checked')).toBe('mixed');
    // Unticking a part-ticked branch's last part.
    row('Rehab').click();
    expect(row('New Cairo').getAttribute('aria-checked')).toBe('false');
  });

  it('keeps a whole branch as itself where it says “top”, and the last ones alone where it says “leaves”', async () => {
    const top = await mount({ keeps: 'top' });
    (top.row('Cairo').querySelector('.fd-tree-twist') as HTMLElement).click();
    top.row('Nasr City').click();
    (top.row('New Cairo').querySelector('.fd-tree-twist') as HTMLElement).click();
    top.row('Rehab').click();
    top.row('Madinaty').click();
    expect(top.held()).toEqual(['Nasr City', 'Rehab', 'Madinaty']);
    const leaves = await mount({ keeps: 'leaves' });
    (leaves.row('Cairo').querySelector('.fd-tree-twist') as HTMLElement).click();
    leaves.row('Nasr City').click();
    expect(leaves.held()).toEqual(['District 7', 'District 8']);
  });

  it('reads a value: a branch held ticks all under it, folded, those part-ticked opened; a record it does not show is kept', async () => {
    const { row, held, form } = await mount({ keeps: 'top' }, [{ id: 2, label: 'Nasr City' }, { id: 99, label: 'Somewhere else' }]);
    expect(row('Nasr City').getAttribute('aria-checked')).toBe('true');
    expect(row('Nasr City').getAttribute('aria-expanded')).toBe('false');
    expect(row('Cairo').getAttribute('aria-checked')).toBe('mixed');
    expect(row('Cairo').getAttribute('aria-expanded')).toBe('true');
    (row('Giza').querySelector('.fd-tree-twist') as HTMLElement).click();
    row('Sheikh Zayed').click();
    expect(held()).toEqual(['Nasr City', 'Sheikh Zayed', 'Somewhere else']);
    expect((form.getState().values['areas'] as RelatedRecord[]).length).toBe(3);
  });

  it('is searched, the rows found shown with the branches they are in; the count of those chosen said', async () => {
    const { host, names, row, held } = await mount();
    const search = host.querySelector('.fd-tree-search') as HTMLInputElement;
    expect(search.getAttribute('aria-label')).toBe('Search Areas wanted');
    search.value = 'rehab';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(names()).toEqual(['Cairo', 'New Cairo', 'Rehab']);
    row('Rehab').click();
    expect(held()).toEqual(['Rehab']);
    expect(host.querySelector('.fd-tree-count')?.textContent).toBe('1 chosen');
    search.value = 'nothing like it';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect((host.querySelector('.fd-tree-empty') as HTMLElement).hidden).toBe(false);
  });

  it('is moved by the keys of a tree and ticked with Space, right to left too', async () => {
    const { host, row, key, held } = await mount();
    const first = row('Cairo');
    first.focus();
    key(first, 'ArrowRight');
    expect(row('Cairo').getAttribute('aria-expanded')).toBe('true');
    key(document.activeElement as Element, 'ArrowRight');
    expect(document.activeElement).toBe(row('Nasr City'));
    key(document.activeElement as Element, 'ArrowDown');
    expect(document.activeElement).toBe(row('New Cairo'));
    key(document.activeElement as Element, ' ');
    expect(held()).toEqual(['New Cairo', 'Fifth Settlement', 'Rehab', 'Madinaty']);
    key(document.activeElement as Element, 'ArrowLeft');
    expect(document.activeElement).toBe(row('Cairo'));
    key(document.activeElement as Element, 'ArrowLeft');
    expect(row('Cairo').getAttribute('aria-expanded')).toBe('false');
    // Right to left, ← opens and goes in.
    host.setAttribute('dir', 'rtl');
    key(row('Cairo'), 'ArrowLeft');
    expect(row('Cairo').getAttribute('aria-expanded')).toBe('true');
  });
});
