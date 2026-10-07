import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createMemoryDataSource } from './memory-data-source';
import { createForm } from './form';
import type { Line } from './values';

/**
 * A table's lines in an order of their own fields, as Flectra's list
 * default_order: a manufacturing order's components by is_done, then
 * manual_consumption descending, then sequence — as they load.
 */
const order = {
  fieldia: '0.1',
  id: 'mo',
  title: 'Manufacturing order',
  data: { kind: 'record', model: 'mrp.production' },
  fields: {
    name: { type: 'char', label: 'Reference' },
    move_raw_ids: {
      type: 'one2many',
      label: 'Components',
      relation: 'stock.move',
      sequenceField: 'sequence',
      fields: {
        sequence: { type: 'integer', label: 'Sequence' },
        product_id: { type: 'many2one', label: 'Product', relation: 'product.product' },
        is_done: { type: 'boolean', label: 'Done' },
        manual_consumption: { type: 'boolean', label: 'Manual' },
      },
    },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      {
        type: 'field',
        id: 'f-components',
        field: 'move_raw_ids',
        order: [{ field: 'is_done' }, { field: 'manual_consumption', desc: true }, { field: 'sequence' }],
      },
    ],
  },
} as unknown as Page;

const moves = (): Line[] => [
  { key: 'glue', id: 1, values: { sequence: 1, product_id: { id: 11, label: 'Glue' }, is_done: true, manual_consumption: false } },
  { key: 'legs', id: 2, values: { sequence: 2, product_id: { id: 12, label: 'Legs' }, is_done: false, manual_consumption: false } },
  { key: 'top', id: 3, values: { sequence: 3, product_id: { id: 13, label: 'Top' }, is_done: false, manual_consumption: true } },
  { key: 'screws', id: 4, values: { sequence: 0, product_id: { id: 14, label: 'Screws' }, is_done: false, manual_consumption: false } },
];
const keys = (form: ReturnType<typeof createForm>) => ((form.getState().values['move_raw_ids'] as Line[]) ?? []).map((line) => line.key);

describe('a table’s lines in an order of their own fields', () => {
  it('puts them in that order as they load, the first field first, desc turned round', async () => {
    expect(validatePage(order)).toMatchObject({ ok: true });
    const dataSource = createMemoryDataSource({ records: { 'mrp.production': { '1': { name: 'MO/0001', move_raw_ids: moves() } } } } as never);
    const form = createForm({ page: order, dataSource, recordId: 1 });
    await form.load();
    expect(keys(form)).toEqual(['top', 'screws', 'legs', 'glue']);
    // Loaded in order is no change.
    expect(form.getState().dirty).toEqual([]);
  });

  it('orders the lines a new record is given too', () => {
    expect(keys(createForm({ page: order, values: { move_raw_ids: moves() } as never }))).toEqual(['top', 'screws', 'legs', 'glue']);
  });

  it('leaves a line where a person moved it, and a new one at the end, until the lines load again — a save bringing them back', async () => {
    const dataSource = createMemoryDataSource({ records: { 'mrp.production': { '1': { name: 'MO/0001', move_raw_ids: moves() } } } } as never);
    const form = createForm({ page: order, dataSource, recordId: 1 });
    await form.load();
    form.moveLine('move_raw_ids', 'legs', 0);
    expect(keys(form)).toEqual(['legs', 'top', 'screws', 'glue']);
    const added = form.addLine('move_raw_ids', { is_done: false, manual_consumption: true });
    expect(keys(form).at(-1)).toBe(added);
    expect(keys(form).slice(0, 4)).toEqual(['legs', 'top', 'screws', 'glue']);
    await form.save();
    const product = (form.getState().values['move_raw_ids'] as Line[]).map((line) => (line.values['product_id'] as { label: string } | null)?.label ?? 'new');
    expect(product).toEqual(['Top', 'new', 'Legs', 'Screws', 'Glue']);
  });

  it('is refused for a field the lines lack, or a field that holds no lines', () => {
    const page = JSON.parse(JSON.stringify(order));
    page.layout.children[1].order = [{ field: 'colour' }];
    expect(validatePage(page)).toMatchObject({ ok: false, issues: [{ path: 'layout.children[1].order[0].field', message: '"colour" is not a field of the lines of "move_raw_ids"' }] });
    page.layout.children[1].order = [{ field: 'is_done' }];
    page.layout.children[0].order = [{ field: 'name' }];
    expect(validatePage(page)).toMatchObject({ ok: false, issues: [{ path: 'layout.children[0].order' }] });
  });
});
