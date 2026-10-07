import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import type { DataSource, SearchRequest } from './data-source';

/**
 * Values the app passes in, as Flectra's context: a transfer opened from
 * Receipts restricts its operation types to incoming ones, read as
 * `context.restricted_picking_type_code` — the app's values, never the page's.
 */
const transfer = {
  fieldia: '0.1',
  id: 'transfer',
  title: 'Transfer',
  data: { kind: 'record', model: 'stock.picking' },
  fields: {
    picking_type_id: {
      type: 'many2one',
      label: 'Operation type',
      relation: 'stock.picking.type',
      filter: [{ field: 'code', op: '=?', valueFrom: 'context.restricted_picking_type_code' }],
    },
    move_ids: {
      type: 'one2many',
      label: 'Operations',
      relation: 'stock.move',
      fields: {
        location_id: { type: 'many2one', label: 'From', relation: 'stock.location', filter: [{ field: 'usage', op: '=', valueFrom: 'context.location_usage' }] },
        note: { type: 'char', label: 'Note' },
      },
    },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    children: [
      { type: 'field', id: 'f-type', field: 'picking_type_id', invisible: "context.hide_picking_type" },
      { type: 'field', id: 'f-moves', field: 'move_ids', cells: { note: { readonly: "context.restricted_picking_type_code == 'incoming'" } } },
    ],
  },
} as unknown as Page;

function recording() {
  const asked: SearchRequest[] = [];
  const dataSource: DataSource = { search: async (request) => (asked.push(request), []) };
  return { asked, dataSource };
}

describe('values the app passes in, read as context', () => {
  it('filters a link by them, leaving out a =? the app did not give', async () => {
    expect(validatePage(transfer)).toMatchObject({ ok: true });
    const { asked, dataSource } = recording();
    await createForm({ page: transfer, dataSource, context: { restricted_picking_type_code: 'incoming' } }).search('picking_type_id', '');
    await createForm({ page: transfer, dataSource }).search('picking_type_id', '');
    expect(asked.map((request) => request.filter)).toEqual([[{ field: 'code', op: '=', value: 'incoming' }], []]);
  });

  it('is read by conditions on the record and on a line, and by a line’s link', async () => {
    const { asked, dataSource } = recording();
    const form = createForm({ page: transfer, dataSource, context: { hide_picking_type: true, restricted_picking_type_code: 'incoming', location_usage: 'supplier' }, values: { move_ids: [{ key: 'a', values: { note: null } }] } as never });
    expect(form.node('f-type').invisible).toBe(true);
    expect(form.lineState('f-moves', 'a').cells['note']).toMatchObject({ readonly: true });
    await form.searchLine('move_ids', 'a', 'location_id', '');
    expect(asked[0].filter).toEqual([{ field: 'usage', op: '=', value: 'supplier' }]);
    expect(createForm({ page: transfer }).node('f-type').invisible).toBe(false);
  });

  it('gives way to a field of the page named context', () => {
    const own = JSON.parse(JSON.stringify(transfer));
    own.fields.context = { type: 'char', label: 'Context' };
    own.layout.children[0].invisible = "context == 'x'";
    expect(createForm({ page: own, values: { context: 'x' } as never, context: { x: 1 } }).node('f-type').invisible).toBe(true);
  });
});
