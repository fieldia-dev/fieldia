import type { Line, Page } from '@fieldia/core';
import { datePart, linesPart, type WidgetFactory } from '@fieldia/widgets';
import { openFormDialog } from './dialog';
import { mountViewer, type ViewerHandle } from './viewer';
import { partsFor } from './viewer-parts';

/**
 * A table of lines and a many2many's table of records come in the lines part
 * (parts.ts in @fieldia/widgets): a page that shows one asks for it and is
 * drawn whole once it has come — nothing of it before, so no line is drawn
 * plainly and then moved; a page that shows none never asks for it. This file
 * starts with no part loaded (src/test-parts.ts leaves it so), and its tests
 * run in order: the first sees no part at all.
 */

const fields = {
  name: { type: 'char', label: 'Name' },
  line_ids: {
    type: 'one2many',
    label: 'Order lines',
    relation: 'order.line',
    fields: { product: { type: 'char', label: 'Product' }, quantity: { type: 'integer', label: 'Quantity' }, due: { type: 'date', label: 'Due' } },
  },
  plain_ids: { type: 'one2many', label: 'Steps', relation: 'step', fields: { title: { type: 'char', label: 'Title' } } },
  tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag', fields: { name: { type: 'char', label: 'Name' } } },
};
const page = (...children: unknown[]): Page =>
  ({ fieldia: '0.1', id: 'p', title: 'P', data: { kind: 'record', model: 'order' }, fields, layout: { type: 'sections', id: 's', children } }) as unknown as Page;
const field = (name: string, more: Record<string, unknown> = {}) => ({ type: 'field', id: `f-${name}`, field: name, ...more });
const LINES: Line[] = [
  { key: 'a', values: { title: 'Measure the room' } },
  { key: 'b', values: { title: 'Order the desks' } },
];

let handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles) handle.destroy();
  handles = [];
  document.body.replaceChildren();
});

describe('the lines part', () => {
  it('is asked for by a page with a table of lines or of a many2many’s records, and by no other', () => {
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(partsFor(page(field('plain_ids')))).toEqual([linesPart]);
    expect(partsFor(page(field('tag_ids', { columns: ['name'] })))).toEqual([linesPart]);
    expect(partsFor(page(field('tag_ids', { widget: 'table', columns: ['name'] })))).toEqual([linesPart]);
    // A table inside a group, a tab or a page's steps: wherever the page names it.
    expect(partsFor(page({ type: 'section', id: 'g', title: 'Lines', children: [field('plain_ids')] }))).toEqual([linesPart]);
    // None: a page without one, a one2many as cards, a many2many as tags, the app's own table (a grid).
    expect(partsFor(page(field('name')))).toEqual([]);
    expect(partsFor(page(field('plain_ids', { widget: 'cards' })))).toEqual([]);
    expect(partsFor(page(field('tag_ids')))).toEqual([]);
    expect(partsFor(page(field('plain_ids', { widget: 'grid' })), { 'one2many.grid': own })).toEqual([]);
    expect(partsFor(page(field('plain_ids')), { one2many: own })).toEqual([]);
  });

  it('a page without one is drawn at once and never asks for it', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const handle = mountViewer(host, { page: page(field('name'), field('plain_ids', { widget: 'cards' })) });
    handles.push(handle);
    expect(host.querySelector('[data-node="f-name"]')).not.toBeNull();
    await handle.drawn;
    expect(linesPart.loaded).toBeUndefined();
  });

  it('a page with one: nothing of it drawn, its element busy, until the part has come; then its table, its lines in it, typed into at once', async () => {
    expect(linesPart.loaded).toBeUndefined();
    const host = document.createElement('div');
    document.body.append(host);
    const handle = mountViewer(host, { page: page(field('name'), field('plain_ids')), values: { name: 'Office', plain_ids: LINES } as never });
    handles.push(handle);
    expect(handle.element.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('[data-node]')).toBeNull();
    await handle.drawn;
    expect(linesPart.loaded).toBeDefined();
    expect(handle.element.hasAttribute('aria-busy')).toBe(false);
    // Never its plain words: the table at once, its sheet in the page.
    expect(host.querySelector('.fd-lines-plain')).toBeNull();
    const rows = [...host.querySelectorAll('[data-node="f-plain_ids"] tbody tr')] as HTMLElement[];
    expect(rows.map((row) => row.dataset['line'])).toEqual(['a', 'b']);
    expect(document.getElementById('fieldia-lines-styles')).not.toBeNull();
    const title = rows[1].querySelector('td[data-column="title"] input') as HTMLInputElement;
    title.focus();
    title.value = 'Order six desks';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    title.blur();
    expect((handle.form.getState().values['plain_ids'] as Line[])[1].values['title']).toBe('Order six desks');
  });

  it('a line’s columns ask for their own parts with it: a date column, the date part', () => {
    expect(partsFor(page(field('line_ids')))).toEqual([linesPart, datePart]);
  });

  it('a dialog whose page has a table opens with its table drawn whole', async () => {
    const opened = openFormDialog({ page: page(field('plain_ids')), title: 'Steps', mode: 'values', values: { plain_ids: LINES } as never });
    // The part is in by now (the page above brought it): the box is there at once, its table in it.
    const box = document.querySelector('.fd-form-dialog') as HTMLElement;
    expect(box.querySelectorAll('[data-node="f-plain_ids"] tbody tr')).toHaveLength(2);
    expect(box.querySelector('.fd-lines-plain')).toBeNull();
    (box.querySelector('.fd-dialog-close') as HTMLElement).click();
    await opened;
  });
});
