import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { SearchRequest } from './data-source';
import type { Page } from '../format/page';

/**
 * A link's record found by a code a scanner read (`SearchOptions.field`): the records whose field holds the code
 * exactly, asked of the source's search through its filter — the field's own filter kept, the query empty — whatever
 * their names; a line's link the same way.
 */
describe('a search by a code', () => {
  const page = {
    fieldia: '0.9',
    id: 'p',
    data: { kind: 'record', model: 'treatment' },
    fields: {
      product_id: { type: 'many2one', label: 'Product', relation: 'product', filter: [{ field: 'active', op: '=', value: true }] },
      line_ids: { type: 'one2many', label: 'Lines', relation: 'line', fields: { product_id: { type: 'many2one', label: 'Product', relation: 'product' } } },
    },
    layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'a', field: 'product_id' }, { type: 'field', id: 'b', field: 'line_ids' }] },
  } as unknown as Page;
  const products = { 1: { name: 'Hand cream 50 ml', barcode: '6224000123451', active: true }, 2: { name: 'Lip balm', barcode: '6224000123468', active: true }, 3: { name: 'Old lip balm', barcode: '6224000123475', active: false } };

  it('asks for the records whose field holds it, the field’s own filter kept', async () => {
    const source = createMemoryDataSource({ records: { product: products } });
    const asked: SearchRequest[] = [];
    const search = source.search!.bind(source);
    source.search = (request) => (asked.push(request), search(request));
    const form = createForm({ page, dataSource: source });
    expect(await form.search('product_id', '6224000123468', 2, { field: 'barcode' })).toEqual([{ id: 2, label: 'Lip balm' }]);
    expect(asked[0]).toEqual({ model: 'product', query: '', filter: [{ field: 'active', op: '=', value: true }, { field: 'barcode', op: '=', value: '6224000123468' }], limit: 2 });
    expect(await form.search('product_id', '6224000123475', 2, { field: 'barcode' })).toEqual([]);
    expect(await form.search('product_id', '622400012346', 2, { field: 'barcode' })).toEqual([]);
  });

  it("finds a line's link the same way, a line not added yet too", async () => {
    const form = createForm({ page, dataSource: createMemoryDataSource({ records: { product: products } }) });
    expect(await form.searchLine('line_ids', null, 'product_id', '6224000123475', 2, { field: 'barcode' })).toEqual([{ id: 3, label: 'Old lip balm' }]);
  });
});
